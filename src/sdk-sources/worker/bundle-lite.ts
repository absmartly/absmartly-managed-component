/**
 * ABsmartly SDK Bundle for Worker Mode (without WebVitals)
 * Entry point that composes shared modules
 */

import { createABsmartlyInit } from '../shared/absmartly-init'
import * as ABsmartlySDK from '@absmartly/javascript-sdk'

// Import each plugin from its clean entry point (NO WebVitals, resolves to TypeScript source)
import { DOMChangesPluginLite } from '@absmartly/sdk-plugins/dom-changes'
import { CookiePlugin } from '@absmartly/sdk-plugins/cookie'
import { getOverrides } from '@absmartly/sdk-plugins/overrides'
import * as DOMTrackerModule from '@absmartly/dom-tracker'

// Expose SDK on window
;(window as any).ABsmartly = ABsmartlySDK

const BUNDLE_VERSION = '2.0.0-worker-lite'
const LOG_PREFIX = 'ABsmartly Worker'

console.log(`[${LOG_PREFIX}] SDK Bundle Version: ${BUNDLE_VERSION}`)
;(window as any).ABsmartlyBundleVersion = BUNDLE_VERSION

// Compose ABsmartlyInit WITHOUT Zaraz-specific behavior and WITHOUT WebVitals
;(window as any).ABsmartlyInit = createABsmartlyInit(
  ABsmartlySDK,
  DOMChangesPluginLite,
  CookiePlugin,
  null, // No WebVitalsPlugin
  getOverrides,
  {
    logPrefix: LOG_PREFIX,
    bundleVersion: BUNDLE_VERSION,
    includeWebVitals: false,
  },
  DOMTrackerModule,
)
