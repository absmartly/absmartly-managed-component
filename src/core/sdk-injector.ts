import {
  ABsmartlySettings,
  ExperimentData,
  OverridesMap,
  SDKConfig,
  ABsmartlyContextData,
  Logger,
} from '../types'
import sdkBundleZarazFull from '../bundles/sdk-bundle-inline-zaraz-full'
import sdkBundleZarazLite from '../bundles/sdk-bundle-inline-zaraz-lite'
import sdkBundleWorkerFull from '../bundles/sdk-bundle-inline-worker-full'
import sdkBundleWorkerLite from '../bundles/sdk-bundle-inline-worker-lite'

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

  private getPluginConfigStr(): string {
    const { settings } = this.options
    const trackerConfig = settings.TRACKER_CONFIG
    let trackerStr = 'false'
    if (trackerConfig) {
      trackerStr = JSON.stringify(trackerConfig)
    }
    return `{
  domChanges: ${settings.ENABLE_DOM_CHANGES_PLUGIN !== false},
  cookie: ${settings.ENABLE_COOKIE_PLUGIN !== false},
  webVitals: ${settings.ENABLE_WEB_VITALS_PLUGIN !== false},
  tracker: ${trackerStr}
}`
  }

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
      this.options.logger.log(
        'Using inline SDK strategy (WebCM mode - HTML, no network)'
      )
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
    const loadStrategy =
      this.options.settings.CLIENT_SDK_LOAD_STRATEGY || 'async'

    // For Zaraz mode: Inline the entire SDK bundle + init code
    // client.execute() expects pure JS, not HTML
    const isZarazMode = this.options.settings.DEPLOYMENT_MODE === 'zaraz'

    this.options.logger.log('generateExternalSDKScript: Zaraz mode check', {
      deploymentMode: this.options.settings.DEPLOYMENT_MODE,
      isZarazMode,
    })

    if (isZarazMode) {
      this.options.logger.log('Returning pure JS (Zaraz mode path)')

      // Use Zaraz-specific bundle (with zaraz.track integration)
      const useWebVitals =
        this.options.settings.ENABLE_WEB_VITALS_PLUGIN !== false
      const zarazBundle = useWebVitals ? sdkBundleZarazFull : sdkBundleZarazLite

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

      const pluginConfigStr = this.getPluginConfigStr()

      this.options.logger.log('Generated config strings for Zaraz mode', {
        configStr,
        pluginConfigStr,
        unitId,
        unitType,
        serverData: serverData === 'null' ? null : '<context data>',
        bundleType: useWebVitals ? 'zaraz-full' : 'zaraz-lite',
      })

      // Use string concatenation to avoid evaluating template literals in the bundle
      return (
        zarazBundle +
        '\n\n' +
        'window.ABsmartlyInit(' +
        configStr +
        ', ' +
        unitId +
        ', ' +
        unitType +
        ', ' +
        serverData +
        ', ' +
        overrides +
        ', ' +
        pluginConfigStr +
        ');'
      )
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

    // Check if we should use inline onload (faster) or polling (more compatible)
    const loadMethod = this.options.settings.CLIENT_SDK_LOAD_METHOD || 'polling'
    const useWebVitals =
      this.options.settings.ENABLE_WEB_VITALS_PLUGIN !== false

    // Inline onload approach: Faster (~1ms) but requires CSP to allow inline handlers
    if (loadMethod === 'onload') {
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

  if (typeof window.ABsmartlyInit === 'function') {
    perf('using ABsmartlyInit from bundle');
    try {
      window.ABsmartlyInit(config, unitId, unitType, serverData, overrides, ${this.getPluginConfigStr()});
      var elapsed = (performance.now() - perfStart).toFixed(2);
      if (elapsed > 500) {
        console.warn('[ABsmartly Worker +' + elapsed + 'ms] ⚠️  SDK ready (slow load)');
      } else {
        perf('SDK ready');
      }
    } catch (error) {
      console.error('[ABsmartly Worker] ❌ ABsmartlyInit failed:', error);
    }
  }
})();
"></script>
      `.trim()
    }

    // Polling approach: More browser compatible, works with CSP, handles caching
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
<script src="${sdkUrl}" ${loadStrategy}></script>
<script>
(function(config, unitId, unitType, serverData, overrides) {
  var perfStart = window.__absmartlyPerfStart;
  var perf = function(name) {
    var elapsed = (performance.now() - perfStart).toFixed(2);
    console.log('[ABsmartly Worker +' + elapsed + 'ms] ⏱️  ' + name);
  };

  function init() {
    if (typeof window.ABsmartlyInit !== 'undefined') {
      perf('SDK loaded - using ABsmartlyInit from bundle');
      try {
        window.ABsmartlyInit(config, unitId, unitType, serverData, overrides, {
          domChanges: ${this.options.settings.ENABLE_DOM_CHANGES_PLUGIN !== false},
          cookie: ${this.options.settings.ENABLE_COOKIE_PLUGIN !== false},
          webVitals: ${useWebVitals}
        });
        var elapsed = (performance.now() - perfStart).toFixed(2);
        if (elapsed > 500) {
          console.warn('[ABsmartly Worker +' + elapsed + 'ms] ⚠️  SDK ready (slow load)');
        } else {
          perf('SDK ready');
        }
      } catch (error) {
        console.error('[ABsmartly Worker] ❌ ABsmartlyInit failed:', error);
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
})(window.__absmartlyConfig, window.__absmartlyUnitId, window.__absmartlyUnitType, window.__absmartlyServerData, window.__absmartlyOverrides);
</script>
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
    const loadStrategy =
      this.options.settings.CLIENT_SDK_LOAD_STRATEGY || 'async'

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

    // Inline the entire SDK bundle + init code in a single script tag
    // This eliminates network latency (~200ms savings)
    // Select correct bundle based on deployment mode and WebVitals setting
    const useWebVitals =
      this.options.settings.ENABLE_WEB_VITALS_PLUGIN !== false
    const isZarazMode = this.options.settings.DEPLOYMENT_MODE === 'zaraz'

    let inlineBundle: string
    let bundleType: string

    if (isZarazMode) {
      // Zaraz mode: use Zaraz-specific bundles (with zaraz.track integration)
      inlineBundle = useWebVitals ? sdkBundleZarazFull : sdkBundleZarazLite
      bundleType = useWebVitals ? 'zaraz-full' : 'zaraz-lite'
    } else {
      // Worker/WebCM mode: use Worker bundles (no zaraz.track)
      inlineBundle = useWebVitals ? sdkBundleWorkerFull : sdkBundleWorkerLite
      bundleType = useWebVitals ? 'worker-full' : 'worker-lite'
    }

    // Base64 encoding: Proven solution that works reliably
    // 33% size overhead (~64KB) but eliminates all template literal parsing issues
    // TODO: Optimize with architect agent's recommendations (see plan agent output)
    const bundleBase64 = Buffer.from(inlineBundle).toString('base64')

    const scriptContent = `window.__absmartlyPerfStart = performance.now();

