import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContextManager } from '../../../src/core/context-manager'
import { ABSmartlySettings, Logger, ABSmartlyContext } from '../../../src/types'
import { Manager } from '@managed-components/types'
import { createTestSDK, type EventLogger } from '../../helpers/sdk-helper'
import { basicExperimentData, emptyContextData } from '../../fixtures/absmartly-context-data'
import type { EventName, EventLoggerData } from '@absmartly/javascript-sdk/types/sdk'

interface CapturedEvent {
  context: ABSmartlyContext
  name: EventName
  data?: EventLoggerData
}

describe('ContextManager', () => {
  let manager: Partial<Manager>
  let settings: ABSmartlySettings
  let logger: Logger
  let storage: Map<string, any>
  let contextManager: ContextManager
  let events: CapturedEvent[]
  let eventLogger: EventLogger

  beforeEach(() => {
    storage = new Map()
    events = []

    eventLogger = (context, eventName, data) => {
      events.push({ context: context as unknown as ABSmartlyContext, name: eventName, data })
    }

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
      info: vi.fn(),
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    if (contextManager) {
      contextManager.destroy()
    }
  })

  describe('constructor', () => {
    it('should initialize SDK with correct configuration', () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      expect(contextManager).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        'Started cache cleanup task',
        expect.objectContaining({
          ttl: 60000,
          cleanupInterval: 60000,
        })
      )
    })

    it('should start cleanup task', () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      expect(logger.debug).toHaveBeenCalledWith(
        'Started cache cleanup task',
        expect.objectContaining({
          ttl: 60000,
          cleanupInterval: 60000,
        })
      )
    })
  })

  describe('createContext', () => {
    it('should create context that works and emits ready event', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})

      expect(context).toBeDefined()
      expect(context.ready).toBeDefined()

      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should apply overrides and verify treatment returns correct variant', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', { experiment1: 1 }, {})

      const treatment = context.treatment('experiment1')
      expect(treatment).toBe(1)

      const exposureEvents = events.filter(e => e.name === 'exposure')
      expect(exposureEvents.length).toBeGreaterThan(0)
      expect(exposureEvents[0].data).toMatchObject(
        expect.objectContaining({
          name: 'experiment1',
        })
      )
    })

    it('should set context attributes when provided', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext(
        'user123',
        {},
        { userAgent: 'test-agent' }
      )

      expect(context).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        'Set context attributes',
        expect.objectContaining({ userAgent: 'test-agent' })
      )
    })

    it('should wait for context ready', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})

      expect(context).toBeDefined()
      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should handle timeout', async () => {
      const sdk = createTestSDK(eventLogger, emptyContextData, 100)
      const slowSettings = { ...settings, SDK_TIMEOUT: 10 }
      contextManager = new ContextManager(manager as Manager, slowSettings, logger, sdk)

      await expect(
        contextManager.createContext('user123', {}, {})
      ).rejects.toThrow('Context timeout')
    })
  })

  describe('extractExperimentData', () => {
    it('should extract experiment data for eligible user', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      const experiments = contextManager.extractExperimentData(context, false)

      expect(Array.isArray(experiments)).toBe(true)
    })

    it('should skip experiments where user is not eligible', async () => {
      const sdk = createTestSDK(eventLogger, emptyContextData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      const experiments = contextManager.extractExperimentData(context, false)

      expect(experiments).toHaveLength(0)
    })

    it('should track immediate exposure when trackImmediate is true', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      events = []

      contextManager.extractExperimentData(context, true)

      const exposureEvents = events.filter(e => e.name === 'exposure')
      expect(exposureEvents.length).toBeGreaterThan(0)
    })

    it('should not track exposure when trackImmediate is false', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      events = []

      contextManager.extractExperimentData(context, false)

      const exposureEvents = events.filter(e => e.name === 'exposure')
      expect(exposureEvents.length).toBe(0)
    })

    it('should handle missing context data', async () => {
      const sdk = createTestSDK(eventLogger, emptyContextData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      const experiments = contextManager.extractExperimentData(context, false)

      expect(experiments).toHaveLength(0)
    })

    it('should handle experiment extraction errors gracefully', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})
      const brokenContext = {
        ...context,
        getData: () => {
          throw new Error('getData failed')
        },
      } as ABSmartlyContext

      const experiments = contextManager.extractExperimentData(brokenContext, false)

      expect(experiments).toHaveLength(0)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('getOrCreateContext', () => {
    it('should create new context if not cached', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should cache created context with TTL', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')

      expect(manager.set).toHaveBeenCalledWith(
        'context_user123',
        expect.objectContaining({
          data: expect.any(Object),
          timestamp: expect.any(Number),
          ttl: 60000,
        })
      )
    })

    it('should return cached context if available and not expired', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')
      const firstEventCount = events.length
      events = []

      await contextManager.getOrCreateContext('user123')

      const newReadyEvents = events.filter(e => e.name === 'ready')
      expect(newReadyEvents.length).toBeGreaterThan(0)
    })

    it('should create new context on second call if cache is expired', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')
      storage.delete('context_user123')
      events = []

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should create new context if cache recreation fails', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')

      vi.spyOn(sdk, 'createContextWith').mockImplementationOnce(() => {
        throw new Error('Invalid context data')
      })

      storage.set('context_user123', { data: 'invalid', timestamp: Date.now(), ttl: 60000 })
      events = []

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to recreate context from cache, creating new',
        expect.any(Error)
      )
    })

    it('should handle cache set failure gracefully', async () => {
      manager.set = vi.fn().mockRejectedValue(new Error('Cache set failed'))
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cache context:',
        expect.any(Error)
      )
    })

    it('should use default TTL when CONTEXT_CACHE_TTL is not set', async () => {
      delete settings.CONTEXT_CACHE_TTL
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')

      expect(manager.set).toHaveBeenCalledWith(
        'context_user123',
        expect.objectContaining({
          ttl: 300000,
        })
      )
    })

    it('should store cache entry in manager for persistence', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')

      expect(manager.set).toHaveBeenCalledWith(
        'context_user123',
        expect.objectContaining({
          data: expect.any(Object),
          timestamp: expect.any(Number),
          ttl: expect.any(Number),
        })
      )
    })
  })

  describe('publishContext', () => {
    it('should publish context successfully', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})

      await contextManager.publishContext(context)

      expect(logger.debug).toHaveBeenCalledWith('Published context (exposures and events)')
    })

    it('should handle publish errors', async () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {})

      vi.spyOn(context, 'publish').mockRejectedValue(new Error('Publish failed'))

      await expect(contextManager.publishContext(context)).rejects.toThrow('Publish failed')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish context:',
        expect.any(Error)
      )
    })
  })

  describe('destroy', () => {
    it('should stop cleanup task', () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      contextManager.destroy()

      expect(logger.debug).toHaveBeenCalledWith('Stopped cache cleanup task')
    })

    it('should handle multiple destroy calls', () => {
      const sdk = createTestSDK(eventLogger, basicExperimentData)
      contextManager = new ContextManager(manager as Manager, settings, logger, sdk)

      contextManager.destroy()
      contextManager.destroy()

      expect(logger.debug).toHaveBeenCalledWith('Stopped cache cleanup task')
    })
  })
})
