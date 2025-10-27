import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { OverridesHandler } from '../core/overrides-handler'
import { EventTracker } from '../core/event-tracker'
import { ExperimentViewHandler } from '../core/experiment-view-handler'
import { RequestHandler } from '../core/request-handler'
import { EventHandlers } from '../core/event-handlers'
import { ResponseManipulator } from './response-manipulator'
import { WebCMClientInjector } from './client-injector'
import { ABSmartlyEndpointHandler } from './absmartly-endpoint-handler'
import { createLogger } from '../utils/logger'

// FetchedRequest is a WebCM-specific type not exported from @managed-components/types
interface FetchedRequest extends Response {
  url: string
}

export function setupWebCMMode(
  manager: Manager,
  settings: ABSmartlySettings
): void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - WebCM mode')

  // Initialize core components
  const contextManager = new ContextManager(manager, settings, logger)
  const cookieHandler = new CookieHandler(settings)
  const overridesHandler = new OverridesHandler()
  const eventTracker = new EventTracker(
    manager,
    contextManager,
    cookieHandler,
    settings,
    logger
  )
  const responseManipulator = new ResponseManipulator(settings, logger)
  const clientInjector = new WebCMClientInjector(settings, logger)
  const endpointHandler = new ABSmartlyEndpointHandler(settings, eventTracker, logger)
  const experimentViewHandler = new ExperimentViewHandler(
    contextManager,
    cookieHandler,
    overridesHandler,
    logger
  )
  const requestHandler = new RequestHandler({
    contextManager,
    cookieHandler,
    overridesHandler,
    settings,
    logger,
  })
  const eventHandlers = new EventHandlers({
    eventTracker,
    experimentViewHandler,
    logger,
  })

  // Intercept requests to handle /absmartly endpoint and manipulate responses
  manager.addEventListener('request', async (event: MCEvent) => {
    // Handle /absmartly endpoint for track requests
    const isEndpointHandled = await endpointHandler.handleRequest(event)
    if (isEndpointHandled) {
      return
    }

    // Check if URL should be manipulated
    if (!responseManipulator.shouldManipulate(event.client.url.toString())) {
      return
    }

    const result = await requestHandler.handleRequest(event)

    if (!result) {
      await requestHandler.handleRequestError(event)
      return
    }

    if (!result.shouldProcess) {
      return
    }

    try {
      // Manipulate response HTML with experiment changes
      let modifiedHTML = (await result.fetchResult.text()) as string

      // Process HTML with Treatment tags and DOM changes
      const modifiedRequest = await responseManipulator.manipulateResponse(
        result.fetchResult as unknown as FetchedRequest,
        result.experimentData
      )

      // Get the modified HTML
      const modifiedHTMLText = await modifiedRequest.text()

      // Inject client bundle (anti-flicker + trigger-on-view + init)
      const finalHTML = clientInjector.injectClientBundle(modifiedHTMLText)

      // Create final response
      const finalResponse = new Response(finalHTML, {
        status: modifiedRequest.status,
        statusText: modifiedRequest.statusText,
        headers: modifiedRequest.headers
      })

      // Return final response
      event.client.return(finalResponse)
    } catch (error) {
      logger.error('Response manipulation error:', error)
      await requestHandler.handleRequestError(event)
    }
  })

  // Set up event handlers (track, event, ecommerce)
  eventHandlers.setupEventListeners(manager)

  logger.log(
    'ABsmartly Managed Component - WebCM mode initialized successfully'
  )
}
