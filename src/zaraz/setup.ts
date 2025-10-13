import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { OverridesHandler } from '../core/overrides-handler'
import { EventTracker } from '../core/event-tracker'
import { ClientInjector } from './client-injector'
import { EmbedHandler } from './embed-handler'
import { createLogger } from '../utils/logger'
import { Logger } from '../types'

export function setupZarazMode(manager: Manager, settings: ABSmartlySettings): void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - Zaraz mode')

  // Initialize core components
  const contextManager = new ContextManager(manager, settings, logger)
  const cookieHandler = new CookieHandler(settings)
  const overridesHandler = new OverridesHandler()
  const eventTracker = new EventTracker(manager, contextManager, cookieHandler, settings, logger)
  const clientInjector = new ClientInjector(settings, logger)
  const embedHandler = new EmbedHandler(manager, contextManager, cookieHandler, settings, logger)

  // Set up embeds
  embedHandler.setup()

  // Handle pageview events - main experiment delivery
  manager.addEventListener('pageview', async (event: MCEvent) => {
    try {
      logger.debug('Pageview event received', { url: event.client.url })

      // 1. Get or create user ID
      const userId = cookieHandler.getUserId(event.client)
      logger.debug('User ID', { userId })

      // 2. Store UTM params and landing page (first visit)
      cookieHandler.storeUTMParams(event.client)
      cookieHandler.storeLandingPage(event.client)

      // 3. Check for overrides (QA mode)
      const overrides = overridesHandler.getOverrides(event)
      if (overridesHandler.hasOverrides(overrides)) {
        logger.debug('Overrides detected', { overrides })
      }

      // 4. Create context on edge (FAST!)
      const context = await contextManager.createContext(userId, overrides, {
        url: event.client.url,
        userAgent: event.client.userAgent,
        ip: event.client.ip,
      })

      // 5. Extract experiment data and treatments
      const experimentData = contextManager.extractExperimentData(context)
      logger.debug('Experiments extracted', {
        count: experimentData.length,
        experiments: experimentData.map((e) => ({ name: e.name, treatment: e.treatment })),
      })

      // 6. Inject debug info if enabled
      if (settings.ENABLE_DEBUG) {
        clientInjector.injectDebugInfo(event, { experiments: experimentData })
      }

      // 7. Inject client code
      clientInjector.injectExperimentCode(event, { experiments: experimentData })

      // 8. Track exposures immediately (context is short-lived on edge)
      await contextManager.publishContext(context)
      logger.debug('Exposures published')
    } catch (error) {
      logger.error('Pageview handler error:', error)

      // Graceful degradation - inject failsafe to reveal page
      clientInjector.injectFailsafe(event)
    }
  })

  // Handle custom events (goals) and exposure tracking
  manager.addEventListener('track', async (event: MCEvent) => {
    try {
      const eventName = event.payload?.name || event.payload?.goal_name
      logger.debug('Track event received', { name: eventName })

      // Handle ExperimentView events for on-view exposure tracking
      if (eventName === 'ExperimentView') {
        const experimentName = event.payload?.experimentName
        if (experimentName) {
          logger.debug('ExperimentView event received', { experimentName })

          // Get user ID
          const userId = cookieHandler.getUserId(event.client)

          // Get overrides
          const overrides = overridesHandler.getOverrides(event)

          // Get or create context
          const context = await contextManager.getOrCreateContext(userId, overrides, {
            url: event.client.url,
            userAgent: event.client.userAgent,
            ip: event.client.ip,
          })

          // Trigger exposure by calling treatment
          context.treatment(experimentName)

          // Publish exposure
          await contextManager.publishContext(context)

          logger.debug('Exposure tracked for experiment', { experimentName })
        }
      } else {
        // Regular goal tracking
        await eventTracker.trackGoal(event)
      }
    } catch (error) {
      logger.error('Track event error:', error)
    }
  })

  // Handle generic events
  manager.addEventListener('event', async (event: MCEvent) => {
    try {
      logger.debug('Event received', { type: event.type })
      await eventTracker.trackEvent(event)
    } catch (error) {
      logger.error('Event error:', error)
    }
  })

  // Handle ecommerce events
  manager.addEventListener('ecommerce', async (event: MCEvent) => {
    try {
      logger.debug('Ecommerce event received', { type: event.payload?.type })
      await eventTracker.trackEcommerce(event)
    } catch (error) {
      logger.error('Ecommerce event error:', error)
    }
  })

  logger.log('ABsmartly Managed Component - Zaraz mode initialized successfully')
}
