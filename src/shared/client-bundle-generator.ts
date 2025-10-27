import { readFileSync } from 'fs'
import { join } from 'path'
import { ABSmartlySettings, Logger } from '../types'

const SCRIPTS_DIR = join(__dirname, 'client-scripts')

let cachedAntiFlicker: string | null = null
let cachedTriggerOnView: string | null = null
let cachedInit: string | null = null

export interface ClientBundleOptions {
  mode: 'zaraz' | 'webcm'
  settings: ABSmartlySettings
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

  const antiFlickerCSS = settings.ENABLE_ANTI_FLICKER !== false ? generateAntiFlickerCSS(settings) : ''
  const triggerOnViewScript = settings.ENABLE_TRIGGER_ON_VIEW !== false ? generateTriggerOnViewScript(mode, settings) : ''
  const initScript = generateInitScript(settings)

  const bundle = [antiFlickerCSS, triggerOnViewScript, initScript].filter(Boolean).join('\n')

  logger.debug('Client bundle generated', { size: bundle.length })

  return bundle
}

function generateAntiFlickerCSS(settings: ABSmartlySettings): string {
  const selector = settings.HIDE_SELECTOR || 'body'
  const timeout = settings.HIDE_TIMEOUT || 3000
  const transitionMs = settings.TRANSITION_MS || '300'

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

function generateTriggerOnViewScript(mode: 'zaraz' | 'webcm', settings: ABSmartlySettings): string {
  const template = getTriggerOnViewTemplate()
  const enableDebug = settings.ENABLE_DEBUG || false

  return `<script>\n${template
    .replace(/{{MODE}}/g, mode)
    .replace(/{{ENABLE_DEBUG}}/g, String(enableDebug))}\n</script>`
}

function generateInitScript(settings: ABSmartlySettings): string {
  const template = getInitTemplate()
  const selector = settings.HIDE_SELECTOR || 'body'
  const enableDebug = settings.ENABLE_DEBUG || false

  return `<script>\n${template
    .replace(/{{SELECTOR}}/g, selector)
    .replace(/{{ENABLE_DEBUG}}/g, String(enableDebug))}\n</script>`
}

function getTriggerOnViewTemplate(): string {
  if (!cachedTriggerOnView) {
    cachedTriggerOnView = readFileSync(join(SCRIPTS_DIR, 'trigger-on-view.js'), 'utf-8')
  }
  return cachedTriggerOnView
}

function getInitTemplate(): string {
  if (!cachedInit) {
    cachedInit = readFileSync(join(SCRIPTS_DIR, 'init.js'), 'utf-8')
  }
  return cachedInit
}

function getAntiFlickerTemplate(): string {
  if (!cachedAntiFlicker) {
    cachedAntiFlicker = readFileSync(join(SCRIPTS_DIR, 'anti-flicker.js'), 'utf-8')
  }
  return cachedAntiFlicker
}
