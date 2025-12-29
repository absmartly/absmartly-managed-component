import { ABsmartlySettings } from '../types'
import { Logger } from '../types'

export function parseAndMergeConfig(
  settings: ABsmartlySettings,
  logger?: Logger
): ABsmartlySettings {
  logger?.debug('parseAndMergeConfig called', {
    hasZarazConfig: !!settings.ZARAZ_CONFIG,
    zarazConfigType: typeof settings.ZARAZ_CONFIG,
    zarazConfigValue: settings.ZARAZ_CONFIG,
  })

  if (!settings.ZARAZ_CONFIG) {
    logger?.debug('No ZARAZ_CONFIG found, returning original settings')
    return settings
  }

  // Check if ZARAZ_CONFIG is a Zaraz template variable that wasn't resolved
  if (
    typeof settings.ZARAZ_CONFIG === 'string' &&
    settings.ZARAZ_CONFIG.includes('{{')
  ) {
    logger?.warn(
      'ZARAZ_CONFIG contains unresolved Zaraz template variable - put JSON directly in the field instead',
      {
        value: settings.ZARAZ_CONFIG,
      }
    )
    return settings
  }

  try {
    logger?.debug('Attempting to parse ZARAZ_CONFIG as JSON')
    const zarazConfig = JSON.parse(settings.ZARAZ_CONFIG)

    if (
      typeof zarazConfig !== 'object' ||
      zarazConfig === null ||
      Array.isArray(zarazConfig)
    ) {
      logger?.warn('ZARAZ_CONFIG must be a valid JSON object', {
        value: settings.ZARAZ_CONFIG,
      })
      return settings
    }

    logger?.debug('Successfully parsed ZARAZ_CONFIG', {
      parsedKeys: Object.keys(zarazConfig),
    })

    const mergedSettings = { ...settings }

    Object.keys(zarazConfig).forEach(key => {
      const currentValue = mergedSettings[key as keyof ABsmartlySettings]
      const shouldUseZarazConfig =
        !(key in mergedSettings) ||
        currentValue === undefined ||
        currentValue === null ||
        currentValue === ''

      if (shouldUseZarazConfig) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mergedSettings as any)[key] = zarazConfig[key]
      }
    })

    logger?.log('Merged ZARAZ_CONFIG with individual settings', {
      zarazConfigKeys: Object.keys(zarazConfig),
      overriddenKeys: Object.keys(zarazConfig).filter(key => {
        const currentValue = settings[key as keyof ABsmartlySettings]
        return (
          key in settings &&
          currentValue !== undefined &&
          currentValue !== null &&
          currentValue !== ''
        )
      }),
    })

    return mergedSettings
  } catch (error) {
    logger?.error('Failed to parse ZARAZ_CONFIG', {
      error: error instanceof Error ? error.message : String(error),
      value: settings.ZARAZ_CONFIG,
    })
    return settings
  }
}
