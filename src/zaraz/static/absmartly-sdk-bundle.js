/**
 * ABsmartly SDK Bundle for Zaraz
 *
 * This file contains:
 * 1. The ABsmartly JavaScript SDK (bundled)
 * 2. SDK Plugins (DOMChanges, Cookie, WebVitals)
 * 3. The ABsmartlyInit helper function for easy initialization
 * 4. Performance tracking utilities
 *
 * This bundle is generated at build time and served at /_zaraz/absmartly-sdk.js
 * with 1-year browser cache for optimal performance
 */

// Import cookie constants (esbuild will bundle this)
import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../../constants/cookies'

// Import and expose the SDK and plugins globally using CommonJS
// This works better with esbuild's IIFE format
const ABsmartlySDK = require('@absmartly/javascript-sdk')
const SDKPlugins = require('@absmartly/sdk-plugins')

window.ABsmartly = ABsmartlySDK

// Bundle version for tracking updates
const BUNDLE_VERSION = '1.0.5-direct-plugin-access'
console.log(`[ABsmartly Zaraz] 📦 SDK Bundle Version: ${BUNDLE_VERSION}`)
window.ABsmartlyBundleVersion = BUNDLE_VERSION

// Performance tracking
const perfMarks = {
  start: performance.now(),
  sdkConfigured: 0,
  contextCreated: 0,
  contextReady: 0,
  pluginsLoaded: 0,
  domReady: 0
}

function markPerf(name) {
  perfMarks[name] = performance.now()
  const elapsed = (perfMarks[name] - perfMarks.start).toFixed(2)
  if (name === 'start') {
    console.log(`[ABsmartly Zaraz] ⏱️  ${name}: ${elapsed}ms`)
  } else {
    console.log(`[ABsmartly Zaraz +${elapsed}ms] ⏱️  ${name}`)
  }
}

function debugLog(...args) {
  const elapsed = (performance.now() - perfMarks.start).toFixed(2)
  console.log(`[ABsmartly Zaraz +${elapsed}ms]`, ...args)
}

