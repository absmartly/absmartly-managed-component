import { MCEvent, Client } from '@managed-components/types'
import { ABSmartlySettings, Logger } from '../types'
import { TrackBridge, PublishData } from '../shared/track-bridge'

interface ExtendedClient extends Client {
  request?: {
    method: string
    url: string
    json(): Promise<unknown>
    headers?: Record<string, string>
  }
}

export class ABSmartlyEndpointHandler {
  private trackBridge: TrackBridge

  constructor(
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {
    this.trackBridge = new TrackBridge({
      logger,
      apiEndpoint: settings.ABSMARTLY_ENDPOINT,
      apiKey: settings.ABSMARTLY_API_KEY,
      returnImmediate: true,
    })
  }

  async handleRequest(event: MCEvent): Promise<boolean> {
    const url = new URL(event.client.url.toString())

    if (!url.pathname.startsWith('/absmartly')) {
      return false
    }

    const client = event.client as ExtendedClient

    try {
      if (!client.request) {
        event.client.return(
          new Response('Method not allowed', {
            status: 405,
          })
        )
        return true
      }

      const method = client.request.method.toUpperCase()

      if (method === 'GET') {
        event.client.return(
          new Response(
            JSON.stringify({
              message: 'ABSmartly passthrough endpoint',
              status: 'ok',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
        return true
      }

      if (method === 'POST') {
        const contentType = client.request.headers?.['content-type']
        if (!contentType || !contentType.includes('application/json')) {
          this.logger.warn(
            '[ABSmartly MC] Invalid Content-Type for POST request',
            { contentType }
          )
          event.client.return(
            new Response(
              JSON.stringify({
                error: 'Content-Type must be application/json',
              }),
              {
                status: 415,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          )
          return true
        }

        try {
          const body = await client.request.json()

          this.logger.debug('Track request received at /absmartly', {
            method,
            body,
          })

          const clientId = event.client.ip || 'unknown'
          const originalUserAgent =
            client.request.headers?.['x-agent'] ||
            client.request.headers?.['user-agent']
          const response = await this.trackBridge.handleTrackRequest(
            body as PublishData,
            clientId,
            originalUserAgent
          )

          event.client.return(response)
          return true
        } catch (error) {
          this.logger.error('Failed to parse track request:', error)
          event.client.return(
            new Response(JSON.stringify({ error: 'Invalid request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          )
          return true
        }
      }

      event.client.return(
        new Response('Method not allowed', {
          status: 405,
        })
      )
      return true
    } catch (error) {
      this.logger.error('Error handling /absmartly request:', error)
      event.client.return(
        new Response('', {
          status: 202,
        })
      )
      return true
    }
  }
}
