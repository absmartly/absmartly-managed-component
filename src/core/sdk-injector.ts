import {
  ABsmartlySettings,
  ExperimentData,
  OverridesMap,
  SDKConfig,
  ABsmartlyContextData,
  Logger,
} from '../types'
import sdkBundle from '../bundles/sdk-bundle-inline'
import sdkBundleLite from '../bundles/sdk-bundle-inline-lite'

export interface SDKInjectorOptions {
  settings: ABsmartlySettings
  logger: Logger
}

export interface SDKInjectionPayload {
  unitId: string
  unitType: string
  contextData?: ABsmartlyContextData
  overrides: OverridesMap
  experiments: ExperimentData[]
}

export interface ClientSDKConfig {
  endpoint: string
  apiKey: string
  environment: string
  application: string
  retries?: number
  timeout?: number
}

export class SDKInjector {
  constructor(private options: SDKInjectorOptions) {}

  generateInjectionScript(payload: SDKInjectionPayload): string {
    const { settings } = this.options

    if (!settings.INJECT_CLIENT_SDK) {
      this.options.logger.debug('SDK injection disabled')
      return ''
    }

    this.options.logger.log('🔧 generateInjectionScript called', {
      strategy: settings.CLIENT_SDK_STRATEGY,
      deploymentMode: settings.DEPLOYMENT_MODE,
      hasDeploymentMode: !!settings.DEPLOYMENT_MODE,
      deploymentModeType: typeof settings.DEPLOYMENT_MODE,
    })

    const config = this.buildClientSDKConfig()
    const sdkUrl = this.getSDKUrl()

    // For Zaraz mode, always use external script generator which has Zaraz-specific logic
    // (generates pure JS instead of HTML)
    const isZarazMode = settings.DEPLOYMENT_MODE === 'zaraz'

    this.options.logger.log('🔍 Checking deployment mode', {
      deploymentMode: settings.DEPLOYMENT_MODE,
      isZarazMode,
      clientSDKStrategy: settings.CLIENT_SDK_STRATEGY,
      willCheckZarazFirst: true,
    })

    // For Zaraz mode, ALWAYS use pure JS (never HTML tags)
    // This must be checked BEFORE CLIENT_SDK_STRATEGY to avoid HTML generation
    if (isZarazMode) {
      this.options.logger.log('✅ Using Zaraz mode (pure JS generation)', {
        willGeneratePureJS: true,
        noHTMLTags: true,
        callingGenerateExternalSDKScript: true,
      })
      return this.generateExternalSDKScript(sdkUrl, config, payload)
    }

    this.options.logger.log('⚠️ NOT in Zaraz mode - will generate HTML', {
      deploymentMode: settings.DEPLOYMENT_MODE,
      reason: 'deploymentMode !== "zaraz"',
    })

    // For WebCM mode, use bundled, inline, or external based on strategy
    if (settings.CLIENT_SDK_STRATEGY === 'bundled') {
      this.options.logger.log('Using bundled SDK strategy (WebCM mode - HTML)')
      return this.generateBundledScript(config, payload)
    }

    // Inline strategy: embed SDK directly in HTML to eliminate network request
    // This gives ~200ms faster load times compared to external file
    if (settings.CLIENT_SDK_STRATEGY === 'inline') {
      this.options.logger.log('Using inline SDK strategy (WebCM mode - HTML, no network)')
      return this.generateInlineScript(config, payload)
    }

    this.options.logger.log('Using external SDK strategy (WebCM mode - HTML)', {
      sdkUrl,
    })
    return this.generateExternalSDKScript(sdkUrl, config, payload)
  }

  private buildClientSDKConfig(): ClientSDKConfig {
    const { settings } = this.options

    return {
      endpoint: settings.ENDPOINT,
      apiKey: settings.SDK_API_KEY,
      environment: settings.ENVIRONMENT,
      application: settings.APPLICATION,
      retries: 1,
      timeout: 2000,
    }
  }

