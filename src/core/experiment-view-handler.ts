import { MCEvent } from '@managed-components/types'
import { ContextManager } from './context-manager'
import { CookieHandler } from './cookie-handler'
import { OverridesHandler } from './overrides-handler'
import { Logger } from '../types'

/**
 * Shared ExperimentView tracking handler for both Zaraz and WebCM modes
 * Handles on-view exposure tracking when elements enter the viewport
 */
export class ExperimentViewHandler {
  constructor(
    private contextManager: ContextManager,
    private cookieHandler: CookieHandler,
    private overridesHandler: OverridesHandler,
    private logger: Logger
  ) {}

  async handleExperimentView(
    event: MCEvent,
    experimentName: string
  ): Promise<void> {
    try {
      this.logger.debug('ExperimentView event received', { experimentName })

      // Get user ID
      const userId = this.cookieHandler.getUserId(event.client)

      // Get overrides
      const overrides = this.overridesHandler.getOverrides(event)

      // Get or create context
      const context = await this.contextManager.getOrCreateContext(
        userId,
        overrides,
        {
          url: event.client.url.toString(),
          userAgent: event.client.userAgent,
          ip: event.client.ip,
        }
      )

      // Trigger exposure by calling treatment
      context.treatment(experimentName)

      // Publish exposure
      await this.contextManager.publishContext(context)

      this.logger.debug('Exposure tracked for experiment', { experimentName })
    } catch (error) {
      this.logger.error('ExperimentView tracking error:', error)
      throw error
    }
  }
}
