import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createABsmartlyProxyRoute } from '../../../src/core/absmartly-proxy-route'
import { ABsmartlySettings, Logger } from '../../../src/types'
import { Manager } from '@managed-components/types'

describe('createABsmartlyProxyRoute', () => {
  let manager: Partial<Manager>
  let settings: ABsmartlySettings
  let logger: Logger
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()

    manager = {
      fetch: fetchMock as any,
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      SDK_API_KEY: 'test-api-key',
      ENDPOINT: 'https://api.absmartly.io/v1',
      ENVIRONMENT: 'production',
      APPLICATION: 'test-app',
    } as ABsmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    vi.clearAllMocks()
  })

  describe('POST request handling (context fetch)', () => {
    it('should proxy POST request to ABsmartly API with correct headers', async () => {
      const mockResponse = new Response(JSON.stringify({ experiments: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const requestBody = {
        units: { user_id: 'test-user-123' },
      }

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const response = await proxyRoute(request)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.absmartly.io/v1/context',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
            'X-Application': 'test-app',
            'X-Environment': 'production',
            'X-Agent': 'javascript-sdk-zaraz-proxy',
          }),
          body: JSON.stringify(requestBody),
        })
      )

      expect(response.status).toBe(200)
      const responseData = await response.json()
      expect(responseData).toEqual({ experiments: [] })
    })

    it('should log request payload details for POST', async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        status: 200,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const requestBody = {
        units: { user_id: 'test-user' },
        exposures: [{ id: 1, name: 'exp1', variant: 1 }],
        goals: [{ name: 'goal1', achievedAt: Date.now() }],
      }

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      await proxyRoute(request)

      expect(logger.debug).toHaveBeenCalledWith('Request payload', {
        exposuresCount: 1,
        goalsCount: 1,
        hasUnits: true,
      })
    })
  })

  describe('PUT request handling (publish)', () => {
    it('should proxy PUT request to ABsmartly API', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const publishPayload = {
        exposures: [
          { id: 1, name: 'test-exp', variant: 1, exposedAt: Date.now() },
        ],
        goals: [],
        attributes: [],
      }

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishPayload),
      })

      const response = await proxyRoute(request)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.absmartly.io/v1/context',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
          body: JSON.stringify(publishPayload),
        })
      )

      expect(response.status).toBe(200)
      const responseData = await response.json()
      expect(responseData).toEqual({ success: true })
    })

    it('should log exposures and goals count for PUT', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const publishPayload = {
        exposures: [
          { id: 1, name: 'exp1', variant: 1, exposedAt: Date.now() },
          { id: 2, name: 'exp2', variant: 0, exposedAt: Date.now() },
        ],
        goals: [
          { name: 'purchase', achievedAt: Date.now() },
        ],
      }

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishPayload),
      })

      await proxyRoute(request)

      expect(logger.debug).toHaveBeenCalledWith('Request payload', {
        exposuresCount: 2,
        goalsCount: 1,
        hasUnits: false,
      })
    })
  })

  describe('GET request handling (context fetch)', () => {
    it('should proxy GET request without body', async () => {
      const mockResponse = new Response(JSON.stringify({ experiments: [] }), {
        status: 200,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'GET',
      })

      const response = await proxyRoute(request)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.absmartly.io/v1/context',
        expect.objectContaining({
          method: 'GET',
          body: undefined,
        })
      )

      expect(response.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should return 500 when endpoint is missing', async () => {
      settings.ENDPOINT = ''

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData).toEqual({ error: 'Missing configuration' })
      expect(logger.error).toHaveBeenCalledWith('Missing ABsmartly endpoint or API key')
    })

    it('should return 500 when API key is missing', async () => {
      settings.SDK_API_KEY = ''

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData).toEqual({ error: 'Missing configuration' })
    })

    it('should handle when manager.fetch returns undefined', async () => {
      fetchMock.mockResolvedValue(undefined)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData.error).toBe('Proxy error')
      expect(errorData.message).toBe('No response from ABsmartly API')
    })

    it('should handle ABsmartly API errors', async () => {
      const mockResponse = new Response('Bad Request', {
        status: 400,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(400)
      expect(logger.error).toHaveBeenCalledWith('ABsmartly API error', {
        status: 400,
        response: 'Bad Request',
      })
    })

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(500)
      const errorData = await response.json()
      expect(errorData.error).toBe('Proxy error')
      expect(errorData.message).toBe('Network error')
      expect(logger.error).toHaveBeenCalledWith('Proxy route error:', expect.any(Error))
    })
  })

  describe('response handling', () => {
    it('should preserve response status from ABsmartly API', async () => {
      const mockResponse = new Response(JSON.stringify({ message: 'Created' }), {
        status: 201,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.status).toBe(201)
    })

    it('should always return JSON content type', async () => {
      const mockResponse = new Response('{"data":"test"}', {
        status: 200,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await proxyRoute(request)

      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should log API response details', async () => {
      const mockResponse = new Response(JSON.stringify({}), {
        status: 200,
      })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await proxyRoute(request)

      expect(logger.debug).toHaveBeenCalledWith('ABsmartly API response', {
        status: 200,
        ok: true,
      })
    })
  })

  describe('security', () => {
    it('should include API key in headers', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await proxyRoute(request)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      )
    })

    it('should include environment and application in headers', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await proxyRoute(request)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Application': 'test-app',
            'X-Environment': 'production',
            'X-Agent': 'javascript-sdk-zaraz-proxy',
          }),
        })
      )
    })
  })

  describe('logging', () => {
    it('should log request payload and API response', async () => {
      const mockResponse = new Response(JSON.stringify({}), { status: 200 })
      fetchMock.mockResolvedValue(mockResponse)

      const proxyRoute = createABsmartlyProxyRoute({ manager: manager as Manager, settings, logger })

      const request = new Request('http://localhost/_routes/absmartly/absmartly-publish', {
        method: 'PUT',
        body: JSON.stringify({}),
      })

      await proxyRoute(request)

      expect(logger.debug).toHaveBeenCalledWith('Request payload', {
        exposuresCount: 0,
        goalsCount: 0,
        hasUnits: false,
      })
      expect(logger.debug).toHaveBeenCalledWith('ABsmartly API response', {
        ok: true,
        status: 200,
      })
    })
  })
})
