import { ABsmartlySettings, Logger } from '../types'
import { escapeSelectorForJS } from '../utils/selector-validator'
import { getValidatedNumericConfig } from '../utils/config-validator'
import { TRIGGER_ON_VIEW_TEMPLATE } from './client-scripts/trigger-on-view'
import { INIT_TEMPLATE } from './client-scripts/init'

export interface ClientBundleOptions {
  mode: 'zaraz' | 'webcm'
  settings: ABsmartlySettings
  logger: Logger
}

/**
 * Generates a complete client-side bundle for both Zaraz and WebCM modes
 * Includes anti-flicker CSS and trigger-on-view tracking
 * Bundle size: ~2-2.5KB (includes anti-flicker + trigger-on-view + init)
 */
export function generateClientBundle(options: ClientBundleOptions): string {
  const { mode, settings, logger } = options

  logger.debug('Generating client bundle', { mode })

  const antiFlickerCSS =
    settings.ENABLE_ANTI_FLICKER !== false
      ? generateAntiFlickerCSS(settings, logger, mode)
      : ''
  const triggerOnViewScript =
    settings.ENABLE_TRIGGER_ON_VIEW !== false
      ? generateTriggerOnViewScript(mode, settings)
      : ''
  const initScript = generateInitScript(settings, mode)

  const bundle = [antiFlickerCSS, triggerOnViewScript, initScript]
    .filter(Boolean)
    .join('\n')

  logger.debug('Client bundle generated', { size: bundle.length })

  return bundle
}

function generateAntiFlickerCSS(
  settings: ABsmartlySettings,
  logger: Logger,
  mode: 'zaraz' | 'webcm'
): string {
  const selector = escapeSelectorForJS(settings.HIDE_SELECTOR || 'body')
  const timeout = getValidatedNumericConfig(settings, 'HIDE_TIMEOUT', logger)
  const transitionMs = settings.TRANSITION_MS || '300'

  // For Zaraz mode, return pure JavaScript (no HTML tags)
  if (mode === 'zaraz') {
    return `
(function() {
  // Inject anti-flicker CSS
  var style = document.createElement('style');
  style.id = 'absmartly-antiflicker';
  style.textContent = '${selector} { opacity: 0 !important; transition: opacity ${transitionMs}ms ease-in; }';
  document.head.appendChild(style);

  // Failsafe timeout to ensure page is always revealed
  setTimeout(function() {
    var style = document.getElementById('absmartly-antiflicker');
    if (style) style.remove();
    var el = document.querySelector('${selector}');
    if (el) el.style.opacity = '1';
  }, ${timeout});
})();
    `.trim()
  }

  // For WebCM mode, return HTML tags
  return `
<style id="absmartly-antiflicker">
  ${selector} {
    opacity: 0 !important;
    transition: opacity ${transitionMs}ms ease-in;
  }
</style>
<script>
  // Failsafe timeout to ensure page is always revealed
  setTimeout(function() {
    var style = document.getElementById('absmartly-antiflicker');
    if (style) style.remove();
    var el = document.querySelector('${selector}');
    if (el) el.style.opacity = '1';
  }, ${timeout});
</script>
  `.trim()
}

function generateTriggerOnViewScript(
  mode: 'zaraz' | 'webcm',
  settings: ABsmartlySettings
): string {
  const template = getTriggerOnViewTemplate()
  const enableDebug = settings.ENABLE_DEBUG || false
  const code = template
    .replace(/{{MODE}}/g, mode)
    .replace(/{{ENABLE_DEBUG}}/g, String(enableDebug))

  // For Zaraz mode, return pure JavaScript (no script tags)
  if (mode === 'zaraz') {
    return code
  }

  // For WebCM mode, wrap in script tags
  return `<script>\n${code}\n</script>`
}

function generateInitScript(
  settings: ABsmartlySettings,
  mode: 'zaraz' | 'webcm'
): string {
  const template = getInitTemplate()
  const selector = escapeSelectorForJS(settings.HIDE_SELECTOR || 'body')
  const enableDebug = settings.ENABLE_DEBUG || false
  const code = template
    .replace(/{{SELECTOR}}/g, selector)
    .replace(/{{ENABLE_DEBUG}}/g, String(enableDebug))

  // For Zaraz mode, return pure JavaScript (no script tags)
  if (mode === 'zaraz') {
    return code
  }

  // For WebCM mode, wrap in script tags
  return `<script>\n${code}\n</script>`
}

function getTriggerOnViewTemplate(): string {
  return TRIGGER_ON_VIEW_TEMPLATE
}

function getInitTemplate(): string {
  return INIT_TEMPLATE
}
