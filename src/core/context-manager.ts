import { SDK } from '@absmartly/javascript-sdk'
import type { ContextData } from '@absmartly/javascript-sdk/types/context'
import {
  ABsmartlySettings,
  ContextAttributes,
  OverridesMap,
  ExperimentData,
  ABsmartlyContext,
  ABsmartlyExperiment,
  DOMChange,
  Logger,
} from '../types'
import { getValidatedNumericConfig } from '../utils/config-validator'

interface PublishQueueEntry {
  context: ABsmartlyContext
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

const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3
const DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS = 60000

export class ContextManager {
  private sdk: typeof SDK.prototype
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
    private settings: ABsmartlySettings,
    private logger: Logger,
    sdk?: typeof SDK.prototype
  ) {
    this.sdk = sdk || this.initializeSDK()
  }

  private initializeSDK(): typeof SDK.prototype {
    this.logger.debug('Initializing ABsmartly SDK', {
      endpoint: this.settings.ENDPOINT,
      environment: this.settings.ENVIRONMENT,
      application: this.settings.APPLICATION,
    })

    const sdkTimeout = getValidatedNumericConfig(
      this.settings,
      'SDK_TIMEOUT',
      this.logger
    )

    const sdk = new SDK({
      endpoint: this.settings.ENDPOINT,
      apiKey: this.settings.SDK_API_KEY,
      environment: this.settings.ENVIRONMENT,
      application: this.settings.APPLICATION,
      retries: 1,
      timeout: sdkTimeout,
    })

    return sdk
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
    if (this.circuitBreakerResetTimer) {
      clearTimeout(this.circuitBreakerResetTimer)
      this.circuitBreakerResetTimer = null
    }
  }

  async createContext(
    userId: string,
    overrides: OverridesMap,
    attributes: ContextAttributes,
    contextData: ContextData
  ): Promise<ABsmartlyContext> {
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker is OPEN, skipping SDK call', {
        userId,
      })
      throw new Error('Circuit breaker is open - ABsmartly SDK unavailable')
    }

    const unitType = this.settings.UNIT_TYPE || 'user_id'
    const units = {
      [unitType]: userId,
    }

    this.logger.log('Creating ABsmartly context', {
      userId,
      unitType,
      units,
      overrides,
      attributes,
      hasContextData: !!contextData,
      contextDataExperiments: contextData?.experiments?.length || 0,
      circuitState: this.circuitBreakerState,
    })

    const context = this.sdk.createContextWith(
      {
        units,
      },
      contextData
    ) as unknown as ABsmartlyContext

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

    return context as unknown as ABsmartlyContext
  }

  private extractSingleExperiment(
    context: ABsmartlyContext,
    experiment: ABsmartlyExperiment,
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
    context: ABsmartlyContext,
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

    if (typeof config === 'object' && config !== null) {
      return config as { domChanges?: DOMChange[] }
    }

    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config)
        return parsed || {}
      } catch (error) {
        this.logger.error(
          '[ABsmartly MC] Failed to parse variant.config JSON',
          {
            error: error instanceof Error ? error.message : String(error),
            config: config.substring(0, 100),
          }
        )
        return {}
      }
    }

    this.logger.warn('[ABsmartly MC] Unexpected variant.config type', {
      type: typeof config,
    })
    return {}
  }

  private shouldTrackImmediately(
    experiment: ABsmartlyExperiment,
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
  ): Promise<ABsmartlyContext> {
    const perfStart = Date.now()

    try {
      const apiUrl = `${this.settings.ENDPOINT}/context?application=${this.settings.APPLICATION}&environment=${this.settings.ENVIRONMENT}`

      this.logger.log('Fetching context from ABsmartly API', {
        url: apiUrl,
        userId,
      })

      const sdkFetchStart = Date.now()
      const contextData = await this.sdk.getContextData({ path: '' })
      const sdkFetchTime = Date.now() - sdkFetchStart

      const contextCreateStart = Date.now()
      const context = await this.createContext(
        userId,
        overrides,
        attributes,
        contextData
      )
      const contextCreateTime = Date.now() - contextCreateStart
      const totalTime = Date.now() - perfStart

      this.logger.log('Context data fetched from ABsmartly API', {
        userId,
        url: apiUrl,
        totalTime: `${totalTime}ms`,
        breakdown: {
          sdkFetch: `${sdkFetchTime}ms`,
          contextCreate: `${contextCreateTime}ms`,
        },
        experimentsCount: contextData?.experiments?.length || 0,
      })

      return context
    } catch (error) {
      this.recordFailure()
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

  private createFallbackContext(userId: string): ABsmartlyContext {
    this.logger.info('Creating fallback context (no experiments)', { userId })
    const unitType = this.settings.UNIT_TYPE || 'user_id'
    const context = this.sdk.createContextWith(
      {
        units: {
          [unitType]: userId,
        },
      },
      { experiments: [] }
    ) as unknown as ABsmartlyContext
    return context
  }

  async publishContext(context: ABsmartlyContext): Promise<void> {
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
