import { ABSmartlySettings } from '../../types'

export function generateAntiFlickerCSS(settings: ABSmartlySettings): string {
  const selector = settings.HIDE_SELECTOR || 'body'
  const timeout = settings.HIDE_TIMEOUT || 3000
  const transitionMs = settings.TRANSITION_MS || '300'

  return `
<style id="absmartly-antiflicker">
  ${selector} {
    opacity: 0 !important;
    transition: opacity ${transitionMs}ms ease-in;
  }
</style>
<script>
  // Failsafe timeout to ensure page is always revealed
  setTimeout(function() {
    var style = document.getElementById('absmartly-antiflicker');
    if (style) style.remove();
    var el = document.querySelector('${selector}');
    if (el) el.style.opacity = '1';
  }, ${timeout});
</script>
  `.trim()
}
