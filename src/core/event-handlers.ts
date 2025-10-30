import { Manager, MCEvent } from '@managed-components/types'
import { EventTracker } from './event-tracker'
import { ExperimentViewHandler } from './experiment-view-handler'
import { Logger } from '../types'

export interface EventHandlersOptions {
  eventTracker: EventTracker
  experimentViewHandler: ExperimentViewHandler
  logger: Logger
}

const setupManagers = new WeakSet<Manager>()

export class EventHandlers {
  constructor(private options: EventHandlersOptions) {}

  setupEventListeners(manager: Manager): () => void {
    const { logger } = this.options

    if (setupManagers.has(manager)) {
      logger.warn('Event handlers already setup for this manager, skipping duplicate setup')
      return () => {
        logger.debug('Cleanup called but already skipped duplicate event handler setup')
      }
    }

    setupManagers.add(manager)

    this.setupTrackEventListener(manager)
    this.setupGenericEventListener(manager)
    this.setupEcommerceEventListener(manager)

    return () => {
      setupManagers.delete(manager)
      logger.debug('Event handlers cleanup completed (note: Managed Components API does not support removeEventListener)')
    }
  }

  private setupTrackEventListener(manager: Manager): void {
    const { eventTracker, experimentViewHandler, logger } = this.options

    const trackListener = async (event: MCEvent) => {
      try {
        const eventName = event.payload?.name || event.payload?.goal_name
        logger.debug('Track event received', { name: eventName })

        if (eventName === 'ExperimentView') {
          const experimentName = event.payload?.experimentName
          if (experimentName) {
            await experimentViewHandler.handleExperimentView(
              event,
              experimentName
            )
          }
        } else {
          await eventTracker.trackGoal(event)
        }
      } catch (error) {
        logger.error('Track event error:', error)
      }
    }

    manager.addEventListener('track', trackListener)
  }

  private setupGenericEventListener(manager: Manager): void {
    const { eventTracker, logger } = this.options

    const eventListener = async (event: MCEvent) => {
      try {
        logger.debug('Event received', { type: event.type })
        await eventTracker.trackEvent(event)
      } catch (error) {
        logger.error('Event error:', error)
      }
    }

    manager.addEventListener('event', eventListener)
  }

  private setupEcommerceEventListener(manager: Manager): void {
    const { eventTracker, logger } = this.options

    const ecommerceListener = async (event: MCEvent) => {
      try {
        logger.debug('Ecommerce event received', { type: event.payload?.type })
        await eventTracker.trackEcommerce(event)
      } catch (error) {
        logger.error('Ecommerce event error:', error)
      }
    }

    manager.addEventListener('ecommerce', ecommerceListener)
  }
}
