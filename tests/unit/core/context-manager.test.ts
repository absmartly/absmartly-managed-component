import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContextManager } from '../../../src/core/context-manager'
import { ABSmartlySettings, Logger } from '../../../src/types'
import { Manager } from '@managed-components/types'

// Create mock instances that will be shared
const mockSDKInstance = {
  createContext: vi.fn(),
  createContextWith: vi.fn(),
}

// Mock the ABsmartly SDK
vi.mock('@absmartly/javascript-sdk', () => {
  return {
    SDK: vi.fn().mockImplementation(() => mockSDKInstance),
  }
})

describe('ContextManager', () => {
  let manager: Partial<Manager>
  let settings: ABSmartlySettings
  let logger: Logger
  let mockContext: any
  let storage: Map<string, any>

  beforeEach(() => {
    storage = new Map()

    manager = {
      get: vi.fn(async (key: string) => storage.get(key)),
      set: vi.fn(async (key: string, value: any): Promise<boolean> => {
        storage.set(key, value)
        return true
      }),
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      SDK_TIMEOUT: 2000,
      CONTEXT_CACHE_TTL: 60,
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }

    // Mock context object
    mockContext = {
      ready: vi.fn().mockResolvedValue(undefined),
      override: vi.fn(),
      attributes: vi.fn(),
      getData: vi.fn().mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: { domChanges: [] } },
              { name: 'variant_a', config: { domChanges: [{ selector: '.test', type: 'text', value: 'Test' }] } },
            ],
          },
        ],
      }),
      peek: vi.fn(),
      treatment: vi.fn(),
      getContextData: vi.fn().mockReturnValue({ data: 'cached' }),
      publish: vi.fn().mockResolvedValue(undefined),
      track: vi.fn(),
    }

    // Reset and configure mock SDK
    vi.clearAllMocks()
    mockSDKInstance.createContext.mockReturnValue(mockContext)
    mockSDKInstance.createContextWith.mockReturnValue(mockContext)
  })

  describe('constructor', () => {
    it('should initialize SDK with correct configuration', () => {
      const contextManager = new ContextManager(
        manager as Manager,
        settings,
        logger
      )

      expect(contextManager).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        'Initializing ABsmartly SDK',
        expect.objectContaining({
          endpoint: settings.ABSMARTLY_ENDPOINT,
          environment: settings.ABSMARTLY_ENVIRONMENT,
          application: settings.ABSMARTLY_APPLICATION,
        })
      )
    })
  })

  describe('createContext', () => {
    it('should create context with user ID and session ID', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await contextManager.createContext('user123', {}, {})

      expect(mockSDKInstance.createContext).toHaveBeenCalledWith({
        units: {
          user_id: 'user123',
          session_id: expect.stringContaining('user123_'),
        },
      })
    })

    it('should apply overrides to context', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)
      const overrides = { experiment1: 1, experiment2: 2 }

      await contextManager.createContext('user123', overrides, {})

      expect(mockContext.override).toHaveBeenCalledWith('experiment1', 1)
      expect(mockContext.override).toHaveBeenCalledWith('experiment2', 2)
    })

    it('should set attributes on context', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)
      const attributes = { url: 'https://example.com', userAgent: 'test' }

      await contextManager.createContext('user123', {}, attributes)

      expect(mockContext.attributes).toHaveBeenCalledWith(attributes)
    })

    it('should wait for context to be ready', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await contextManager.createContext('user123', {}, {})

      expect(mockContext.ready).toHaveBeenCalled()
    })

    it('should timeout if context takes too long', async () => {
      mockContext.ready.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      )
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await expect(
        contextManager.createContext('user123', {}, {})
      ).rejects.toThrow('Context timeout')
    })

    it('should log error on context creation failure', async () => {
      mockContext.ready.mockRejectedValue(new Error('Network error'))
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await expect(
        contextManager.createContext('user123', {}, {})
      ).rejects.toThrow('Network error')

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create context:',
        expect.any(Error)
      )
    })
  })

  describe('extractExperimentData', () => {
    it('should extract experiment data from context', () => {
      mockContext.peek.mockReturnValue(1)
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(1)
      expect(experiments[0]).toEqual({
        name: 'experiment1',
        treatment: 1,
        variant: 'variant_a',
        changes: [{ selector: '.test', type: 'text', value: 'Test' }],
      })
    })

    it('should skip experiments with undefined treatment', () => {
      mockContext.peek.mockReturnValue(undefined)
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(0)
    })

    it('should skip experiments with negative treatment', () => {
      mockContext.peek.mockReturnValue(-1)
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(0)
    })

    it('should handle context without experiments', () => {
      mockContext.getData.mockReturnValue({})
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith('No experiments found in context data')
    })

    it('should handle missing variant for treatment', () => {
      mockContext.peek.mockReturnValue(5) // Out of range
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(0)
      expect(logger.warn).toHaveBeenCalledWith(
        'No variant found for treatment',
        expect.any(Object)
      )
    })

    it('should use default variant name if not provided', () => {
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { config: { domChanges: [] } }, // No name property
            ],
          },
        ],
      })
      mockContext.peek.mockReturnValue(0)
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments[0].variant).toBe('variant_0')
    })

    it('should handle empty DOM changes', () => {
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: {} }, // No domChanges
            ],
          },
        ],
      })
      mockContext.peek.mockReturnValue(0)
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments[0].changes).toEqual([])
    })

    it('should handle errors gracefully', () => {
      mockContext.getData.mockImplementation(() => {
        throw new Error('getData failed')
      })
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const experiments = contextManager.extractExperimentData(mockContext)

      expect(experiments).toHaveLength(0)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract experiment data:',
        expect.any(Error)
      )
    })
  })

  describe('getOrCreateContext', () => {
    it('should create new context if not cached', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBe(mockContext)
      expect(mockSDKInstance.createContext).toHaveBeenCalled()
    })

    it('should cache created context', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await contextManager.getOrCreateContext('user123')

      expect(manager.set).toHaveBeenCalledWith(
        'context_user123',
        { data: 'cached' }
      )
    })

    it('should return cached context if available', async () => {
      storage.set('context_user123', { data: 'cached' })
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const context = await contextManager.getOrCreateContext('user123')

      expect(mockSDKInstance.createContextWith).toHaveBeenCalledWith(
        {
          units: {
            user_id: 'user123',
            session_id: expect.stringContaining('user123_'),
          },
        },
        { data: 'cached' }
      )
      expect(mockSDKInstance.createContext).not.toHaveBeenCalled()
    })

    it('should create new context if cache recreation fails', async () => {
      storage.set('context_user123', { data: 'cached' })
      mockSDKInstance.createContextWith.mockImplementation(() => {
        throw new Error('Failed to recreate')
      })
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      const context = await contextManager.getOrCreateContext('user123')

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to recreate context from cache, creating new',
        expect.any(Error)
      )
      expect(mockSDKInstance.createContext).toHaveBeenCalled()
    })

    it('should handle cache set failure gracefully', async () => {
      manager.set = vi.fn().mockRejectedValue(new Error('Cache set failed'))
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await contextManager.getOrCreateContext('user123')

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cache context:',
        expect.any(Error)
      )
    })
  })

  describe('publishContext', () => {
    it('should publish context successfully', async () => {
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await contextManager.publishContext(mockContext)

      expect(mockContext.publish).toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('Published context (exposures and events)')
    })

    it('should handle publish failure', async () => {
      mockContext.publish.mockRejectedValue(new Error('Publish failed'))
      const contextManager = new ContextManager(manager as Manager, settings, logger)

      await expect(contextManager.publishContext(mockContext)).rejects.toThrow('Publish failed')

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish context:',
        expect.any(Error)
      )
    })
  })
})
