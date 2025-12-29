import { MCEvent } from '@managed-components/types'
import {
  OverridesMap,
  Logger,
  ABsmartlySettings,
  ClientSetOptions,
} from '../types'
import { safeParseJSON } from '../utils/serializer'
import { COOKIE_NAMES } from '../constants/cookies'

function logError(logger: Logger | undefined, ...args: unknown[]): void {
  if (logger) {
    logger.error(...args)
  } else {
    console.error('[ABsmartly MC]', ...args)
  }
}

export class OverridesHandler {
  constructor(
    private settings: ABsmartlySettings,
    private logger?: Logger
  ) {}

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
      const cookieValue = event.client.get(COOKIE_NAMES.OVERRIDES)
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
    // Note: httpOnly=false because this needs to be readable by ABsmartly Browser Extension
    event.client.set(COOKIE_NAMES.OVERRIDES, JSON.stringify(existing), {
      scope: 'page',
      expiry: 7 * 86400, // 7 days
      httpOnly: false,
      secure: this.settings.COOKIE_SECURE !== false,
      sameSite: this.settings.COOKIE_SAMESITE || 'Lax',
    } as ClientSetOptions)
  }

  clearOverrides(event: MCEvent): void {
    event.client.set(COOKIE_NAMES.OVERRIDES, '', {
      scope: 'page',
      expiry: 0,
      httpOnly: false,
      secure: this.settings.COOKIE_SECURE !== false,
      sameSite: this.settings.COOKIE_SAMESITE || 'Lax',
    } as ClientSetOptions)
  }

  hasOverrides(overrides: OverridesMap): boolean {
    return Object.keys(overrides).length > 0
  }
}
