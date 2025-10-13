import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
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

    // Register embed for experiment placeholders
    this.manager.registerEmbed('experiment', async ({ client, payload }) => {
      return await this.handleExperimentEmbed(client, payload)
    })

    this.logger.debug('Embeds registered successfully')
  }

  private async handleExperimentEmbed(client: any, payload: any): Promise<string> {
    try {
      const experimentName = payload.get('exp-name')
      const defaultContent = payload.get('default') || ''

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
        this.logger.debug('User not eligible for experiment', { experimentName })
        return defaultContent
      }

      // Get experiment data
      const contextData = context.getData()
      const experiment = contextData.experiments?.find((exp: any) => exp.name === experimentName)

      if (!experiment) {
        this.logger.warn('Experiment not found in context', { experimentName })
        return defaultContent
      }

      const variant = experiment.variants ? experiment.variants[treatment] : null

      if (!variant) {
        this.logger.warn('Variant not found', { experimentName, treatment })
        return defaultContent
      }

      // Return variant HTML
      const html = variant.config?.html || variant.config?.content || defaultContent

      this.logger.debug('Returning variant HTML for embed', {
        experimentName,
        treatment,
        variant: variant.name,
      })

      return html
    } catch (error) {
      this.logger.error('Failed to handle experiment embed:', error)
      return payload.get('default') || ''
    }
  }
}
