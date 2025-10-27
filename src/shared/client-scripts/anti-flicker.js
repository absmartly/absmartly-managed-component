/**
 * Anti-flicker CSS and failsafe script
 * Hides the page during experiment initialization with a failsafe timeout
 */
(function() {
  // Failsafe timeout to ensure page is always revealed
  var selector = '{{SELECTOR}}';
  var timeout = {{HIDE_TIMEOUT}};

  setTimeout(function() {
    var style = document.getElementById('absmartly-antiflicker');
    if (style) {
      style.remove();
    }
    var el = document.querySelector(selector);
    if (el) {
      el.style.opacity = '1';
    }
  }, timeout);
})();
