export const TRIGGER_ON_VIEW_TEMPLATE = `/**
 * Trigger-on-view tracking
 * Sets up IntersectionObserver to track when elements become visible
 * Supports both Zaraz (zaraz.track) and WebCM (/absmartly endpoint) modes
 */
(function() {
  'use strict';

  var mode = '{{MODE}}'; // 'zaraz' or 'webcm'
  var debug = {{ENABLE_DEBUG}};
  var trackedExperiments = new Set();

  // Skip if IntersectionObserver not supported
  if (typeof IntersectionObserver === 'undefined') {
    if (debug) {
      console.warn('[ABsmartly] IntersectionObserver not supported, trigger-on-view disabled');
    }
    return;
  }

  var intersectionObserver = new IntersectionObserver(
    function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var experimentName = entry.target.getAttribute('trigger-on-view');
          if (experimentName) {
            trackExperimentView(experimentName);
            intersectionObserver.unobserve(entry.target);
          }
        }
      });
    },
    {
      threshold: 0.5, // Element must be 50% visible
      rootMargin: '0px'
    }
  );

  function trackExperimentView(experimentName) {
    // Check if already tracked (prevent duplicates)
    if (trackedExperiments.has(experimentName)) {
      if (debug) {
        console.log('[ABsmartly] Experiment already tracked, skipping:', experimentName);
      }
      return;
    }

    // Mark as tracked
    trackedExperiments.add(experimentName);

    if (debug) {
      console.log('[ABsmartly] Tracking on-view exposure:', experimentName);
    }

    if (mode === 'zaraz') {
      // Zaraz mode: use zaraz.track()
      if (typeof zaraz !== 'undefined' && zaraz.track) {
        zaraz.track('ExperimentView', { experimentName: experimentName });
      } else if (debug) {
        console.warn('[ABsmartly] zaraz.track not available, cannot track exposure for:', experimentName);
      }
    } else if (mode === 'webcm') {
      // WebCM mode: POST to /absmartly endpoint
      if (typeof fetch !== 'undefined') {
        fetch('/absmartly', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'ExperimentView',
            experimentName: experimentName
          }),
          keepalive: true // Ensure request completes even if page unloads
        }).catch(function(error) {
          if (debug) {
            console.error('[ABsmartly] Failed to track exposure:', error);
          }
        });
      } else if (debug) {
        console.warn('[ABsmartly] fetch not available, cannot track exposure for:', experimentName);
      }
    }
  }

  // Scan for elements with trigger-on-view attribute
  function scanForTriggerOnView() {
    var elements = document.querySelectorAll('[trigger-on-view]');

    if (debug) {
      console.log('[ABsmartly] Scanning for trigger-on-view elements, found:', elements.length);
    }

    elements.forEach(function(element) {
      var experimentName = element.getAttribute('trigger-on-view');
      if (experimentName && !trackedExperiments.has(experimentName)) {
        intersectionObserver.observe(element);

        if (debug) {
          console.log('[ABsmartly] Set up trigger-on-view tracking for:', experimentName);
        }
      }
    });
  }

  // Scan on page load and when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForTriggerOnView);
  } else {
    scanForTriggerOnView();
  }

  // Also scan after a small delay to catch dynamically added elements
  setTimeout(scanForTriggerOnView, 100);
})();`
