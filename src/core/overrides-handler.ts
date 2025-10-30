import { MCEvent } from '@managed-components/types'
import { OverridesMap, Logger } from '../types'
import { safeParseJSON } from '../utils/serializer'

function logError(logger: Logger | undefined, ...args: unknown[]): void {
  if (logger) {
    logger.error(...args)
  } else {
    console.error('[ABSmartly MC]', ...args)
  }
}

export class OverridesHandler {
  constructor(private logger?: Logger) {}

  getOverrides(event: MCEvent): OverridesMap {
    const overrides: OverridesMap = {}

    // Check URL parameters
    const urlOverrides = this.getURLOverrides(event)
    Object.assign(overrides, urlOverrides)

    // Check cookie (set by ABsmartly Browser Extension)
    const cookieOverrides = this.getCookieOverrides(event)
    Object.assign(overrides, cookieOverrides)

    return overrides
  }

  private getURLOverrides(event: MCEvent): OverridesMap {
    const overrides: OverridesMap = {}

    try {
      const url = new URL(event.client.url)

      for (const [key, value] of url.searchParams) {
        // Support both formats:
        // ?absmartly_exp_name=1
        // ?exp_name=1 (when used with specific prefix)
        if (key.startsWith('absmartly_')) {
          const experimentName = key.replace('absmartly_', '')
          overrides[experimentName] = parseInt(value, 10)
        }
      }
    } catch (error) {
      logError(this.logger, 'Failed to parse URL overrides', error)
    }

    return overrides
  }

  private getCookieOverrides(event: MCEvent): OverridesMap {
    try {
      const cookieValue = event.client.get('absmartly_overrides')
      if (cookieValue) {
        return safeParseJSON<OverridesMap>(cookieValue, {}, this.logger) || {}
      }
    } catch (error) {
      logError(this.logger, 'Failed to parse cookie overrides', error)
    }

    return {}
  }

  setOverride(event: MCEvent, experimentName: string, variant: number): void {
    const existing = this.getOverrides(event)
    existing[experimentName] = variant

    // Store back in cookie
    event.client.set('absmartly_overrides', JSON.stringify(existing), {
      scope: 'page',
      expiry: 7 * 86400, // 7 days
    })
  }

  clearOverrides(event: MCEvent): void {
    event.client.set('absmartly_overrides', '', {
      scope: 'page',
      expiry: 0,
    })
  }

  hasOverrides(overrides: OverridesMap): boolean {
    return Object.keys(overrides).length > 0
  }
}
