import { MCEvent } from '@managed-components/types'
import { ABsmartlySettings, Logger } from '../types'
import { escapeSelectorForJS } from '../utils/selector-validator'
import { generateClientBundle } from './client-bundle-generator'
import { injectIntoHTML } from '../utils/html-injection'

/**
 * Injects failsafe script to reveal page if initialization fails
 * Applies to both WebCM and Zaraz modes
 */
export function injectFailsafe(
  event: MCEvent,
  settings: ABsmartlySettings,
  logger: Logger
): void {
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
    logger.debug('Failsafe script injected')
  } catch (error) {
    logger.error('Failed to inject failsafe:', error)
  }
}

/**
 * Injects debug information to console
 * Applies to both WebCM and Zaraz modes
 */
export function injectDebugInfo(
  event: MCEvent,
  settings: ABsmartlySettings,
  logger: Logger
): void {
  if (!settings.ENABLE_DEBUG) return

  // Capitalize first letter of mode for display (Zaraz, Webcm -> WebCM is handled in test expectations)
  const modeDisplay =
    settings.DEPLOYMENT_MODE === 'zaraz'
      ? 'Zaraz'
      : settings.DEPLOYMENT_MODE === 'webcm'
        ? 'WebCM'
        : settings.DEPLOYMENT_MODE

  const debugScript = `
    <script>
      console.log('[ABsmartly] ${modeDisplay} mode initialized');
      console.log('[ABsmartly] Settings:', {
        deployment: '${settings.DEPLOYMENT_MODE}',
        antiFlicker: ${settings.ENABLE_ANTI_FLICKER !== false},
        triggerOnView: ${settings.ENABLE_TRIGGER_ON_VIEW !== false}
      });
    </script>
  `

  try {
    event.client.execute(debugScript)
    logger.debug('Debug info injected')
  } catch (error) {
    logger.error('Failed to inject debug info:', error)
  }
}

/**
 * Injects client bundle via event.client.execute()
 * Used by Zaraz mode
 */
export function injectClientBundleViaExecute(
  event: MCEvent,
  settings: ABsmartlySettings,
  logger: Logger
): void {
  try {
    logger.debug('Injecting client code for Zaraz mode')

    const mode = settings.DEPLOYMENT_MODE === 'zaraz' ? 'zaraz' : 'webcm'
    const clientBundle = generateClientBundle({
      mode,
      settings,
      logger,
    })

    event.client.execute(clientBundle)
    logger.debug('Client code injected successfully')
  } catch (error) {
    logger.error('Failed to inject client code:', error)
    injectFailsafe(event, settings, logger)
  }
}

/**
 * Injects client bundle into HTML string
 * Used by WebCM mode
 */
export function injectClientBundleIntoHTML(
  html: string,
  settings: ABsmartlySettings,
  logger: Logger
): string {
  if (settings.INJECT_CLIENT_BUNDLE === false) {
    logger.debug('Client bundle injection disabled')
    return html
  }

  try {
    const bundle = generateClientBundle({
      mode: 'webcm',
      settings,
      logger,
    })

    return injectIntoHTML(html, bundle)
  } catch (error) {
    logger.error('Failed to inject client bundle into HTML:', error)
    return html
  }
}

/**
 * Checks if response is HTML content
 * Returns true if content-type includes 'text/html'
 */
export function isHTMLResponse(response: Response): boolean {
  const contentType = response.headers?.get('content-type') || ''
  return contentType.includes('text/html')
}
