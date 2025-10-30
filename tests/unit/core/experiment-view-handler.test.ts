import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExperimentViewHandler } from '../../../src/core/experiment-view-handler'
import { ContextManager } from '../../../src/core/context-manager'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { OverridesHandler } from '../../../src/core/overrides-handler'
import { Logger, OverridesMap } from '../../../src/types'
import { MCEvent, Client } from '@managed-components/types'

describe('ExperimentViewHandler', () => {
  let contextManager: Partial<ContextManager>
  let cookieHandler: Partial<CookieHandler>
  let overridesHandler: Partial<OverridesHandler>
  let logger: Logger
  let handler: ExperimentViewHandler
  let mockContext: any
  let mockClient: any
  let mockEvent: any

  beforeEach(() => {
    mockContext = {
      treatment: vi.fn().mockReturnValue(1),
    }

    mockClient = {
      url: new URL('https://example.com/test'),
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    }

    mockEvent = {
      client: mockClient as Client,
      payload: {},
    }

    contextManager = {
      getOrCreateContext: vi.fn().mockResolvedValue(mockContext),
      publishContext: vi.fn().mockResolvedValue(undefined),
    }

    cookieHandler = {
      getUserId: vi.fn().mockReturnValue('user123'),
    }

    overridesHandler = {
      getOverrides: vi.fn().mockReturnValue({}),
    }

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    handler = new ExperimentViewHandler(
      contextManager as ContextManager,
      cookieHandler as CookieHandler,
      overridesHandler as OverridesHandler,
      logger
    )
  })

  describe('handleExperimentView', () => {
    it('should track exposure for experiment', async () => {
      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(logger.debug).toHaveBeenCalledWith('ExperimentView event received', {
        experimentName: 'test-experiment',
      })
      expect(cookieHandler.getUserId).toHaveBeenCalledWith(mockClient)
      expect(overridesHandler.getOverrides).toHaveBeenCalledWith(mockEvent)
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        {},
        {
          url: 'https://example.com/test',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }
      )
      expect(mockContext.treatment).toHaveBeenCalledWith('test-experiment')
      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
      expect(logger.debug).toHaveBeenCalledWith('Exposure tracked for experiment', {
        experimentName: 'test-experiment',
      })
    })

    it('should handle missing user ID', async () => {
      cookieHandler.getUserId = vi.fn().mockReturnValue(null)

      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        null,
        {},
        expect.objectContaining({
          url: 'https://example.com/test',
        })
      )
      expect(mockContext.treatment).toHaveBeenCalledWith('test-experiment')
    })

    it('should apply overrides', async () => {
      const overrides: OverridesMap = {
        'test-experiment': 2,
        'another-experiment': 1,
      }
      overridesHandler.getOverrides = vi.fn().mockReturnValue(overrides)

      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        overrides,
        expect.any(Object)
      )
      expect(mockContext.treatment).toHaveBeenCalledWith('test-experiment')
      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
    })

    it('should pass client metadata to context creation', async () => {
      mockClient.url = new URL('https://example.com/page?utm_source=test')
      mockClient.userAgent = 'Mozilla/5.0 Custom Agent'
      mockClient.ip = '192.168.1.1'

      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/page?utm_source=test',
        userAgent: 'Mozilla/5.0 Custom Agent',
        ip: '192.168.1.1',
      })
    })

    it('should handle context creation failures', async () => {
      const error = new Error('Context creation failed')
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(error)

      await expect(
        handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')
      ).rejects.toThrow('Context creation failed')

      expect(logger.error).toHaveBeenCalledWith('ExperimentView tracking error:', error)
    })

    it('should handle publish context failures', async () => {
      const error = new Error('Publish failed')
      contextManager.publishContext = vi.fn().mockRejectedValue(error)

      await expect(
        handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')
      ).rejects.toThrow('Publish failed')

      expect(logger.error).toHaveBeenCalledWith('ExperimentView tracking error:', error)
    })

    it('should handle treatment call failures', async () => {
      const error = new Error('Treatment failed')
      mockContext.treatment = vi.fn().mockImplementation(() => {
        throw error
      })

      await expect(
        handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')
      ).rejects.toThrow('Treatment failed')

      expect(logger.error).toHaveBeenCalledWith('ExperimentView tracking error:', error)
    })

    it('should track multiple experiments sequentially', async () => {
      await handler.handleExperimentView(mockEvent as MCEvent, 'experiment-1')
      await handler.handleExperimentView(mockEvent as MCEvent, 'experiment-2')
      await handler.handleExperimentView(mockEvent as MCEvent, 'experiment-3')

      expect(mockContext.treatment).toHaveBeenCalledTimes(3)
      expect(mockContext.treatment).toHaveBeenNthCalledWith(1, 'experiment-1')
      expect(mockContext.treatment).toHaveBeenNthCalledWith(2, 'experiment-2')
      expect(mockContext.treatment).toHaveBeenNthCalledWith(3, 'experiment-3')
      expect(contextManager.publishContext).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent experiment views', async () => {
      const experiments = ['exp-1', 'exp-2', 'exp-3']

      await Promise.all(
        experiments.map(exp => handler.handleExperimentView(mockEvent as MCEvent, exp))
      )

      expect(mockContext.treatment).toHaveBeenCalledTimes(3)
      expect(contextManager.publishContext).toHaveBeenCalledTimes(3)
    })

    it('should log debug messages at key points', async () => {
      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(logger.debug).toHaveBeenCalledTimes(2)
      expect(logger.debug).toHaveBeenNthCalledWith(1, 'ExperimentView event received', {
        experimentName: 'test-experiment',
      })
      expect(logger.debug).toHaveBeenNthCalledWith(2, 'Exposure tracked for experiment', {
        experimentName: 'test-experiment',
      })
    })

    it('should handle experiment names with special characters', async () => {
      const experimentNames = [
        'test-experiment-123',
        'test_experiment_456',
        'test.experiment.789',
        'test experiment with spaces',
      ]

      for (const name of experimentNames) {
        vi.clearAllMocks()
        await handler.handleExperimentView(mockEvent as MCEvent, name)
        expect(mockContext.treatment).toHaveBeenCalledWith(name)
      }
    })

    it('should handle empty experiment name', async () => {
      await handler.handleExperimentView(mockEvent as MCEvent, '')

      expect(mockContext.treatment).toHaveBeenCalledWith('')
      expect(contextManager.publishContext).toHaveBeenCalled()
    })

    it('should use same context for multiple treatments', async () => {
      const event = mockEvent as MCEvent

      await handler.handleExperimentView(event, 'exp-1')
      await handler.handleExperimentView(event, 'exp-2')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledTimes(2)
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith(
        'user123',
        {},
        expect.any(Object)
      )
    })

    it('should handle URL without query parameters', async () => {
      mockClient.url = new URL('https://example.com')

      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      })
    })

    it('should handle URL with hash', async () => {
      mockClient.url = new URL('https://example.com/page#section')

      await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')

      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123', {}, {
        url: 'https://example.com/page#section',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      })
    })

    it('should propagate error without suppressing', async () => {
      const error = new Error('Critical error')
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(error)

      let caughtError: Error | undefined
      try {
        await handler.handleExperimentView(mockEvent as MCEvent, 'test-experiment')
      } catch (e) {
        caughtError = e as Error
      }

      expect(caughtError).toBe(error)
      expect(logger.error).toHaveBeenCalledWith('ExperimentView tracking error:', error)
    })
  })
})
