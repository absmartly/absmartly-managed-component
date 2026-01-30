/**
 * Shared core SDK initialization logic
 * Used by both Zaraz and Worker bundles
 *
 * Note: This module does NOT import plugins directly.
 * Plugins are imported by entry points and passed as parameters.
 */

import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../../constants/cookies'

export interface SDKConfig {
  endpoint: string
  apiKey: string
  environment: string
  application: string
  retries?: number
  timeout?: number
  enableDebug?: boolean
  hideSelector?: string
  hideTransition?: string
  cookieDomain?: string
  queryPrefix?: string
}

export interface PluginConfig {
  domChanges?: boolean
  cookie?: boolean
  webVitals?: boolean
}

export interface PerfMarks {
  start: number
  sdkConfigured: number
  contextCreated: number
  contextReady: number
  pluginsLoaded: number
  domReady: number
}

export interface SDKInitParams {
  config: SDKConfig
  unitId: string
  unitType: string
  serverData: any
  overrides: Record<string, number>
  pluginConfig?: PluginConfig
}

/**
 * Create performance tracking utilities
 */
export function createPerfTracking(logPrefix: string) {
  const perfStart = (window as any).__absmartlyPerfStart || performance.now()
  const perfMarks: PerfMarks = {
    start: perfStart,
    sdkConfigured: 0,
    contextCreated: 0,
    contextReady: 0,
    pluginsLoaded: 0,
    domReady: 0,
  }

  function markPerf(name: keyof PerfMarks) {
    perfMarks[name] = performance.now()
    const elapsed = (perfMarks[name] - perfMarks.start).toFixed(2)
    console.log(`[${logPrefix} +${elapsed}ms] ${name}`)
  }

  function debugLog(...args: any[]) {
    const elapsed = (performance.now() - perfMarks.start).toFixed(2)
    console.log(`[${logPrefix} +${elapsed}ms]`, ...args)
  }

  return { perfMarks, markPerf, debugLog }
}

/**
 * Initialize CookiePlugin with standard configuration
 */
export function initializeCookiePlugin(
  CookiePlugin: any,
  config: SDKConfig,
  debugLog: (...args: any[]) => void,
  logPrefix: string
) {
  try {
    const cookiePluginInstance = new CookiePlugin({
      debug: config.enableDebug || false,
      cookieDomain: config.cookieDomain || window.location.hostname,
      cookiePath: '/',
      sameSite: 'Lax',
      cookieExpiryDays: COOKIE_DEFAULTS.MAX_AGE_DAYS,
      unitIdCookieName: COOKIE_NAMES.UNIT_ID,
      publicIdCookieName: COOKIE_NAMES.PUBLIC_ID,
      expiryCookieName: COOKIE_NAMES.EXPIRY,
      utmCookieName: COOKIE_NAMES.UTM_PARAMS,
      autoUpdateExpiry: true,
      expiryCheckInterval: 30,
    })
    debugLog('CookiePlugin initialized')
    return cookiePluginInstance
  } catch (error) {
    console.error(`[${logPrefix}] Failed to initialize CookiePlugin:`, error)
    return null
  }
}

/**
 * Get client-side overrides from URL
 */
export function getClientOverrides(
  getOverrides: any,
  queryPrefix: string
): Record<string, number> {
  const searchParams = new URLSearchParams(location.search)
  return getOverrides('absmartly_overrides', queryPrefix, searchParams)
}

/**
 * Create SDK instance
 */
export function createSDK(ABsmartly: any, config: SDKConfig) {
  return new ABsmartly.SDK({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    environment: config.environment,
    application: config.application,
    retries: config.retries || 1,
    timeout: config.timeout || 2000,
  })
}

/**
 * Create SDK context
 */
export function createContext(
  sdk: any,
  unitId: string,
  unitType: string,
  serverData: any,
  contextConfig: any
) {
  const units: Record<string, string> = {}
  units[unitType || 'user_id'] = unitId

  const config = {
    units,
    ...contextConfig,
  }

  if (serverData) {
    return sdk.createContextWith(config, serverData)
  } else {
    return sdk.createContext(config)
  }
}

/**
 * Initialize DOMChangesPluginLite
 */
export function initializeDOMChangesPlugin(
  DOMChangesPluginLite: any,
  context: any,
  config: SDKConfig,
  debugLog: (...args: any[]) => void,
  logPrefix: string
) {
  try {
    const plugin = new DOMChangesPluginLite({
      context: context,
      autoApply: true,
      spa: true,
      visibilityTracking: true,
      debug: config.enableDebug || false,
      hideUntilReady: config.hideSelector || 'body',
      hideTransition: config.hideTransition || '0.3s ease-in',
    })
    debugLog('DOMChangesPluginLite loaded')
    return plugin
  } catch (error) {
    console.error(`[${logPrefix}] Failed to load DOMChangesPlugin:`, error)
    return null
  }
}

/**
 * Initialize WebVitalsPlugin
 */
export function initializeWebVitalsPlugin(
  WebVitalsPlugin: any,
  context: any,
  debugLog: (...args: any[]) => void,
  logPrefix: string
) {
  try {
    debugLog('Lazy loading WebVitals plugin')
    const plugin = new WebVitalsPlugin({
      context: context,
      trackWebVitals: true,
      trackPageMetrics: true,
      debug: false,
    })
    plugin.initialize()
    debugLog('Web vitals plugin initialized (tracking in background)')
    return plugin
  } catch (error) {
    console.error(`[${logPrefix}] Failed to load WebVitalsPlugin:`, error)
    return null
  }
}
