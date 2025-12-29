import { MCEvent } from '@managed-components/types'
import {
  ABsmartlySettings,
  ExperimentData,
  ABsmartlyContext,
  OverridesMap,
  Logger,
} from '../types'
import { ContextManager } from './context-manager'
import { CookieHandler } from './cookie-handler'
import { OverridesHandler } from './overrides-handler'

export interface RequestHandlerOptions {
  contextManager: ContextManager
  cookieHandler: CookieHandler
  overridesHandler: OverridesHandler
  settings: ABsmartlySettings
  logger: Logger
}

export interface RequestHandlerResult {
  userId: string
  context: ABsmartlyContext
  experimentData: ExperimentData[]
  overrides: OverridesMap
  fetchResult: Response | boolean | undefined
  shouldProcess: boolean
}

export class RequestHandler {
  constructor(private options: RequestHandlerOptions) {}

  async handleRequest(
    event: MCEvent,
    skipFetch = false
  ): Promise<RequestHandlerResult | null> {
    const {
      contextManager,
      cookieHandler,
      overridesHandler,
      settings,
      logger,
    } = this.options

    try {
      const perfMarks = {
        start: Date.now(),
        userIdResolved: 0,
        overridesChecked: 0,
        contextCreated: 0,
        experimentsExtracted: 0,
        fetchComplete: 0,
        exposuresPublished: 0,
      }

      logger.debug('Request intercepted', { url: event.client.url.toString() })

      // 1. Get or create user ID (with optional cookie management)
      const userId = cookieHandler.ensureUserId(event.client)
      perfMarks.userIdResolved = Date.now()
      logger.debug('User ID', {
        userId,
        time: `${perfMarks.userIdResolved - perfMarks.start}ms`,
      })

      // 2. Store UTM params and landing page (first visit)
      cookieHandler.storeUTMParams(event.client)
      cookieHandler.storeLandingPage(event.client)

      // 3. Check for overrides (QA mode)
      const overrides = overridesHandler.getOverrides(event)
      perfMarks.overridesChecked = Date.now()
      if (overridesHandler.hasOverrides(overrides)) {
        logger.debug('Overrides detected', { overrides })
      }

      // 4. Create context on edge
      const attributes: Record<string, string | undefined> = {
        userAgent: event.client.userAgent,
      }

      // Add IP address if enabled
      if (settings.INCLUDE_IP_IN_ATTRIBUTES) {
        attributes.ip = event.client.ip
      }

      // Add Cloudflare country header if available
      const cfCountry = event.client.get('CF-IPCountry')
      if (cfCountry) {
        attributes.country = cfCountry
      }

      const context = await contextManager.getOrCreateContext(
        userId,
        overrides,
        attributes
      )
      perfMarks.contextCreated = Date.now()
      logger.debug('Context created', {
        time: `${perfMarks.contextCreated - perfMarks.overridesChecked}ms`,
      })

      // 5. Extract experiment data and treatments
      const experimentData = contextManager.extractExperimentData(context)
      perfMarks.experimentsExtracted = Date.now()
      logger.debug('Experiments extracted', {
        count: experimentData.length,
        time: `${perfMarks.experimentsExtracted - perfMarks.contextCreated}ms`,
        experiments: experimentData.map(e => ({
          name: e.name,
          treatment: e.treatment,
        })),
      })

      // 6. Fetch the original response (only for HTML interception, not for SDK injection)
      let fetchResult: Response | boolean | undefined
      if (!skipFetch) {
        fetchResult = await event.client.fetch(event.client.url.toString())
        perfMarks.fetchComplete = Date.now()

        logger.log('Fetch result received', {
          type: typeof fetchResult,
          isBoolean: typeof fetchResult === 'boolean',
          isNull: fetchResult === null,
          isUndefined: fetchResult === undefined,
          constructorName: fetchResult?.constructor?.name,
          hasHeaders: !!(fetchResult as any)?.headers,
          hasText: typeof (fetchResult as any)?.text === 'function',
        })

        if (!fetchResult || typeof fetchResult === 'boolean') {
          logger.warn(
            'Fetch returned unexpected result, skipping manipulation',
            {
              fetchResult,
              type: typeof fetchResult,
            }
          )
          return {
            userId,
            context,
            experimentData,
            overrides,
            fetchResult,
            shouldProcess: false,
          }
        }
      } else {
        fetchResult = undefined
        perfMarks.fetchComplete = Date.now()
        logger.debug('Skipping fetch (SDK injection only)')
      }

      // 7. Track exposures immediately (context is short-lived on edge)
      await contextManager.publishContext(context)
      perfMarks.exposuresPublished = Date.now()

      const totalTime = perfMarks.exposuresPublished - perfMarks.start
      logger.log('Request processing complete', {
        totalTime: `${totalTime}ms`,
        breakdown: {
          userIdResolved: `${perfMarks.userIdResolved - perfMarks.start}ms`,
          contextCreated: `${perfMarks.contextCreated - perfMarks.overridesChecked}ms`,
          experimentsExtracted: `${perfMarks.experimentsExtracted - perfMarks.contextCreated}ms`,
          fetchComplete: `${perfMarks.fetchComplete - perfMarks.experimentsExtracted}ms`,
          exposuresPublished: `${perfMarks.exposuresPublished - perfMarks.fetchComplete}ms`,
        },
      })

      return {
        userId,
        context,
        experimentData,
        overrides,
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
