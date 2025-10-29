import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { ABSmartlyEndpointHandler } from './absmartly-endpoint-handler'
import { HTMLProcessor } from '../core/html-processor'
import { generateClientBundle } from '../shared/client-bundle-generator'
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

  // Initialize core components (shared with Zaraz)
  const {
    contextManager,
    cookieHandler,
    overridesHandler,
    eventTracker,
    experimentViewHandler,
    requestHandler,
    eventHandlers,
  } = createCoreManagers(manager, settings, logger)

  // WebCM-specific components
  const endpointHandler = new ABSmartlyEndpointHandler(settings, eventTracker, logger)

  // Intercept requests to handle /absmartly endpoint and manipulate responses
  manager.addEventListener('request', async (event: MCEvent) => {
    // Handle /absmartly endpoint for track requests
    const isEndpointHandled = await endpointHandler.handleRequest(event)
    if (isEndpointHandled) {
      return
    }

    // Check if URL should be manipulated based on excluded paths
    const excludedPaths = settings.EXCLUDED_PATHS || []
    let shouldSkip = false
    for (const path of excludedPaths) {
      if (event.client.url.toString().includes(path)) {
        logger.debug('URL excluded from manipulation', { url: event.client.url.toString(), path })
        shouldSkip = true
        break
      }
    }
    if (shouldSkip) {
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
      // Get response HTML
      const html = await result.fetchResult.text()

      // Only process HTML responses
      const contentType = result.fetchResult.headers?.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        logger.debug('Skipping non-HTML response', { contentType })
        event.client.return(result.fetchResult as unknown as Response)
        return
      }

      // Process HTML with Treatment tags and DOM changes (zero flicker!)
      const processor = new HTMLProcessor({
        settings,
        logger,
        useLinkedom: true, // WebCM uses linkedom for full CSS selector support
      })
      let processedHTML = processor.processHTML(html, result.experimentData)

      // Inject experiment data for client-side tracking (optional)
      const injectClientData = settings.INJECT_CLIENT_DATA
      if (injectClientData) {
        const dataScript = `
<script id="absmartly-data" type="application/json">
${JSON.stringify({ experiments: result.experimentData })}
</script>
        `.trim()

        if (processedHTML.includes('</head>')) {
          processedHTML = processedHTML.replace('</head>', `${dataScript}</head>`)
        } else if (processedHTML.includes('</body>')) {
          processedHTML = processedHTML.replace('</body>', `${dataScript}</body>`)
        } else {
          processedHTML = processedHTML + dataScript
        }
      }

      // Generate and inject client bundle (anti-flicker + trigger-on-view + init)
      if (settings.INJECT_CLIENT_BUNDLE !== false) {
        try {
          const bundle = generateClientBundle({
            mode: 'webcm',
            settings,
            logger
          })

          if (processedHTML.includes('</head>')) {
            processedHTML = processedHTML.replace('</head>', `${bundle}</head>`)
          } else if (processedHTML.includes('</body>')) {
            processedHTML = processedHTML.replace('</body>', `${bundle}</body>`)
          } else {
            processedHTML = processedHTML + bundle
          }
        } catch (error) {
          logger.error('Failed to inject client bundle:', error)
          // Continue with processed HTML if bundle injection fails
        }
      }

      // Create final response
      const finalResponse = new Response(processedHTML, {
        status: result.fetchResult.status,
        statusText: result.fetchResult.statusText,
        headers: result.fetchResult.headers
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
