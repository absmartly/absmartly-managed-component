import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventTracker } from '../../../src/core/event-tracker'
import { ContextManager } from '../../../src/core/context-manager'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { ABSmartlySettings, Logger } from '../../../src/types'
import { Manager, MCEvent, Client } from '@managed-components/types'

describe('EventTracker', () => {
  let manager: Partial<Manager>
  let contextManager: Partial<ContextManager>
  let cookieHandler: Partial<CookieHandler>
  let settings: ABSmartlySettings
  let logger: Logger
  let mockEvent: Partial<MCEvent>
  let mockClient: Partial<Client>
  let mockContext: any

  beforeEach(() => {
    mockContext = {
      track: vi.fn(),
    }

    manager = {}

    contextManager = {
      getOrCreateContext: vi.fn().mockResolvedValue(mockContext),
      publishContext: vi.fn().mockResolvedValue(undefined),
    }

    cookieHandler = {
      getUserId: vi.fn().mockReturnValue('user123'),
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      ENABLE_WEB_VITALS: true,
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }

    mockClient = {
      url: new URL('https://example.com'),
    }

    mockEvent = {
      client: mockClient as Client,
      payload: {} as any,
    }
  })

  const createMockEvent = (payload: any = {}): Partial<MCEvent> => ({
    client: mockClient as Client,
    payload: payload as any,
  })

  describe('trackGoal', () => {
    it('should track goal with properties', async () => {
      mockEvent = createMockEvent({
        name: 'signup',
        properties: { source: 'homepage' },
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackGoal(mockEvent as MCEvent)

      expect(cookieHandler.getUserId).toHaveBeenCalledWith(mockClient)
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123')
      expect(mockContext.track).toHaveBeenCalledWith('signup', { source: 'homepage' })
      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
    })

    it('should track goal with empty properties', async () => {
      mockEvent = createMockEvent({
        name: 'page_view',
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackGoal(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('page_view', {})
    })

    it('should warn and return if no user ID', async () => {
      cookieHandler.getUserId = vi.fn().mockReturnValue(null)
      mockEvent = createMockEvent({ name: 'test_goal' })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackGoal(mockEvent as MCEvent)

      expect(logger.warn).toHaveBeenCalledWith('No user ID found for goal tracking')
      expect(contextManager.getOrCreateContext).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockEvent = createMockEvent({ name: 'test_goal' })
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(new Error('Context error'))

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackGoal(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to track goal:', expect.any(Error))
    })
  })

  describe('trackEvent', () => {
    it('should call trackGoal', async () => {
      mockEvent = createMockEvent({ name: 'custom_event' })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEvent(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('custom_event', {})
    })
  })

  describe('trackEcommerce', () => {
    it('should track purchase event with revenue', async () => {
      mockEvent = createMockEvent({
        type: 'purchase',
        revenue: 99.99,
        currency: 'USD',
        transaction_id: 'txn_123',
        items: [
          { id: 'item1', name: 'Product 1', price: 49.99 },
          { id: 'item2', name: 'Product 2', price: 50.00 },
        ],
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('ecommerce_purchase', {
        event_type: 'purchase',
        revenue: 99.99,
        items: expect.any(Array),
        item_count: 2,
        transaction_id: 'txn_123',
        currency: 'USD',
      })

      expect(mockContext.track).toHaveBeenCalledWith('revenue', {
        value: 99.99,
        currency: 'USD',
      })
    })

    it('should track add_to_cart event', async () => {
      mockEvent = createMockEvent({
        type: 'add_to_cart',
        items: [{ id: 'item1', name: 'Product 1' }],
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('ecommerce_add_to_cart', {
        event_type: 'add_to_cart',
        items: expect.any(Array),
        item_count: 1,
      })
    })

    it('should track purchase with default currency when not specified', async () => {
      mockEvent = createMockEvent({
        type: 'purchase',
        revenue: 50.00,
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('revenue', {
        value: 50.00,
        currency: 'USD',
      })
    })

    it('should not track revenue for non-purchase events', async () => {
      mockEvent = createMockEvent({
        type: 'view_item',
        revenue: 99.99,
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledTimes(1)
      expect(mockContext.track).not.toHaveBeenCalledWith('revenue', expect.any(Object))
    })

    it('should warn and return if no user ID', async () => {
      cookieHandler.getUserId = vi.fn().mockReturnValue(null)
      mockEvent = createMockEvent({ type: 'purchase' })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(logger.warn).toHaveBeenCalledWith('No user ID found for ecommerce tracking')
      expect(contextManager.getOrCreateContext).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockEvent = createMockEvent({ type: 'purchase' })
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(new Error('Context error'))

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackEcommerce(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to track ecommerce event:', expect.any(Error))
    })
  })

  describe('trackWebVital', () => {
    it('should track web vital metric', async () => {
      mockEvent = createMockEvent({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 100,
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackWebVital(mockEvent as MCEvent)

      expect(mockContext.track).toHaveBeenCalledWith('LCP', {
        value: 2500,
        rating: 'good',
        delta: 100,
      })
      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
    })

    it('should not track if web vitals disabled', async () => {
      settings.ENABLE_WEB_VITALS = false
      mockEvent = createMockEvent({
        name: 'FCP',
        value: 1800,
        rating: 'good',
        delta: 50,
      })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackWebVital(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).not.toHaveBeenCalled()
      expect(mockContext.track).not.toHaveBeenCalled()
    })

    it('should return if no user ID', async () => {
      cookieHandler.getUserId = vi.fn().mockReturnValue(null)
      mockEvent = createMockEvent({ name: 'CLS', value: 0.1 })

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackWebVital(mockEvent as MCEvent)

      expect(contextManager.getOrCreateContext).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockEvent = createMockEvent({ name: 'FID', value: 100 })
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(new Error('Context error'))

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackWebVital(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to track web vital:', expect.any(Error))
    })
  })

  describe('trackCustom', () => {
    it('should track custom event with properties', async () => {
      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackCustom(mockEvent as MCEvent, 'custom_event', {
        key1: 'value1',
        key2: 123,
      })

      expect(mockContext.track).toHaveBeenCalledWith('custom_event', {
        key1: 'value1',
        key2: 123,
      })
      expect(contextManager.publishContext).toHaveBeenCalledWith(mockContext)
    })

    it('should return if no user ID', async () => {
      cookieHandler.getUserId = vi.fn().mockReturnValue(null)

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackCustom(mockEvent as MCEvent, 'custom_event', {})

      expect(contextManager.getOrCreateContext).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(new Error('Context error'))

      const tracker = new EventTracker(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      await tracker.trackCustom(mockEvent as MCEvent, 'custom_event', {})

      expect(logger.error).toHaveBeenCalledWith('Failed to track custom event:', expect.any(Error))
    })
  })
})
