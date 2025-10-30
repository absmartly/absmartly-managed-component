import { SDK } from '@absmartly/javascript-sdk'
import type { ContextData } from '@absmartly/javascript-sdk/types/context'
import { Manager } from '@managed-components/types'
import {
  ABSmartlySettings,
  ContextAttributes,
  OverridesMap,
  ExperimentData,
  ABSmartlyContext,
  ABSmartlyExperiment,
  DOMChange,
  Logger,
} from '../types'
import { generateSessionId } from '../utils/serializer'

interface CachedContextEntry {
  data: unknown
  timestamp: number
  ttl: number
}

interface PublishQueueEntry {
  context: ABSmartlyContext
  resolve: () => void
  reject: (error: Error) => void
}

enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
}

const DEFAULT_SDK_TIMEOUT_MS = 2000
const DEFAULT_CACHE_TTL_MS = 300000
const MIN_CLEANUP_INTERVAL_MS = 60000
const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3
const DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS = 60000

export class ContextManager {
  private sdk: typeof SDK.prototype
  private contextCache = new Map<string, CachedContextEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null
  private publishQueue: PublishQueueEntry[] = []
  private isPublishing = false
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED
  private consecutiveFailures = 0
  private circuitBreakerResetTimer: NodeJS.Timeout | null = null
  private circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    resetTimeout: DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
  }

  constructor(
    private manager: Manager,
    private settings: ABSmartlySettings,
    private logger: Logger,
    sdk?: typeof SDK.prototype
  ) {
    this.sdk = sdk || this.initializeSDK()
    this.startCleanupTask()
  }

  private initializeSDK(): typeof SDK.prototype {
    this.logger.debug('Initializing ABsmartly SDK', {
      endpoint: this.settings.ABSMARTLY_ENDPOINT,
      environment: this.settings.ABSMARTLY_ENVIRONMENT,
      application: this.settings.ABSMARTLY_APPLICATION,
    })

    const sdk = new SDK({
      endpoint: this.settings.ABSMARTLY_ENDPOINT,
      apiKey: this.settings.ABSMARTLY_API_KEY,
      environment: this.settings.ABSMARTLY_ENVIRONMENT,
      application: this.settings.ABSMARTLY_APPLICATION,
      retries: 1,
      timeout: this.settings.SDK_TIMEOUT || DEFAULT_SDK_TIMEOUT_MS,
    })

    return sdk
  }

  private startCleanupTask(): void {
    const ttl = this.getContextCacheTTL()
    const cleanupInterval = Math.max(ttl, MIN_CLEANUP_INTERVAL_MS)

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredCaches()
    }, cleanupInterval)

    this.logger.debug('Started cache cleanup task', {
      ttl,
      cleanupInterval,
    })
  }

  private async cleanupExpiredCaches(): Promise<void> {
    try {
      const now = Date.now()
      let removedCount = 0

      for (const [key, entry] of this.contextCache.entries()) {
        const expirationTime = entry.timestamp + entry.ttl
        if (now >= expirationTime) {
          this.contextCache.delete(key)
          await this.manager.set(key, null)
          removedCount++
          this.logger.debug('Cleaned up expired cache entry', { key })
        }
      }

      this.logger.debug('Cleanup complete', {
        removed: removedCount,
        remaining: this.contextCache.size,
      })
    } catch (error) {
      this.logger.error('Failed to cleanup expired caches:', error)
    }
  }

  private isValidCacheEntry(entry: unknown): entry is CachedContextEntry {
    if (!entry || typeof entry !== 'object') {
      return false
    }

    const obj = entry as Record<string, unknown>
    return (
      'data' in obj &&
      'timestamp' in obj &&
      'ttl' in obj &&
      typeof obj.timestamp === 'number' &&
      typeof obj.ttl === 'number'
    )
  }

  private getContextCacheTTL(): number {
    const ttl = this.settings.CONTEXT_CACHE_TTL
    if (ttl && ttl > 0) {
      return ttl * 1000
    }
    return DEFAULT_CACHE_TTL_MS
  }

  private recordSuccess(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.logger.info('Circuit breaker test succeeded, closing circuit')
      this.circuitBreakerState = CircuitBreakerState.CLOSED
    }
    this.consecutiveFailures = 0
  }

  private recordFailure(): void {
    this.consecutiveFailures++
    this.logger.warn('SDK call failed', {
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.circuitBreakerConfig.failureThreshold,
    })

    if (
      this.consecutiveFailures >= this.circuitBreakerConfig.failureThreshold &&
      this.circuitBreakerState === CircuitBreakerState.CLOSED
    ) {
      this.openCircuit()
    }
  }

  private openCircuit(): void {
    this.circuitBreakerState = CircuitBreakerState.OPEN
    this.logger.error(
      'Circuit breaker OPEN - falling back to original content',
      {
        consecutiveFailures: this.consecutiveFailures,
      }
    )

    if (this.circuitBreakerResetTimer) {
      clearTimeout(this.circuitBreakerResetTimer)
    }

    this.circuitBreakerResetTimer = setTimeout(() => {
      this.circuitBreakerState = CircuitBreakerState.HALF_OPEN
      this.logger.info('Circuit breaker HALF_OPEN - testing SDK availability')
    }, this.circuitBreakerConfig.resetTimeout)
  }

  private isCircuitOpen(): boolean {
    return this.circuitBreakerState === CircuitBreakerState.OPEN
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      this.logger.debug('Stopped cache cleanup task')
    }

    if (this.circuitBreakerResetTimer) {
      clearTimeout(this.circuitBreakerResetTimer)
      this.circuitBreakerResetTimer = null
    }

    this.contextCache.clear()
  }

  async createContext(
    userId: string,
    overrides: OverridesMap,
    attributes: ContextAttributes,
    contextData: ContextData
  ): Promise<ABSmartlyContext> {
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker is OPEN, skipping SDK call', {
        userId,
      })
      throw new Error('Circuit breaker is open - ABSmartly SDK unavailable')
    }

    this.logger.debug('Creating ABsmartly context', {
      userId,
      overrides,
      attributes,
      circuitState: this.circuitBreakerState,
    })

    const context = this.sdk.createContextWith(
      {
        units: {
          user_id: userId,
          session_id: generateSessionId(userId),
        },
      },
      contextData
    ) as unknown as ABSmartlyContext

    if (Object.keys(overrides).length > 0) {
      for (const [experimentName, variant] of Object.entries(overrides)) {
        context.override(experimentName, variant)
      }
      this.logger.debug('Applied overrides', { overrides })
    }

    if (Object.keys(attributes).length > 0) {
      context.attributes(attributes)
      this.logger.debug('Set context attributes', attributes)
    }

    this.recordSuccess()
    this.logger.debug('ABsmartly context ready with provided data')

    return context as unknown as ABSmartlyContext
  }

  private extractSingleExperiment(
    context: ABSmartlyContext,
    experiment: ABSmartlyExperiment,
    trackImmediate: boolean
  ): ExperimentData | null {
    const treatment = context.peek(experiment.name)

    if (treatment === undefined || treatment < 0) {
      return null
    }

    const variant = experiment.variants?.[treatment] ?? null

    if (!variant) {
      this.logger.warn('No variant found for treatment', {
        experiment: experiment.name,
        treatment,
      })
      return null
    }

    const parsedConfig = this.parseVariantConfig(variant.config)
    const changes = parsedConfig.domChanges || []

    const needsImmediateTracking = this.shouldTrackImmediately(
      experiment,
      changes
    )

    if (trackImmediate && needsImmediateTracking) {
      context.treatment(experiment.name)
      this.logger.debug('Tracked immediate exposure', {
        experiment: experiment.name,
      })
    }

    this.logger.debug('Extracted experiment', {
      name: experiment.name,
      treatment,
      variant: variant.name,
      changesCount: changes.length,
      immediateTracking: needsImmediateTracking,
    })

    return {
      name: experiment.name,
      treatment,
      variant: variant.name || `variant_${treatment}`,
      changes,
    }
  }

  extractExperimentData(
    context: ABSmartlyContext,
    trackImmediate = true
  ): ExperimentData[] {
    const experiments: ExperimentData[] = []

    try {
      const contextData = context.data()

      if (!contextData?.experiments) {
        this.logger.warn('No experiments found in context data')
        return experiments
      }

      for (const experiment of contextData.experiments) {
        try {
          const experimentData = this.extractSingleExperiment(
            context,
            experiment,
            trackImmediate
          )

          if (experimentData) {
            experiments.push(experimentData)
          }
        } catch (error) {
          this.logger.error('Failed to extract experiment', {
            experiment: experiment.name,
            error,
          })
        }
      }
    } catch (error) {
      this.logger.error('Failed to extract experiment data:', error)
    }

    return experiments
  }

  /**
   * Safely parses variant.config which can be either a JSON string or an already parsed object
   * @param config - The variant config (string or object)
   * @returns The parsed config object or an empty object if parsing fails
   */
  private parseVariantConfig(config: unknown): { domChanges?: DOMChange[] } {
    if (!config) {
      return {}
    }

    // If config is already an object, return it
    if (typeof config === 'object' && config !== null) {
      return config as { domChanges?: DOMChange[] }
    }

    // If config is a string, try to parse it
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config)
        return parsed || {}
      } catch (error) {
        this.logger.error(
          '[ABSmartly MC] Failed to parse variant.config JSON',
          {
            error: error instanceof Error ? error.message : String(error),
            config: config.substring(0, 100), // Log first 100 chars for debugging
          }
        )
        return {}
      }
    }

    // Unexpected type
    this.logger.warn('[ABSmartly MC] Unexpected variant.config type', {
      type: typeof config,
    })
    return {}
  }

  private shouldTrackImmediately(
    experiment: ABSmartlyExperiment,
    _currentVariantChanges: DOMChange[]
  ): boolean {
    if (!experiment.variants || experiment.variants.length === 0) {
      return true
    }

    for (const variant of experiment.variants) {
      const parsedConfig = this.parseVariantConfig(variant.config)
      const changes = parsedConfig.domChanges || []

      const hasImmediateTrigger = changes.some(
        (change: DOMChange) =>
          change.trigger_on_view === false ||
          change.trigger_on_view === undefined
      )

      if (hasImmediateTrigger) {
        return true
      }
    }

    return false
  }

  async getOrCreateContext(
    userId: string,
    overrides: OverridesMap = {},
    attributes: ContextAttributes = {}
  ): Promise<ABSmartlyContext> {
    const cacheKey = `context_${userId}`

    const cached = this.contextCache.get(cacheKey)

    if (cached) {
      const now = Date.now()
      const expirationTime = cached.timestamp + cached.ttl

      if (now < expirationTime) {
        this.logger.debug('Using cached context', {
          userId,
          age: Math.round((now - cached.timestamp) / 1000),
          ttl: Math.round(cached.ttl / 1000),
        })

        try {
          return this.sdk.createContextWith(
            {
              units: {
                user_id: userId,
                session_id: generateSessionId(userId),
              },
            },
            cached.data as ContextData
          ) as unknown as ABSmartlyContext
        } catch (error) {
          this.logger.warn(
            'Failed to recreate context from cache, creating new',
            error
          )
          this.contextCache.delete(cacheKey)
        }
      } else {
        this.logger.debug('Cache expired, creating new context', { userId })
        this.contextCache.delete(cacheKey)
      }
    }

    try {
      const contextData = await this.sdk.getContextData({ path: '' })
      const context = await this.createContext(
        userId,
        overrides,
        attributes,
        contextData
      )

      try {
        const ttl = this.getContextCacheTTL()
        const cacheEntry: CachedContextEntry = {
          data: contextData,
          timestamp: Date.now(),
          ttl,
        }

        this.contextCache.set(cacheKey, cacheEntry)
        await this.manager.set(cacheKey, cacheEntry)

        this.logger.debug('Cached context', {
          userId,
          ttl: Math.round(ttl / 1000),
        })
      } catch (error) {
        this.logger.error('Failed to cache context:', error)
      }

      return context
    } catch (error) {
      if (this.isCircuitOpen()) {
        this.logger.warn('Returning fallback context due to circuit breaker', {
          userId,
        })
        return this.createFallbackContext(userId)
      }
      this.logger.error('Failed to fetch context data:', error)
      return this.createFallbackContext(userId)
    }
  }

  private createFallbackContext(userId: string): ABSmartlyContext {
    this.logger.info('Creating fallback context (no experiments)', { userId })
    const context = this.sdk.createContextWith(
      {
        units: {
          user_id: userId,
          session_id: generateSessionId(userId),
        },
      },
      { experiments: [] }
    ) as unknown as ABSmartlyContext
    return context
  }

  async publishContext(context: ABSmartlyContext): Promise<void> {
    return new Promise((resolve, reject) => {
      this.publishQueue.push({ context, resolve, reject })
      this.logger.debug('Queued context for publishing', {
        queueLength: this.publishQueue.length,
      })
      this.processPublishQueue()
    })
  }

  private async processPublishQueue(): Promise<void> {
    if (this.isPublishing || this.publishQueue.length === 0) {
      return
    }

    this.isPublishing = true

    while (this.publishQueue.length > 0) {
      const entry = this.publishQueue.shift()
      if (!entry) break

      try {
        this.logger.debug('Publishing context', {
          remaining: this.publishQueue.length,
        })
        await entry.context.publish()
        this.logger.debug('Published context (exposures and events)')
        entry.resolve()
      } catch (error) {
        this.logger.error('Failed to publish context:', error)
        entry.reject(error as Error)
      }
    }

    this.isPublishing = false
  }
}
