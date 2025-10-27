import { ABSmartlySettings, Logger } from '../types'
import { generateClientBundle } from '../shared/client-bundle-generator'

export class WebCMClientInjector {
  constructor(private settings: ABSmartlySettings, private logger: Logger) {}

  /**
   * Injects client-side bundle into HTML response
   * Includes anti-flicker CSS, trigger-on-view tracking, and initialization
   * Bundle size: ~2-2.5KB
   */
  injectClientBundle(html: string): string {
    // Check if client bundle injection is enabled
    if (!this.settings.INJECT_CLIENT_BUNDLE && this.settings.INJECT_CLIENT_BUNDLE !== undefined) {
      this.logger.debug('Client bundle injection disabled')
      return html
    }

    try {
      const bundle = generateClientBundle({
        mode: 'webcm',
        settings: this.settings,
        logger: this.logger
      })

      return this.injectIntoHTML(html, bundle)
    } catch (error) {
      this.logger.error('Failed to inject client bundle:', error)
      // Return original HTML on error (graceful degradation)
      return html
    }
  }

  /**
   * Injects bundle before </head> or </body> tag
   */
  private injectIntoHTML(html: string, bundle: string): string {
    if (html.includes('</head>')) {
      return html.replace('</head>', `${bundle}</head>`)
    } else if (html.includes('</body>')) {
      return html.replace('</body>', `${bundle}</body>`)
    } else {
      // Append at the end if no head or body tags
      return html + bundle
    }
  }
}
