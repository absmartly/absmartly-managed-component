import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseAndMergeConfig } from '../../../src/utils/config-parser'
import { ABsmartlySettings, Logger } from '../../../src/types'

describe('parseAndMergeConfig', () => {
  let logger: Logger
  let baseSettings: ABsmartlySettings

  beforeEach(() => {
    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    baseSettings = {
      DEPLOYMENT_MODE: 'zaraz',
      SDK_API_KEY: 'api-key-from-individual-setting',
      ENDPOINT: 'https://default.example.com',
      ENVIRONMENT: 'default-env',
      APPLICATION: 'default-app',
    } as ABsmartlySettings
  })

  describe('when ZARAZ_CONFIG is not provided', () => {
    it('should return settings unchanged', () => {
      const result = parseAndMergeConfig(baseSettings, logger)

      expect(result).toEqual(baseSettings)
      expect(logger.log).not.toHaveBeenCalled()
    })
  })

  describe('when ZARAZ_CONFIG contains valid JSON', () => {
    it('should merge ZARAZ_CONFIG settings with individual settings', () => {
      const settingsWithConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: JSON.stringify({
          ENDPOINT: 'https://zaraz-config.example.com',
          ENVIRONMENT: 'zaraz-env',
          APPLICATION: 'zaraz-app',
          ENABLE_DEBUG: 'true',
        }),
      }

      const result = parseAndMergeConfig(settingsWithConfig, logger)

      expect(result.SDK_API_KEY).toBe('api-key-from-individual-setting')
      expect(result.ENDPOINT).toBe('https://default.example.com')
      expect(result.ENVIRONMENT).toBe('default-env')
      expect(result.APPLICATION).toBe('default-app')
      expect(result.ENABLE_DEBUG).toBe('true')
      expect(logger.log).toHaveBeenCalled()
    })

    it('should use ZARAZ_CONFIG values when individual settings are undefined', () => {
      const settingsWithConfig = {
        DEPLOYMENT_MODE: 'zaraz' as const,
        SDK_API_KEY: 'api-key',
        ENDPOINT: 'https://default.example.com',
        ENVIRONMENT: 'default-env',
        APPLICATION: 'default-app',
        ZARAZ_CONFIG: JSON.stringify({
          ENABLE_DEBUG: 'true',
          ENABLE_WEB_VITALS: 'true',
          SDK_TIMEOUT: '5000',
        }),
      }

      const result = parseAndMergeConfig(settingsWithConfig, logger)

      expect(result.ENABLE_DEBUG).toBe('true')
      expect(result.ENABLE_WEB_VITALS).toBe('true')
      expect(result.SDK_TIMEOUT).toBe('5000')
    })

    it('should allow API key to be overridden individually', () => {
      const settingsWithConfig = {
        ...baseSettings,
        SDK_API_KEY: 'individual-api-key',
        ZARAZ_CONFIG: JSON.stringify({
          SDK_API_KEY: 'zaraz-config-api-key',
          ENDPOINT: 'https://zaraz-config.example.com',
        }),
      }

      const result = parseAndMergeConfig(settingsWithConfig, logger)

      expect(result.SDK_API_KEY).toBe('individual-api-key')
      expect(result.ENDPOINT).toBe('https://default.example.com')
    })

    it('should log which keys were overridden', () => {
      const settingsWithConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: JSON.stringify({
          ENDPOINT: 'https://zaraz-config.example.com',
          ENABLE_DEBUG: 'true',
        }),
      }

      parseAndMergeConfig(settingsWithConfig, logger)

      expect(logger.log).toHaveBeenCalledWith(
        'Merged ZARAZ_CONFIG with individual settings',
        expect.objectContaining({
          zarazConfigKeys: expect.arrayContaining(['ENDPOINT', 'ENABLE_DEBUG']),
          overriddenKeys: expect.arrayContaining(['ENDPOINT']),
        })
      )
    })
  })

  describe('when ZARAZ_CONFIG contains invalid JSON', () => {
    it('should log error and return original settings', () => {
      const settingsWithBadConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: '{invalid json}',
      }

      const result = parseAndMergeConfig(settingsWithBadConfig, logger)

      expect(result).toEqual(settingsWithBadConfig)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse ZARAZ_CONFIG',
        expect.objectContaining({
          error: expect.any(String),
          value: '{invalid json}',
        })
      )
    })

    it('should handle non-object JSON values', () => {
      const settingsWithArrayConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: '["array", "value"]',
      }

      const result = parseAndMergeConfig(settingsWithArrayConfig, logger)

      expect(result).toEqual(settingsWithArrayConfig)
      expect(logger.warn).toHaveBeenCalledWith(
        'ZARAZ_CONFIG must be a valid JSON object',
        expect.objectContaining({
          value: '["array", "value"]',
        })
      )
    })

    it('should handle null JSON value', () => {
      const settingsWithNullConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: 'null',
      }

      const result = parseAndMergeConfig(settingsWithNullConfig, logger)

      expect(result).toEqual(settingsWithNullConfig)
      expect(logger.warn).toHaveBeenCalledWith(
        'ZARAZ_CONFIG must be a valid JSON object',
        expect.objectContaining({
          value: 'null',
        })
      )
    })
  })

  describe('real-world scenarios', () => {
    it('should handle the example from documentation', () => {
      const settingsWithConfig = {
        DEPLOYMENT_MODE: 'zaraz' as const,
        SDK_API_KEY: 'secret-api-key-from-variable',
        ENDPOINT: '',
        ENVIRONMENT: '',
        APPLICATION: '',
        ZARAZ_CONFIG: JSON.stringify({
          ENDPOINT: 'https://demo2.absmartly.com',
          ENVIRONMENT: 'Prod',
          APPLICATION: 'absmartly.com',
          UNIT_TYPE: 'absId',
          ENABLE_DEBUG: 'true',
        }),
      }

      const result = parseAndMergeConfig(settingsWithConfig, logger)

      expect(result.SDK_API_KEY).toBe('secret-api-key-from-variable')
      expect(result.ENDPOINT).toBe('https://demo2.absmartly.com')
      expect(result.ENVIRONMENT).toBe('Prod')
      expect(result.APPLICATION).toBe('absmartly.com')
      expect((result as any).UNIT_TYPE).toBe('absId')
      expect(result.ENABLE_DEBUG).toBe('true')
    })

    it('should work without logger', () => {
      const settingsWithConfig = {
        ...baseSettings,
        ZARAZ_CONFIG: JSON.stringify({
          ENABLE_DEBUG: 'true',
        }),
      }

      const result = parseAndMergeConfig(settingsWithConfig)

      expect(result.ENABLE_DEBUG).toBe('true')
    })
  })
})
