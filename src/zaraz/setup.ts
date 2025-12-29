import { Manager, MCEvent } from '@managed-components/types'
import { ABsmartlySettings, Logger } from '../types'
import { createCoreManagers } from '../shared/setup-managers'
import { SDKInjector } from '../core/sdk-injector'
import { createLogger } from '../utils/logger'
import {
  isDuplicateSetup,
  markCleanedUp,
  createNoOpCleanup,
} from '../shared/setup-helpers'
import { injectFailsafe, isHTMLResponse } from '../shared/injection-helpers'
import {
  processHTMLWithExperiments,
  createResponseFromHTML,
} from '../shared/response-processors'
import { TRIGGER_ON_VIEW_TEMPLATE } from '../shared/client-scripts/trigger-on-view'

/**
 * Generates pure JavaScript for trigger-on-view tracking
 * Used when server-side DOM changes are enabled
 */
function generateTriggerOnViewScript(
  settings: ABsmartlySettings,
  logger: Logger
): string {
  try {
    const enableDebug = settings.ENABLE_DEBUG || false
    const script = TRIGGER_ON_VIEW_TEMPLATE.replace(
      /{{MODE}}/g,
      'zaraz'
    ).replace(/{{ENABLE_DEBUG}}/g, String(enableDebug))
    return script
  } catch (error) {
    logger.error('Failed to generate trigger-on-view script:', error)
    return ''
  }
}

