import { SDK } from '@absmartly/javascript-sdk'
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
    failureThreshold: 3,
    resetTimeout: 60000,
  }

  constructor(
    private manager: Manager,
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {
    this.sdk = this.initializeSDK()
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
      timeout: this.settings.SDK_TIMEOUT || 2000,
    })

    return sdk
  }

  private startCleanupTask(): void {
    const ttl = this.getContextCacheTTL()
    const cleanupInterval = Math.max(ttl, 60000)

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
    return (
      !!entry &&
      typeof entry === 'object' &&
      'data' in entry &&
      'timestamp' in entry &&
      'ttl' in entry &&
      typeof (entry as any).timestamp === 'number' &&
      typeof (entry as any).ttl === 'number'
    )
  }

  private getContextCacheTTL(): number {
    const ttl = this.settings.CONTEXT_CACHE_TTL
    if (ttl && ttl > 0) {
      return ttl * 1000
    }
    return 300000
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
    attributes: ContextAttributes
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

    const context = this.sdk.createContext({
      units: {
        user_id: userId,
        session_id: generateSessionId(userId),
      },
    }) as unknown as ABSmartlyContext

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

    try {
      await Promise.race([
        context.ready(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Context timeout')),
            this.settings.SDK_TIMEOUT || 2000
          )
        ),
      ])

      this.recordSuccess()
      this.logger.debug('ABsmartly context ready')
    } catch (error) {
      this.recordFailure()
      this.logger.error('Failed to create context:', error)
      throw error
    }

    return context as unknown as ABSmartlyContext
  }

  extractExperimentData(
    context: ABSmartlyContext,
    trackImmediate = true
  ): ExperimentData[] {
    const experiments: ExperimentData[] = []

    try {
      const contextData = context.getData()

      if (!contextData || !contextData.experiments) {
        this.logger.warn('No experiments found in context data')
        return experiments
      }

      for (const experiment of contextData.experiments) {
        try {
          const treatment = context.peek(experiment.name)

          if (treatment === undefined || treatment < 0) {
            continue
          }

          const variant = experiment.variants
            ? experiment.variants[treatment]
            : null

          if (!variant) {
            this.logger.warn('No variant found for treatment', {
              experiment: experiment.name,
              treatment,
            })
            continue
          }

          const changes = variant.config?.domChanges || []

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

          experiments.push({
            name: experiment.name,
            treatment,
            variant: variant.name || `variant_${treatment}`,
            changes,
          })

          this.logger.debug('Extracted experiment', {
            name: experiment.name,
            treatment,
            variant: variant.name,
            changesCount: changes.length,
            immediateTracking: needsImmediateTracking,
          })
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

  private shouldTrackImmediately(
    experiment: ABSmartlyExperiment,
    _currentVariantChanges: DOMChange[]
  ): boolean {
    if (!experiment.variants || experiment.variants.length === 0) {
      return true
    }

    for (const variant of experiment.variants) {
      const changes = variant.config?.domChanges || []

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
            cached.data as any
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
      const context = await this.createContext(userId, overrides, attributes)

      try {
        const contextData = context.getContextData()
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
      throw error
    }
  }

  private createFallbackContext(userId: string): ABSmartlyContext {
    this.logger.info('Creating fallback context (no experiments)', { userId })
    const context = this.sdk.createContext({
      units: {
        user_id: userId,
        session_id: generateSessionId(userId),
      },
    }) as unknown as ABSmartlyContext
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
