/**
 * ABsmartly SDK Bundle for Zaraz (with WebVitals)
 * Entry point that composes shared modules
 */

import { createABsmartlyInit } from '../shared/absmartly-init'
import {
  createZarazEventLogger,
  trackZarazInit,
} from '../shared/zaraz-integration'
import { setHttpOnlyCookie } from '../shared/http-cookie-setter'
import * as ABsmartlySDK from '@absmartly/javascript-sdk'

// Import each plugin from its clean entry point (resolves to TypeScript source)
import { DOMChangesPluginLite } from '@absmartly/sdk-plugins/dom-changes'
import { CookiePlugin } from '@absmartly/sdk-plugins/cookie'
import { WebVitalsPlugin } from '@absmartly/sdk-plugins/web-vitals'
import { getOverrides } from '@absmartly/sdk-plugins/overrides'

// Expose SDK on window
;(window as any).ABsmartly = ABsmartlySDK

const BUNDLE_VERSION = '2.0.0-zaraz-full'
const LOG_PREFIX = 'ABsmartly Zaraz'

console.log(`[${LOG_PREFIX}] 📦 SDK Bundle Version: ${BUNDLE_VERSION}`)
;(window as any).ABsmartlyBundleVersion = BUNDLE_VERSION

// Compose ABsmartlyInit with Zaraz-specific behavior and WebVitals
;(window as any).ABsmartlyInit = createABsmartlyInit(
  ABsmartlySDK,
  DOMChangesPluginLite,
  CookiePlugin,
  WebVitalsPlugin,
  getOverrides,
  {
    logPrefix: LOG_PREFIX,
    bundleVersion: BUNDLE_VERSION,
    includeWebVitals: true,
    eventLogger: createZarazEventLogger(),
    onBeforeInit: params => {
      trackZarazInit(params.serverData, params.unitType)
    },
    onCookiePlugin: async (cookiePlugin, unitId, config) => {
      return setHttpOnlyCookie(
        unitId,
        config.cookieDomain || window.location.hostname,
        (...args) => console.log(`[${LOG_PREFIX}]`, ...args),
        LOG_PREFIX
      )
    },
  }
)
