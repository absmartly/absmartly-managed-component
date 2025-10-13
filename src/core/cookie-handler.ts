import { Client } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { generateUUID } from '../utils/serializer'

export class CookieHandler {
  constructor(private settings: ABSmartlySettings) {}

  getUserId(client: Client): string {
    const cookieName = this.settings.COOKIE_NAME || 'absmartly_id'
    let userId = client.get(cookieName)

    if (!userId) {
      userId = generateUUID()
      this.setUserId(client, userId)
    }

    return userId
  }

  setUserId(client: Client, userId: string): void {
    const cookieName = this.settings.COOKIE_NAME || 'absmartly_id'
    const maxAge = (this.settings.COOKIE_MAX_AGE || 365) * 86400 // Convert days to seconds

    client.set(cookieName, userId, {
      expiry: maxAge,
      path: '/',
      domain: this.settings.COOKIE_DOMAIN,
      sameSite: 'Lax',
    })
  }

  getUTMParams(client: Client): Record<string, string> {
    const url = new URL(client.url)
    const utmParams: Record<string, string> = {}

    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

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
      // Store UTM params in cookie for attribution
      const existing = client.get('absmartly_utm')
      if (!existing) {
        client.set('absmartly_utm', JSON.stringify(utmParams), {
          expiry: 30 * 86400, // 30 days
          path: '/',
          sameSite: 'Lax',
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
      client.set('absmartly_landing', client.url, {
        expiry: 30 * 86400, // 30 days
        path: '/',
        sameSite: 'Lax',
      })
    }
  }
}
