import { Manager, MCEvent } from '@managed-components/types'
import { EventTracker } from './event-tracker'
import { ExperimentViewHandler } from './experiment-view-handler'
import { Logger } from '../types'

export interface EventHandlersOptions {
  eventTracker: EventTracker
  experimentViewHandler: ExperimentViewHandler
  logger: Logger
}

export class EventHandlers {
  constructor(private options: EventHandlersOptions) {}

  setupEventListeners(manager: Manager): void {
    this.setupTrackEventListener(manager)
    this.setupGenericEventListener(manager)
    this.setupEcommerceEventListener(manager)
  }

  private setupTrackEventListener(manager: Manager): void {
    const { eventTracker, experimentViewHandler, logger } = this.options

    manager.addEventListener('track', async (event: MCEvent) => {
      try {
        const eventName = event.payload?.name || event.payload?.goal_name
        logger.debug('Track event received', { name: eventName })

        // Handle ExperimentView events for on-view exposure tracking
        if (eventName === 'ExperimentView') {
          const experimentName = event.payload?.experimentName
          if (experimentName) {
            await experimentViewHandler.handleExperimentView(
              event,
              experimentName
            )
          }
        } else {
          // Regular goal tracking
          await eventTracker.trackGoal(event)
        }
      } catch (error) {
        logger.error('Track event error:', error)
      }
    })
  }

  private setupGenericEventListener(manager: Manager): void {
    const { eventTracker, logger } = this.options

    manager.addEventListener('event', async (event: MCEvent) => {
      try {
        logger.debug('Event received', { type: event.type })
        await eventTracker.trackEvent(event)
      } catch (error) {
        logger.error('Event error:', error)
      }
    })
  }

  private setupEcommerceEventListener(manager: Manager): void {
    const { eventTracker, logger } = this.options

    manager.addEventListener('ecommerce', async (event: MCEvent) => {
      try {
        logger.debug('Ecommerce event received', { type: event.payload?.type })
        await eventTracker.trackEcommerce(event)
      } catch (error) {
        logger.error('Ecommerce event error:', error)
      }
    })
  }
}
