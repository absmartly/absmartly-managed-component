import { ComponentSettings } from '@managed-components/types'
import { Client } from './client'
import { Context } from './context'
import { Manager } from './manager'
import { Env, EventBody, InitBody } from './models'
;(globalThis as any).systemFetch = globalThis.fetch
globalThis.fetch = async (
  resource: string | Request | URL,
  _settings?: RequestInit | Request
) => {
  // For now we will keep supporting normal fetch, but later we can replace the console.error with throw
  console.error(
    `Fetch isn't available to Managed Components, please choose client.fetch or manager.fetch. Trying to call: ${JSON.stringify(
      resource
    )}`
  )
  return new Response(
    `Fetch isn't available to Managed Components, please choose client.fetch or manager.fetch. Trying to call: ${JSON.stringify(
      resource
    )}`,
    { status: 500 }
  )
}

export const handleRequest = async (
  request: Request,
  execContext: ExecutionContext,
  env: Env,
  componentCb: (manager: Manager, settings: ComponentSettings) => void
) => {
  const context: Context = {
    component: '',
    componentPath: '',
    events: {},
    clientEvents: {},
    routePath: '',
    mappedEndpoints: {},
    cookies: {},
    permissions: [],
    debug: false,
    response: {
      fetch: [],
      execute: [],
      return: {},
      pendingCookies: {},
      clientPrefs: {},
      serverFetch: [],
    },
    execContext,
    env,
  }

  const url = new URL(request.url)
  console.log('[ABsmartly MC] Request:', request.method, url.pathname, url.search)

  if (url.pathname === '/set-cookie' && request.method === 'POST') {
    // Endpoint for setting HttpOnly cookie directly from browser
    try {
      const body = await request.json() as {
        cookieName: string
        cookieValue: string
        maxAge: number
        domain?: string
        secure?: boolean
        httpOnly?: boolean
        sameSite?: string
      }

      const cookieHeader = `${body.cookieName}=${body.cookieValue}; Max-Age=${body.maxAge}; Path=/${body.httpOnly ? '; HttpOnly' : ''}${body.secure ? '; Secure' : ''}; SameSite=${body.sameSite || 'Lax'}${body.domain ? `; Domain=${body.domain}` : ''}`

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
          'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } else if (url.pathname === '/set-cookie' && request.method === 'OPTIONS') {
    // CORS preflight
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  } else if (url.pathname === '/route') {
    let settings: ComponentSettings
    let routeEndpoint: string
    let params: string
    try {
      context.component = request.headers.get('zaraz-component') || ''
      context.componentPath = request.headers.get('zaraz-component-path') || ''
      context.routePath = request.headers.get('zaraz-route-path') || ''
      routeEndpoint = request.headers.get('zaraz-route-endpoint') || ''
      context.permissions = JSON.parse(
        request.headers.get('zaraz-permissions') || ''
      )
      settings = JSON.parse(request.headers.get('zaraz-settings') || '')
      params = new URL(request.url).searchParams.toString()
    } catch (e) {
      return new Response('Invalid headers', { status: 400 })
    }
    const manager = new Manager(context)
    await componentCb(manager, settings)
    try {
      return await context.mappedEndpoints[routeEndpoint](
        new Request(routeEndpoint + '?' + params, request.clone())
      )
    } catch (e) {
      console.error(e)
      return new Response('Route handler error', { status: 500 })
    }
  } else if (request.method === 'POST') {
    let body: InitBody | EventBody

    try {
      body = await request.json()
    } catch (e) {
      console.error('no request json data: ', e)
      return new Response((e as Error).toString(), { status: 500 })
    }

    context.componentPath = body.componentPath
    context.permissions = body.permissions
    context.component = body.component
    context.routePath = body.routePath || ''

    if (url.pathname === '/init') {
      const { settings } = body as InitBody
      console.log('[ABsmartly MC] /init call')
      const manager = new Manager(context)
      await componentCb(manager, settings)
      const { cookies, ...restOfContext } = context
      return new Response(
        JSON.stringify({
          ...restOfContext,
          events: Object.keys(context.events),
          clientEvents: Object.keys(context.clientEvents),
          componentPath: context.componentPath,
          mappedEndpoints: Object.keys(context.mappedEndpoints),
        })
      )
    } else if (url.pathname === '/event') {
      const { eventType, event, settings, clientData, debug } =
        body as EventBody
      const isClientEvent = url.searchParams.get('type') === 'client'
      console.log('[ABsmartly MC] /event call:', eventType, 'from URL:', clientData?.url || 'unknown')

      context.cookies = clientData.cookies
      context.debug = debug

      const manager = new Manager(context)

      await componentCb(manager, settings)
      event.client = new Client(clientData, context)
      if (isClientEvent) {
        if (Object.keys(context.clientEvents).includes(eventType)) {
          await context.clientEvents[eventType](event)
        }
      } else {
        if (Object.keys(context.events).includes(eventType)) {
          await Promise.all(context.events[eventType].map(fn => fn(event)))
        }
      }

      // Extract abs cookie from pendingCookies to set via HTTP header
      const pendingCookies = context.response.pendingCookies || {}
      const absCookieName = settings['COOKIE_NAME'] || 'abs'
      const absCookie = pendingCookies[absCookieName]

      // Prepare response headers
      const headers = new Headers({
        'Content-Type': 'application/json',
      })

      // Set abs cookie via HTTP header with security flags if present
      if (absCookie) {
        const cookieMaxAge = parseInt(settings['COOKIE_MAX_AGE'] || '730', 10) * 86400
        const secure = settings['COOKIE_SECURE'] !== false
        const httpOnly = settings['COOKIE_HTTPONLY'] !== false
        const sameSite = settings['COOKIE_SAMESITE'] || 'Lax'
        const domain = settings['COOKIE_DOMAIN']

        let cookieHeader = `${absCookieName}=${absCookie.value}; Max-Age=${cookieMaxAge}; Path=/`

        if (httpOnly) {
          cookieHeader += '; HttpOnly'
        }
        if (secure) {
          cookieHeader += '; Secure'
        }
        cookieHeader += `; SameSite=${sameSite}`

        if (domain) {
          cookieHeader += `; Domain=${domain}`
        }

        headers.append('Set-Cookie', cookieHeader)

        // Remove abs cookie from pendingCookies so Zaraz doesn't set it
        delete pendingCookies[absCookieName]
      }

      return new Response(
        JSON.stringify({
          componentPath: context.componentPath,
          ...context.response,
          pendingCookies, // Return modified pendingCookies without abs
        }),
        { headers }
      )
    }
  } else {
    return new Response('External MC Test ✅')
  }
  return new Response('Invalid Path or Method', { status: 404 })
}
