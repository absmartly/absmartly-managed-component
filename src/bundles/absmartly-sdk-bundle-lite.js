/**
 * ABsmartly SDK Bundle Lite (No WebVitals)
 *
 * This is a lighter version of the SDK bundle optimized for faster parse time.
 * Excludes: WebVitals plugin, Zaraz-specific tracking
 */

import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../constants/cookies'

// Import SDK and specific plugins
const ABsmartlySDK = require('@absmartly/javascript-sdk')
import {
  DOMChangesPluginLite,
  CookiePlugin,
  getOverrides
} from '@absmartly/sdk-plugins/es/index.js'

window.ABsmartly = ABsmartlySDK

const BUNDLE_VERSION = '1.1.0-lite'
window.ABsmartlyBundleVersion = BUNDLE_VERSION

// Use global perf start from inline wrapper, or fallback to now
const perfStart = window.__absmartlyPerfStart || performance.now()
const perfMarks = {
  start: perfStart,
  sdkConfigured: 0,
  contextCreated: 0,
  contextReady: 0,
  pluginsLoaded: 0,
  domReady: 0
}

console.log('[ABsmartly Worker] SDK Bundle Version: ' + BUNDLE_VERSION)

function markPerf(name) {
  perfMarks[name] = performance.now()
  var elapsed = (perfMarks[name] - perfMarks.start).toFixed(2)
  console.log('[ABsmartly Worker +' + elapsed + 'ms] ' + name)
}

function debugLog() {
  var elapsed = (performance.now() - perfMarks.start).toFixed(2)
  var args = Array.prototype.slice.call(arguments)
  args.unshift('[ABsmartly Worker +' + elapsed + 'ms]')
  console.log.apply(console, args)
}

window.ABsmartlyInit = function(config, unitId, unitType, serverData, overrides, pluginConfig) {
  if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
    console.error('[ABsmartly Worker] SDK not loaded');
    return;
  }

  try {
    // Get client-side overrides
    var searchParams = new URLSearchParams(location.search)
    var queryPrefix = config.queryPrefix || '_'
    var clientOverrides = getOverrides('absmartly_overrides', queryPrefix, searchParams)

    // Merge overrides (client-side takes precedence)
    var mergedOverrides = Object.assign({}, overrides || {}, clientOverrides)

    // Parse plugin configuration
    var plugins = pluginConfig || {
      domChanges: true,
      cookie: true
    }

    // Initialize CookiePlugin
    var cookiePluginInstance = null
    if (plugins.cookie !== false) {
      try {
        cookiePluginInstance = new CookiePlugin({
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
        console.error('[ABsmartly Worker] Failed to initialize CookiePlugin:', error)
      }
    }

    var sdkConfig = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      environment: config.environment,
      application: config.application,
      retries: config.retries,
      timeout: config.timeout
    };

    markPerf('sdkConfigured')

    var sdk = new ABsmartly.SDK(sdkConfig);

    var context;
    var units = {};
    units[unitType || 'user_id'] = unitId;

    var contextConfig = {
      units: units,
      publishDelay: 100
    };

    if (serverData) {
      context = sdk.createContextWith(contextConfig, serverData);
    } else {
      context = sdk.createContext(contextConfig);
    }

    markPerf('contextCreated')

    if (mergedOverrides && Object.keys(mergedOverrides).length > 0) {
      context.overrides(mergedOverrides);
    }

    window.ABsmartlyContext = context;

    var pluginInstances = {}

    if (plugins.cookie !== false && cookiePluginInstance) {
      pluginInstances.cookie = cookiePluginInstance
      pluginInstances.cookie.setContext(context)
      pluginInstances.cookie.applyUtmAttributesToContext()
    }

    if (plugins.domChanges !== false) {
      try {
        // Plugin handles waiting for document.body internally
        pluginInstances.domChanges = new DOMChangesPluginLite({
          context: context,
          autoApply: true,
          spa: true,
          visibilityTracking: true,
          debug: config.enableDebug || false,
          hideUntilReady: config.hideSelector || false,
          hideTransition: config.hideTransition || '0.3s ease-in',
        })
        debugLog('DOMChangesPluginLite loaded')
      } catch (error) {
        console.error('[ABsmartly Worker] Failed to load DOMChangesPlugin:', error)
      }
    }

    markPerf('pluginsLoaded')

    context.ready().then(function() {
      markPerf('contextReady')

      var contextReadyTime = perfMarks.contextReady - perfMarks.start
      console.log('[ABsmartly Worker] context.ready() in ' + contextReadyTime.toFixed(2) + 'ms')

      // Check if DOMChangesPlugin has a ready() method
      if (pluginInstances.domChanges) {
        if (typeof pluginInstances.domChanges.ready === 'function') {
          pluginInstances.domChanges.ready().then(function() {
            markPerf('domReady')
            var totalTime = perfMarks.domReady - perfMarks.start
            console.log('[ABsmartly Worker] 🎯 DOM changes ready: ' + totalTime.toFixed(2) + 'ms')
          }).catch(function(err) {
            console.error('[ABsmartly Worker] DOMChangesPlugin.ready() error:', err)
          })
        } else {
          // DOMChangesPluginLite doesn't have ready() - use DOM mutation observer instead
          markPerf('domReady')
          var totalTime = perfMarks.domReady - perfMarks.start
          console.log('[ABsmartly Worker] 🎯 DOM changes ready (sync): ' + totalTime.toFixed(2) + 'ms')
        }
      } else {
        console.log('[ABsmartly Worker] DOMChangesPlugin not loaded')
      }
    }).catch(function(error) {
      console.error('[ABsmartly Worker] Failed to load context:', error);
    })
  } catch (error) {
    console.error('[ABsmartly Worker] Failed to initialize SDK:', error);
  }
};
