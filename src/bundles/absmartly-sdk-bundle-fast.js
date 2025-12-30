/**
 * ABsmartly SDK Bundle - Fast Load
 *
 * Strategy: Load SDK core immediately, lazy-load plugins after first paint
 * This reduces initial parse time from ~180ms to ~100ms
 */

// Only import the core SDK (no plugins bundled)
const ABsmartlySDK = require('@absmartly/javascript-sdk')

window.ABsmartly = ABsmartlySDK
window.ABsmartlyBundleVersion = '2.0.0-fast'

var perfStart = performance.now()

function perf(name) {
  var elapsed = (performance.now() - perfStart).toFixed(2)
  console.log('[ABsmartly +' + elapsed + 'ms] ' + name)
}

window.ABsmartlyInit = function(config, unitId, unitType, serverData, overrides) {
  if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
    console.error('[ABsmartly] SDK not loaded')
    return
  }

  try {
    perf('start')

    // Parse URL overrides inline (no plugin needed)
    var clientOverrides = {}
    var prefix = config.queryPrefix || '_'
    var params = new URLSearchParams(location.search)
    params.forEach(function(value, key) {
      if (key.indexOf(prefix) === 0) {
        var expName = key.substring(prefix.length)
        var variant = parseInt(value, 10)
        if (!isNaN(variant)) {
          clientOverrides[expName] = variant
        }
      }
    })

    var mergedOverrides = Object.assign({}, overrides || {}, clientOverrides)

    var sdk = new ABsmartly.SDK({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      environment: config.environment,
      application: config.application,
      retries: 1,
      timeout: 2000
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

    if (mergedOverrides && Object.keys(mergedOverrides).length > 0) {
      context.overrides(mergedOverrides)
    }

    window.ABsmartlyContext = context
    perf('context ready')

    // Lazy-load DOMChangesPlugin after first paint
    requestIdleCallback(function() {
      perf('loading DOMChangesPlugin (idle)')

      // Dynamically load the plugin from CDN
      var script = document.createElement('script')
      script.src = 'https://unpkg.com/@absmartly/sdk-plugins@1.1.2/dist/absmartly-dom-changes-lite.min.js'
      script.onload = function() {
        perf('DOMChangesPlugin loaded')

        if (window.ABsmartlyDOMChangesPluginLite) {
          new window.ABsmartlyDOMChangesPluginLite({
            context: context,
            autoApply: true,
            spa: true,
            visibilityTracking: true,
            debug: config.enableDebug || false,
            hideUntilReady: config.hideSelector || 'body',
            hideTransition: config.hideTransition || '0.3s ease-in'
          })
          perf('DOMChangesPlugin initialized')
        }
      }
      document.head.appendChild(script)
    }, { timeout: 100 })

  } catch (e) {
    console.error('[ABsmartly] init error:', e)
  }
}
