import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { ABSmartlySettings } from '../../../src/types'
import { Client } from '@managed-components/types'

describe('CookieHandler', () => {
  let settings: ABSmartlySettings
  let mockClient: Partial<Client>
  let cookieStorage: Map<string, string>

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      COOKIE_NAME: 'absmartly_id',
      COOKIE_MAX_AGE: 365,
    } as ABSmartlySettings

    cookieStorage = new Map()

    mockClient = {
      url: 'https://example.com',
      referer: 'https://google.com',
      get: vi.fn((key: string) => cookieStorage.get(key)),
      set: vi.fn((key: string, value: string) => {
        cookieStorage.set(key, value)
      }),
    }
  })

  describe('getUserId', () => {
    it('should return existing user ID from cookie', () => {
      cookieStorage.set('absmartly_id', 'existing-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('existing-user-id')
      expect(mockClient.get).toHaveBeenCalledWith('absmartly_id')
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should generate and store new user ID if not exists', () => {
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBeTruthy()
      expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(mockClient.set).toHaveBeenCalledWith('absmartly_id', userId, expect.any(Object))
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
      cookieStorage.set('absmartly_id', 'default-user-id')
      const handler = new CookieHandler(settings)

      const userId = handler.getUserId(mockClient as Client)

      expect(userId).toBe('default-user-id')
      expect(mockClient.get).toHaveBeenCalledWith('absmartly_id')
    })
  })

  describe('setUserId', () => {
    it('should set user ID cookie with correct options', () => {
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith('absmartly_id', 'test-user-id', {
        expiry: 365 * 86400,
        path: '/',
        domain: undefined,
        sameSite: 'Lax',
      })
    })

    it('should use custom cookie max age from settings', () => {
      settings.COOKIE_MAX_AGE = 30
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith('absmartly_id', 'test-user-id', {
        expiry: 30 * 86400,
        path: '/',
        domain: undefined,
        sameSite: 'Lax',
      })
    })

    it('should use custom cookie domain from settings', () => {
      settings.COOKIE_DOMAIN = '.example.com'
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith('absmartly_id', 'test-user-id', {
        expiry: 365 * 86400,
        path: '/',
        domain: '.example.com',
        sameSite: 'Lax',
      })
    })

    it('should use default max age if not specified', () => {
      delete settings.COOKIE_MAX_AGE
      const handler = new CookieHandler(settings)

      handler.setUserId(mockClient as Client, 'test-user-id')

      expect(mockClient.set).toHaveBeenCalledWith('absmartly_id', 'test-user-id', {
        expiry: 365 * 86400,
        path: '/',
        domain: undefined,
        sameSite: 'Lax',
      })
    })
  })

  describe('getUTMParams', () => {
    it('should extract all UTM parameters from URL', () => {
      mockClient.url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=shoes&utm_content=ad1'
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
      mockClient.url = 'https://example.com?utm_source=facebook&utm_campaign=fall'
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({
        utm_source: 'facebook',
        utm_campaign: 'fall',
      })
    })

    it('should return empty object if no UTM parameters', () => {
      mockClient.url = 'https://example.com?foo=bar'
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })

    it('should handle URL without query string', () => {
      mockClient.url = 'https://example.com'
      const handler = new CookieHandler(settings)

      const params = handler.getUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })
  })

  describe('storeUTMParams', () => {
    it('should store UTM parameters in cookie if present', () => {
      mockClient.url = 'https://example.com?utm_source=google&utm_medium=cpc'
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).toHaveBeenCalledWith(
        'absmartly_utm',
        JSON.stringify({
          utm_source: 'google',
          utm_medium: 'cpc',
        }),
        {
          expiry: 30 * 86400,
          path: '/',
          sameSite: 'Lax',
        }
      )
    })

    it('should not store UTM parameters if none present', () => {
      mockClient.url = 'https://example.com'
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('should not overwrite existing UTM parameters', () => {
      mockClient.url = 'https://example.com?utm_source=facebook'
      cookieStorage.set('absmartly_utm', JSON.stringify({ utm_source: 'google' }))
      const handler = new CookieHandler(settings)

      handler.storeUTMParams(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })
  })

  describe('getStoredUTMParams', () => {
    it('should return stored UTM parameters from cookie', () => {
      const storedParams = { utm_source: 'google', utm_campaign: 'summer' }
      cookieStorage.set('absmartly_utm', JSON.stringify(storedParams))
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
      cookieStorage.set('absmartly_utm', 'invalid json')
      const handler = new CookieHandler(settings)

      const params = handler.getStoredUTMParams(mockClient as Client)

      expect(params).toEqual({})
    })
  })

  describe('getReferrer', () => {
    it('should return referrer from client', () => {
      mockClient.referer = 'https://google.com'
      const handler = new CookieHandler(settings)

      const referrer = handler.getReferrer(mockClient as Client)

      expect(referrer).toBe('https://google.com')
    })

    it('should return undefined if no referrer', () => {
      mockClient.referer = undefined
      const handler = new CookieHandler(settings)

      const referrer = handler.getReferrer(mockClient as Client)

      expect(referrer).toBeUndefined()
    })
  })

  describe('storeLandingPage', () => {
    it('should store landing page URL in cookie', () => {
      mockClient.url = 'https://example.com/landing'
      const handler = new CookieHandler(settings)

      handler.storeLandingPage(mockClient as Client)

      expect(mockClient.set).toHaveBeenCalledWith(
        'absmartly_landing',
        'https://example.com/landing',
        {
          expiry: 30 * 86400,
          path: '/',
          sameSite: 'Lax',
        }
      )
    })

    it('should not overwrite existing landing page', () => {
      mockClient.url = 'https://example.com/second-page'
      cookieStorage.set('absmartly_landing', 'https://example.com/first-page')
      const handler = new CookieHandler(settings)

      handler.storeLandingPage(mockClient as Client)

      expect(mockClient.set).not.toHaveBeenCalled()
    })
  })
})
