import { Manager, MCEvent, FetchedRequest } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { OverridesHandler } from '../core/overrides-handler'
import { EventTracker } from '../core/event-tracker'
import { ResponseManipulator } from './response-manipulator'
import { createLogger } from '../utils/logger'
import { Logger } from '../types'

export function setupWebCMMode(manager: Manager, settings: ABSmartlySettings): void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - WebCM mode')

  // Initialize core components
  const contextManager = new ContextManager(manager, settings, logger)
  const cookieHandler = new CookieHandler(settings)
  const overridesHandler = new OverridesHandler()
  const eventTracker = new EventTracker(manager, contextManager, cookieHandler, settings, logger)
  const responseManipulator = new ResponseManipulator(settings, logger)

  // Intercept requests to manipulate responses
  manager.addEventListener('request', async (event: MCEvent) => {
    try {
      logger.debug('Request intercepted', { url: event.client.url })

      // Check if URL should be manipulated
      if (!responseManipulator.shouldManipulate(event.client.url)) {
        return
      }

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

      // 4. Create context on edge
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

      // 6. Fetch the original response
      const request = await event.client.fetch(event.client.url)

      // 7. Manipulate response HTML with experiment changes
      const modifiedRequest = await responseManipulator.manipulateResponse(
        request as FetchedRequest,
        experimentData
      )

      // 8. Track exposures immediately (context is short-lived on edge)
      await contextManager.publishContext(context)
      logger.debug('Exposures published')

      // 9. Return modified response
      event.client.return(modifiedRequest)
    } catch (error) {
      logger.error('Request handler error:', error)

      // Graceful degradation - return original response
      try {
        const originalRequest = await event.client.fetch(event.client.url)
        event.client.return(originalRequest)
      } catch (fetchError) {
        logger.error('Failed to fetch original request:', fetchError)
      }
    }
  })

  // Handle custom events (goals)
  manager.addEventListener('track', async (event: MCEvent) => {
    try {
      logger.debug('Track event received', { name: event.payload?.name })
      await eventTracker.trackGoal(event)
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

  logger.log('ABsmartly Managed Component - WebCM mode initialized successfully')
}
