import { MCEvent } from '@managed-components/types'
import { ABSmartlySettings, Logger } from '../types'
import { TrackBridge } from '../shared/track-bridge'
import { EventTracker } from '../core/event-tracker'

export class ABSmartlyEndpointHandler {
  private trackBridge: TrackBridge

  constructor(
    private settings: ABSmartlySettings,
    private eventTracker: EventTracker,
    private logger: Logger
  ) {
    this.trackBridge = new TrackBridge({
      eventTracker,
      logger,
      apiEndpoint: settings.ABSMARTLY_ENDPOINT,
      apiKey: settings.ABSMARTLY_API_KEY,
      returnImmediate: true // WebCM: return 202 immediately
    })
  }

  /**
   * Handles requests to /absmartly endpoint
   * This is the passthrough endpoint for client-side track() calls
   * Returns 202 Accepted immediately, forwards to ABsmartly asynchronously
   */
  async handleRequest(event: MCEvent): Promise<boolean> {
    const url = new URL(event.client.url.toString())

    // Check if this is a request to /absmartly
    if (!url.pathname.startsWith('/absmartly')) {
      return false // Not our endpoint
    }

    try {
      const method = event.client.request.method.toUpperCase()

      // Handle GET requests (for testing/debugging)
      if (method === 'GET') {
        event.client.return(
          new Response(
            JSON.stringify({
              message: 'ABSmartly passthrough endpoint',
              status: 'ok'
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        )
        return true
      }

      // Handle POST requests (from client SDK track calls)
      if (method === 'POST') {
        try {
          const body = await event.client.request.json()

          this.logger.debug('Track request received at /absmartly', {
            method,
            body
          })

          const response = await this.trackBridge.handleTrackRequest(body)

          event.client.return(response)
          return true
        } catch (error) {
          this.logger.error('Failed to parse track request:', error)
          event.client.return(
            new Response(
              JSON.stringify({ error: 'Invalid request body' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          )
          return true
        }
      }

      // Unsupported method
      event.client.return(
        new Response('Method not allowed', {
          status: 405
        })
      )
      return true
    } catch (error) {
      this.logger.error('Error handling /absmartly request:', error)
      event.client.return(
        new Response('', {
          status: 202 // Still return 202 on error
        })
      )
      return true
    }
  }
}