export function setupZarazMode(
  manager: Manager,
  settings: ABsmartlySettings
): () => void {
  const logger = createLogger(settings.ENABLE_DEBUG || false, 'zaraz')

  logger.log('Initializing ABsmartly Managed Component - Zaraz mode')

  if (isDuplicateSetup(manager, logger)) {
    return createNoOpCleanup(logger)
  }

  // Ensure DEPLOYMENT_MODE is set to 'zaraz' for SDK injector
  settings.DEPLOYMENT_MODE = 'zaraz'

  if (settings.INJECT_CLIENT_SDK === undefined) {
    settings.INJECT_CLIENT_SDK = true
    logger.debug('INJECT_CLIENT_SDK not set, defaulting to true for Zaraz mode')
  }

  if (!settings.CLIENT_SDK_STRATEGY) {
    settings.CLIENT_SDK_STRATEGY = 'bundled'
    logger.debug(
      'CLIENT_SDK_STRATEGY not set, defaulting to "bundled" for Zaraz mode (event.client.execute requires pure JS)'
    )
  }

  if (settings.ENABLE_EMBEDS === undefined) {
    settings.ENABLE_EMBEDS = false
    logger.debug(
      'ENABLE_EMBEDS not set, defaulting to false for Zaraz mode (event.client.fetch() returns boolean instead of Response, cannot intercept HTML)'
    )
  }

  // Enable CookiePlugin by default for Zaraz mode (for UTM tracking and cookie checks)
  if (settings.ENABLE_COOKIE_PLUGIN === undefined) {
    settings.ENABLE_COOKIE_PLUGIN = true
    logger.debug(
      'ENABLE_COOKIE_PLUGIN not set, defaulting to true for Zaraz mode (uses needsServerSideCookie() pattern)'
    )
  }

  if (settings.PASS_SERVER_PAYLOAD === undefined) {
    settings.PASS_SERVER_PAYLOAD = true
    logger.debug(
      'PASS_SERVER_PAYLOAD not set, defaulting to true for Zaraz mode (avoids client-side API calls and keeps API key secure)'
    )
  }

  // Disable proxy by default for Zaraz mode (will revisit later)
  if (settings.PROXY_SDK_REQUESTS === undefined) {
    settings.PROXY_SDK_REQUESTS = false
    logger.debug(
      'PROXY_SDK_REQUESTS not set, defaulting to false for Zaraz mode'
    )
  }

  // Enable cookie management by default for Zaraz mode
  if (settings.ENABLE_COOKIE_MANAGEMENT === undefined) {
    settings.ENABLE_COOKIE_MANAGEMENT = true
    logger.debug(
      'ENABLE_COOKIE_MANAGEMENT not set, defaulting to true for Zaraz mode (user ID persistence)'
    )
  }

  const { contextManager, requestHandler, eventHandlers, cookieHandler } =
    createCoreManagers(manager, settings, logger)

  const sdkInjector = new SDKInjector({ settings, logger })

  // Proxy mode disabled for Zaraz - using zaraz.track() for event forwarding instead
  // SDK always connects directly to ABsmartly API
  settings.PROXY_SDK_REQUESTS = false
  logger.debug('Proxy mode disabled - using zaraz.track() for event forwarding')

  const pageviewListener = async (event: MCEvent) => {
    try {
      logger.log('🔥 Pageview event received', {
        url: event.client.url.toString(),
      })

      // Use request handler to get context and experiment data
      // If EMBEDS enabled, also fetch HTML for server-side processing
      const skipFetch = !settings.ENABLE_EMBEDS
      const result = await requestHandler.handleRequest(event, skipFetch)

      if (!result) {
        await requestHandler.handleRequestError(event)
        return
      }

      const { userId, context, experimentData, overrides, fetchResult } = result

      if (!result.shouldProcess) {
        logger.debug(
          'Request handler indicated shouldProcess=false (fetch failed), will skip HTML processing but still inject SDK'
        )
      }

      logger.debug('Context and experiments ready', {
        userId,
        experimentsCount: experimentData.length,
        hasOverrides: !!overrides && Object.keys(overrides).length > 0,
        willProcessHTML: settings.ENABLE_EMBEDS && !!fetchResult,
      })

      // Process HTML if EMBEDS enabled and we have a response
      if (
        settings.ENABLE_EMBEDS &&
        fetchResult &&
        typeof fetchResult !== 'boolean'
      ) {
        const response = fetchResult as Response

        if (isHTMLResponse(response)) {
          logger.log('✅ HTML response detected - processing DOM changes', {
            contentType: response.headers.get('Content-Type'),
            contentLength: response.headers.get('Content-Length'),
          })

          let html = await response.text()
          const originalLength = html.length

          html = processHTMLWithExperiments(
            html,
            experimentData,
            settings,
            logger
          )

          logger.log(
            '✅ HTML processing completed (Treatment tags + DOM changes)',
            {
              originalLength,
              processedLength: html.length,
              experimentsCount: experimentData.length,
              changed: originalLength !== html.length,
            }
          )

          event.client.return(createResponseFromHTML(html, response))
        } else {
          logger.debug('Non-HTML response, skipping DOM processing', {
            contentType: response.headers.get('Content-Type'),
          })
        }
      }

      if (sdkInjector.shouldInjectSDK()) {
        const contextData = settings.PASS_SERVER_PAYLOAD
          ? context.data()
          : undefined

        logger.log('🎯 Generating SDK injection script', {
          hasContextData: !!contextData,
          hasOverrides: !!overrides && Object.keys(overrides).length > 0,
          experimentCount: experimentData.length,
          deploymentMode: settings.DEPLOYMENT_MODE,
          clientSDKStrategy: settings.CLIENT_SDK_STRATEGY,
        })

        const sdkScript = sdkInjector.generateInjectionScript({
          unitId: userId,
          unitType: settings.UNIT_TYPE || 'user_id',
          contextData,
          overrides,
          experiments: experimentData,
        })

        if (sdkScript) {
          const hasScriptTag = sdkScript.includes('<script')
          const hasStyleTag = sdkScript.includes('<style')
          const hasHTMLTags = hasScriptTag || hasStyleTag

          logger.log('📝 SDK script generated', {
            scriptLength: sdkScript.length,
            hasScriptTag,
            hasStyleTag,
            hasHTMLTags,
            scriptStart: sdkScript.substring(0, 200),
          })

          // Check if script contains HTML tags
          if (hasHTMLTags) {
            logger.error('❌ SDK script contains HTML tags!', {
              hasScriptTag,
              hasStyleTag,
              scriptPreview: sdkScript.substring(0, 500),
              deploymentMode: settings.DEPLOYMENT_MODE,
              clientSDKStrategy: settings.CLIENT_SDK_STRATEGY,
            })
          } else {
            logger.log('✅ SDK script is pure JavaScript (no HTML tags)')
          }

          event.client.execute(sdkScript)
          logger.log('💉 Client SDK injected via event.client.execute()')
        } else {
          logger.warn('⚠️ SDK injection script generation returned null/empty')
        }
      } else {
        logger.log('⏭️ SDK injection skipped (shouldInjectSDK returned false)')
      }

      // If server-side DOM changes are enabled, inject trigger-on-view tracking
      if (settings.ENABLE_EMBEDS && settings.ENABLE_TRIGGER_ON_VIEW !== false) {
        const triggerScript = generateTriggerOnViewScript(settings, logger)
        if (triggerScript) {
          // Check if script contains HTML tags
          if (
            triggerScript.includes('<script') ||
            triggerScript.includes('<style')
          ) {
            logger.error('Trigger script contains HTML tags!', {
              scriptPreview: triggerScript.substring(0, 500),
            })
          }
          event.client.execute(triggerScript)
          logger.debug(
            'Trigger-on-view tracking injected for server-side DOM changes'
          )
        }
      }

      await contextManager.publishContext(context)
      logger.debug('Exposures published')
    } catch (error) {
      logger.error('Pageview handler error:', error)
      injectFailsafe(event, settings, logger)
    }
  }

  manager.addEventListener('pageview', pageviewListener)

  // Listen for track events (zaraz.track() calls from client)
  // Following Segment semantic conventions:
  // - "Experiment Viewed" events → Exposures
  // - All other track events → Goals
  const trackListener = async (event: MCEvent) => {
    try {
      const eventName = event.name
      const eventPayload = event.payload

      logger.log('📊 Track event received', {
        name: eventName,
        payload: eventPayload,
      })

      // Get user ID from cookie
      const userId = cookieHandler.ensureUserId(event.client)

      // "Experiment Viewed" events are exposures (Segment semantic spec)
      if (eventName === 'Experiment Viewed') {
        logger.log('🔬 Exposure detected via "Experiment Viewed" event', {
          experiment_id: eventPayload?.experiment_id,
          variation_id: eventPayload?.variation_id,
        })

        // TODO: Send exposure to ABsmartly API
        // For now, just log it
        logger.debug('Exposure event will be sent to ABsmartly API', {
          userId,
          experimentId: eventPayload?.experiment_id,
          variantId: eventPayload?.variation_id,
          properties: eventPayload,
        })
      }
      // All other track events are goals
      else {
        logger.log('🎯 Goal detected via zaraz.track()', {
          eventName,
          userId,
        })

        // TODO: Send goal to ABsmartly API
        // For now, just log it
        logger.debug('Goal event will be sent to ABsmartly API', {
          userId,
          goalName: eventName,
          properties: eventPayload,
        })
      }
    } catch (error) {
      logger.error('Track event handler error:', error)
    }
  }

  manager.addEventListener('event', trackListener)

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
