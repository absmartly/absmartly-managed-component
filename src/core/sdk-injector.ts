import {
  ABSmartlySettings,
  ExperimentData,
  OverridesMap,
  SDKConfig,
  ABSmartlyContextData,
  Logger,
} from '../types'

export interface SDKInjectorOptions {
  settings: ABSmartlySettings
  logger: Logger
}

export interface SDKInjectionPayload {
  unitId: string
  contextData?: ABSmartlyContextData
  overrides: OverridesMap
  experiments: ExperimentData[]
}

export class SDKInjector {
  constructor(private options: SDKInjectorOptions) {}

  generateInjectionScript(payload: SDKInjectionPayload): string {
    const { settings } = this.options

    if (!settings.INJECT_CLIENT_SDK) {
      return ''
    }

    const config = this.buildSDKConfig()
    const sdkUrl = this.getSDKUrl()

    if (settings.CLIENT_SDK_STRATEGY === 'bundled') {
      return this.generateBundledScript(config, payload)
    }

    return this.generateExternalSDKScript(sdkUrl, config, payload)
  }

  private buildSDKConfig(): SDKConfig {
    const { settings } = this.options

    return {
      endpoint: settings.ABSMARTLY_ENDPOINT,
      apiKey: settings.ABSMARTLY_API_KEY,
      environment: settings.ABSMARTLY_ENVIRONMENT,
      application: settings.ABSMARTLY_APPLICATION,
      retries: 1,
      timeout: 2000,
    }
  }

  private getSDKUrl(): string {
    const { settings } = this.options

    if (settings.CLIENT_SDK_STRATEGY === 'custom' && settings.CLIENT_SDK_URL) {
      return settings.CLIENT_SDK_URL
    }

    if (settings.CLIENT_SDK_STRATEGY === 'zaraz-bundle') {
      return '/_zaraz/absmartly-sdk.js'
    }

    const provider = settings.CLIENT_SDK_CDN_PROVIDER || 'unpkg'
    const version = settings.CLIENT_SDK_VERSION || 'latest'

    if (provider === 'jsdelivr') {
      return `https://cdn.jsdelivr.net/npm/@absmartly/javascript-sdk@${version}/dist/absmartly.min.js`
    }

    return `https://unpkg.com/@absmartly/javascript-sdk@${version}/dist/absmartly.min.js`
  }

  private generateExternalSDKScript(
    sdkUrl: string,
    config: SDKConfig,
    payload: SDKInjectionPayload
  ): string {
    const serverData = this.options.settings.PASS_SERVER_PAYLOAD
      ? JSON.stringify(payload.contextData)
      : 'null'

    const overrides = JSON.stringify(payload.overrides || {})
    const unitId = JSON.stringify(payload.unitId)

    // For zaraz-bundle, use the bundled init helper
    if (this.options.settings.CLIENT_SDK_STRATEGY === 'zaraz-bundle') {
      return `
<script src="${sdkUrl}" async></script>
<script>
(function(config, unitId, serverData, overrides) {
  function init() {
    if (typeof ABsmartlyInit !== 'undefined') {
      try {
        ABsmartlyInit(config, unitId, serverData, overrides);
      } catch (error) {
        console.error('[ABsmartly] Failed to initialize SDK:', error);
      }
    } else {
      setTimeout(init, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(${JSON.stringify(config)}, ${unitId}, ${serverData}, ${overrides});
</script>
      `.trim()
    }

    // For external CDN or custom URL, use dynamic script loading
    return `
<script src="${sdkUrl}" async></script>
<script>
(function(config, unitId, serverData, overrides) {
  function init() {
    if (typeof ABsmartly !== 'undefined' && ABsmartly.SDK) {
      try {
        var sdk = new ABsmartly.SDK(config);
        var context;

        if (serverData) {
          context = sdk.createContextWith({
            units: { user_id: unitId }
          }, serverData);
        } else {
          context = sdk.createContext({
            units: { user_id: unitId }
          });
        }

        if (Object.keys(overrides).length > 0) {
          for (var exp in overrides) {
            context.override(exp, overrides[exp]);
          }
        }

        window.ABsmartlyContext = context;

        if (serverData) {
          console.log('[ABsmartly] SDK initialized with server payload (no CDN fetch)');
        } else {
          context.ready().then(function() {
            console.log('[ABsmartly] SDK initialized and ready');
          });
        }
      } catch (error) {
        console.error('[ABsmartly] Failed to initialize SDK:', error);
      }
    } else {
      setTimeout(init, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(${JSON.stringify(config)}, ${unitId}, ${serverData}, ${overrides});
</script>
    `.trim()
  }

  private generateBundledScript(
    config: SDKConfig,
    payload: SDKInjectionPayload
  ): string {
    const serverData = this.options.settings.PASS_SERVER_PAYLOAD
      ? JSON.stringify(payload.contextData)
      : 'null'

    const overrides = JSON.stringify(payload.overrides || {})
    const unitId = JSON.stringify(payload.unitId)

    return `
<script>
(function(config, unitId, serverData, overrides) {
  console.warn('[ABsmartly] Bundled SDK not yet implemented - use CDN strategy');
  console.log('[ABsmartly] Would initialize with:', { config: config, unitId: unitId, hasServerData: !!serverData });
})(${JSON.stringify(config)}, ${unitId}, ${serverData}, ${overrides});
</script>
    `.trim()
  }

  shouldInjectSDK(): boolean {
    return this.options.settings.INJECT_CLIENT_SDK === true
  }
}
