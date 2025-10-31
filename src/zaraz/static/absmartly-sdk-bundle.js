/**
 * ABsmartly SDK Bundle for Zaraz
 *
 * This file contains:
 * 1. The ABsmartly JavaScript SDK (bundled)
 * 2. The ABsmartlyInit helper function for easy initialization
 *
 * This bundle is generated at build time and served at /_zaraz/absmartly-sdk.js
 * with 1-year browser cache for optimal performance
 */

// Import and expose the SDK globally
const ABsmartlySDK = require('@absmartly/javascript-sdk')
window.ABsmartly = ABsmartlySDK

/**
 * ABsmartlyInit - Helper function to initialize the SDK with configuration
 *
 * This function is called by the per-request initialization script
 * injected in the HTML. It handles all the boilerplate for:
 * - Creating the SDK instance
 * - Creating context with or without server data
 * - Applying overrides
 * - Setting up window.ABsmartlyContext
 *
 * @param {Object} config - SDK configuration (endpoint, apiKey, etc.)
 * @param {string} unitId - User/unit identifier
 * @param {Object|null} serverData - Pre-fetched context data (optional)
 * @param {Object} overrides - Experiment overrides for QA mode
 */
window.ABsmartlyInit = function(config, unitId, serverData, overrides) {
  if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
    console.error('[ABsmartly] SDK not loaded');
    return;
  }

  try {
    var sdk = new ABsmartly.SDK(config);
    var context;

    // Create context with or without server data
    if (serverData) {
      // Server provided context data - no CDN fetch needed!
      context = sdk.createContextWith(
        {
          units: { user_id: unitId }
        },
        serverData
      );
    } else {
      // No server data - SDK will fetch from ABsmartly API
      context = sdk.createContext({
        units: { user_id: unitId }
      });
    }

    // Apply experiment overrides (QA mode)
    if (overrides && Object.keys(overrides).length > 0) {
      context.overrides(overrides);
    }

    // Make context globally available
    window.ABsmartlyContext = context;

    // Log success
    if (serverData) {
      console.log('[ABsmartly] SDK initialized with server payload (no CDN fetch)');
    } else {
      context.ready().then(function() {
        console.log('[ABsmartly] SDK initialized and ready');
      }).catch(function(error) {
        console.error('[ABsmartly] Failed to load context:', error);
      });
    }
  } catch (error) {
    console.error('[ABsmartly] Failed to initialize SDK:', error);
  }
};

/**
 * Build Process Instructions:
 *
 * To create the production bundle:
 *
 * 1. Install dependencies:
 *    npm install @absmartly/javascript-sdk
 *
 * 2. Bundle with a tool like esbuild, webpack, or rollup:
 *    esbuild src/zaraz/static/absmartly-sdk-bundle.js \
 *      --bundle \
 *      --minify \
 *      --format=iife \
 *      --global-name=ABsmartly \
 *      --outfile=dist/absmartly-sdk.js
 *
 * 3. The bundled file should be served by Zaraz at:
 *    /_zaraz/absmartly-sdk.js
 *
 * 4. The bundle will include:
 *    - ABsmartly SDK (exported as window.ABsmartly)
 *    - ABsmartlyInit helper (exported as window.ABsmartlyInit)
 */
