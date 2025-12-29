import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { ABsmartlySettings } from '../../../src/types'
import { Client } from '@managed-components/types'
import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../../../src/constants/cookies'

describe('CookieHandler', () => {
  let settings: ABsmartlySettings
  let mockClient: Partial<Client>
  let cookieStorage: Map<string, string>

  const createMockClient = (urlString: string = 'https://example.com', refererString: string = 'https://google.com'): Partial<Client> => {
    return {
      url: new URL(urlString),
      referer: refererString,
      get: vi.fn((key: string) => cookieStorage.get(key)),
      set: vi.fn((key: string, value: string): boolean => {
        cookieStorage.set(key, value)
        return true
      }),
    }
  }

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      SDK_API_KEY: 'test-key',
      ENDPOINT: 'https://api.absmartly.io/v1',
      ENVIRONMENT: 'production',
      APPLICATION: 'test-app',
      COOKIE_NAME: COOKIE_NAMES.UNIT_ID,
      COOKIE_MAX_AGE: 365,
      COOKIE_SECURE: true,
      COOKIE_HTTPONLY: true,
      COOKIE_SAMESITE: 'Lax',
    } as ABsmartlySettings

    cookieStorage = new Map()
    mockClient = createMockClient()
  })

  describe('getUserId', () => {
    it('should return existing user ID from cookie', () => {
      cookieStorage.set(COOKIE_NAMES.UNIT_ID, 'existing-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('existing-user-id')
      expect(mockClient.get).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID)
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should return empty string if no user ID exists', () => {
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('')
      expect(mockClient.get).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID)
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should use custom cookie name from settings', () => {
      settings.COOKIE_NAME = 'custom_cookie'
      cookieStorage.set('custom_cookie', 'custom-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('custom-user-id')
      expect(mockClient.get).toHaveBeenCalledWith('custom_cookie')
    })

    it('should use default cookie name if not specified', () => {
      delete settings.COOKIE_NAME
      cookieStorage.set(COOKIE_NAMES.UNIT_ID, 'default-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('default-user-id')
      expect(mockClient.get).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID)
    })
  })

  describe('ensureUserId', () => {
    it('should return existing user ID if present', () => {
      cookieStorage.set(COOKIE_NAMES.UNIT_ID, 'existing-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.ensureUserId(mockClient as Client)

      expect(userId).toBe('existing-user-id')
      expect(mockClient.get).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID)
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should generate new user ID if not exists and cookie management disabled', () => {
      settings.ENABLE_COOKIE_MANAGEMENT = false
      const handler = new CookieHandler(settings)

      const userId = handler.ensureUserId(mockClient as Client)

      expect(userId).toBeTruthy()
      // UUID format is base36 timestamp + random (e.g., "l1234abc56def")
      expect(userId.length).toBeGreaterThanOrEqual(15)
      expect(userId).toMatch(/^[a-z0-9]+$/)
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should generate and set cookies when ENABLE_COOKIE_MANAGEMENT is true', () => {
      settings.ENABLE_COOKIE_MANAGEMENT = true
      const handler = new CookieHandler(settings)

      const userId = handler.ensureUserId(mockClient as Client)

      expect(userId).toBeTruthy()
      // UUID format is base36 timestamp + random (e.g., "l1234abc56def")
      expect(userId.length).toBeGreaterThanOrEqual(15)
      expect(userId).toMatch(/^[a-z0-9]+$/)

      // Should set both private and public cookies
      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID, userId, expect.any(Object))
      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.PUBLIC_ID, userId, expect.any(Object))
      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.EXPIRY, expect.any(String), expect.any(Object))
    })
  })

  describe('setUserId', () => {
    it('should set user ID cookie with correct options', () => {
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID, 'test-user-id', {
        scope: 'infinite',
        expiry: 365 * 86400,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      })
    })

    it('should use custom cookie max age from settings', () => {
      settings.COOKIE_MAX_AGE = 30
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID, 'test-user-id', {
        scope: 'infinite',
        expiry: 30 * 86400,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      })
    })

    it('should use custom cookie domain from settings', () => {
      settings.COOKIE_DOMAIN = '.example.com'
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID, 'test-user-id', {
        scope: 'infinite',
        expiry: 365 * 86400,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      })
    })

    it('should use default max age if not specified', () => {
      delete settings.COOKIE_MAX_AGE
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith(COOKIE_NAMES.UNIT_ID, 'test-user-id', {
        scope: 'infinite',
        expiry: COOKIE_DEFAULTS.MAX_AGE_DAYS * 86400,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      })
    })
  })

  describe('getUTMParams', () => {
    it('should extract all UTM parameters from URL', () => {
      mockClient = createMockClient('https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=shoes&utm_content=ad1')
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer',
        utm_term: 'shoes',
        utm_content: 'ad1',
      })
    })

    it('should return only present UTM parameters', () => {
      mockClient = createMockClient('https://example.com?utm_source=facebook&utm_campaign=fall')
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({
        utm_source: 'facebook',
        utm_campaign: 'fall',
      })
    })

    it('should return empty object if no UTM parameters', () => {
      mockClient = createMockClient('https://example.com?foo=bar')
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })

    it('should handle URL without query string', () => {
      mockClient = createMockClient('https://example.com')
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })
  })

  describe('storeUTMParams', () => {
    it('should store UTM parameters in cookie if present', () => {
      mockClient = createMockClient('https://example.com?utm_source=google&utm_medium=cpc')
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.UTM_PARAMS,
        JSON.stringify({
          utm_source: 'google',
          utm_medium: 'cpc',
        }),
        {
          scope: 'infinite',
          expiry: 30 * 86400,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        }
      )
    })

    it('should not store UTM parameters if none present', () => {
      mockClient = createMockClient('https://example.com')
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should not overwrite existing UTM parameters', () => {
      mockClient = createMockClient('https://example.com?utm_source=facebook')
      cookieStorage.set(COOKIE_NAMES.UTM_PARAMS, JSON.stringify({ utm_source: 'google' }))
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })
  })

  describe('getStoredUTMParams', () => {
    it('should return stored UTM parameters from cookie', () => {
      const storedParams = { utm_source: 'google', utm_campaign: 'summer' }
      cookieStorage.set(COOKIE_NAMES.UTM_PARAMS, JSON.stringify(storedParams))
      const handler = new CookieHandler(settings)

      const params = handler.getStoredUTMParams(mockClient as Client)

      expect(params).toEqual(storedParams)
    })

    it('should return empty object if no stored UTM parameters', () => {
      const handler = new CookieHandler(settings)

      const params = handler.getStoredUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })

    it('should return empty object if stored data is invalid JSON', () => {
      cookieStorage.set(COOKIE_NAMES.UTM_PARAMS, 'invalid json')
      const handler = new CookieHandler(settings)

      const params = handler.getStoredUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })
  })

  describe('getReferrer', () => {
    it('should return referrer from client', () => {
      mockClient = createMockClient('https://example.com', 'https://google.com')
      const handler = new CookieHandler(settings)

      const referrer = handler.getReferrer(mockClient as Client)

      expect(referrer).toBe('https://google.com')
    })

    it('should return undefined if no referrer', () => {
      mockClient = createMockClient('https://example.com', '')
      const handler = new CookieHandler(settings)

      const referrer = handler.getReferrer(mockClient as Client)

      expect(referrer).toBe('')
    })
  })

  describe('storeLandingPage', () => {
    it('should store landing page URL in cookie', () => {
      mockClient = createMockClient('https://example.com/landing')
      const handler = new CookieHandler(settings)

      handler.storeLandingPage(mockClient as Client)

      expect(mockClient.set).toHaveBeenCalledWith(
        COOKIE_NAMES.LANDING_PAGE,
        'https://example.com/landing',
        {
          scope: 'infinite',
          expiry: 30 * 86400,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        }
      )
    })

    it('should not overwrite existing landing page', () => {
      mockClient = createMockClient('https://example.com/second-page')
      cookieStorage.set(COOKIE_NAMES.LANDING_PAGE, 'https://example.com/first-page')
      const handler = new CookieHandler(settings)

      handler.storeLandingPage(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })
  })
})