window.ABsmartlyInit = function(config, unitId, unitType, serverData, overrides, pluginConfig) {
  if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
    console.error('[ABsmartly Zaraz] SDK not loaded');
    return;
  }

  try {
    markPerf('start')

    // Track SDK initialization as a goal
    zaraz.track('absmartly_client_init', {
      has_server_data: !!serverData,
      unit_type: unitType
    });

    // Get client-side overrides from query params and cookies
    var searchParams = new URLSearchParams(location.search)
    var queryPrefix = config.queryPrefix || '_'
    var clientOverrides = SDKPlugins.getOverrides('absmartly_overrides', queryPrefix, searchParams)
    debugLog('Client-side overrides:', clientOverrides)

    // Merge server-side and client-side overrides (client-side takes precedence)
    var mergedOverrides = Object.assign({}, overrides || {}, clientOverrides)
    debugLog('Merged overrides (server + client):', mergedOverrides)

    // Parse plugin configuration
    var plugins = pluginConfig || {
      domChanges: true,
      cookie: true,  // Enable CookiePlugin for cookie management
      webVitals: true
    }

    // Initialize CookiePlugin first (before SDK)
    var cookiePluginInstance = null
    if (plugins.cookie !== false) {
      try {
        cookiePluginInstance = new SDKPlugins.CookiePlugin({
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
      } catch (error) {
        console.error('[ABsmartly Zaraz] ❌ Failed to initialize CookiePlugin:', error)
      }
    }

    // Check if we need to set server-side HttpOnly cookie
    // CookiePlugin checks if abs_public cookie exists (HttpOnly abs cookie is not readable from JS)
    if (cookiePluginInstance && cookiePluginInstance.needsServerSideCookie() && unitId) {
      debugLog('Setting HttpOnly cookie via Worker endpoint (CookiePlugin detected missing cookie)')

      var workerUrl = 'https://custom-mc-absmartly.absmartly.workers.dev'
      var setCookieUrl = workerUrl + '/set-cookie'

      fetch(setCookieUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cookieName: COOKIE_NAMES.UNIT_ID,
          cookieValue: unitId,
          maxAge: COOKIE_DEFAULTS.MAX_AGE_DAYS * 86400,
          domain: config.cookieDomain || window.location.hostname,
          secure: true,
          httpOnly: true,
          sameSite: 'Lax'
        }),
        credentials: 'include'
      }).then(function(response) {
        if (response.ok) {
          debugLog('✅ HttpOnly cookie set successfully')
          // Set the public cookie too
          if (cookiePluginInstance) {
            cookiePluginInstance.setUnitId(unitId)
          }
        } else {
          console.error('[ABsmartly Zaraz] Failed to set HttpOnly cookie:', response.status)
        }
      }).catch(function(error) {
        console.error('[ABsmartly Zaraz] Error setting HttpOnly cookie:', error)
      })
    }

    var sdkConfig = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      environment: config.environment,
      application: config.application,
      retries: config.retries,
      timeout: config.timeout
    };

    debugLog('SDK Configuration:', {
      endpoint: sdkConfig.endpoint,
      environment: sdkConfig.environment,
      application: sdkConfig.application,
      hasServerData: !!serverData
    })
    debugLog('Overrides to apply:', overrides || {})
    debugLog('Initializing SDK with ID:', unitId)
    debugLog('Mode:', serverData ? '(with preloaded data)' : '(will fetch data)')

    markPerf('sdkConfigured')

    var sdk = new ABsmartly.SDK(sdkConfig);

    var context;
    var units = {};
    units[unitType || 'user_id'] = unitId;

    // Create context config with event listeners
    var contextConfig = {
      units: units,
      publishDelay: 100, // Short delay for zaraz.track() batching
      // Listen for SDK events and forward to zaraz.track()
      eventLogger: function(event, data) {
        if (event === 'exposure') {
          // Track exposure using Segment "Experiment Viewed" semantic format
          zaraz.track('Experiment Viewed', {
            experiment_id: data.name,
            experiment_name: data.name,
            variation_id: String(data.variant),
            variation_name: String(data.variant),
            data
          });
        } else if (event === 'goal') {
          // Track goals using regular zaraz.track() with goal name
          zaraz.track(data.name, data.properties);
        } else if (event === 'publish') {
          // Track publish events as goals
          zaraz.track('absmartly_client_publish');
        }
      }
    };

    if (serverData) {
      context = sdk.createContextWith(contextConfig, serverData);
    } else {
      context = sdk.createContext(contextConfig);
    }

    markPerf('contextCreated')

    if (mergedOverrides && Object.keys(mergedOverrides).length > 0) {
      debugLog('Applying overrides to context:', mergedOverrides)
      context.overrides(mergedOverrides);
    }

    window.ABsmartlyContext = context;

    // Initialize plugins
    var pluginInstances = {}

    if (plugins.cookie !== false && cookiePluginInstance) {
      // Use the already-created CookiePlugin instance
      pluginInstances.cookie = cookiePluginInstance
      pluginInstances.cookie.setContext(context)

      // Apply UTM parameters to context
      pluginInstances.cookie.applyUtmAttributesToContext()

      debugLog('CookiePlugin attached to context')
    }

    if (plugins.domChanges !== false) {
      try {
        pluginInstances.domChanges = new SDKPlugins.DOMChangesPluginLite({
          context: context,
          autoApply: true,
          spa: true,
          visibilityTracking: true,
          debug: config.enableDebug || false,
          hideUntilReady: config.hideSelector || 'body',
          hideTransition: config.hideTransition || '0.3s ease-in',
        })
        debugLog('DOMChangesPluginLite loaded')
      } catch (error) {
        console.error('[ABsmartly Zaraz] ❌ Failed to load DOMChangesPlugin:', error)
      }
    }

    if (plugins.webVitals !== false) {
      try {
        debugLog('Lazy loading WebVitals plugin')
        pluginInstances.webVitals = new SDKPlugins.WebVitalsPlugin({
          context: context,
          trackWebVitals: true,
          trackPageMetrics: true,
          debug: false,
        })
        pluginInstances.webVitals.initialize()
        debugLog('Web vitals plugin initialized (tracking in background)')
      } catch (error) {
        console.error('[ABsmartly Zaraz] ❌ Failed to load WebVitalsPlugin:', error)
      }
    }

    markPerf('pluginsLoaded')

    // Wait for context ready and track timing
    // context.ready() returns immediately when created with createContextWith (server data)
    context.ready().then(function() {
      markPerf('contextReady')

      var contextReadyTime = perfMarks.contextReady - perfMarks.start
      console.log(`[ABsmartly Zaraz] ⚡ context.ready() completed in ${contextReadyTime.toFixed(2)}ms`)

      // Track context ready as a goal
      context.track('context_ready', {
        time_ms: Math.round(contextReadyTime),
        has_server_data: !!serverData
      })

      // Wait for DOM plugin if enabled
      if (pluginInstances.domChanges && pluginInstances.domChanges.ready) {
        return pluginInstances.domChanges.ready().then(function() {
          markPerf('domReady')

          var totalTime = perfMarks.domReady - perfMarks.start
          console.log(`[ABsmartly Zaraz] 🎯 Total time to DOM ready: ${totalTime.toFixed(2)}ms`)

          debugLog('DOM changes plugin ready!')
        })
      }
    }).catch(function(error) {
      console.error('[ABsmartly Zaraz] ❌ Failed to load context:', error);
    })
  } catch (error) {
    console.error('[ABsmartly Zaraz] ❌ Failed to initialize SDK:', error);
  }
};

/**
 * Build Process Instructions:
 *
 * To create the production bundle:
 *
 * 1. Install dependencies:
 *    npm install @absmartly/javascript-sdk @absmartly/sdk-plugins
 *
 * 2. Bundle with esbuild (configured in esbuild.js)
 *
 * 3. The bundled file will be served by Zaraz at:
 *    /_zaraz/absmartly-sdk.js
 *
 * 4. The bundle includes:
 *    - ABsmartly SDK (exported as window.ABsmartly)
 *    - ABsmartlyInit helper (exported as window.ABsmartlyInit)
 *    - Performance tracking utilities
 *
 * 5. After initialization, plugins can be accessed via:
 *    - window.ABsmartlyContext.__plugins.domPlugin (DOMChangesPluginLite)
 *    - window.ABsmartlyContext.__plugins.overridesPlugin (if using OverridesPlugin)
 */
