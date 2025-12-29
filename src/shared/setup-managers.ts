import { Manager } from '@managed-components/types'
import { ABsmartlySettings, Logger } from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { OverridesHandler } from '../core/overrides-handler'
import { EventTracker } from '../core/event-tracker'
import { ExperimentViewHandler } from '../core/experiment-view-handler'
import { RequestHandler } from '../core/request-handler'
import { EventHandlers } from '../core/event-handlers'

/**
 * Core managers used by both Zaraz and WebCM modes
 * This eliminates duplication between setup.ts files
 */
export interface CoreManagers {
  contextManager: ContextManager
  cookieHandler: CookieHandler
  overridesHandler: OverridesHandler
  eventTracker: EventTracker
  experimentViewHandler: ExperimentViewHandler
  requestHandler: RequestHandler
  eventHandlers: EventHandlers
}

/**
 * Create core managers shared by both deployment modes
 * Eliminates ~60% code duplication between Zaraz and WebCM setup
 */
export function createCoreManagers(
  manager: Manager,
  settings: ABsmartlySettings,
  logger: Logger
): CoreManagers {
  const contextManager = new ContextManager(settings, logger)
  const cookieHandler = new CookieHandler({ settings, logger })
  const overridesHandler = new OverridesHandler(settings, logger)
  const eventTracker = new EventTracker(
    manager,
    contextManager,
    cookieHandler,
    settings,
    logger
  )
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

  return {
    contextManager,
    cookieHandler,
    overridesHandler,
    eventTracker,
    experimentViewHandler,
    requestHandler,
    eventHandlers,
  }
}
