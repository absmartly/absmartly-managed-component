import { Manager, MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { ABSmartlyEndpointHandler } from './absmartly-endpoint-handler'
import { HTMLProcessor } from '../core/html-processor'
import { createLogger } from '../utils/logger'
import { injectIntoHTML } from '../utils/html-injection'
import {
  isDuplicateSetup,
  markCleanedUp,
  createNoOpCleanup,
} from '../shared/setup-helpers'
import {
  injectClientBundleIntoHTML,
  isHTMLResponse,
} from '../shared/injection-helpers'

export function setupWebCMMode(
  manager: Manager,
  settings: ABSmartlySettings
): () => void {
  const logger = createLogger(settings.ENABLE_DEBUG || false)
  logger.log('Initializing ABsmartly Managed Component - WebCM mode')

  if (isDuplicateSetup(manager, logger)) {
    return createNoOpCleanup(logger)
  }

  const { requestHandler, eventHandlers } = createCoreManagers(
    manager,
    settings,
    logger
  )

  const endpointHandler = new ABSmartlyEndpointHandler(settings, logger)

  const requestListener = async (event: MCEvent) => {
    const isEndpointHandled = await endpointHandler.handleRequest(event)
    if (isEndpointHandled) {
      return
    }

    const excludedPaths = settings.EXCLUDED_PATHS || []
    let shouldSkip = false
    for (const path of excludedPaths) {
      if (event.client.url.toString().includes(path)) {
        logger.debug('URL excluded from manipulation', {
          url: event.client.url.toString(),
          path,
        })
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
      // Type guard: Check if fetchResult exists and is not boolean
      if (!result.fetchResult || typeof result.fetchResult === 'boolean') {
        logger.warn('Invalid fetchResult, skipping HTML processing')
        return
      }

      const html = await result.fetchResult.text()

      if (!isHTMLResponse(result.fetchResult as Response)) {
        logger.debug('Skipping non-HTML response')
        event.client.return(result.fetchResult as unknown as Response)
        return
      }

      const processor = new HTMLProcessor({
        settings,
        logger,
        useLinkedom: true,
      })
      let processedHTML = processor.processHTML(html, result.experimentData)

      const injectClientData = settings.INJECT_CLIENT_DATA
      if (injectClientData) {
        const dataScript = `
<script id="absmartly-data" type="application/json">
${JSON.stringify({ experiments: result.experimentData })}
</script>
        `.trim()

        processedHTML = injectIntoHTML(processedHTML, dataScript)
      }

      processedHTML = injectClientBundleIntoHTML(
        processedHTML,
        settings,
        logger
      )

      const finalResponse = new Response(processedHTML, {
        status: result.fetchResult.status,
        statusText: result.fetchResult.statusText,
        headers: result.fetchResult.headers,
      })

      event.client.return(finalResponse)
    } catch (error) {
      logger.error('Response manipulation error:', error)
      await requestHandler.handleRequestError(event)
    }
  }

  manager.addEventListener('request', requestListener)

  const cleanupEventHandlers = eventHandlers.setupEventListeners(manager)

  logger.log(
    'ABsmartly Managed Component - WebCM mode initialized successfully'
  )

  return () => {
    markCleanedUp(manager)
    cleanupEventHandlers()
    logger.debug(
      'WebCM mode cleanup completed (note: Managed Components API does not support removeEventListener)'
    )
  }
}
