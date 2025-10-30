import { ABSmartlySettings, Logger } from '../types'
import { generateClientBundle } from '../shared/client-bundle-generator'
import { injectIntoHTML } from '../utils/html-injection'

export class WebCMClientInjector {
  constructor(
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  /**
   * Injects client-side bundle into HTML response
   * Includes anti-flicker CSS, trigger-on-view tracking, and initialization
   * Bundle size: ~2-2.5KB
   */
  injectClientBundle(html: string): string {
    // Check if client bundle injection is enabled
    if (
      !this.settings.INJECT_CLIENT_BUNDLE &&
      this.settings.INJECT_CLIENT_BUNDLE !== undefined
    ) {
      this.logger.debug('Client bundle injection disabled')
      return html
    }

    try {
      const bundle = generateClientBundle({
        mode: 'webcm',
        settings: this.settings,
        logger: this.logger,
      })

      return injectIntoHTML(html, bundle)
    } catch (error) {
      this.logger.error('Failed to inject client bundle:', error)
      // Return original HTML on error (graceful degradation)
      return html
    }
  }
}
