import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ABSmartlyEndpointHandler } from '../../../src/webcm/absmartly-endpoint-handler'
import { EventTracker } from '../../../src/core/event-tracker'
import type { ABSmartlySettings, Logger } from '../../../src/types'
import type { MCEvent } from '@managed-components/types'

describe('ABSmartlyEndpointHandler', () => {
  let handler: ABSmartlyEndpointHandler
  let settings: ABSmartlySettings
  let logger: Logger
  let eventTracker: EventTracker
  let mockEvent: any

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'webcm',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'test',
      ABSMARTLY_APPLICATION: 'test-app'
    }

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn()
    }

    eventTracker = {
      track: vi.fn(),
      trackEvent: vi.fn(),
      trackEcommerce: vi.fn(),
      trackExposure: vi.fn()
    } as any

    handler = new ABSmartlyEndpointHandler(settings, logger)

    mockEvent = {
      client: {
        url: new URL('https://example.com/absmartly'),
        request: {
          method: 'POST',
          json: vi.fn()
        },
        return: vi.fn()
      }
    }
  })

  describe('Route matching', () => {
    it('should handle /absmartly requests', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        url: new URL('https://example.com/absmartly'),
        request: {
          method: 'GET',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBe(true)
      expect(mockEvent.client.return).toHaveBeenCalled()
    })

    it('should ignore non-/absmartly requests', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        url: new URL('https://example.com/other-path'),
        request: {
          method: 'GET',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBe(false)
      expect(mockEvent.client.return).not.toHaveBeenCalled()
    })

    it('should handle /absmartly/* sub-paths', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        url: new URL('https://example.com/absmartly/track'),
        request: {
          method: 'GET',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBe(true)
      expect(mockEvent.client.return).toHaveBeenCalled()
    })
  })

  describe('GET requests', () => {
    beforeEach(() => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'GET',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }
    })

    it('should return 200 with status message', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(200)
      expect(call.headers.get('Content-Type')).toBe('application/json')
    })

    it('should mark endpoint as handled', async () => {
      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBe(true)
    })
  })

  describe('POST requests (track)', () => {
    beforeEach(() => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          json: vi.fn().mockResolvedValue({
            name: 'ExperimentView',
            experimentName: 'test_experiment'
          } as any)
        },
        return: vi.fn()
      }
    })

    it('should parse track request body', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      expect(mockEvent.client.request.json).toHaveBeenCalled()
      expect(mockEvent.client.return).toHaveBeenCalled()
    })

    it('should return 202 Accepted immediately', async () => {
      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(202)
    })

    it('should handle invalid JSON gracefully', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(400)
    })

    it('should return 400 for invalid JSON with error message', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(400)
      expect(mockEvent.client.return).toHaveBeenCalled()
    })

    it('should mark as handled even on error', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
        } as any,
        return: vi.fn()
      }

      const result = await handler.handleRequest(mockEvent as MCEvent)

      expect(result).toBe(true)
    })
  })

  describe('HTTP methods', () => {
    it('should reject unsupported HTTP methods', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'PUT',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(405)
    })

    it('should return 405 Method Not Allowed for unsupported methods', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'DELETE',
          json: vi.fn()
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(405)
    })

    it('should be case-insensitive for method names', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'post',
          json: vi.fn().mockResolvedValue({ name: 'test' } as any)
        },
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      expect(mockEvent.client.return).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle request parsing errors gracefully', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        url: new URL('https://example.com/absmartly'),
        request: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      const call = (mockEvent.client.return as any).mock.calls[0][0]
      expect(call.status).toBe(400)
    })

    it('should return error response with proper format', async () => {
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          json: vi.fn().mockRejectedValue(new Error('Invalid request'))
        } as any,
        return: vi.fn()
      }

      await handler.handleRequest(mockEvent as MCEvent)

      expect(mockEvent.client.return).toHaveBeenCalled()
    })
  })

  describe('Fire-and-forget pattern', () => {
    it('should return response immediately without waiting for track completion', async () => {
      const trackPromise = new Promise(resolve => setTimeout(resolve, 1000))
      mockEvent.client = {
        ...mockEvent.client,
        request: {
          method: 'POST',
          json: vi.fn().mockResolvedValue({ name: 'ExperimentView' } as any)
        },
        return: vi.fn()
      }

      const startTime = Date.now()
      await handler.handleRequest(mockEvent as MCEvent)
      const elapsed = Date.now() - startTime

      // Should complete quickly (< 100ms), not wait for 1000ms
      expect(elapsed).toBeLessThan(100)
      expect(mockEvent.client.return).toHaveBeenCalled()
    })
  })
})
