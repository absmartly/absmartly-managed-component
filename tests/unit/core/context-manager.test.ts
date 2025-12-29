import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContextManager } from '../../../src/core/context-manager'
import { ABsmartlySettings, Logger, ABsmartlyContext } from '../../../src/types'
import { createTestSDK, type EventLogger } from '../../helpers/sdk-helper'
import { basicExperimentData, emptyContextData } from '../../fixtures/absmartly-context-data'
import type { EventName, EventLoggerData } from '@absmartly/javascript-sdk/types/sdk'

interface CapturedEvent {
  context: ABsmartlyContext
  name: EventName
  data?: EventLoggerData
}

describe('ContextManager', () => {
  let settings: ABsmartlySettings
  let logger: Logger
  let contextManager: ContextManager
  let events: CapturedEvent[]
  let eventLogger: EventLogger

  beforeEach(() => {
    events = []

    eventLogger = (context, eventName, data) => {
      events.push({ context: context as unknown as ABsmartlyContext, name: eventName, data })
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      SDK_API_KEY: 'test-key',
      ENDPOINT: 'https://api.absmartly.io/v1',
      ENVIRONMENT: 'production',
      APPLICATION: 'test-app',
      SDK_TIMEOUT: 2000,
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

  afterEach(() => {
    if (contextManager) {
      contextManager.destroy()
    }
  })

  describe('constructor', () => {
    it('should initialize SDK with correct configuration', () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      expect(contextManager).toBeDefined()
    })
  })

  describe('createContext', () => {
    it('should create context that works and emits ready event', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)

      expect(context).toBeDefined()
      expect(context.ready).toBeDefined()

      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should apply overrides and verify treatment returns correct variant', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', { experiment1: 1 }, {}, basicExperimentData)

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
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext(
        'user123',
        {},
        { userAgent: 'test-agent' },
        basicExperimentData
      )

      expect(context).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        'Set context attributes',
        expect.objectContaining({ userAgent: 'test-agent' })
      )
    })

    it('should wait for context ready', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)

      expect(context).toBeDefined()
      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
    })

    it('should create context immediately with provided data', async () => {
      const sdk = createTestSDK(eventLogger)
      const slowSettings = { ...settings, SDK_TIMEOUT: 10 }
      contextManager = new ContextManager(slowSettings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)
      expect(context).toBeDefined()
    })
  })

  describe('extractExperimentData', () => {
    it('should extract experiment data for eligible user', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)
      const experiments = contextManager.extractExperimentData(context, false)

      expect(Array.isArray(experiments)).toBe(true)
    })

    it('should skip experiments where user is not eligible', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, emptyContextData)
      const experiments = contextManager.extractExperimentData(context, false)

      expect(experiments).toHaveLength(0)
    })

    it('should track immediate exposure when trackImmediate is true', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)
      events = []

      contextManager.extractExperimentData(context, true)

      const exposureEvents = events.filter(e => e.name === 'exposure')
      expect(exposureEvents.length).toBeGreaterThan(0)
    })

    it('should not track exposure when trackImmediate is false', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)
      events = []

      contextManager.extractExperimentData(context, false)

      const exposureEvents = events.filter(e => e.name === 'exposure')
      expect(exposureEvents.length).toBe(0)
    })

    it('should handle missing context data', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, emptyContextData)
      const experiments = contextManager.extractExperimentData(context, false)

      expect(experiments).toHaveLength(0)
    })

    it('should handle experiment extraction errors gracefully', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)
      const brokenContext = {
        ...context,
        getData: () => {
          throw new Error('getData failed')
        },
      } as ABsmartlyContext

      const experiments = contextManager.extractExperimentData(brokenContext, false)

      expect(experiments).toHaveLength(0)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('getOrCreateContext', () => {
    it('should create new context and fetch from API', async () => {
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockResolvedValue(basicExperimentData as any)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      const readyEvents = events.filter(e => e.name === 'ready')
      expect(readyEvents.length).toBeGreaterThan(0)
      expect(logger.log).toHaveBeenCalledWith(
        'Context data fetched from ABsmartly API',
        expect.objectContaining({
          userId: 'user123',
        })
      )
    })

    it('should handle API errors gracefully and return fallback context', async () => {
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockRejectedValue(new Error('API error'))
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.getOrCreateContext('user123')

      expect(context).toBeDefined()
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch context data:',
        expect.any(Error)
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Creating fallback context (no experiments)',
        { userId: 'user123' }
      )
    })

    it('should apply overrides and attributes when provided', async () => {
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockResolvedValue(basicExperimentData as any)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.getOrCreateContext(
        'user123',
        { experiment1: 1 },
        { userAgent: 'test-agent' }
      )

      expect(context).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith('Applied overrides', {
        overrides: { experiment1: 1 },
      })
      expect(logger.debug).toHaveBeenCalledWith(
        'Set context attributes',
        { userAgent: 'test-agent' }
      )
    })
  })

  describe('publishContext', () => {
    it('should publish context successfully', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)

      await contextManager.publishContext(context)

      expect(logger.debug).toHaveBeenCalledWith('Published context (exposures and events)')
    })

    it('should handle publish errors', async () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      const context = await contextManager.createContext('user123', {}, {}, basicExperimentData)

      vi.spyOn(context, 'publish').mockRejectedValue(new Error('Publish failed'))

      await expect(contextManager.publishContext(context)).rejects.toThrow('Publish failed')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish context:',
        expect.any(Error)
      )
    })
  })

  describe('circuit breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockRejectedValue(new Error('API error'))
      contextManager = new ContextManager(settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')

      expect(logger.error).toHaveBeenCalledWith(
        'Circuit breaker OPEN - falling back to original content',
        expect.any(Object)
      )
    })

    it('should throw error when circuit is open', async () => {
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockRejectedValue(new Error('API error'))
      contextManager = new ContextManager(settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')

      await expect(
        contextManager.createContext('user123', {}, {}, basicExperimentData)
      ).rejects.toThrow('Circuit breaker is open')
    })

    it('should transition to half-open state after timeout', async () => {
      vi.useFakeTimers()
      const sdk = createTestSDK(eventLogger)
      vi.spyOn(sdk, 'getContextData').mockRejectedValue(new Error('API error'))
      contextManager = new ContextManager(settings, logger, sdk)

      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')
      await contextManager.getOrCreateContext('user123')

      vi.advanceTimersByTime(60000)

      expect(logger.info).toHaveBeenCalledWith(
        'Circuit breaker HALF_OPEN - testing SDK availability'
      )

      vi.useRealTimers()
    })
  })

  describe('destroy', () => {
    it('should clean up circuit breaker timer', () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      contextManager.destroy()

      expect(contextManager).toBeDefined()
    })

    it('should handle multiple destroy calls', () => {
      const sdk = createTestSDK(eventLogger)
      contextManager = new ContextManager(settings, logger, sdk)

      contextManager.destroy()
      contextManager.destroy()

      expect(contextManager).toBeDefined()
    })
  })
})
