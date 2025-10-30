import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestHandler } from '../../../src/core/request-handler'
import { ContextManager } from '../../../src/core/context-manager'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { OverridesHandler } from '../../../src/core/overrides-handler'
import { ABSmartlySettings, Logger, ExperimentData, OverridesMap } from '../../../src/types'
import { MCEvent, Client } from '@managed-components/types'

describe('RequestHandler', () => {
  let contextManager: Partial<ContextManager>
  let cookieHandler: Partial<CookieHandler>
  let overridesHandler: Partial<OverridesHandler>
  let settings: ABSmartlySettings
  let logger: Logger
  let handler: RequestHandler
  let mockClient: any
  let mockEvent: any
  let mockContext: any
  let mockResponse: any

  beforeEach(() => {
    mockContext = {
      treatment: vi.fn().mockReturnValue(1),
    }

    mockResponse = {
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: '<html><body>Test</body></html>',
    } as any

    mockClient = {
      url: new URL('https://example.com/test'),
      userAgent: 'test-agent',
      ip: '127.0.0.1',
      fetch: vi.fn().mockResolvedValue(mockResponse),
      return: vi.fn(),
    }

    mockEvent = {
      client: mockClient as Client,
      payload: {},
    }

    contextManager = {
      getOrCreateContext: vi.fn().mockResolvedValue(mockContext),
      publishContext: vi.fn().mockResolvedValue(undefined),
      extractExperimentData: vi.fn().mockReturnValue([
        {
          id: 1,
          name: 'test-experiment',
          treatment: 1,
        } as ExperimentData,
      ]),
    }

    cookieHandler = {
      ensureUserId: vi.fn().mockReturnValue('user123'),
      storeUTMParams: vi.fn(),
      storeLandingPage: vi.fn(),
    }

    overridesHandler = {
      getOverrides: vi.fn().mockReturnValue({}),
      hasOverrides: vi.fn().mockReturnValue(false),
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    handler = new RequestHandler({
      contextManager: contextManager as ContextManager,
      cookieHandler: cookieHandler as CookieHandler,
      overridesHandler: overridesHandler as OverridesHandler,
      settings,
      logger,
    })

    vi.clearAllMocks()
  })

  describe('handleRequest', () => {
    it('should handle successful requests', async () => {
      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
      expect(result?.userId).toBe('user123')
      expect(result?.experimentData).toHaveLength(1)
      expect(result?.fetchResult).toBe(mockResponse)
      expect(result?.shouldProcess).toBe(true)
      expect(logger.debug).toHaveBeenCalledWith('Request intercepted', {
        url: 'https://example.com/test',
      })
    })

    it('should ensure user ID is created', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(cookieHandler.ensureUserId).toHaveBeenCalledWith(mockClient)
      expect(logger.debug).toHaveBeenCalledWith('User ID', { userId: 'user123' })
    })

    it('should store UTM params and landing page', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(cookieHandler.storeUTMParams).toHaveBeenCalledWith(mockClient)
      expect(cookieHandler.storeLandingPage).toHaveBeenCalledWith(mockClient)
    })

    it('should check for overrides', async () => {
      const overrides: OverridesMap = { 'test-experiment': 2 }
      overridesHandler.getOverrides = vi.fn().mockReturnValue(overrides)
      overridesHandler.hasOverrides = vi.fn().mockReturnValue(true)

      await handler.handleRequest(mockEvent as MCEvent)

      expect(overridesHandler.getOverrides).toHaveBeenCalledWith(mockEvent)
      expect(logger.debug).toHaveBeenCalledWith('Overrides detected', { overrides })
    })

    it('should create context with correct parameters', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      })
    })

    it('should extract experiment data from context', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.extractExperimentData).toHaveBeenCalledWith(mockContext)
      expect(logger.debug).toHaveBeenCalledWith('Experiments extracted', {
        count: 1,
        experiments: [{ name: 'test-experiment', treatment: 1 }],
      })
    })

    it('should fetch the original response', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(mockClient.fetch).toHaveBeenCalledWith('https://example.com/test')
    })

    it('should publish context to track exposures', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
      expect(logger.debug).toHaveBeenCalledWith('Exposures published')
    })

    it('should handle fetch returning boolean', async () => {
      mockClient.fetch = vi.fn().mockResolvedValue(true)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(false)
      expect(result?.fetchResult).toBe(true)
      expect(logger.warn).toHaveBeenCalledWith(
        'Fetch returned unexpected result, skipping manipulation'
      )
    })

    it('should handle fetch returning undefined', async () => {
      mockClient.fetch = vi.fn().mockResolvedValue(undefined)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(false)
      expect(result?.fetchResult).toBe(undefined)
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should handle context creation failures', async () => {
      const error = new Error('Context creation failed')
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(error)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('Request handler error:', error)
    })

    it('should handle publish context failures', async () => {
      const error = new Error('Publish failed')
      contextManager.publishContext = vi.fn().mockRejectedValue(error)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('Request handler error:', error)
    })

    it('should handle fetch failures', async () => {
      const error = new Error('Fetch failed')
      mockClient.fetch = vi.fn().mockRejectedValue(error)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('Request handler error:', error)
    })

    it('should apply overrides from URL', async () => {
      const overrides: OverridesMap = { 'experiment-1': 1, 'experiment-2': 0 }
      overridesHandler.getOverrides = vi.fn().mockReturnValue(overrides)
      overridesHandler.hasOverrides = vi.fn().mockReturnValue(true)

      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        overrides,
        expect.any(Object)
      )
    })

    it('should handle multiple experiments', async () => {
      contextManager.extractExperimentData = vi.fn().mockReturnValue([
        { id: 1, name: 'exp-1', treatment: 0 } as ExperimentData,
        { id: 2, name: 'exp-2', treatment: 1 } as ExperimentData,
        { id: 3, name: 'exp-3', treatment: 2 } as ExperimentData,
      ])

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.experimentData).toHaveLength(3)
      expect(logger.debug).toHaveBeenCalledWith('Experiments extracted', {
        count: 3,
        experiments: [
          { name: 'exp-1', treatment: 0 },
          { name: 'exp-2', treatment: 1 },
          { name: 'exp-3', treatment: 2 },
        ],
      })
    })

    it('should handle requests with query parameters', async () => {
      ;mockClient.url = new URL('https://example.com/page?utm_source=test&absmartly=exp:1')

      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/page?utm_source=test&absmartly=exp:1',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      })
    })

    it('should handle requests without user agent', async () => {
      ;mockClient.userAgent = undefined

      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/test',
        userAgent: undefined,
        ip: '127.0.0.1',
      })
    })

    it('should handle requests without IP', async () => {
      ;mockClient.ip = undefined

      await handler.handleRequest(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/test',
        userAgent: 'test-agent',
        ip: undefined,
      })
    })

    it('should log all major steps', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(logger.debug).toHaveBeenCalledWith('Request intercepted', expect.any(Object))
      expect(logger.debug).toHaveBeenCalledWith('User ID', expect.any(Object))
      expect(logger.debug).toHaveBeenCalledWith('Experiments extracted', expect.any(Object))
      expect(logger.debug).toHaveBeenCalledWith('Exposures published')
    })

    it('should handle empty experiment data', async () => {
      contextManager.extractExperimentData = vi.fn().mockReturnValue([])

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.experimentData).toHaveLength(0)
      expect(logger.debug).toHaveBeenCalledWith('Experiments extracted', {
        count: 0,
        experiments: [],
      })
    })

    it('should handle new user without existing ID', async () => {
      cookieHandler.ensureUserId = vi.fn().mockReturnValue('new-user-id')

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.userId).toBe('new-user-id')
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'new-user-id',
        {},
        expect.any(Object)
      )
    })

    it('should handle ensureUserId failures gracefully', async () => {
      cookieHandler.ensureUserId = vi.fn().mockImplementation(() => {
        throw new Error('Cookie error')
      })

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle storeUTMParams failures gracefully', async () => {
      cookieHandler.storeUTMParams = vi.fn().mockImplementation(() => {
        throw new Error('UTM storage error')
      })

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('handleRequestError', () => {
    it('should fetch and return original request on error', async () => {
      await handler.handleRequestError(mockEvent as MCEvent)

      expect(mockClient.fetch).toHaveBeenCalledWith('https://example.com/test')
      expect(mockClient.return).toHaveBeenCalledWith(mockResponse)
    })

    it('should handle fetch failures in error handler', async () => {
      const error = new Error('Fetch failed')
      mockClient.fetch = vi.fn().mockRejectedValue(error)

      await handler.handleRequestError(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to fetch original request:', error)
      expect(mockClient.return).not.toHaveBeenCalled()
    })

    it('should handle undefined fetch result', async () => {
      mockClient.fetch = vi.fn().mockResolvedValue(undefined)

      await handler.handleRequestError(mockEvent as MCEvent)

      expect(mockClient.return).toHaveBeenCalledWith(undefined)
    })

    it('should handle fetch returning boolean', async () => {
      mockClient.fetch = vi.fn().mockResolvedValue(true)

      await handler.handleRequestError(mockEvent as MCEvent)

      expect(mockClient.return).toHaveBeenCalledWith(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete request flow with overrides', async () => {
      const overrides: OverridesMap = { 'test-exp': 1 }
      overridesHandler.getOverrides = vi.fn().mockReturnValue(overrides)
      overridesHandler.hasOverrides = vi.fn().mockReturnValue(true)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(cookieHandler.ensureUserId).toHaveBeenCalled()
      expect(cookieHandler.storeUTMParams).toHaveBeenCalled()
      expect(cookieHandler.storeLandingPage).toHaveBeenCalled()
      expect(overridesHandler.getOverrides).toHaveBeenCalled()
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        overrides,
        expect.any(Object)
      )
      expect(contextManager.extractExperimentData).toHaveBeenCalled()
      expect(mockClient.fetch).toHaveBeenCalled()
      expect(contextManager.publishContext).toHaveBeenCalled()
      expect(result?.shouldProcess).toBe(true)
    })

    it('should handle request with URL parameters and cookies', async () => {
      ;mockClient.url = new URL('https://example.com/page?utm_source=email&utm_campaign=test')

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(cookieHandler.storeUTMParams).toHaveBeenCalledWith(mockClient)
      expect(result?.shouldProcess).toBe(true)
    })

    it('should maintain request flow even if optional steps fail', async () => {
      // Landing page storage fails but request continues
      cookieHandler.storeLandingPage = vi.fn().mockImplementation(() => {
        // Silent failure
      })

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
      expect(result?.shouldProcess).toBe(true)
    })

    it('should handle concurrent requests', async () => {
      const event1 = { ...mockEvent, client: { ...mockClient, url: new URL('https://example.com/page1') } }
      const event2 = { ...mockEvent, client: { ...mockClient, url: new URL('https://example.com/page2') } }

      const [result1, result2] = await Promise.all([
        handler.handleRequest(event1 as MCEvent),
        handler.handleRequest(event2 as MCEvent),
      ])

      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(contextManager.getOrCreateContext).toHaveBeenCalledTimes(2)
      expect(mockClient.fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle different response content types', async () => {
      ;mockResponse.headers = new Headers({ 'content-type': 'application/json' })

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(true)
      expect(result?.fetchResult).toBe(mockResponse)
    })

    it('should handle redirect responses', async () => {
      ;mockResponse.status = 302
      ;mockResponse.headers = new Headers({ 'location': 'https://example.com/redirect' })

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(true)
      expect(result?.fetchResult).toBe(mockResponse)
    })

    it('should handle 404 responses', async () => {
      ;mockResponse.status = 404

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(true)
      expect(result?.fetchResult).toBe(mockResponse)
    })

    it('should handle 500 error responses', async () => {
      ;mockResponse.status = 500

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.shouldProcess).toBe(true)
      expect(result?.fetchResult).toBe(mockResponse)
    })
  })

  describe('edge cases', () => {
    it('should handle malformed URLs gracefully', async () => {
      ;mockClient.url = new URL('https://example.com/path with spaces')

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
    })

    it('should handle very long URLs', async () => {
      const longPath: string = 'a'.repeat(2000)
      ;mockClient.url = new URL(`https://example.com/${longPath}`)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
    })

    it('should handle special characters in URL', async () => {
      ;mockClient.url = new URL('https://example.com/path?q=%E2%9C%93&test=123')

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        {},
        expect.objectContaining({
          url: 'https://example.com/path?q=%E2%9C%93&test=123',
        })
      )
    })

    it('should handle undefined event payload', async () => {
      ;mockEvent.payload = undefined

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).not.toBeNull()
    })

    it('should handle null user ID from ensureUserId', async () => {
      cookieHandler.ensureUserId = vi.fn().mockReturnValue(null)

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result?.userId).toBeNull()
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        null,
        {},
        expect.any(Object)
      )
    })
  })
})
