import { Client, ClientSetOptions } from '@managed-components/types'

export interface CookieToSet {
  name: string
  value: string
  options: ClientSetOptions & {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
  }
}

export class WorkerClient implements Client {
  readonly emitter = 'worker'
  readonly userAgent: string
  readonly language: string
  readonly referer: string
  readonly ip: string
  readonly url: URL
  readonly title?: string
  readonly timestamp: number

  private cookies: Map<string, string>
  private cookiesToSet: CookieToSet[] = []

  constructor(private request: Request) {
    this.url = new URL(request.url)
    this.userAgent = request.headers.get('User-Agent') || ''
    this.language = request.headers.get('Accept-Language') || ''
    this.referer = request.headers.get('Referer') || ''
    this.ip =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      ''
    this.timestamp = Date.now()
    this.cookies = this.parseCookies(request.headers.get('Cookie') || '')
  }

  private parseCookies(cookieHeader: string): Map<string, string> {
    const cookies = new Map<string, string>()
    if (!cookieHeader) return cookies

    for (const pair of cookieHeader.split(';')) {
      const [name, ...valueParts] = pair.trim().split('=')
      if (name) {
        cookies.set(name.trim(), valueParts.join('='))
      }
    }
    return cookies
  }

  get(key: string): string | undefined {
    return this.cookies.get(key)
  }

  set(
    key: string,
    value?: string | null,
    opts?: ClientSetOptions
  ): boolean | undefined {
    if (value === null || value === undefined) {
      this.cookiesToSet.push({
        name: key,
        value: '',
        options: { ...opts, expiry: 0 },
      })
    } else {
      this.cookiesToSet.push({
        name: key,
        value,
        options: opts || {},
      })
    }
    return true
  }

  getCookiesToSet(): CookieToSet[] {
    return this.cookiesToSet
  }

  fetch(): boolean | undefined {
    return undefined
  }

  execute(): boolean | undefined {
    return undefined
  }

  return(): void {
    // No-op: Worker handles response directly
  }

  attachEvent(): void {
    // No-op: Worker doesn't support client-side events
  }

  detachEvent(): void {
    // No-op: Worker doesn't support client-side events
  }
}

export function buildSetCookieHeaders(cookiesToSet: CookieToSet[]): string[] {
  return cookiesToSet.map(cookie => {
    const parts = [`${cookie.name}=${cookie.value}`]

    if (cookie.options.expiry !== undefined) {
      if (typeof cookie.options.expiry === 'number') {
        parts.push(`Max-Age=${cookie.options.expiry}`)
      } else if (cookie.options.expiry instanceof Date) {
        parts.push(`Expires=${cookie.options.expiry.toUTCString()}`)
      }
    }

    if (cookie.options.httpOnly) {
      parts.push('HttpOnly')
    }

    if (cookie.options.secure) {
      parts.push('Secure')
    }

    if (cookie.options.sameSite) {
      parts.push(`SameSite=${cookie.options.sameSite}`)
    }

    parts.push('Path=/')

    return parts.join('; ')
  })
}
