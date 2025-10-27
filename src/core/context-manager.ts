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

export class ContextManager {
  private sdk: typeof SDK.prototype

  constructor(
    private manager: Manager,
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {
    this.sdk = this.initializeSDK()
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

  async createContext(
    userId: string,
    overrides: OverridesMap,
    attributes: ContextAttributes
  ): Promise<ABSmartlyContext> {
    this.logger.debug('Creating ABsmartly context', {
      userId,
      overrides,
      attributes,
    })

    const context = this.sdk.createContext({
      units: {
        user_id: userId,
        session_id: generateSessionId(userId),
      },
    })

    // Apply overrides (QA mode)
    for (const [experimentName, variant] of Object.entries(overrides)) {
      context.override(experimentName, variant)
      this.logger.debug('Applied override', { experimentName, variant })
    }

    // Set context attributes for targeting
    if (Object.keys(attributes).length > 0) {
      context.attributes(attributes)
      this.logger.debug('Set context attributes', attributes)
    }

    // Wait for context to be ready (fetch experiment data)
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

      this.logger.debug('ABsmartly context ready')
    } catch (error) {
      this.logger.error('Failed to create context:', error)
      throw error
    }

    return context
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
          // Use peek() to get treatment without tracking exposure yet
          const treatment = context.peek(experiment.name)

          if (treatment === undefined || treatment < 0) {
            continue // User not eligible for this experiment
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

          // Check if this experiment needs immediate exposure tracking
          // Cross-variant logic: Check ALL variants, not just current variant
          const needsImmediateTracking = this.shouldTrackImmediately(
            experiment,
            changes
          )

          if (trackImmediate && needsImmediateTracking) {
            // Track exposure immediately (this is the correct SDK call!)
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
    // Check if ANY variant has immediate triggers (cross-variant tracking)
    // This prevents Sample Ratio Mismatch (SRM)

    if (!experiment.variants || experiment.variants.length === 0) {
      return true // No variants = immediate tracking
    }

    // Check all variants, not just the current one
    for (const variant of experiment.variants) {
      const changes = variant.config?.domChanges || []

      // If any change has trigger_on_view explicitly false, or undefined (default immediate)
      const hasImmediateTrigger = changes.some(
        (change: DOMChange) =>
          change.trigger_on_view === false ||
          change.trigger_on_view === undefined
      )

      if (hasImmediateTrigger) {
        return true // At least one variant has immediate trigger
      }
    }

    // All variants only have trigger_on_view: true
    return false
  }

  async getOrCreateContext(
    userId: string,
    overrides: OverridesMap = {},
    attributes: ContextAttributes = {}
  ): Promise<ABSmartlyContext> {
    // Try to get cached context
    const cacheKey = `context_${userId}`
    const cached = await this.manager.get(cacheKey)

    if (cached) {
      this.logger.debug('Using cached context', { userId })
      try {
        // Recreate context from cached data
        // createContextWith requires: params, data, options
        return this.sdk.createContextWith(
          {
            units: {
              user_id: userId,
              session_id: generateSessionId(userId),
            },
          },
          cached
        )
      } catch (error) {
        this.logger.warn(
          'Failed to recreate context from cache, creating new',
          error
        )
      }
    }

    // Create new context
    const context = await this.createContext(userId, overrides, attributes)

    // Cache context data
    try {
      const contextData = context.getContextData()
      // manager.set only takes key and value (no options)
      await this.manager.set(cacheKey, contextData)
      this.logger.debug('Cached context', {
        userId,
        ttl: this.settings.CONTEXT_CACHE_TTL,
      })
    } catch (error) {
      this.logger.error('Failed to cache context:', error)
    }

    return context
  }

  async publishContext(context: ABSmartlyContext): Promise<void> {
    try {
      await context.publish()
      this.logger.debug('Published context (exposures and events)')
    } catch (error) {
      this.logger.error('Failed to publish context:', error)
      throw error
    }
  }
}
