import { Manager } from '@managed-components/types'
import { ABsmartlySettings } from './types'
import { setupZarazMode } from './zaraz/setup'
import { setupWebCMMode } from './webcm/setup'
import { createLogger } from './utils/logger'
import { parseAndMergeConfig } from './utils/config-parser'

// Export worker integration module for use in existing Cloudflare Workers
export {
  processHTML,
  ProcessHTMLOptions,
  ProcessHTMLResult,
  WorkerClient,
  CookieToSet,
  buildSetCookieHeaders,
} from './worker'

// Export core utilities for advanced use cases
export { HTMLParserLinkedom } from './core/html-parser-linkedom'
export { HTMLProcessor } from './core/html-processor'
export { ContextManager } from './core/context-manager'
export { CookieHandler } from './core/cookie-handler'
export { createLogger, type LoggerMode } from './utils/logger'
export type {
  ABsmartlySettings,
  DOMChange,
  ExperimentData,
  Logger,
  SDKConfig,
  ABsmartlyContextData,
  ABsmartlyExperiment,
} from './types'

// Cache parsed settings to avoid re-parsing on every event
// Use API key as cache key since it's always present and unique per configuration
const parsedSettingsCache = new Map<string, ABsmartlySettings>()
let isSetupComplete = false

function hasUnresolvedVariables(settings: ABsmartlySettings): boolean {
  const checkValue = (value: unknown): boolean => {
    if (typeof value === 'string' && value.includes('{{')) {
      return true
    }
    return false
  }

  return (
    checkValue(settings.ENDPOINT) ||
    checkValue(settings.SDK_API_KEY) ||
    checkValue(settings.ENVIRONMENT) ||
    checkValue(settings.APPLICATION)
  )
}

export default async function (manager: Manager, settings: ABsmartlySettings) {
  const logger = createLogger(settings.ENABLE_DEBUG || false, 'zaraz')

  try {
    // Skip cache if we have unresolved template variables
    const hasUnresolved = hasUnresolvedVariables(settings)

    // Try to load resolved settings from KV if we have unresolved variables
    if (hasUnresolved) {
      logger.log('⚠️ Unresolved variables detected, checking KV storage', {
        hasApiKey: !!settings.SDK_API_KEY,
        apiKeyValue: settings.SDK_API_KEY,
      })

      try {
        const resolvedSettings = await manager.get('resolved_settings')
        if (resolvedSettings) {
          logger.log(
            '✅ Found resolved settings in KV storage, using those for all config'
          )
          // Use ALL resolved settings from KV
          // This ensures any Zaraz variables are properly resolved
          settings = {
            ...settings, // Keep any new settings from current request
            ...resolvedSettings, // Override with resolved values from /init
          }

          logger.log('Using resolved settings from KV:', {
            hasApiKey: !!settings.SDK_API_KEY,
            apiKeyLength: settings.SDK_API_KEY?.length,
            endpoint: settings.ENDPOINT,
            environment: settings.ENVIRONMENT,
            application: settings.APPLICATION,
          })
        } else {
          logger.warn(
            '⚠️ No resolved settings in KV storage yet (first /init call pending)'
          )
        }
      } catch (kvError) {
        logger.error('Failed to read from KV storage:', kvError)
      }
    }

    const cacheKey = settings.SDK_API_KEY || 'default'
    let mergedSettings = parsedSettingsCache.get(cacheKey)

    // Recheck after potentially loading from KV
    const stillHasUnresolved = hasUnresolvedVariables(settings)

    if (!mergedSettings || stillHasUnresolved) {
      if (stillHasUnresolved) {
        logger.warn('Still have unresolved variables, skipping cache')
      }

      logger.log('Raw settings received:', {
        hasApiKey: !!settings.SDK_API_KEY,
        hasEndpoint: !!settings.ENDPOINT,
        hasEnvironment: !!settings.ENVIRONMENT,
        hasApplication: !!settings.APPLICATION,
        hasZarazConfig: !!settings.ZARAZ_CONFIG,
        allKeys: Object.keys(settings),
        // DEBUG: Show actual values
        ENDPOINT_VALUE: settings.ENDPOINT,
        SDK_API_KEY_VALUE: settings.SDK_API_KEY
          ? settings.SDK_API_KEY.substring(0, 20) + '...'
          : undefined,
        ZARAZ_CONFIG_VALUE: settings.ZARAZ_CONFIG,
      })

      // Parse and merge ZARAZ_CONFIG before validation
      mergedSettings = parseAndMergeConfig(settings, logger)

      logger.log('Settings after merge:', {
        hasApiKey: !!mergedSettings.SDK_API_KEY,
        endpoint: mergedSettings.ENDPOINT,
        environment: mergedSettings.ENVIRONMENT,
        application: mergedSettings.APPLICATION,
      })

      // Validate required settings
      if (!mergedSettings.SDK_API_KEY) {
        throw new Error('SDK_API_KEY is required')
      }

      if (!mergedSettings.ENDPOINT) {
        throw new Error('ENDPOINT is required')
      }

      if (!mergedSettings.ENVIRONMENT) {
        throw new Error('ENVIRONMENT is required')
      }

      if (!mergedSettings.APPLICATION) {
        throw new Error('APPLICATION is required')
      }

      // Only cache if no unresolved variables
      if (!stillHasUnresolved) {
        parsedSettingsCache.set(cacheKey, mergedSettings)

        // Store resolved settings in KV for future requests with unresolved variables
        try {
          await manager.set('resolved_settings', mergedSettings)
          logger.log(
            '✅ Stored resolved settings in KV storage for future requests'
          )
        } catch (kvError) {
          logger.error('Failed to save to KV storage:', kvError)
        }
      }
    }

    // Route to appropriate setup based on deployment mode
    // Note: Setup must run on every request because each request gets a new Manager instance
    // Event listeners must be re-registered for each request
    const deploymentMode = mergedSettings.DEPLOYMENT_MODE || 'zaraz'

    if (!isSetupComplete) {
      logger.log(
        `Starting ABsmartly Managed Component in ${deploymentMode} mode`
      )
      isSetupComplete = true
    }

    if (deploymentMode === 'webcm') {
      setupWebCMMode(manager, mergedSettings)
    } else {
      // Default to Zaraz mode
      setupZarazMode(manager, mergedSettings)
    }
  } catch (error) {
    logger.error('Failed to initialize ABsmartly Managed Component:', error)
    throw error
  }
}