  private buildSDKConfig(): SDKConfig {
    const { settings } = this.options

    return {
      endpoint: settings.ENDPOINT,
      apiKey: settings.SDK_API_KEY,
      environment: settings.ENVIRONMENT,
      application: settings.APPLICATION,
      retries: 1,
      timeout: 2000,
    }
  }

  getServerSDKConfig(): SDKConfig {
    return this.buildSDKConfig()
  }

  private getSDKUrl(): string {
    const { settings } = this.options

    if (settings.CLIENT_SDK_STRATEGY === 'custom' && settings.CLIENT_SDK_URL) {
      return settings.CLIENT_SDK_URL
    }

    if (settings.CLIENT_SDK_STRATEGY === 'zaraz-bundle') {
      return '/_zaraz/absmartly-sdk.js'
    }

    // Local strategy: load SDK bundle from the worker's public directory
    // Add version parameter to bust CDN/browser cache
    if (settings.CLIENT_SDK_STRATEGY === 'local') {
      const baseUrl = settings.CLIENT_SDK_URL || '/absmartly-sdk.min.js'
      const version = settings.CLIENT_SDK_VERSION || '1.1.0'
      return `${baseUrl}?v=${version}`
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
    config: ClientSDKConfig,
    payload: SDKInjectionPayload
  ): string {
    const serverData = this.options.settings.PASS_SERVER_PAYLOAD
      ? JSON.stringify(payload.contextData)
      : 'null'

    const overrides = JSON.stringify(payload.overrides || {})
    const unitId = JSON.stringify(payload.unitId)
    const unitType = JSON.stringify(payload.unitType)

    // Script loading strategy: async (default) or defer
    const loadStrategy = this.options.settings.CLIENT_SDK_LOAD_STRATEGY || 'async'

    // For Zaraz mode: Inline the entire SDK bundle + init code
    // client.execute() expects pure JS, not HTML
    const isZarazMode = this.options.settings.DEPLOYMENT_MODE === 'zaraz'

    this.options.logger.log('generateExternalSDKScript: Zaraz mode check', {
      deploymentMode: this.options.settings.DEPLOYMENT_MODE,
      isZarazMode,
    })

    if (isZarazMode) {
      this.options.logger.log('Returning pure JS (Zaraz mode path)')
      // Inline the bundled SDK + call ABsmartlyInit
      // Build config object manually - use raw values to preserve Zaraz template variables
      // Don't JSON.stringify config values as they may contain {{ variable.xxx }} placeholders

      // Always use real ABsmartly endpoint for Zaraz mode
      // Events are forwarded via zaraz.track(), not a proxy
      const sdkEndpoint = config.endpoint

      this.options.logger.log('🔧 SDK endpoint (direct mode)', {
        endpoint: sdkEndpoint,
        note: 'Events forwarded via zaraz.track(), no proxy needed',
      })

      // Check if API key contains unresolved Zaraz variable
      const apiKey = this.options.settings.SDK_API_KEY
      const hasUnresolvedVariable =
        typeof apiKey === 'string' &&
        (apiKey.includes('{{') || apiKey.includes('variable.'))

      this.options.logger.log('🔑 API key check', {
        apiKeyPrefix:
          typeof apiKey === 'string' ? apiKey.substring(0, 20) : apiKey,
        apiKeyLength: typeof apiKey === 'string' ? apiKey.length : 0,
        hasUnresolvedVariable,
        isString: typeof apiKey === 'string',
      })

      if (hasUnresolvedVariable) {
        this.options.logger.error(
          '❌ API key contains unresolved Zaraz variable! The key will not work.',
          {
            apiKey,
            hint: 'Use ZARAZ_CONFIG or ensure the variable is resolved before passing to the component',
          }
        )
      }

      const configStr = `{
  endpoint: ${JSON.stringify(sdkEndpoint)},
  apiKey: ${JSON.stringify(apiKey)},
  environment: ${JSON.stringify(config.environment)},
  application: ${JSON.stringify(config.application)},
  retries: ${config.retries},
  timeout: ${config.timeout},
  enableDebug: ${this.options.settings.ENABLE_DEBUG || false},
  hideSelector: ${JSON.stringify(this.options.settings.HIDE_SELECTOR || 'body')},
  hideTransition: ${JSON.stringify(this.options.settings.TRANSITION_MS || '0.3s ease-in')},
  cookieDomain: ${JSON.stringify(this.options.settings.COOKIE_DOMAIN || '')},
  queryPrefix: ${JSON.stringify(this.options.settings.OVERRIDE_QUERY_PREFIX || '_')}
}`

      const pluginConfigStr = `{
  domChanges: ${this.options.settings.ENABLE_DOM_CHANGES_PLUGIN !== false},
  cookie: ${this.options.settings.ENABLE_COOKIE_PLUGIN !== false},
  webVitals: ${this.options.settings.ENABLE_WEB_VITALS_PLUGIN !== false}
}`

      this.options.logger.log('Generated config strings for Zaraz mode', {
        configStr,
        pluginConfigStr,
        unitId,
        unitType,
        serverData: serverData === 'null' ? null : '<context data>',
      })

      return `
${sdkBundle}

window.ABsmartlyInit(${configStr}, ${unitId}, ${unitType}, ${serverData}, ${overrides}, ${pluginConfigStr});
      `.trim()
    }

    // For WebCM mode: Return HTML script tags
    if (this.options.settings.CLIENT_SDK_STRATEGY === 'zaraz-bundle') {
      return `
<link rel="preload" href="${sdkUrl}" as="script">
<script src="${sdkUrl}" ${loadStrategy}></script>
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

    if (!this.options.settings.PASS_SERVER_PAYLOAD) {
      this.options.logger.warn(
        'Client SDK initialized without server payload. API calls will be made from the browser. ' +
          'For better security, enable PASS_SERVER_PAYLOAD to avoid exposing API endpoints to clients.'
      )
    }

    // Use ABsmartlyInit from the bundle if available (has all plugins)
    // Fall back to inline SDK init if ABsmartlyInit is not present
    return `
<link rel="preload" href="${sdkUrl}" as="script">
<script>
window.__absmartlyConfig = ${JSON.stringify(config)};
window.__absmartlyUnitId = ${unitId};
window.__absmartlyUnitType = ${unitType};
window.__absmartlyServerData = ${serverData};
window.__absmartlyOverrides = ${overrides};
window.__absmartlyPerfStart = performance.now();
</script>
<script src="${sdkUrl}" ${loadStrategy} onload="
(function() {
  var perfStart = window.__absmartlyPerfStart;
  var perf = function(name) {
    var elapsed = (performance.now() - perfStart).toFixed(2);
    console.log('[ABsmartly Worker +' + elapsed + 'ms] ⏱️  ' + name);
  };

  perf('SDK loaded');

  var config = window.__absmartlyConfig;
  var unitId = window.__absmartlyUnitId;
  var unitType = window.__absmartlyUnitType;
  var serverData = window.__absmartlyServerData;
  var overrides = window.__absmartlyOverrides;

  // If bundle has ABsmartlyInit (includes DOMChangesPlugin), use it
  if (typeof window.ABsmartlyInit === 'function') {
    perf('using ABsmartlyInit from bundle');
    try {
      window.ABsmartlyInit(config, unitId, unitType, serverData, overrides, {
        domChanges: true,
        cookie: false,
        webVitals: false
      });
    } catch (error) {
      console.error('[ABsmartly Worker] ❌ ABsmartlyInit failed:', error);
    }
    return;
  }

  // Fallback: manual SDK init (no plugins)
  perf('fallback: manual SDK init');
  try {
    var sdk = new ABsmartly.SDK(config);
    perf('SDK configured');
    var context;
    var units = {};
    units[unitType || 'user_id'] = unitId;

    if (serverData) {
      context = sdk.createContextWith({ units: units }, serverData);
      perf('context created (server payload)');
    } else {
      context = sdk.createContext({ units: units });
      perf('context created (will fetch)');
    }

    if (overrides && Object.keys(overrides).length > 0) {
      for (var exp in overrides) {
        context.override(exp, overrides[exp]);
      }
      perf('overrides applied');
    }

    window.ABsmartlyContext = context;
    perf('context exposed on window');

    if (serverData) {
      perf('✅ ready (no API fetch needed)');
    } else {
      context.ready().then(function() {
        perf('✅ ready (API fetch complete)');
      });
    }
  } catch (error) {
    console.error('[ABsmartly Worker] ❌ Failed to initialize SDK:', error);
  }
})();
"></script>
    `.trim()
  }

  private generateBundledScript(
    config: ClientSDKConfig,
    payload: SDKInjectionPayload
  ): string {
    const serverData = this.options.settings.PASS_SERVER_PAYLOAD
      ? JSON.stringify(payload.contextData)
      : 'null'

    const overrides = JSON.stringify(payload.overrides || {})
    const unitId = JSON.stringify(payload.unitId)

    // Script loading strategy: async (default) or defer
    const loadStrategy = this.options.settings.CLIENT_SDK_LOAD_STRATEGY || 'async'

    if (!this.options.settings.PASS_SERVER_PAYLOAD) {
      this.options.logger.warn(
        'Client SDK initialized without server payload. API calls will be made from the browser. ' +
          'For better security, enable PASS_SERVER_PAYLOAD to avoid exposing API endpoints to clients.'
      )
    }

    return `
<script src="/_zaraz/absmartly-sdk.js" ${loadStrategy}></script>
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

  private generateInlineScript(
    config: ClientSDKConfig,
    payload: SDKInjectionPayload
  ): string {
    const serverData = this.options.settings.PASS_SERVER_PAYLOAD
      ? JSON.stringify(payload.contextData)
      : 'null'

    const overrides = JSON.stringify(payload.overrides || {})
    const unitId = JSON.stringify(payload.unitId)
    const unitType = JSON.stringify(payload.unitType)

    if (!this.options.settings.PASS_SERVER_PAYLOAD) {
      this.options.logger.warn(
        'Client SDK initialized without server payload. API calls will be made from the browser. ' +
          'For better security, enable PASS_SERVER_PAYLOAD to avoid exposing API endpoints to clients.'
      )
    }

    // Inline the entire SDK bundle (lite) + init code in a single script tag
    // This eliminates network latency (~200ms savings)
    // Uses lite bundle (no WebVitals) for smaller size and faster parsing
    return `
<script>
window.__absmartlyPerfStart = performance.now();
${sdkBundleLite}

(function() {
  var perfStart = window.__absmartlyPerfStart;
  var perf = function(name) {
    var elapsed = (performance.now() - perfStart).toFixed(2);
    console.log('[ABsmartly Worker +' + elapsed + 'ms] ⏱️  ' + name);
  };

  perf('SDK inline bundle parsed');

  var config = ${JSON.stringify(config)};
  var unitId = ${unitId};
  var unitType = ${unitType};
  var serverData = ${serverData};
  var overrides = ${overrides};

  if (typeof window.ABsmartlyInit === 'function') {
    perf('using ABsmartlyInit from inline bundle');
    try {
      window.ABsmartlyInit(config, unitId, unitType, serverData, overrides, {
        domChanges: true,
        cookie: false,
        webVitals: false
      });
    } catch (error) {
      console.error('[ABsmartly Worker] ❌ ABsmartlyInit failed:', error);
    }
  } else {
    console.error('[ABsmartly Worker] ❌ ABsmartlyInit not found in inline bundle');
  }
})();
</script>
    `.trim()
  }

  shouldInjectSDK(): boolean {
    return this.options.settings.INJECT_CLIENT_SDK === true
  }
}
