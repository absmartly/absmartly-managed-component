export const INIT_TEMPLATE = `/**
 * Initialization script
 * Handles anti-flicker removal and sets up client-side tracking
 */
(function() {
  'use strict';

  var debug = {{ENABLE_DEBUG}};
  var selector = '{{SELECTOR}}';

  if (debug) {
    console.log('[ABSmartly] Client bundle initialized');
  }

  // Remove anti-flicker and reveal page after a short delay
  // This gives the page time to render with server-side changes
  setTimeout(function() {
    try {
      var style = document.getElementById('absmartly-antiflicker');
      if (style) {
        style.remove();
      }
      var el = document.querySelector(selector);
      if (el) {
        el.style.opacity = '1';
      }

      if (debug) {
        console.log('[ABSmartly] Page revealed, client bundle ready');
      }
    } catch (error) {
      console.error('[ABSmartly] Error removing anti-flicker:', error);
      // Fallback: ensure page is revealed
      var element = document.querySelector(selector);
      if (element) {
        element.style.opacity = '1';
      }
    }
  }, 50);

  // Handle initialization errors
  window.ABSmartlyInit = {
    initialized: true,
    debug: debug
  };
})();`
