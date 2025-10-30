import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { HTMLProcessor } from '../core/html-processor'
import { SDKInjector } from '../core/sdk-injector'
import { generateClientBundle } from '../shared/client-bundle-generator'
import { createLogger } from '../utils/logger'
import { escapeSelectorForJS } from '../utils/selector-validator'

const setupInstances = new WeakMap<Manager, boolean>()

export function setupZarazMode(
  manager: Manager,
  settings: ABSmartlySettings
): () => void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - Zaraz mode')

  if (setupInstances.has(manager)) {
    logger.warn(
      'Zaraz mode already initialized for this manager, skipping duplicate setup'
    )
    return () => {
      logger.debug('Cleanup called but already skipped duplicate setup')
    }
  }

  setupInstances.set(manager, true)

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

      const contentType = response.headers?.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        logger.debug('Skipping non-HTML response', { contentType })
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

      const context = await contextManager.createContext(userId, overrides, {
        url: event.client.url.toString(),
        userAgent: event.client.userAgent,
        ip: event.client.ip,
      })

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

      if (settings.ENABLE_DEBUG) {
        const debugScript = `
        <script>
          console.log('[ABSmartly] Zaraz mode initialized');
          console.log('[ABSmartly] Settings:', {
            deployment: '${settings.DEPLOYMENT_MODE}',
            antiFlicker: ${settings.ENABLE_ANTI_FLICKER !== false},
            triggerOnView: ${settings.ENABLE_TRIGGER_ON_VIEW !== false}
          });
        </script>
        `
        event.client.execute(debugScript)
      }

      const clientBundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger,
      })
      event.client.execute(clientBundle)

      await contextManager.publishContext(context)
      logger.debug('Exposures published')
    } catch (error) {
      logger.error('Pageview handler error:', error)

      const selector = escapeSelectorForJS(settings.HIDE_SELECTOR || 'body')
      const failsafeScript = `
      <script>
        setTimeout(function() {
          var el = document.querySelector('${selector}');
          if (el) el.style.opacity = '1';
        }, 100);
      </script>
      `
      try {
        event.client.execute(failsafeScript)
      } catch (e) {
        logger.error('Failed to inject failsafe:', e)
      }
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
    setupInstances.delete(manager)
    cleanupEventHandlers()
    logger.debug(
      'Zaraz mode cleanup completed (note: Managed Components API does not support removeEventListener)'
    )
  }
}
