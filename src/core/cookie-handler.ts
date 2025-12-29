import { Client } from '@managed-components/types'
import { ABsmartlySettings, Logger, ClientSetOptions } from '../types'
import { generateUUID } from '../utils/serializer'
import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../constants/cookies'

export interface CookieHandlerOptions {
  settings: ABsmartlySettings
  logger: Logger
}

export class CookieHandler {
  private options: CookieHandlerOptions

  constructor(
    settingsOrOptions: ABsmartlySettings | CookieHandlerOptions,
    legacyLogger?: Logger
  ) {
    if ('settings' in settingsOrOptions && 'logger' in settingsOrOptions) {
      this.options = settingsOrOptions as CookieHandlerOptions
    } else {
      this.options = {
        settings: settingsOrOptions as ABsmartlySettings,
        logger: legacyLogger || console,
      }
    }

    this.applySecurityDefaults()
    this.logSecurityWarnings()
  }

  private applySecurityDefaults(): void {
    const { settings } = this.options
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction) {
      if (settings.COOKIE_SECURE === undefined) {
        settings.COOKIE_SECURE = true
      }
      if (settings.COOKIE_HTTPONLY === undefined) {
        settings.COOKIE_HTTPONLY = true
      }
      if (!settings.COOKIE_SAMESITE) {
        settings.COOKIE_SAMESITE = 'Lax'
      }
    }
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

  private validateUTMParam(value: string): string {
    if (value.length > 500) {
      this.options.logger.warn(
        '[ABsmartly MC] UTM parameter exceeds 500 characters, truncating'
      )
      value = value.slice(0, 500)
    }

    return value.replace(/[<>"'&]/g, '')
  }

  getUserId(client: Client): string {
    const cookieName = this.options.settings.COOKIE_NAME || COOKIE_NAMES.UNIT_ID
    return client.get(cookieName) || ''
  }

  ensureUserId(client: Client): string {
    const cookieName = this.options.settings.COOKIE_NAME || COOKIE_NAMES.UNIT_ID
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
    const cookieName = this.options.settings.COOKIE_NAME || COOKIE_NAMES.UNIT_ID
    const maxAge =
      (this.options.settings.COOKIE_MAX_AGE || COOKIE_DEFAULTS.MAX_AGE_DAYS) *
      86400

    client.set(cookieName, userId, {
      scope: 'infinite',
      expiry: maxAge,
      httpOnly: this.options.settings.COOKIE_HTTPONLY !== false,
      secure: this.options.settings.COOKIE_SECURE !== false,
      sameSite: this.options.settings.COOKIE_SAMESITE || 'Lax',
    } as ClientSetOptions)
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
        utmParams[key] = this.validateUTMParam(value)
      }
    }

    return utmParams
  }

  storeUTMParams(client: Client): void {
    const utmParams = this.getUTMParams(client)

    if (Object.keys(utmParams).length > 0) {
      const existing = client.get(COOKIE_NAMES.UTM_PARAMS)
      if (!existing) {
        client.set(COOKIE_NAMES.UTM_PARAMS, JSON.stringify(utmParams), {
          scope: 'infinite',
          expiry: 30 * 86400,
          httpOnly: true,
          secure: this.options.settings.COOKIE_SECURE !== false,
          sameSite: this.options.settings.COOKIE_SAMESITE || 'Lax',
        } as ClientSetOptions)
      }
    }
  }

  getStoredUTMParams(client: Client): Record<string, string> {
    const stored = client.get(COOKIE_NAMES.UTM_PARAMS)
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
    const existing = client.get(COOKIE_NAMES.LANDING_PAGE)
    if (!existing) {
      client.set(COOKIE_NAMES.LANDING_PAGE, client.url.toString(), {
        scope: 'infinite',
        expiry: 30 * 86400,
        httpOnly: true,
        secure: this.options.settings.COOKIE_SECURE !== false,
        sameSite: this.options.settings.COOKIE_SAMESITE || 'Lax',
      } as ClientSetOptions)
    }
  }

  setPublicUserId(client: Client, userId: string): void {
    const cookieName =
      this.options.settings.PUBLIC_COOKIE_NAME || COOKIE_NAMES.PUBLIC_ID
    const maxAge =
      (this.options.settings.COOKIE_MAX_AGE || COOKIE_DEFAULTS.MAX_AGE_DAYS) *
      86400

    client.set(cookieName, userId, {
      scope: 'page',
      expiry: maxAge,
      httpOnly: false, // Public cookie must be accessible from JavaScript
      secure: this.options.settings.COOKIE_SECURE !== false,
      sameSite: this.options.settings.COOKIE_SAMESITE || 'Lax',
    } as ClientSetOptions)
  }

  setExpiryTimestamp(client: Client): void {
    const cookieName =
      this.options.settings.EXPIRY_COOKIE_NAME || COOKIE_NAMES.EXPIRY
    const maxAge =
      (this.options.settings.COOKIE_MAX_AGE || COOKIE_DEFAULTS.MAX_AGE_DAYS) *
      86400
    const expiryDate = new Date(Date.now() + maxAge * 1000).toISOString()

    client.set(cookieName, expiryDate, {
      scope: 'page',
      expiry: maxAge,
      httpOnly: false, // Expiry cookie needs to be readable by JavaScript
      secure: this.options.settings.COOKIE_SECURE !== false,
      sameSite: this.options.settings.COOKIE_SAMESITE || 'Lax',
    } as ClientSetOptions)
  }

  getExpiryTimestamp(client: Client): string | null {
    const cookieName =
      this.options.settings.EXPIRY_COOKIE_NAME || COOKIE_NAMES.EXPIRY
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
