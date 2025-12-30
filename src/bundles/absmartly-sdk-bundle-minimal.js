/**
 * ABsmartly SDK Bundle - Minimal (SDK + DOMChanges only)
 *
 * Optimized for fastest parse time. Excludes:
 * - CookiePlugin (worker handles cookies server-side)
 * - WebVitalsPlugin (optional metrics)
 */

// Import only the SDK
const ABsmartlySDK = require('@absmartly/javascript-sdk')

// Import only DOMChangesPluginLite and getOverrides from the ES module path
import { DOMChangesPluginLite, getOverrides } from '@absmartly/sdk-plugins/es/index.js'

window.ABsmartly = ABsmartlySDK

const BUNDLE_VERSION = '1.2.0-minimal'
console.log('[ABsmartly Worker] SDK Bundle: ' + BUNDLE_VERSION)

var perfStart = performance.now()

function perf(name) {
  var elapsed = (performance.now() - perfStart).toFixed(2)
  console.log('[ABsmartly Worker +' + elapsed + 'ms] ' + name)
}

window.ABsmartlyInit = function(config, unitId, unitType, serverData, overrides, pluginConfig) {
  if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
    console.error('[ABsmartly Worker] SDK not loaded')
    return
  }

  try {
    perf('start')

    // Get client-side overrides from URL
    var searchParams = new URLSearchParams(location.search)
    var queryPrefix = config.queryPrefix || '_'
    var clientOverrides = getOverrides('absmartly_overrides', queryPrefix, searchParams)
    var mergedOverrides = Object.assign({}, overrides || {}, clientOverrides)

    var sdk = new ABsmartly.SDK({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      environment: config.environment,
      application: config.application,
      retries: config.retries || 1,
      timeout: config.timeout || 2000
    })

    perf('SDK configured')

    var units = {}
    units[unitType || 'user_id'] = unitId

    var context
    if (serverData) {
      context = sdk.createContextWith({ units: units, publishDelay: 100 }, serverData)
    } else {
      context = sdk.createContext({ units: units, publishDelay: 100 })
    }

    perf('context created')

    if (mergedOverrides && Object.keys(mergedOverrides).length > 0) {
      context.overrides(mergedOverrides)
    }

    window.ABsmartlyContext = context

    // Initialize DOMChangesPluginLite for SPA support
    var plugins = pluginConfig || { domChanges: true }

    if (plugins.domChanges !== false) {
      try {
        new DOMChangesPluginLite({
          context: context,
          autoApply: true,
          spa: true,
          visibilityTracking: true,
          debug: config.enableDebug || false,
          hideUntilReady: config.hideSelector || 'body',
          hideTransition: config.hideTransition || '0.3s ease-in'
        })
        perf('DOMChangesPlugin loaded')
      } catch (e) {
        console.error('[ABsmartly Worker] DOMChangesPlugin error:', e)
      }
    }

    context.ready().then(function() {
      perf('ready')
    }).catch(function(e) {
      console.error('[ABsmartly Worker] context error:', e)
    })
  } catch (e) {
    console.error('[ABsmartly Worker] init error:', e)
  }
}
