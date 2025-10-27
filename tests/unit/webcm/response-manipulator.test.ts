import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResponseManipulator } from '../../../src/webcm/response-manipulator'
import { ABSmartlySettings, Logger, ExperimentData } from '../../../src/types'

// FetchedRequest is not exported from @managed-components/types, define locally
interface FetchedRequest extends Response {
  url: string
}

describe('ResponseManipulator', () => {
  let settings: ABSmartlySettings
  let logger: Logger
  let mockRequest: Partial<FetchedRequest>

  const createMockRequest = (contentType: string = 'text/html'): Partial<FetchedRequest> => {
    const headers = new Map<string, string>()
    headers.set('content-type', contentType)

    return {
      url: 'https://example.com',
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name: string) => headers.get(name),
      } as any,
      text: vi.fn().mockResolvedValue('<html><head></head><body>Hello</body></html>'),
    }
  }

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'webcm',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      INJECT_CLIENT_DATA: true,
      EXCLUDED_PATHS: ['/api/', '/static/'],
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }

    mockRequest = createMockRequest()
  })

  describe('manipulateResponse', () => {
    it('should manipulate HTML response with DOM changes', async () => {
      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [
            {
              selector: 'h1',
              type: 'text',
              value: 'Modified Title',
            },
          ],
        },
      ]

      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).toContain('Modified Title')
    })

    it('should inject experiment data when enabled', async () => {
      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ]

      settings.INJECT_CLIENT_DATA = true
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).toContain('id="absmartly-data"')
      expect(modifiedHtml).toContain('application/json')
      expect(modifiedHtml).toContain('"name":"experiment1"')
    })

    it('should not inject experiment data when disabled', async () => {
      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ]

      settings.INJECT_CLIENT_DATA = false
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).not.toContain('id="absmartly-data"')
    })

    it('should skip non-HTML responses', async () => {
      mockRequest = createMockRequest('application/json')

      const experimentData: ExperimentData[] = []
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      expect(logger.debug).toHaveBeenCalledWith('Skipping non-HTML response', {
        contentType: 'application/json',
      })
      expect(result).toBe(mockRequest)
    })

    it('should handle experiments with no changes', async () => {
      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 0,
          variant: 'control',
          changes: [],
        },
      ]

      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).toContain('Hello')
      expect(modifiedHtml).toContain('id="absmartly-data"') // Experiment data should still be injected
    })

    it('should handle multiple experiments', async () => {
      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [
            {
              selector: 'h1',
              type: 'text',
              value: 'Experiment 1',
            },
          ],
        },
        {
          name: 'experiment2',
          treatment: 1,
          variant: 'variant_b',
          changes: [
            {
              selector: 'body',
              type: 'attribute',
              name: 'class',
              value: 'test-class',
            },
          ],
        },
      ]

      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).toContain('Experiment 1')
      expect(modifiedHtml).toContain('class="test-class"')
    })

    it('should return original request on error', async () => {
      mockRequest.text = vi.fn().mockRejectedValue(new Error('Text parsing failed'))

      const experimentData: ExperimentData[] = []
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      expect(logger.error).toHaveBeenCalledWith('Failed to manipulate response:', expect.any(Error))
      expect(result).toBe(mockRequest)
    })

    it('should inject data before </head> when available', async () => {
      mockRequest.text = vi.fn().mockResolvedValue('<html><head><title>Test</title></head><body></body></html>')

      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ]

      settings.INJECT_CLIENT_DATA = true
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      const dataScriptIndex = modifiedHtml.indexOf('id="absmartly-data"')
      const headEndIndex = modifiedHtml.indexOf('</head>')

      expect(dataScriptIndex).toBeLessThan(headEndIndex)
    })

    it('should inject data before </body> when no </head>', async () => {
      mockRequest.text = vi.fn().mockResolvedValue('<html><body><h1>Test</h1></body></html>')

      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ]

      settings.INJECT_CLIENT_DATA = true
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      const dataScriptIndex = modifiedHtml.indexOf('id="absmartly-data"')
      const bodyEndIndex = modifiedHtml.indexOf('</body>')

      expect(dataScriptIndex).toBeLessThan(bodyEndIndex)
    })

    it('should append data at the end when no head or body tags', async () => {
      mockRequest.text = vi.fn().mockResolvedValue('<div>Simple HTML</div>')

      const experimentData: ExperimentData[] = [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ]

      settings.INJECT_CLIENT_DATA = true
      const manipulator = new ResponseManipulator(settings, logger)
      const result = await manipulator.manipulateResponse(
        mockRequest as FetchedRequest,
        experimentData
      )

      const modifiedHtml = await result.text()
      expect(modifiedHtml).toContain('<div>Simple HTML</div>')
      expect(modifiedHtml).toContain('id="absmartly-data"')
    })
  })

  describe('shouldManipulate', () => {
    it('should return true for allowed URLs', () => {
      const manipulator = new ResponseManipulator(settings, logger)

      expect(manipulator.shouldManipulate('https://example.com/')).toBe(true)
      expect(manipulator.shouldManipulate('https://example.com/page')).toBe(true)
    })

    it('should return false for excluded paths', () => {
      const manipulator = new ResponseManipulator(settings, logger)

      expect(manipulator.shouldManipulate('https://example.com/api/data')).toBe(false)
      expect(manipulator.shouldManipulate('https://example.com/static/image.png')).toBe(false)
    })

    it('should work with empty excluded paths', () => {
      settings.EXCLUDED_PATHS = []
      const manipulator = new ResponseManipulator(settings, logger)

      expect(manipulator.shouldManipulate('https://example.com/api/data')).toBe(true)
    })
  })
})
