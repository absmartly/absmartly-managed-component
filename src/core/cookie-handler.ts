import { Client } from '@managed-components/types'
import { ABSmartlySettings, Logger } from '../types'
import { generateUUID } from '../utils/serializer'

export interface CookieHandlerOptions {
  settings: ABSmartlySettings
  logger: Logger
}

export class CookieHandler {
  private options: CookieHandlerOptions

  constructor(settingsOrOptions: ABSmartlySettings | CookieHandlerOptions, legacyLogger?: Logger) {
    if ('settings' in settingsOrOptions && 'logger' in settingsOrOptions) {
      this.options = settingsOrOptions as CookieHandlerOptions
    } else {
      this.options = {
        settings: settingsOrOptions as ABSmartlySettings,
        logger: legacyLogger || console
      }
    }
    this.logSecurityWarnings()
  }

  private logSecurityWarnings(): void {
    const { settings, logger } = this.options

    if (!settings.COOKIE_SECURE) {
      logger.warn(
        'COOKIE_SECURE is not enabled. Cookies will not be marked as Secure. ' +
        'Enable this setting in production to ensure cookies are only sent over HTTPS.'
      )
    }

    if (!settings.COOKIE_HTTPONLY) {
      logger.warn(
        'COOKIE_HTTPONLY is not enabled. Cookies will be accessible to JavaScript. ' +
        'Enable this setting to prevent XSS attacks from stealing cookie values.'
      )
    }

    const sameSite = settings.COOKIE_SAMESITE || 'Lax'
    if (sameSite === 'None' && !settings.COOKIE_SECURE) {
      logger.error(
        'COOKIE_SAMESITE=None requires COOKIE_SECURE=true. ' +
        'This is a security requirement to prevent CSRF attacks.'
      )
    }
  }

  getUserId(client: Client): string {
    const cookieName = this.options.settings.COOKIE_NAME || 'absmartly_id'
    return client.get(cookieName) || ''
  }

  ensureUserId(client: Client): string {
    const cookieName = this.options.settings.COOKIE_NAME || 'absmartly_id'
    let userId = client.get(cookieName)

    if (!userId) {
      userId = generateUUID()

      if (this.options.settings.ENABLE_COOKIE_MANAGEMENT) {
        this.setUserId(client, userId)
        this.setPublicUserId(client, userId)
        this.setExpiryTimestamp(client)
      }
    }

    return userId
  }

  setUserId(client: Client, userId: string): void {
    const cookieName = this.options.settings.COOKIE_NAME || 'absmartly_id'
    const maxAge = (this.options.settings.COOKIE_MAX_AGE || 365) * 86400

    client.set(cookieName, userId, {
      scope: 'infinite',
      expiry: maxAge,
    })
  }

  getUTMParams(client: Client): Record<string, string> {
    const url = new URL(client.url)
    const utmParams: Record<string, string> = {}

    const utmKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ]

    for (const key of utmKeys) {
      const value = url.searchParams.get(key)
      if (value) {
        utmParams[key] = value
      }
    }

    return utmParams
  }

  storeUTMParams(client: Client): void {
    const utmParams = this.getUTMParams(client)

    if (Object.keys(utmParams).length > 0) {
      const existing = client.get('absmartly_utm')
      if (!existing) {
        client.set('absmartly_utm', JSON.stringify(utmParams), {
          scope: 'infinite',
          expiry: 30 * 86400,
        })
      }
    }
  }

  getStoredUTMParams(client: Client): Record<string, string> {
    const stored = client.get('absmartly_utm')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return {}
      }
    }
    return {}
  }

  getReferrer(client: Client): string | undefined {
    return client.referer
  }

  storeLandingPage(client: Client): void {
    const existing = client.get('absmartly_landing')
    if (!existing) {
      client.set('absmartly_landing', client.url.toString(), {
        scope: 'infinite',
        expiry: 30 * 86400,
      })
    }
  }

  setPublicUserId(client: Client, userId: string): void {
    const cookieName = this.options.settings.PUBLIC_COOKIE_NAME || 'absmartly_public_id'
    const maxAge = (this.options.settings.COOKIE_MAX_AGE || 365) * 86400

    client.set(cookieName, userId, {
      scope: 'page',
      expiry: maxAge,
    })
  }

  setExpiryTimestamp(client: Client): void {
    const cookieName = this.options.settings.EXPIRY_COOKIE_NAME || 'absmartly_expiry'
    const maxAge = (this.options.settings.COOKIE_MAX_AGE || 365) * 86400
    const expiryDate = new Date(Date.now() + maxAge * 1000).toISOString()

    client.set(cookieName, expiryDate, {
      scope: 'page',
      expiry: maxAge,
    })
  }

  getExpiryTimestamp(client: Client): string | null {
    const cookieName = this.options.settings.EXPIRY_COOKIE_NAME || 'absmartly_expiry'
    return client.get(cookieName) || null
  }

  needsServerSideCookie(client: Client): boolean {
    if (!this.options.settings.ENABLE_COOKIE_MANAGEMENT) {
      return false
    }

    const expiry = this.getExpiryTimestamp(client)
    if (!expiry) {
      return true
    }

    const expiryDate = new Date(expiry)
    const now = new Date()
    const daysUntilExpiry =
      (expiryDate.getTime() - now.getTime()) / (1000 * 86400)

    return daysUntilExpiry < 30
  }

  getCookieSecurityFlags(): string {
    const { settings } = this.options
    const flags: string[] = []

    if (settings.COOKIE_HTTPONLY) {
      flags.push('HttpOnly')
    }

    if (settings.COOKIE_SECURE) {
      flags.push('Secure')
    }

    const sameSite = settings.COOKIE_SAMESITE || 'Lax'
    flags.push(`SameSite=${sameSite}`)

    return flags.join('; ')
  }
}
