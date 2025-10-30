import { Manager, Client } from '@managed-components/types'
import { ABSmartlySettings, ABSmartlyExperiment } from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { Logger } from '../types'

export class EmbedHandler {
  constructor(
    private manager: Manager,
    private contextManager: ContextManager,
    private cookieHandler: CookieHandler,
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  setup(): void {
    if (!this.settings.ENABLE_EMBEDS) {
      this.logger.debug('Embeds disabled, skipping setup')
      return
    }

    this.logger.debug('Setting up ABsmartly embeds')

    // Register embed for {{experiment ...}} placeholders (Zaraz standard format)
    this.manager.registerEmbed('experiment', async ({ client, parameters }) => {
      return await this.handleExperimentEmbed(client, parameters)
    })

    // Note: Treatment/TreatmentVariant HTML tags are handled via request interception
    // in setup.ts, not through the embed system

    this.logger.debug('Embeds registered successfully')
  }

  private async handleExperimentEmbed(
    client: Client,
    parameters: { [k: string]: unknown }
  ): Promise<string> {
    try {
      const experimentName = parameters['exp-name'] as string
      const defaultContent = (parameters['default'] as string) || ''

      if (!experimentName) {
        this.logger.warn('No experiment name provided for embed')
        return defaultContent
      }

      this.logger.debug('Handling experiment embed', { experimentName })

      // Get user ID
      const userId = this.cookieHandler.getUserId(client)

      // Get or create context
      const context = await this.contextManager.getOrCreateContext(userId)

      // Get treatment for this experiment
      const treatment = context.treatment(experimentName)

      if (treatment === undefined || treatment < 0) {
        // User not eligible or experiment not running
        this.logger.debug('User not eligible for experiment', {
          experimentName,
        })
        return defaultContent
      }

      // Get experiment data
      const contextData = context.getData()
      const experiment = contextData.experiments?.find(
        (exp: ABSmartlyExperiment) => exp.name === experimentName
      )

      if (!experiment) {
        this.logger.warn('Experiment not found in context', { experimentName })
        return defaultContent
      }

      const variant = experiment.variants
        ? experiment.variants[treatment]
        : null

      if (!variant) {
        this.logger.warn('Variant not found', { experimentName, treatment })
        return defaultContent
      }

      // Parse variant.config from JSON string to object if needed
      const parsedConfig = this.parseVariantConfig(variant.config)

      // Return variant HTML - ensure we only use string values
      const htmlValue = parsedConfig?.html
      const contentValue = parsedConfig?.content
      const html =
        (typeof htmlValue === 'string' ? htmlValue : null) ||
        (typeof contentValue === 'string' ? contentValue : null) ||
        defaultContent

      this.logger.debug('Returning variant HTML for embed', {
        experimentName,
        treatment,
        variant: variant.name,
      })

      return html
    } catch (error) {
      this.logger.error('Failed to handle experiment embed:', error)
      return ''
    }
  }

  /**
   * Safely parses variant.config which can be either a JSON string or an already parsed object
   * @param config - The variant config (string or object)
   * @returns The parsed config object or an empty object if parsing fails
   */
  private parseVariantConfig(config: unknown): {
    html?: string
    content?: string
  } {
    if (!config) {
      return {}
    }

    // If config is already an object, return it
    if (typeof config === 'object' && config !== null) {
      return config as { html?: string; content?: string }
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
}
