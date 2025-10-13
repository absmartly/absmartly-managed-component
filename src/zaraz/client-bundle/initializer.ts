import { ABSmartlySettings, ContextData } from '../../types'
import { getDOMManipulatorBundle } from './dom-manipulator'
import { generateAntiFlickerCSS } from './anti-flicker'

export function generateClientBundle(experimentData: ContextData, settings: ABSmartlySettings): string {
  const antiFlickerCSS = generateAntiFlickerCSS(settings)
  const domManipulator = getDOMManipulatorBundle()
  const initScript = generateInitScript(experimentData, settings)

  return antiFlickerCSS + '\\n' + '<script>' + domManipulator + initScript + '</script>'
}

function generateInitScript(experimentData: ContextData, settings: ABSmartlySettings): string {
  const dataJSON = JSON.stringify(experimentData)
  const selector = settings.HIDE_SELECTOR || 'body'
  const enableSPA = settings.ENABLE_SPA_MODE !== false
  const enableDebug = settings.ENABLE_DEBUG || false

  return `
;(function() {
  try {
    // Experiment data from edge
    var experimentData = ${dataJSON};

    // Initialize DOMManipulator
    var manipulator = new window.ABSmartlyDOMManipulator({
      debug: ${enableDebug},
      spa: ${enableSPA}
    });

    // Apply all DOM changes
    if (experimentData.experiments && experimentData.experiments.length > 0) {
      for (var i = 0; i < experimentData.experiments.length; i++) {
        var exp = experimentData.experiments[i];
        if (exp.changes && exp.changes.length > 0) {
          if (${enableDebug}) {
            console.log('[ABSmartly] Applying changes for experiment:', exp.name);
          }
          manipulator.applyChanges(exp.name, exp.changes);
        }
      }
    }

    // Remove anti-flicker and reveal page
    setTimeout(function() {
      var style = document.getElementById('absmartly-antiflicker');
      if (style) style.remove();
      var el = document.querySelector('${selector}');
      if (el) el.style.opacity = '1';

      if (${enableDebug}) {
        console.log('[ABSmartly] Page revealed, experiments applied');
      }
    }, 50);

    // Enable SPA mode if configured
    if (${enableSPA}) {
      manipulator.enableSPAMode();
      if (${enableDebug}) {
        console.log('[ABSmartly] SPA mode enabled');
      }
    }

  } catch (error) {
    console.error('[ABSmartly] Client initialization error:', error);
    // Failsafe: reveal page immediately on error
    var el = document.querySelector('${selector}');
    if (el) el.style.opacity = '1';
  }
})();
`.trim()
}

export function generateWebVitalsScript(): string {
  return `
<script type="module">
  import {onCLS, onLCP, onFCP, onINP, onTTFB} from 'https://unpkg.com/web-vitals@3/dist/web-vitals.js';

  function sendMetric(metric) {
    if (window.zaraz && window.zaraz.track) {
      window.zaraz.track('web_vital_' + metric.name, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta
      });
    }
  }

  onCLS(sendMetric);
  onLCP(sendMetric);
  onFCP(sendMetric);
  onINP(sendMetric);
  onTTFB(sendMetric);
</script>
  `.trim()
}
