/**
 * HTTP-only cookie setter via Worker endpoint
 * Used by Zaraz mode when CookiePlugin detects missing HttpOnly cookie
 */

import { COOKIE_NAMES, COOKIE_DEFAULTS } from '../../constants/cookies'

export function setHttpOnlyCookie(
  unitId: string,
  cookieDomain: string,
  debugLog: (...args: any[]) => void,
  logPrefix: string
) {
  debugLog('Setting HttpOnly cookie via Worker endpoint')

  const workerUrl = 'https://custom-mc-absmartly.absmartly.workers.dev'
  const setCookieUrl = workerUrl + '/set-cookie'

  return fetch(setCookieUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cookieName: COOKIE_NAMES.UNIT_ID,
      cookieValue: unitId,
      maxAge: COOKIE_DEFAULTS.MAX_AGE_DAYS * 86400,
      domain: cookieDomain || window.location.hostname,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    }),
    credentials: 'include',
  })
    .then(response => {
      if (response.ok) {
        debugLog('✅ HttpOnly cookie set successfully')
        return true
      } else {
        console.error(
          `[${logPrefix}] Failed to set HttpOnly cookie:`,
          response.status
        )
        return false
      }
    })
    .catch(error => {
      console.error(`[${logPrefix}] Error setting HttpOnly cookie:`, error)
      return false
    })
}
