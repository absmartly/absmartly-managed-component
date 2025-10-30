import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventHandlers } from '../../../src/core/event-handlers'
import { EventTracker } from '../../../src/core/event-tracker'
import { ExperimentViewHandler } from '../../../src/core/experiment-view-handler'
import { Logger } from '../../../src/types'
import { Manager, MCEvent } from '@managed-components/types'

describe('EventHandlers', () => {
  let eventTracker: EventTracker
  let experimentViewHandler: ExperimentViewHandler
  let logger: Logger
  let manager: Partial<Manager>
  let eventHandlers: EventHandlers

  beforeEach(() => {
    eventTracker = {
      trackGoal: vi.fn(),
      trackEvent: vi.fn(),
      trackEcommerce: vi.fn(),
    } as unknown as EventTracker

    experimentViewHandler = {
      handleExperimentView: vi.fn(),
    } as unknown as ExperimentViewHandler

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    manager = {
      addEventListener: vi.fn(),
    }

    eventHandlers = new EventHandlers({
      eventTracker,
      experimentViewHandler,
      logger,
    })

    vi.clearAllMocks()
  })

  describe('setupEventListeners', () => {
    it('should setup all event listeners without duplicates', () => {
      eventHandlers.setupEventListeners(manager as Manager)

      expect(manager.addEventListener).toHaveBeenCalledTimes(3)
      expect(manager.addEventListener).toHaveBeenCalledWith('track', expect.any(Function))
      expect(manager.addEventListener).toHaveBeenCalledWith('event', expect.any(Function))
      expect(manager.addEventListener).toHaveBeenCalledWith('ecommerce', expect.any(Function))
    })

    it('should prevent duplicate setup for same manager', () => {
      eventHandlers.setupEventListeners(manager as Manager)
      eventHandlers.setupEventListeners(manager as Manager)

      expect(manager.addEventListener).toHaveBeenCalledTimes(3)
      expect(logger.warn).toHaveBeenCalledWith(
        'Event handlers already setup for this manager, skipping duplicate setup'
      )
    })

    it('should return cleanup function', () => {
      const cleanup = eventHandlers.setupEventListeners(manager as Manager)

      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should cleanup and allow re-setup after cleanup', () => {
      const cleanup = eventHandlers.setupEventListeners(manager as Manager)

      expect(manager.addEventListener).toHaveBeenCalledTimes(3)
      vi.clearAllMocks()

      cleanup()

      expect(logger.debug).toHaveBeenCalledWith(
        'Event handlers cleanup completed (note: Managed Components API does not support removeEventListener)'
      )

      eventHandlers.setupEventListeners(manager as Manager)
      expect(manager.addEventListener).toHaveBeenCalledTimes(3)
    })

    it('should handle cleanup for duplicate setup attempt', () => {
      eventHandlers.setupEventListeners(manager as Manager)
      const cleanup = eventHandlers.setupEventListeners(manager as Manager)

      cleanup()

      expect(logger.debug).toHaveBeenCalledWith(
        'Cleanup called but already skipped duplicate event handler setup'
      )
    })
  })

  describe('track event handling', () => {
    let trackListener: (event: MCEvent) => Promise<void>

    beforeEach(() => {
      eventHandlers.setupEventListeners(manager as Manager)
      const calls = (manager.addEventListener as any).mock.calls
      const trackCall = calls.find((call: any[]) => call[0] === 'track')
      trackListener = trackCall[1]
    })

    it('should handle ExperimentView events', async () => {
      const event: MCEvent = {
        type: 'track',
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-experiment',
        },
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Track event received', { name: 'ExperimentView' })
      expect(experimentViewHandler.handleExperimentView).toHaveBeenCalledWith(
        event,
        'test-experiment'
      )
      expect(eventTracker.trackGoal).not.toHaveBeenCalled()
    })

    it('should handle ExperimentView with goal_name field', async () => {
      const event: MCEvent = {
        type: 'track',
        payload: {
          goal_name: 'ExperimentView',
          experimentName: 'test-experiment',
        },
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Track event received', { name: 'ExperimentView' })
      expect(experimentViewHandler.handleExperimentView).toHaveBeenCalledWith(
        event,
        'test-experiment'
      )
    })

    it('should skip ExperimentView without experimentName', async () => {
      const event: MCEvent = {
        type: 'track',
        payload: {
          name: 'ExperimentView',
        },
        client: {} as any,
      }

      await trackListener(event)

      expect(experimentViewHandler.handleExperimentView).not.toHaveBeenCalled()
      expect(eventTracker.trackGoal).not.toHaveBeenCalled()
    })

    it('should handle regular track events', async () => {
      const event: MCEvent = {
        type: 'track',
        payload: {
          name: 'purchase',
          properties: { value: 100 },
        },
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Track event received', { name: 'purchase' })
      expect(eventTracker.trackGoal).toHaveBeenCalledWith(event)
      expect(experimentViewHandler.handleExperimentView).not.toHaveBeenCalled()
    })

    it('should handle track events with empty payload', async () => {
      const event: MCEvent = {
        type: 'track',
        payload: {},
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Track event received', { name: undefined })
      expect(eventTracker.trackGoal).toHaveBeenCalledWith(event)
    })

    it('should handle errors in track event gracefully', async () => {
      const error = new Error('Track error')
      vi.mocked(eventTracker.trackGoal).mockRejectedValueOnce(error)

      const event: MCEvent = {
        type: 'track',
        payload: { name: 'test' },
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.error).toHaveBeenCalledWith('Track event error:', error)
    })

    it('should handle errors in ExperimentView gracefully', async () => {
      const error = new Error('ExperimentView error')
      vi.mocked(experimentViewHandler.handleExperimentView).mockRejectedValueOnce(error)

      const event: MCEvent = {
        type: 'track',
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-experiment',
        },
        client: {} as any,
      }

      await trackListener(event)

      expect(logger.error).toHaveBeenCalledWith('Track event error:', error)
    })
  })

  describe('generic event handling', () => {
    let eventListener: (event: MCEvent) => Promise<void>

    beforeEach(() => {
      eventHandlers.setupEventListeners(manager as Manager)
      const calls = (manager.addEventListener as any).mock.calls
      const eventCall = calls.find((call: any[]) => call[0] === 'event')
      eventListener = eventCall[1]
    })

    it('should handle generic events', async () => {
      const event: MCEvent = {
        type: 'event',
        payload: { data: 'test' },
        client: {} as any,
      }

      await eventListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Event received', { type: 'event' })
      expect(eventTracker.trackEvent).toHaveBeenCalledWith(event)
    })

    it('should handle errors in generic events gracefully', async () => {
      const error = new Error('Event error')
      vi.mocked(eventTracker.trackEvent).mockRejectedValueOnce(error)

      const event: MCEvent = {
        type: 'event',
        payload: {},
        client: {} as any,
      }

      await eventListener(event)

      expect(logger.error).toHaveBeenCalledWith('Event error:', error)
    })
  })

  describe('ecommerce event handling', () => {
    let ecommerceListener: (event: MCEvent) => Promise<void>

    beforeEach(() => {
      eventHandlers.setupEventListeners(manager as Manager)
      const calls = (manager.addEventListener as any).mock.calls
      const ecommerceCall = calls.find((call: any[]) => call[0] === 'ecommerce')
      ecommerceListener = ecommerceCall[1]
    })

    it('should handle ecommerce events', async () => {
      const event: MCEvent = {
        type: 'ecommerce',
        payload: {
          type: 'purchase',
          products: [{ id: '123', price: 100 }],
        },
        client: {} as any,
      }

      await ecommerceListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Ecommerce event received', { type: 'purchase' })
      expect(eventTracker.trackEcommerce).toHaveBeenCalledWith(event)
    })

    it('should handle ecommerce events without type', async () => {
      const event: MCEvent = {
        type: 'ecommerce',
        payload: {},
        client: {} as any,
      }

      await ecommerceListener(event)

      expect(logger.debug).toHaveBeenCalledWith('Ecommerce event received', { type: undefined })
      expect(eventTracker.trackEcommerce).toHaveBeenCalledWith(event)
    })

    it('should handle errors in ecommerce events gracefully', async () => {
      const error = new Error('Ecommerce error')
      vi.mocked(eventTracker.trackEcommerce).mockRejectedValueOnce(error)

      const event: MCEvent = {
        type: 'ecommerce',
        payload: { type: 'purchase' },
        client: {} as any,
      }

      await ecommerceListener(event)

      expect(logger.error).toHaveBeenCalledWith('Ecommerce event error:', error)
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple event types in sequence', async () => {
      eventHandlers.setupEventListeners(manager as Manager)

      const calls = (manager.addEventListener as any).mock.calls
      const trackListener = calls.find((call: any[]) => call[0] === 'track')[1]
      const eventListener = calls.find((call: any[]) => call[0] === 'event')[1]
      const ecommerceListener = calls.find((call: any[]) => call[0] === 'ecommerce')[1]

      await trackListener({ type: 'track', payload: { name: 'test' }, client: {} as any })
      await eventListener({ type: 'event', payload: {}, client: {} as any })
      await ecommerceListener({ type: 'ecommerce', payload: {}, client: {} as any })

      expect(eventTracker.trackGoal).toHaveBeenCalledTimes(1)
      expect(eventTracker.trackEvent).toHaveBeenCalledTimes(1)
      expect(eventTracker.trackEcommerce).toHaveBeenCalledTimes(1)
    })

    it('should handle concurrent event processing', async () => {
      eventHandlers.setupEventListeners(manager as Manager)

      const calls = (manager.addEventListener as any).mock.calls
      const trackListener = calls.find((call: any[]) => call[0] === 'track')[1]

      const events = [
        { type: 'track', payload: { name: 'event1' }, client: {} as any },
        { type: 'track', payload: { name: 'event2' }, client: {} as any },
        { type: 'track', payload: { name: 'event3' }, client: {} as any },
      ]

      await Promise.all(events.map(event => trackListener(event)))

      expect(eventTracker.trackGoal).toHaveBeenCalledTimes(3)
    })

    it('should maintain error isolation between events', async () => {
      eventHandlers.setupEventListeners(manager as Manager)

      const calls = (manager.addEventListener as any).mock.calls
      const trackListener = calls.find((call: any[]) => call[0] === 'track')[1]

      vi.mocked(eventTracker.trackGoal)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Error 3'))

      await trackListener({ type: 'track', payload: { name: 'event1' }, client: {} as any })
      await trackListener({ type: 'track', payload: { name: 'event2' }, client: {} as any })
      await trackListener({ type: 'track', payload: { name: 'event3' }, client: {} as any })

      expect(logger.error).toHaveBeenCalledTimes(2)
      expect(eventTracker.trackGoal).toHaveBeenCalledTimes(3)
    })
  })
})
