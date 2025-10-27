import { Manager, MCEvent } from '@managed-components/types'
import {
  ABSmartlySettings,
  EventPayload,
  EcommercePayload,
  WebVitalMetric,
} from '../types'
import { ContextManager } from './context-manager'
import { CookieHandler } from './cookie-handler'
import { Logger } from '../types'

export class EventTracker {
  constructor(
    private manager: Manager,
    private contextManager: ContextManager,
    private cookieHandler: CookieHandler,
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  async trackGoal(event: MCEvent): Promise<void> {
    try {
      const userId = this.cookieHandler.getUserId(event.client)
      if (!userId) {
        this.logger.warn('No user ID found for goal tracking')
        return
      }

      const payload = event.payload as EventPayload
      const goalName = payload.name
      const properties = payload.properties || {}

      this.logger.debug('Tracking goal', { userId, goalName, properties })

      // Get or create context
      const context = await this.contextManager.getOrCreateContext(userId)

      // Track goal
      context.track(goalName, properties)

      // Publish immediately (edge context is short-lived)
      await this.contextManager.publishContext(context)

      this.logger.debug('Goal tracked successfully', { goalName })
    } catch (error) {
      this.logger.error('Failed to track goal:', error)
    }
  }

  async trackEvent(event: MCEvent): Promise<void> {
    // Same as trackGoal
    await this.trackGoal(event)
  }

  async trackEcommerce(event: MCEvent): Promise<void> {
    try {
      const userId = this.cookieHandler.getUserId(event.client)
      if (!userId) {
        this.logger.warn('No user ID found for ecommerce tracking')
        return
      }

      const payload = event.payload as EcommercePayload
      const eventType = payload.type

      this.logger.debug('Tracking ecommerce event', {
        userId,
        eventType,
        payload,
      })

      // Get or create context
      const context = await this.contextManager.getOrCreateContext(userId)

      // Map ecommerce events to ABsmartly goals
      const goalName = `ecommerce_${eventType}`
      const properties: Record<string, string | number | boolean | unknown[]> =
        {
          event_type: eventType,
        }

      if (payload.revenue !== undefined) {
        properties.revenue = payload.revenue
      }

      if (payload.items) {
        properties.items = payload.items
        properties.item_count = payload.items.length
      }

      if (payload.transaction_id) {
        properties.transaction_id = payload.transaction_id
      }

      if (payload.currency) {
        properties.currency = payload.currency
      }

      // Track as goal
      context.track(goalName, properties)

      // Also track purchase value if it's a purchase event
      if (eventType === 'purchase' && payload.revenue) {
        context.track('revenue', {
          value: payload.revenue,
          currency: payload.currency || 'USD',
        })
      }

      // Publish immediately
      await this.contextManager.publishContext(context)

      this.logger.debug('Ecommerce event tracked successfully', { eventType })
    } catch (error) {
      this.logger.error('Failed to track ecommerce event:', error)
    }
  }

  async trackWebVital(event: MCEvent): Promise<void> {
    if (!this.settings.ENABLE_WEB_VITALS) {
      return
    }

    try {
      const userId = this.cookieHandler.getUserId(event.client)
      if (!userId) {
        return
      }

      const payload = event.payload as WebVitalMetric
      const metricName = payload.name
      const value = payload.value

      this.logger.debug('Tracking web vital', { userId, metricName, value })

      // Get or create context
      const context = await this.contextManager.getOrCreateContext(userId)

      // Track web vital as a goal
      context.track(metricName, {
        value,
        rating: payload.rating,
        delta: payload.delta,
      })

      // Publish immediately
      await this.contextManager.publishContext(context)

      this.logger.debug('Web vital tracked successfully', { metricName })
    } catch (error) {
      this.logger.error('Failed to track web vital:', error)
    }
  }

  async trackCustom(
    event: MCEvent,
    eventName: string,
    properties: Record<string, string | number | boolean | null | undefined>
  ): Promise<void> {
    try {
      const userId = this.cookieHandler.getUserId(event.client)
      if (!userId) {
        return
      }

      this.logger.debug('Tracking custom event', {
        userId,
        eventName,
        properties,
      })

      const context = await this.contextManager.getOrCreateContext(userId)
      context.track(eventName, properties)
      await this.contextManager.publishContext(context)

      this.logger.debug('Custom event tracked successfully', { eventName })
    } catch (error) {
      this.logger.error('Failed to track custom event:', error)
    }
  }
}
