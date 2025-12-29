import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OverridesHandler } from '../../../src/core/overrides-handler'
import { MCEvent, Client } from '@managed-components/types'
import { ABsmartlySettings } from '../../../src/types'
import { COOKIE_NAMES } from '../../../src/constants/cookies'

describe('OverridesHandler', () => {
  let handler: OverridesHandler
  let mockEvent: Partial<MCEvent>
  let mockClient: Partial<Client>
  let cookieStorage: Map<string, string>
  let mockSettings: ABsmartlySettings

  const createMockClient = (urlString: string = 'https://example.com'): Partial<Client> => {
    return {
      url: new URL(urlString),
      get: vi.fn((key: string) => cookieStorage.get(key)),
      set: vi.fn((key: string, value: string, options?: any): boolean => {
        cookieStorage.set(key, value)
        return true
      }),
    }
  }

  beforeEach(() => {
    mockSettings = {
      DEPLOYMENT_MODE: 'zaraz',
      SDK_API_KEY: 'test-key',
      ENDPOINT: 'https://api.example.com',
      ENVIRONMENT: 'test',
      APPLICATION: 'test-app',
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'Lax',
    } as ABsmartlySettings
    handler = new OverridesHandler(mockSettings)
    cookieStorage = new Map()

    mockClient = createMockClient()

    mockEvent = {
      client: mockClient as Client,
    }
  })

  describe('getOverrides', () => {
    it('should return empty object when no overrides present', () => {
      const overrides = handler.getOverrides(mockEvent as MCEvent)

      expect(overrides).toEqual({})
    })

    it('should get URL overrides', () => {
      mockClient = createMockClient('https://example.com?absmartly_experiment1=2&absmartly_experiment2=1')
      mockEvent.client = mockClient as Client

      const overrides = handler.getOverrides(mockEvent as MCEvent)

      expect(overrides).toEqual({
        experiment1: 2,
        experiment2: 1,
      })
    })

    it('should get cookie overrides', () => {
      cookieStorage.set(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ experiment1: 3, experiment2: 0 })
      )

      const overrides = handler.getOverrides(mockEvent as MCEvent)

      expect(overrides).toEqual({
        experiment1: 3,
        experiment2: 0,
      })
    })

    it('should merge URL and cookie overrides with cookie taking precedence', () => {
      mockClient = createMockClient('https://example.com?absmartly_experiment1=2')
      cookieStorage.set(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ experiment1: 0, experiment2: 1 })
      )

      const overrides = handler.getOverrides(mockEvent as MCEvent)

      expect(overrides).toEqual({
        experiment1: 0, // Cookie overrides URL (assigned last)
        experiment2: 1, // From cookie
      })
    })
  })

  describe('getURLOverrides', () => {
    it('should extract overrides from URL with absmartly_ prefix', () => {
      mockClient = createMockClient('https://example.com?absmartly_exp1=1&absmartly_exp2=2')
      mockEvent.client = mockClient as Client

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides).toEqual({
        exp1: 1,
        exp2: 2,
      })
    })

    it('should ignore non-absmartly parameters', () => {
      mockClient = createMockClient('https://example.com?absmartly_exp1=1&other_param=value&foo=bar')
      mockEvent.client = mockClient as Client

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides).toEqual({
        exp1: 1,
      })
    })

    it('should handle URL without query parameters', () => {
      mockClient = createMockClient('https://example.com')

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides).toEqual({})
    })

    it('should parse variant values as integers', () => {
      mockClient = createMockClient('https://example.com?absmartly_exp1=0&absmartly_exp2=3')
      mockEvent.client = mockClient as Client

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides.exp1).toBe(0)
      expect(overrides.exp2).toBe(3)
      expect(typeof overrides.exp1).toBe('number')
      expect(typeof overrides.exp2).toBe('number')
    })

    it('should handle invalid URL gracefully', () => {
      // Create mock with a valid URL but set it to throw when accessed
      mockClient = {
        url: { toString: () => 'not-a-valid-url' } as any,
        get: vi.fn((key: string) => cookieStorage.get(key)),
        set: vi.fn(() => true),
      }
      mockEvent.client = mockClient as Client
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides).toEqual({})
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should handle experiment names with underscores', () => {
      mockClient = createMockClient('https://example.com?absmartly_my_experiment_name=2')
      mockEvent.client = mockClient as Client

      const overrides = (handler as any).getURLOverrides(mockEvent)

      expect(overrides).toEqual({
        my_experiment_name: 2,
      })
    })
  })

  describe('getCookieOverrides', () => {
    it('should parse valid JSON from cookie', () => {
      cookieStorage.set(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 1, exp2: 2 })
      )

      const overrides = (handler as any).getCookieOverrides(mockEvent)

      expect(overrides).toEqual({
        exp1: 1,
        exp2: 2,
      })
    })

    it('should return empty object when cookie does not exist', () => {
      const overrides = (handler as any).getCookieOverrides(mockEvent)

      expect(overrides).toEqual({})
    })

    it('should return empty object for invalid JSON', () => {
      cookieStorage.set(COOKIE_NAMES.OVERRIDES, 'invalid json')

      const overrides = (handler as any).getCookieOverrides(mockEvent)

      expect(overrides).toEqual({})
    })

    it('should handle errors gracefully', () => {
      mockClient.get = vi.fn(() => {
        throw new Error('Cookie access failed')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const overrides = (handler as any).getCookieOverrides(mockEvent)

      expect(overrides).toEqual({})
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('setOverride', () => {
    it('should set override in cookie', () => {
      handler.setOverride(mockEvent as MCEvent, 'exp1', 2)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 2 }),
        {
          scope: 'page',
          expiry: 7 * 86400,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
        }
      )
    })

    it('should merge with existing overrides', () => {
      cookieStorage.set(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 1, exp2: 0 })
      )

      handler.setOverride(mockEvent as MCEvent, 'exp3', 2)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 1, exp2: 0, exp3: 2 }),
        expect.any(Object)
      )
    })

    it('should update existing override', () => {
      cookieStorage.set(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 1 })
      )

      handler.setOverride(mockEvent as MCEvent, 'exp1', 2)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 2 }),
        expect.any(Object)
      )
    })

    it('should handle variant 0', () => {
      handler.setOverride(mockEvent as MCEvent, 'exp1', 0)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        JSON.stringify({ exp1: 0 }),
        expect.any(Object)
      )
    })
  })

  describe('clearOverrides', () => {
    it('should clear overrides cookie', () => {
      cookieStorage.set(COOKIE_NAMES.OVERRIDES, JSON.stringify({ exp1: 1 }))

      handler.clearOverrides(mockEvent as MCEvent)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        '',
        {
          scope: 'page',
          expiry: 0,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
        }
      )
    })

    it('should work even when no overrides exist', () => {
      handler.clearOverrides(mockEvent as MCEvent)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.OVERRIDES,
        '',
        expect.any(Object)
      )
    })
  })

  describe('hasOverrides', () => {
    it('should return true when overrides present', () => {
      const overrides = { exp1: 1, exp2: 2 }

      const result = handler.hasOverrides(overrides)

      expect(result).toBe(true)
    })

    it('should return false for empty overrides', () => {
      const overrides = {}

      const result = handler.hasOverrides(overrides)

      expect(result).toBe(false)
    })

    it('should return true for single override', () => {
      const overrides = { exp1: 0 }

      const result = handler.hasOverrides(overrides)

      expect(result).toBe(true)
    })
  })
})
