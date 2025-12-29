import { ABsmartlySettings, Logger } from '../types'
import { injectClientBundleIntoHTML } from '../shared/injection-helpers'

/**
 * WebCM Client Injector
 * Wrapper around shared injection utilities for WebCM mode
 */
export class WebCMClientInjector {
  constructor(
    private settings: ABsmartlySettings,
    private logger: Logger
  ) {}

  /**
   * Injects client-side bundle into HTML response
   * Includes anti-flicker CSS, trigger-on-view tracking, and initialization
   * Bundle size: ~2-2.5KB
   */
  injectClientBundle(html: string): string {
    return injectClientBundleIntoHTML(html, this.settings, this.logger)
  }
}
