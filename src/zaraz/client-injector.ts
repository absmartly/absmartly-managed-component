import { MCEvent } from '@managed-components/types'
import { ABSmartlySettings, ContextData } from '../types'
import { generateClientBundle, generateWebVitalsScript } from './client-bundle/initializer'
import { Logger } from '../types'

export class ClientInjector {
  constructor(private settings: ABSmartlySettings, private logger: Logger) {}

  injectExperimentCode(event: MCEvent, experimentData: ContextData): void {
    try {
      this.logger.debug('Injecting client code', {
        experimentsCount: experimentData.experiments.length,
      })

      // Generate the complete client bundle
      const clientBundle = generateClientBundle(experimentData, this.settings)

      // Inject via client.execute()
      event.client.execute(clientBundle)

      this.logger.debug('Client code injected successfully')

      // Inject web vitals if enabled
      if (this.settings.ENABLE_WEB_VITALS) {
        const webVitalsScript = generateWebVitalsScript()
        event.client.execute(webVitalsScript)
        this.logger.debug('Web vitals script injected')
      }
    } catch (error) {
      this.logger.error('Failed to inject client code:', error)

      // Inject failsafe to reveal page
      this.injectFailsafe(event)
    }
  }

  injectFailsafe(event: MCEvent): void {
    const selector = this.settings.HIDE_SELECTOR || 'body'
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

  injectDebugInfo(event: MCEvent, experimentData: ContextData): void {
    if (!this.settings.ENABLE_DEBUG) return

    const debugScript = `
      <script>
        console.log('[ABSmartly] Experiment data:', ${JSON.stringify(experimentData)});
        console.log('[ABSmartly] Settings:', {
          deployment: '${this.settings.DEPLOYMENT_MODE}',
          spaMode: ${this.settings.ENABLE_SPA_MODE !== false},
          webVitals: ${this.settings.ENABLE_WEB_VITALS || false}
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
