import { Manager } from '@managed-components/types'
import { ABsmartlySettings, Logger } from '../types'

export interface ProxyRouteOptions {
  manager: Manager
  settings: ABsmartlySettings
  logger: Logger
}

export function createABsmartlyProxyRoute(options: ProxyRouteOptions) {
  const { manager, settings, logger } = options

  return async (request: Request): Promise<Response> => {
    console.log('🚨 ROUTE HANDLER INVOKED - RAW')
    logger.log('🚨 ROUTE HANDLER INVOKED')
    try {
      logger.log('🔀 Proxy route called', {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      })

      const endpoint = settings.ENDPOINT
      const apiKey = settings.SDK_API_KEY

      if (!endpoint || !apiKey) {
        logger.error('Missing ABsmartly endpoint or API key')
        return new Response(
          JSON.stringify({ error: 'Missing configuration' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const method = request.method

      // Parse URL to get query parameters for GET requests
      const url = new URL(request.url)
      const queryParams = url.searchParams.toString()
      const targetUrl = queryParams
        ? `${endpoint}/context?${queryParams}`
        : `${endpoint}/context`

      logger.log('Proxying to ABsmartly', {
        method,
        targetUrl,
        hasQueryParams: !!queryParams,
      })

      let body: string | undefined
      if (method === 'POST' || method === 'PUT') {
        const payload = await request.json()
        body = JSON.stringify(payload)
        logger.debug('Request payload', {
          exposuresCount: payload.exposures?.length || 0,
          goalsCount: payload.goals?.length || 0,
          hasUnits: !!payload.units,
        })
      }

      const response = await manager.fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Application': settings.APPLICATION,
          'X-Environment': settings.ENVIRONMENT,
          'X-Agent': 'javascript-sdk-zaraz-proxy',
        },
        body,
      })

      if (!response) {
        throw new Error('No response from ABsmartly API')
      }

      const responseText = await response.text()
      logger.debug('ABsmartly API response', {
        status: response.status,
        ok: response.ok,
      })

      if (!response.ok) {
        logger.error('ABsmartly API error', {
          status: response.status,
          response: responseText,
        })
      }

      return new Response(responseText, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      logger.error('Proxy route error:', error)
      return new Response(
        JSON.stringify({
          error: 'Proxy error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}