(function() {
  var perfStart = window.__absmartlyPerfStart;
  var perf = function(name) {
    var elapsed = (performance.now() - perfStart).toFixed(2);
    console.log('[ABsmartly Worker +' + elapsed + 'ms] ⏱️  ' + name);
  };

  perf('SDK inline bundle loading (${bundleType})');

  // Decode and execute SDK bundle from base64
  try {
    var bundleCode = atob('${bundleBase64}');
    new Function(bundleCode)();
    perf('SDK inline bundle executed');
  } catch (error) {
    console.error('[ABsmartly Worker] ❌ SDK bundle execution failed:', error);
    return;
  }

  var config = ${JSON.stringify(config)};
  var unitId = ${unitId};
  var unitType = ${unitType};
  var serverData = ${serverData};
  var overrides = ${overrides};

  if (typeof window.ABsmartlyInit === 'function') {
    perf('using ABsmartlyInit from inline bundle');
    try {
      window.ABsmartlyInit(config, unitId, unitType, serverData, overrides, ${this.getPluginConfigStr()});
    } catch (error) {
      console.error('[ABsmartly Worker] ❌ ABsmartlyInit failed:', error);
    }
  } else {
    console.error('[ABsmartly Worker] ❌ ABsmartlyInit not found in inline bundle');
  }
})();`

    return `<script>
${scriptContent}
</script>`
  }

  shouldInjectSDK(): boolean {
    return this.options.settings.INJECT_CLIENT_SDK === true
  }
}
