import { MCEvent } from '@managed-components/types'
import { ABSmartlySettings, ExperimentData } from '../types'
import { ContextManager } from './context-manager'
import { CookieHandler } from './cookie-handler'
import { OverridesHandler } from './overrides-handler'
import { Logger } from '../types'

export interface RequestHandlerOptions {
  contextManager: ContextManager
  cookieHandler: CookieHandler
  overridesHandler: OverridesHandler
  settings: ABSmartlySettings
  logger: Logger
}

export interface RequestHandlerResult {
  userId: string
  experimentData: ExperimentData[]
  fetchResult: Response | boolean | undefined
  shouldProcess: boolean
}

export class RequestHandler {
  constructor(private options: RequestHandlerOptions) {}

  async handleRequest(event: MCEvent): Promise<RequestHandlerResult | null> {
    const { contextManager, cookieHandler, overridesHandler, logger } =
      this.options

    try {
      logger.debug('Request intercepted', { url: event.client.url.toString() })

      // 1. Get or create user ID (with optional cookie management)
      const userId = cookieHandler.ensureUserId(event.client)
      logger.debug('User ID', { userId })

      // 2. Store UTM params and landing page (first visit)
      cookieHandler.storeUTMParams(event.client)
      cookieHandler.storeLandingPage(event.client)

      // 3. Check for overrides (QA mode)
      const overrides = overridesHandler.getOverrides(event)
      if (overridesHandler.hasOverrides(overrides)) {
        logger.debug('Overrides detected', { overrides })
      }

      // 4. Create context on edge
      const context = await contextManager.getOrCreateContext(
        userId,
        overrides,
        {
          url: event.client.url.toString(),
          userAgent: event.client.userAgent,
          ip: event.client.ip,
        }
      )

      // 5. Extract experiment data and treatments
      const experimentData = contextManager.extractExperimentData(context)
      logger.debug('Experiments extracted', {
        count: experimentData.length,
        experiments: experimentData.map(e => ({
          name: e.name,
          treatment: e.treatment,
        })),
      })

      // 6. Fetch the original response
      const fetchResult = await event.client.fetch(event.client.url.toString())

      if (!fetchResult || typeof fetchResult === 'boolean') {
        logger.warn('Fetch returned unexpected result, skipping manipulation')
        return {
          userId,
          experimentData,
          fetchResult,
          shouldProcess: false,
        }
      }

      // 7. Track exposures immediately (context is short-lived on edge)
      await contextManager.publishContext(context)
      logger.debug('Exposures published')

      return {
        userId,
        experimentData,
        fetchResult,
        shouldProcess: true,
      }
    } catch (error) {
      logger.error('Request handler error:', error)
      return null
    }
  }

  async handleRequestError(event: MCEvent): Promise<void> {
    const { logger } = this.options

    try {
      const originalRequest = await event.client.fetch(
        event.client.url.toString()
      )
      event.client.return(originalRequest)
    } catch (fetchError) {
      logger.error('Failed to fetch original request:', fetchError)
    }
  }
}
