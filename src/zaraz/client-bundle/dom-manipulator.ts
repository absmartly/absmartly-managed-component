// DOMManipulator - Client-side bundle for applying DOM changes
// This will be injected into the browser via client.execute()

export function getDOMManipulatorBundle(): string {
  return `
(function() {
  'use strict';

  // ABSmartlyDOMManipulator - Applies DOM changes from ABsmartly experiments
  function ABSmartlyDOMManipulator(options) {
    this.options = options || {};
    this.debug = this.options.debug || false;
    this.applied = new Set();
    this.pendingChanges = [];
    this.observer = null;
    this.intersectionObserver = null;
    this.trackedExperiments = new Set();
    this.initIntersectionObserver();
  }

  ABSmartlyDOMManipulator.prototype.initIntersectionObserver = function() {
    var self = this;

    // Skip if IntersectionObserver not supported
    if (typeof IntersectionObserver === 'undefined') {
      if (this.debug) {
        console.warn('[ABSmartly] IntersectionObserver not supported, on-view tracking disabled');
      }
      return;
    }

    this.intersectionObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var element = entry.target;
          var experimentName = element.getAttribute('data-ab-experiment');
          var triggerOnView = element.getAttribute('data-ab-trigger-on-view');

          if (experimentName && triggerOnView === 'true') {
            // trackExperimentView handles deduplication
            self.trackExperimentView(experimentName);

            // Stop observing this element
            self.intersectionObserver.unobserve(element);
          }
        }
      });
    }, {
      threshold: 0.5, // Element must be 50% visible
      rootMargin: '0px'
    });
  };

  ABSmartlyDOMManipulator.prototype.trackExperimentView = function(experimentName) {
    // Check if already tracked
    if (this.trackedExperiments.has(experimentName)) {
      if (this.debug) {
        console.log('[ABSmartly] Experiment already tracked, skipping:', experimentName);
      }
      return;
    }

    // Mark as tracked
    this.trackedExperiments.add(experimentName);

    if (this.debug) {
      console.log('[ABSmartly] Tracking on-view exposure:', experimentName);
    }

    // Send exposure event via Zaraz
    if (typeof zaraz !== 'undefined' && zaraz.track) {
      zaraz.track('ExperimentView', { experimentName: experimentName });
    } else if (this.debug) {
      console.warn('[ABSmartly] zaraz.track not available, cannot track exposure for:', experimentName);
    }
  };

  ABSmartlyDOMManipulator.prototype.applyChanges = function(experimentName, changes) {
    if (!changes || !Array.isArray(changes)) return;

    for (var i = 0; i < changes.length; i++) {
      this.applyChange(experimentName, changes[i]);
    }
  };

  ABSmartlyDOMManipulator.prototype.applyChange = function(experimentName, change) {
    if (!change || !change.selector) return;

    var elements = document.querySelectorAll(change.selector);

    if (elements.length === 0) {
      // Element not found - add to pending if in SPA mode
      if (this.options.spa) {
        this.pendingChanges.push({ experimentName: experimentName, change: change });
      }
      return;
    }

    var changeId = change.selector + '_' + change.type;
    var triggerOnView = change.trigger_on_view === true;

    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];

      // Skip if already applied
      if (this.applied.has(changeId + '_' + i)) continue;

      try {
        this.applyChangeToElement(element, change);
        this.applied.add(changeId + '_' + i);

        // Mark element with experiment tracking attributes
        if (triggerOnView && this.intersectionObserver) {
          element.setAttribute('data-ab-experiment', experimentName);
          element.setAttribute('data-ab-trigger-on-view', 'true');

          // Start observing this element
          this.intersectionObserver.observe(element);

          if (this.debug) {
            console.log('[ABSmartly] Observing element for on-view tracking:', experimentName, element);
          }
        }

        if (this.debug) {
          console.log('[ABSmartly] Applied change:', change.type, 'to', element);
        }
      } catch (error) {
        console.error('[ABSmartly] Failed to apply change:', error);
      }
    }
  };

  ABSmartlyDOMManipulator.prototype.applyChangeToElement = function(element, change) {
    switch (change.type) {
      case 'text':
        element.textContent = change.value;
        break;

      case 'html':
        element.innerHTML = change.value;
        break;

      case 'style':
        if (typeof change.value === 'object') {
          for (var key in change.value) {
            element.style[key] = change.value[key];
          }
        } else {
          element.style.cssText = change.value;
        }
        break;

      case 'class':
        if (change.action === 'add') {
          element.classList.add(change.value);
        } else if (change.action === 'remove') {
          element.classList.remove(change.value);
        } else {
          element.className = change.value;
        }
        break;

      case 'attribute':
        if (change.value === null || change.value === undefined) {
          element.removeAttribute(change.name);
        } else {
          element.setAttribute(change.name, change.value);
        }
        break;

      case 'delete':
        element.remove();
        break;

      case 'move':
        var target = document.querySelector(change.target);
        if (target) {
          switch (change.position) {
            case 'before':
              target.parentNode.insertBefore(element, target);
              break;
            case 'after':
              target.parentNode.insertBefore(element, target.nextSibling);
              break;
            case 'prepend':
              target.insertBefore(element, target.firstChild);
              break;
            case 'append':
            default:
              target.appendChild(element);
              break;
          }
        }
        break;

      case 'javascript':
        try {
          var func = new Function('element', change.code);
          func(element);
        } catch (error) {
          console.error('[ABSmartly] Failed to execute javascript change:', error);
        }
        break;

      case 'create':
        try {
          var newElement = document.createElement(change.value.tag || 'div');
          if (change.value.html) {
            newElement.innerHTML = change.value.html;
          }
          if (change.value.attributes) {
            for (var attr in change.value.attributes) {
              newElement.setAttribute(attr, change.value.attributes[attr]);
            }
          }

          var target = document.querySelector(change.target || 'body');
          if (target) {
            switch (change.position) {
              case 'before':
                element.parentNode.insertBefore(newElement, element);
                break;
              case 'after':
                element.parentNode.insertBefore(newElement, element.nextSibling);
                break;
              case 'prepend':
                element.insertBefore(newElement, element.firstChild);
                break;
              case 'append':
              default:
                element.appendChild(newElement);
                break;
            }
          }
        } catch (error) {
          console.error('[ABSmartly] Failed to create element:', error);
        }
        break;

      case 'styleRules':
        try {
          var styleEl = document.getElementById('absmartly-styles');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'absmartly-styles';
            document.head.appendChild(styleEl);
          }
          if (styleEl.sheet) {
            styleEl.sheet.insertRule(change.rules, styleEl.sheet.cssRules.length);
          } else {
            styleEl.appendChild(document.createTextNode(change.rules));
          }
        } catch (error) {
          console.error('[ABSmartly] Failed to add style rules:', error);
        }
        break;
    }
  };

  ABSmartlyDOMManipulator.prototype.enableSPAMode = function() {
    var self = this;

    // Watch for DOM changes and reapply pending changes
    this.observer = new MutationObserver(function() {
      if (self.pendingChanges.length > 0) {
        var pending = self.pendingChanges.slice();
        self.pendingChanges = [];
        pending.forEach(function(item) {
          self.applyChange(item.experimentName, item.change);
        });
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Watch for navigation (SPA route changes)
    var lastPath = location.pathname;
    setInterval(function() {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        if (self.debug) {
          console.log('[ABSmartly] Navigation detected, reapplying changes');
        }
        // Reapply all changes on navigation
        self.applied.clear();
      }
    }, 100);
  };

  // Export to global scope
  window.ABSmartlyDOMManipulator = ABSmartlyDOMManipulator;
})();
`.trim()
}
