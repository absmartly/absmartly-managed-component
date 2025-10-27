import { EventTracker } from '../core/event-tracker'
import { Logger } from '../types'

export interface TrackBridgeOptions {
  eventTracker: EventTracker
  logger: Logger
  apiEndpoint: string
  apiKey: string
  returnImmediate?: boolean // For WebCM: return 202 immediately without waiting
}

/**
 * Passthrough bridge for track events
 * Handles both Zaraz mode (wait for response) and WebCM mode (return immediately)
 */
export class TrackBridge {
  private options: TrackBridgeOptions
  private pendingBatch: any[] = []
  private batchTimeout: NodeJS.Timeout | null = null

  constructor(options: TrackBridgeOptions) {
    this.options = options
  }

  /**
   * Handles a track request
   * For WebCM: Returns 202 immediately and forwards asynchronously
   * For Zaraz: Returns 200 after publishing to ABsmartly
   */
  async handleTrackRequest(body: any): Promise<Response> {
    try {
      const { returnImmediate, eventTracker, logger } = this.options

      logger.debug('Track request received', { returnImmediate })

      if (returnImmediate) {
        // WebCM mode: Fire-and-forget
        // Return 202 Accepted immediately to client
        this.forwardToABsmartly(body).catch((error) => {
          logger.error('Failed to forward track request to ABsmartly:', error)
        })

        return new Response('', { status: 202 })
      } else {
        // Zaraz mode: Wait for response
        // This is called from the event handler, not directly
        // Just return 200 OK
        return new Response('{}', { status: 200 })
      }
    } catch (error) {
      this.options.logger.error('Track bridge error:', error)
      // Always return 202 on error to prevent client retries
      return new Response('', { status: 202 })
    }
  }

  /**
   * Forwards track request to ABsmartly API asynchronously
   * This doesn't block the client response
   */
  private async forwardToABsmartly(body: any): Promise<void> {
    const { apiEndpoint, apiKey, logger } = this.options

    try {
      const response = await fetch(`${apiEndpoint}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Agent': 'ABSmartly MC',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('ABsmartly API error:', {
          status: response.status,
          body: errorText
        })
      } else {
        logger.debug('Track request forwarded to ABsmartly', {
          status: response.status
        })
      }
    } catch (error) {
      logger.error('Failed to forward track request to ABsmartly:', error)
    }
  }
}
