import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { HTMLProcessor } from '../core/html-processor'
import { SDKInjector } from '../core/sdk-injector'
import { generateClientBundle } from '../shared/client-bundle-generator'
import { createLogger } from '../utils/logger'

export function setupZarazMode(
  manager: Manager,
  settings: ABSmartlySettings
): void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - Zaraz mode')

  // Initialize core components (shared with WebCM)
  const {
    contextManager,
    cookieHandler,
    overridesHandler,
    eventTracker,
    experimentViewHandler,
    requestHandler,
    eventHandlers,
  } = createCoreManagers(manager, settings, logger)

  // Zaraz-specific components
  const sdkInjector = new SDKInjector({ settings, logger })

  // Intercept requests to process Treatment tags in HTML (if enabled)
  if (settings.ENABLE_EMBEDS) {
    manager.addEventListener('request', async (event: MCEvent) => {
      const result = await requestHandler.handleRequest(event)

      if (!result) {
        await requestHandler.handleRequestError(event)
        return
      }

      if (!result.shouldProcess) {
        return
      }

      try {
        // Type guard for Response object
        const response = result.fetchResult as Response

        // Only process HTML responses
        const contentType = response.headers?.get('content-type') || ''
        if (!contentType.includes('text/html')) {
          logger.debug('Skipping non-HTML response', { contentType })
          event.client.return(response)
          return
        }

        // Get response HTML
        let html = await response.text()

        // Process HTML with Treatment tags and DOM changes (zero flicker!)
        const processor = new HTMLProcessor({
          settings,
          logger,
          useLinkedom: true, // Use linkedom for full CSS selector support
        })
        html = processor.processHTML(html, result.experimentData)

        logger.debug('HTML processing completed (Treatment tags + DOM changes)')

        // Return modified response
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
    })
  }

  // Handle pageview events - main experiment delivery
  manager.addEventListener('pageview', async (event: MCEvent) => {
    try {
      logger.debug('Pageview event received', {
        url: event.client.url.toString(),
      })

      // 1. Get or create user ID (with optional cookie management)
      const userId = cookieHandler.ensureUserId(event.client)
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
        url: event.client.url.toString(),
        userAgent: event.client.userAgent,
        ip: event.client.ip,
      })

      // 5. Extract experiment data and treatments
      const experimentData = contextManager.extractExperimentData(context)
      logger.debug('Experiments extracted', {
        count: experimentData.length,
        experiments: experimentData.map(e => ({
          name: e.name,
          treatment: e.treatment,
        })),
      })

      // 6. Inject client SDK if enabled
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

      // 7. Inject debug info if enabled
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

      // 8. Inject client code (anti-flicker + trigger-on-view)
      const clientBundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })
      event.client.execute(clientBundle)

      // 9. Track exposures immediately (context is short-lived on edge)
      await contextManager.publishContext(context)
      logger.debug('Exposures published')
    } catch (error) {
      logger.error('Pageview handler error:', error)

      // Graceful degradation - inject failsafe to reveal page
      const selector = settings.HIDE_SELECTOR || 'body'
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
  })

  // Set up event handlers (track, event, ecommerce)
  eventHandlers.setupEventListeners(manager)

  logger.log(
    'ABsmartly Managed Component - Zaraz mode initialized successfully'
  )
}
