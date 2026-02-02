/**
 * ABsmartly SDK Bundle for Worker Mode (with WebVitals)
 * Entry point that composes shared modules
 */

import { createABsmartlyInit } from '../shared/absmartly-init'
import * as ABsmartlySDK from '@absmartly/javascript-sdk'

// Import each plugin from its clean entry point (resolves to TypeScript source)
import { DOMChangesPluginLite } from '@absmartly/sdk-plugins/dom-changes'
import { CookiePlugin } from '@absmartly/sdk-plugins/cookie'
import { WebVitalsPlugin } from '@absmartly/sdk-plugins/web-vitals'
import { getOverrides } from '@absmartly/sdk-plugins/overrides'

// Expose SDK on window
;(window as any).ABsmartly = ABsmartlySDK

const BUNDLE_VERSION = '2.1.2-worker-full'
const LOG_PREFIX = 'ABsmartly Worker'

console.log(`[${LOG_PREFIX}] SDK Bundle Version: ${BUNDLE_VERSION}`)
;(window as any).ABsmartlyBundleVersion = BUNDLE_VERSION

// Compose ABsmartlyInit WITHOUT Zaraz-specific behavior
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
    // No eventLogger - Worker mode doesn't use Zaraz
    // No onBeforeInit - No Zaraz tracking
    // No onCookiePlugin - No HttpOnly cookie setter
  }
)
