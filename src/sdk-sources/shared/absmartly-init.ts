/**
 * Core ABsmartlyInit implementation
 * Composed by mode-specific bundles
 */

import {
  createPerfTracking,
  initializeCookiePlugin,
  getClientOverrides,
  createSDK,
  createContext,
  initializeDOMChangesPlugin,
  initializeWebVitalsPlugin,
  type SDKInitParams,
} from './core'

export interface ABsmartlyInitOptions {
  logPrefix: string
  bundleVersion: string
  includeWebVitals: boolean
  eventLogger?: (event: string, data: any) => void
  onBeforeInit?: (params: SDKInitParams) => void
  onCookiePlugin?: (
    cookiePlugin: any,
    unitId: string,
    config: any
  ) => Promise<boolean>
}

/**
 * Creates ABsmartlyInit function with provided configuration
 */
export function createABsmartlyInit(
  ABsmartly: any,
  DOMChangesPluginLite: any,
  CookiePlugin: any,
  WebVitalsPlugin: any | null,
  getOverrides: any,
  options: ABsmartlyInitOptions
) {
  return function (
    config: SDKInitParams['config'],
    unitId: string,
    unitType: string,
    serverData: any,
    overrides: Record<string, number>,
    pluginConfig?: SDKInitParams['pluginConfig']
  ) {
    if (typeof ABsmartly === 'undefined' || !ABsmartly.SDK) {
      console.error(`[${options.logPrefix}] SDK not loaded`)
      return
    }

    try {
      const { perfMarks, markPerf, debugLog } = createPerfTracking(
        options.logPrefix
      )

      // Call optional before-init hook
      if (options.onBeforeInit) {
        options.onBeforeInit({
          config,
          unitId,
          unitType,
          serverData,
          overrides,
          pluginConfig,
        })
      }

      // Get client-side overrides
      const queryPrefix = config.queryPrefix || '_'
      const clientOverrides = getClientOverrides(getOverrides, queryPrefix)
      debugLog('Client-side overrides:', clientOverrides)

      // Merge server-side and client-side overrides
      const mergedOverrides = Object.assign(
        {},
        overrides || {},
        clientOverrides
      )
      debugLog('Merged overrides (server + client):', mergedOverrides)

      // Parse plugin configuration
      const plugins = pluginConfig || {
        domChanges: true,
        cookie: true,
        webVitals: options.includeWebVitals,
      }

      // Initialize CookiePlugin first (before SDK)
      let cookiePluginInstance = null
      if (plugins.cookie !== false) {
        cookiePluginInstance = initializeCookiePlugin(
          CookiePlugin,
          config,
          debugLog,
          options.logPrefix
        )
      }

      // Handle HttpOnly cookie if needed (Zaraz mode)
      if (
        cookiePluginInstance &&
        cookiePluginInstance.needsServerSideCookie() &&
        unitId &&
        options.onCookiePlugin
      ) {
        options
          .onCookiePlugin(cookiePluginInstance, unitId, config)
          .then(success => {
            if (success && cookiePluginInstance) {
              cookiePluginInstance.setUnitId(unitId)
            }
          })
      }

      debugLog('SDK Configuration:', {
        endpoint: config.endpoint,
        environment: config.environment,
        application: config.application,
        hasServerData: !!serverData,
      })

      markPerf('sdkConfigured')

      // Create SDK instance
      const sdk = createSDK(ABsmartly, config)

      // Create context with optional event logger
      const contextConfig: any = {
        publishDelay: 100,
      }

      if (options.eventLogger) {
        contextConfig.eventLogger = options.eventLogger
      }

      const context = createContext(
        sdk,
        unitId,
        unitType,
        serverData,
        contextConfig
      )
      markPerf('contextCreated')

      // Apply overrides
      if (mergedOverrides && Object.keys(mergedOverrides).length > 0) {
        debugLog('Applying overrides to context:', mergedOverrides)
        context.overrides(mergedOverrides)
      }

      // Expose context on window
      ;(window as any).ABsmartlyContext = context

      const contextAvailableTime = performance.now() - perfMarks.start
      console.log(
        `[${options.logPrefix}] 🎯 window.ABsmartlyContext available in ${contextAvailableTime.toFixed(2)}ms`
      )

      // Initialize plugins
      const pluginInstances: any = {}

      if (plugins.cookie !== false && cookiePluginInstance) {
        pluginInstances.cookie = cookiePluginInstance
        pluginInstances.cookie.setContext(context)
        pluginInstances.cookie.applyUtmAttributesToContext()
        debugLog('CookiePlugin attached to context')
      }

      if (plugins.domChanges !== false) {
        pluginInstances.domChanges = initializeDOMChangesPlugin(
          DOMChangesPluginLite,
          context,
          config,
          debugLog,
          options.logPrefix
        )
      }

      // Only initialize WebVitals if provided and not disabled
      if (
        options.includeWebVitals &&
        plugins.webVitals !== false &&
        WebVitalsPlugin
      ) {
        pluginInstances.webVitals = initializeWebVitalsPlugin(
          WebVitalsPlugin,
          context,
          debugLog,
          options.logPrefix
        )
      }

      markPerf('pluginsLoaded')

      // Wait for context ready
      context
        .ready()
        .then(() => {
          markPerf('contextReady')

          const contextReadyTime = perfMarks.contextReady - perfMarks.start
          console.log(
            `[${options.logPrefix}] ⚡ context.ready() completed in ${contextReadyTime.toFixed(2)}ms`
          )

          // Track context ready as a goal (if we have context.track)
          if (typeof context.track === 'function') {
            context.track('context_ready', {
              time_ms: Math.round(contextReadyTime),
              has_server_data: !!serverData,
            })
          }

          // Wait for DOM plugin if enabled
          if (pluginInstances.domChanges) {
            if (typeof pluginInstances.domChanges.ready === 'function') {
              return pluginInstances.domChanges.ready().then(() => {
                markPerf('domReady')
                const totalTime = perfMarks.domReady - perfMarks.start
                console.log(
                  `[${options.logPrefix}] 🎯 Total time to DOM ready: ${totalTime.toFixed(2)}ms`
                )
                debugLog('DOM changes plugin ready!')
              })
            } else {
              // DOMChangesPluginLite doesn't have ready() - use sync path
              markPerf('domReady')
              const totalTime = perfMarks.domReady - perfMarks.start
              console.log(
                `[${options.logPrefix}] 🎯 DOM changes ready (sync): ${totalTime.toFixed(2)}ms`
              )
            }
          }
        })
        .catch((error: any) => {
          console.error(
            `[${options.logPrefix}] ❌ Failed to load context:`,
            error
          )
        })
    } catch (error: any) {
      console.error(
        `[${options.logPrefix}] ❌ Failed to initialize SDK:`,
        error
      )
    }
  }
}
