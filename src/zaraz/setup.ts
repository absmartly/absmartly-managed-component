import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { HTMLProcessor } from '../core/html-processor'
import { SDKInjector } from '../core/sdk-injector'
import { createLogger } from '../utils/logger'
import {
  isDuplicateSetup,
  markCleanedUp,
  createNoOpCleanup,
} from '../shared/setup-helpers'
import {
  injectFailsafe,
  injectDebugInfo,
  injectClientBundleViaExecute,
  isHTMLResponse,
} from '../shared/injection-helpers'

export function setupZarazMode(
  manager: Manager,
  settings: ABSmartlySettings
): () => void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - Zaraz mode')

  if (isDuplicateSetup(manager, logger)) {
    return createNoOpCleanup(logger)
  }

  const {
    contextManager,
    cookieHandler,
    overridesHandler,
    requestHandler,
    eventHandlers,
  } = createCoreManagers(manager, settings, logger)

  const sdkInjector = new SDKInjector({ settings, logger })

  const requestListener = async (event: MCEvent) => {
    const result = await requestHandler.handleRequest(event)

    if (!result) {
      await requestHandler.handleRequestError(event)
      return
    }

    if (!result.shouldProcess) {
      return
    }

    try {
      const response = result.fetchResult as Response

      if (!isHTMLResponse(response)) {
        logger.debug('Skipping non-HTML response')
        event.client.return(response)
        return
      }

      let html = await response.text()

      const processor = new HTMLProcessor({
        settings,
        logger,
        useLinkedom: true,
      })
      html = processor.processHTML(html, result.experimentData)

      logger.debug('HTML processing completed (Treatment tags + DOM changes)')

      event.client.return(
        new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      )
    } catch (error) {
      logger.error('Request handler error for Treatment tags:', error)
      await requestHandler.handleRequestError(event)
    }
  }

  const pageviewListener = async (event: MCEvent) => {
    try {
      logger.debug('Pageview event received', {
        url: event.client.url.toString(),
      })

      const userId = cookieHandler.ensureUserId(event.client)
      logger.debug('User ID', { userId })

      cookieHandler.storeUTMParams(event.client)
      cookieHandler.storeLandingPage(event.client)

      const overrides = overridesHandler.getOverrides(event)
      if (overridesHandler.hasOverrides(overrides)) {
        logger.debug('Overrides detected', { overrides })
      }

      const context = await contextManager.getOrCreateContext(
        userId,
        overrides,
        {
          url: event.client.url.toString(),
          userAgent: event.client.userAgent,
          ip: event.client.ip,
        }
      )

      const experimentData = contextManager.extractExperimentData(context)
      logger.debug('Experiments extracted', {
        count: experimentData.length,
        experiments: experimentData.map(e => ({
          name: e.name,
          treatment: e.treatment,
        })),
      })

      if (sdkInjector.shouldInjectSDK()) {
        const contextData = settings.PASS_SERVER_PAYLOAD
          ? context.getData()
          : undefined

        const sdkScript = sdkInjector.generateInjectionScript({
          unitId: userId,
          contextData,
          overrides,
          experiments: experimentData,
        })

        if (sdkScript) {
          event.client.execute(sdkScript)
          logger.debug('Client SDK injected')
        }
      }

      injectDebugInfo(event, settings, logger)
      injectClientBundleViaExecute(event, settings, logger)

      await contextManager.publishContext(context)
      logger.debug('Exposures published')
    } catch (error) {
      logger.error('Pageview handler error:', error)
      injectFailsafe(event, settings, logger)
    }
  }

  if (settings.ENABLE_EMBEDS) {
    manager.addEventListener('request', requestListener)
  }

  manager.addEventListener('pageview', pageviewListener)

  const cleanupEventHandlers = eventHandlers.setupEventListeners(manager)

  logger.log(
    'ABsmartly Managed Component - Zaraz mode initialized successfully'
  )

  return () => {
    markCleanedUp(manager)
    cleanupEventHandlers()
    logger.debug(
      'Zaraz mode cleanup completed (note: Managed Components API does not support removeEventListener)'
    )
  }
}
