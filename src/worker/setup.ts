import { Client } from '@managed-components/types'
import {
  ABsmartlySettings,
  ExperimentData,
  Logger,
  OverridesMap,
} from '../types'
import { ContextManager } from '../core/context-manager'
import { CookieHandler } from '../core/cookie-handler'
import { HTMLProcessor } from '../core/html-processor'
import { createLogger } from '../utils/logger'
import { safeParseJSON } from '../utils/serializer'
import { COOKIE_NAMES } from '../constants/cookies'
import {
  WorkerClient,
  CookieToSet,
  buildSetCookieHeaders,
} from './client-adapter'

export interface ProcessHTMLOptions {
  request: Request
  html: string
  settings: ABsmartlySettings
}

export interface ProcessHTMLResult {
  html: string
  experimentData: ExperimentData[]
  userId: string
  cookiesToSet: CookieToSet[]
  setCookieHeaders: string[]
}

function getOverridesFromClient(client: Client, logger: Logger): OverridesMap {
  const overrides: OverridesMap = {}

  try {
    for (const [key, value] of client.url.searchParams) {
      if (key.startsWith('absmartly_')) {
        const experimentName = key.replace('absmartly_', '')
        overrides[experimentName] = parseInt(value, 10)
      }
    }
  } catch (error) {
    logger.error('Failed to parse URL overrides', error)
  }

  try {
    const cookieValue = client.get(COOKIE_NAMES.OVERRIDES)
    if (cookieValue) {
      const cookieOverrides =
        safeParseJSON<OverridesMap>(cookieValue, {}, logger) || {}
      Object.assign(overrides, cookieOverrides)
    }
  } catch (error) {
    logger.error('Failed to parse cookie overrides', error)
  }

  return overrides
}

export async function processHTML(
  options: ProcessHTMLOptions
): Promise<ProcessHTMLResult> {
  const { request, html, settings } = options
  const logger = createLogger(settings.ENABLE_DEBUG || false, 'worker')

  const perfStart = Date.now()

  const client = new WorkerClient(request)

  const cookieHandler = new CookieHandler({ settings, logger })
  const userId = cookieHandler.ensureUserId(client)
  cookieHandler.storeUTMParams(client)
  cookieHandler.storeLandingPage(client)

  const overrides = getOverridesFromClient(client, logger)

  const attributes: Record<string, string | undefined> = {
    userAgent: client.userAgent,
  }

  if (settings.INCLUDE_IP_IN_ATTRIBUTES) {
    attributes.ip = client.ip
  }

  const contextManager = new ContextManager(settings, logger)

  const context = await contextManager.getOrCreateContext(
    userId,
    overrides,
    attributes
  )

  const experimentData = contextManager.extractExperimentData(context)

  logger.log('Experiments extracted', {
    count: experimentData.length,
    experiments: experimentData.map(e => ({
      name: e.name,
      treatment: e.treatment,
      changesCount: e.changes?.length || 0,
    })),
  })

  let processedHTML = html

  if (experimentData.length > 0) {
    const allChanges = experimentData.flatMap(exp => exp.changes || [])

    if (allChanges.length > 0) {
      logger.log('Applying DOM changes', { count: allChanges.length })

      const htmlProcessor = new HTMLProcessor({
        settings,
        logger,
        useLinkedom: true,
      })
      processedHTML = htmlProcessor.processHTML(html, experimentData)

      logger.log('DOM changes applied', {
        originalLength: html.length,
        processedLength: processedHTML.length,
      })
    }
  }

  await contextManager.publishContext(context)

  const cookiesToSet = client.getCookiesToSet()
  const setCookieHeaders = buildSetCookieHeaders(cookiesToSet)

  const totalTime = Date.now() - perfStart
  logger.log('HTML processing complete', {
    totalTime: `${totalTime}ms`,
    userId,
    experimentsCount: experimentData.length,
    cookiesSet: cookiesToSet.length,
  })

  return {
    html: processedHTML,
    experimentData,
    userId,
    cookiesToSet,
    setCookieHeaders,
  }
}

export {
  WorkerClient,
  CookieToSet,
  buildSetCookieHeaders,
} from './client-adapter'
