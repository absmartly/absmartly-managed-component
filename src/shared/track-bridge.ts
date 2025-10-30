import { Logger } from '../types'

export interface TrackBridgeOptions {
  logger: Logger
  apiEndpoint: string
  apiKey: string
  returnImmediate?: boolean
}

export interface PublishUnit {
  type: string
  uid: string
}

export interface PublishAttribute {
  name: string
  value: unknown
  setAt: number
}

export interface PublishExposure {
  id: number
  name: string
  unit: string
  variant: number
  exposedAt: number
  assigned: boolean
  eligible: boolean
  overridden: boolean
  fullOn: boolean
  custom: boolean
  audienceMismatch: boolean
}

export interface PublishGoal {
  name: string
  achievedAt: number
  properties?: Record<string, unknown>
}

export interface PublishData {
  units?: PublishUnit[]
  publishedAt?: number
  hashed?: boolean
  attributes?: PublishAttribute[]
  exposures?: PublishExposure[]
  goals?: PublishGoal[]
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class TrackBridge {
  private options: TrackBridgeOptions
  private pendingBatch: PublishData[] = []
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly MAX_BODY_SIZE = 100000
  private readonly RATE_LIMIT = 100
  private readonly RATE_WINDOW_MS = 60000
  private requestCounts = new Map<string, RateLimitEntry>()

  constructor(options: TrackBridgeOptions) {
    this.options = options
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now()
    const limit = this.requestCounts.get(clientId)

    if (!limit || now > limit.resetAt) {
      this.requestCounts.set(clientId, {
        count: 1,
        resetAt: now + this.RATE_WINDOW_MS,
      })
      return true
    }

    if (limit.count >= this.RATE_LIMIT) {
      return false
    }

    limit.count++
    return true
  }

  async handleTrackRequest(
    body: PublishData,
    clientId?: string
  ): Promise<Response> {
    try {
      const { returnImmediate, logger } = this.options

      if (clientId && !this.checkRateLimit(clientId)) {
        logger.warn('[ABSmartly MC] Rate limit exceeded', {
          clientId,
          limit: this.RATE_LIMIT,
          window: this.RATE_WINDOW_MS,
        })
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const bodyStr = JSON.stringify(body)
      if (bodyStr.length > this.MAX_BODY_SIZE) {
        logger.warn('[ABSmartly MC] Request body exceeds maximum size', {
          size: bodyStr.length,
          maxSize: this.MAX_BODY_SIZE,
        })
        return new Response(
          JSON.stringify({ error: 'Request body too large' }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      logger.debug('Track request received', { returnImmediate })

      if (returnImmediate) {
        this.forwardToABsmartly(body).catch(error => {
          logger.error('Failed to forward track request to ABsmartly:', error)
        })

        return new Response('', { status: 202 })
      } else {
        return new Response('{}', { status: 200 })
      }
    } catch (error) {
      this.options.logger.error('Track bridge error:', error)
      return new Response('', { status: 202 })
    }
  }

  private async forwardToABsmartly(body: PublishData): Promise<void> {
    const { apiEndpoint, apiKey, logger } = this.options

    try {
      const response = await fetch(`${apiEndpoint}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Agent': 'ABSmartly MC',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('ABsmartly API error:', {
          status: response.status,
          body: errorText,
        })
      } else {
        logger.debug('Track request forwarded to ABsmartly', {
          status: response.status,
        })
      }
    } catch (error) {
      logger.error('Failed to forward track request to ABsmartly:', error)
    }
  }
}
