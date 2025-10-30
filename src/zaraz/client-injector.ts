import { MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { generateClientBundle } from '../shared/client-bundle-generator'
import { Logger } from '../types'
import { escapeSelectorForJS } from '../utils/selector-validator'

export class ClientInjector {
  constructor(
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  /**
   * Injects client-side bundle for Zaraz mode
   * Uses the shared client bundle generator for consistent behavior with WebCM
   */
  injectClientCode(event: MCEvent): void {
    try {
      this.logger.debug('Injecting client code for Zaraz mode')

      // Generate the complete client bundle using shared generator
      const clientBundle = generateClientBundle({
        mode: 'zaraz',
        settings: this.settings,
        logger: this.logger
      })

      // Inject via client.execute()
      event.client.execute(clientBundle)

      this.logger.debug('Client code injected successfully')
    } catch (error) {
      this.logger.error('Failed to inject client code:', error)

      // Inject failsafe to reveal page
      this.injectFailsafe(event)
    }
  }

  injectFailsafe(event: MCEvent): void {
    const selector = escapeSelectorForJS(this.settings.HIDE_SELECTOR || 'body')
    const failsafeScript = `
      <script>
        setTimeout(function() {
          var el = document.querySelector('${selector}');
          if (el) el.style.opacity = '1';
        }, 100);
      </script>
    `

    try {
      event.client.execute(failsafeScript)
      this.logger.debug('Failsafe script injected')
    } catch (error) {
      this.logger.error('Failed to inject failsafe:', error)
    }
  }

  injectDebugInfo(event: MCEvent): void {
    if (!this.settings.ENABLE_DEBUG) return

    const debugScript = `
      <script>
        console.log('[ABSmartly] Zaraz mode initialized');
        console.log('[ABSmartly] Settings:', {
          deployment: '${this.settings.DEPLOYMENT_MODE}',
          antiFlicker: ${this.settings.ENABLE_ANTI_FLICKER !== false},
          triggerOnView: ${this.settings.ENABLE_TRIGGER_ON_VIEW !== false}
        });
      </script>
    `

    try {
      event.client.execute(debugScript)
    } catch (error) {
      this.logger.error('Failed to inject debug info:', error)
    }
  }
}
