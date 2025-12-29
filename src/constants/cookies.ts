/**
 * Cookie name constants
 * Single source of truth for all cookie names used across server and client
 * Matches CookiePlugin and absmartly-worker defaults
 */

export const COOKIE_NAMES = {
  // Main unit ID cookie (HttpOnly on server, accessible on client)
  UNIT_ID: 'abs',

  // Public unit ID cookie (accessible from JavaScript)
  PUBLIC_ID: 'abs_public',

  // Cookie expiry timestamp
  EXPIRY: 'abs_expiry',

  // UTM parameters storage
  UTM_PARAMS: 'abs_utm_params',

  // Landing page URL
  LANDING_PAGE: 'abs_landing_page',

  // Experiment overrides
  OVERRIDES: 'abs_overrides',
} as const

export type CookieName = (typeof COOKIE_NAMES)[keyof typeof COOKIE_NAMES]

/**
 * Default cookie settings
 */
export const COOKIE_DEFAULTS = {
  // Cookie expiry in days (matches CookiePlugin)
  MAX_AGE_DAYS: 730,

  // Cookie path
  PATH: '/',

  // SameSite setting
  SAME_SITE: 'Lax' as const,
} as const
