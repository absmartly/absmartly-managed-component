import {
  ComponentSettings as MCComponentSettings,
  ClientSetOptions as MCClientSetOptions,
} from '@managed-components/types'

/**
 * Extended ClientSetOptions to include security flags
 * These are not officially documented in the Managed Components API,
 * but Zaraz may respect them when setting cookies
 */
export interface ClientSetOptions extends MCClientSetOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
}

export interface ABsmartlySettings extends MCComponentSettings {
  // Deployment
  DEPLOYMENT_MODE: 'zaraz' | 'webcm'

  // Zaraz Config (JSON string with all settings - individual options override these)
  ZARAZ_CONFIG?: string

  // ABsmartly
  SDK_API_KEY: string
  ENDPOINT: string
  ENVIRONMENT: string
  APPLICATION: string
  UNIT_TYPE?: string // Default: 'user_id'

  // Cookie Management
  // Note: Cookie names are defined in src/constants/cookies.ts
  // These settings allow overriding the defaults if needed
  ENABLE_COOKIE_MANAGEMENT?: boolean
  COOKIE_NAME?: string // Default: COOKIE_NAMES.UNIT_ID ('abs')
  PUBLIC_COOKIE_NAME?: string // Default: COOKIE_NAMES.PUBLIC_ID ('abs_public')
  EXPIRY_COOKIE_NAME?: string // Default: COOKIE_NAMES.EXPIRY ('abs_expiry')
  COOKIE_MAX_AGE?: number // Default: COOKIE_DEFAULTS.MAX_AGE_DAYS (730 days)
  COOKIE_DOMAIN?: string
  COOKIE_HTTPONLY?: boolean
  COOKIE_SECURE?: boolean
  COOKIE_SAMESITE?: 'Lax' | 'Strict' | 'None'

  // Anti-Flicker (Optional, both modes)
  ENABLE_ANTI_FLICKER?: boolean // Default: true
  HIDE_SELECTOR?: string // Default: 'body'
  HIDE_TIMEOUT?: number // Default: 3000
  TRANSITION_MS?: string // Default: '300'

  // Client-Side Features (Optional, both modes)
  INJECT_CLIENT_BUNDLE?: boolean // Default: true
  ENABLE_TRIGGER_ON_VIEW?: boolean // Default: true

  // Features
  ENABLE_WEB_VITALS?: boolean
  ENABLE_EMBEDS?: boolean // Default: true (enables server-side DOM changes and Treatment tags)
  ENABLE_DEBUG?: boolean
  ENABLE_OVERRIDES?: boolean
  ENABLE_UTM_TRACKING?: boolean
  ENABLE_SERVER_SIDE_INIT?: boolean
  INCLUDE_IP_IN_ATTRIBUTES?: boolean // Default: false (include client IP address in context attributes)

  // Client SDK Injection
  INJECT_CLIENT_SDK?: boolean
  PASS_SERVER_PAYLOAD?: boolean
  PROXY_SDK_REQUESTS?: boolean // Route SDK requests through Worker proxy (keeps API key secure)
  PROXY_ROUTE_PATH?: string // Internal: Actual proxy route path (set at runtime by Zaraz)
  CLIENT_SDK_STRATEGY?: 'cdn' | 'custom' | 'zaraz-bundle' | 'bundled' | 'local' | 'external' | 'inline'
  CLIENT_SDK_LOAD_STRATEGY?: 'async' | 'defer' // Default: 'async'
  CLIENT_SDK_URL?: string
  CLIENT_SDK_CDN_PROVIDER?: 'unpkg' | 'jsdelivr'
  CLIENT_SDK_VERSION?: string

  // SDK Plugins
  ENABLE_DOM_CHANGES_PLUGIN?: boolean // Default: true
  ENABLE_COOKIE_PLUGIN?: boolean // Default: true
  ENABLE_WEB_VITALS_PLUGIN?: boolean // Default: true

  // Overrides
  OVERRIDE_QUERY_PREFIX?: string

  // Performance
  SDK_TIMEOUT?: number

  // WebCM Track Endpoint (WebCM mode only)
  TRACK_ENDPOINT?: string // Default: '/absmartly'
  TRACK_BATCH_TIMEOUT?: number // Default: 0 (no batching)
  TRACK_BATCH_SIZE?: number // Default: 1 (no batching)

  // WebCM-specific settings
  EXCLUDED_PATHS?: string[] // Paths to exclude from HTML manipulation
  INJECT_CLIENT_DATA?: boolean // Whether to inject experiment data for client-side tracking

  // Treatment tag processing
  VARIANT_MAPPING?: Record<string, number> // Map variant names to treatment numbers
}

// ABsmartly SDK Configuration
export interface SDKConfig {
  endpoint: string
  apiKey: string
  environment: string
  application: string
  retries?: number
  timeout?: number
}

// ABsmartly SDK Experiment (from context.getData().experiments)
export interface ABsmartlyExperiment {
  id: number
  name: string
  unitType: string
  iteration: number
  seedHi: number
  seedLo: number
  split: number[]
  trafficSeedHi: number
  trafficSeedLo: number
  trafficSplit: number[]
  fullOnVariant: number
  applications: Array<{
    name: string
  }>
  variants: Array<{
    name: string
    config?: {
      domChanges?: DOMChange[]
      [key: string]: unknown
    } | null
  }>
  audienceStrict: boolean
  audience?: string
}

// ABsmartly SDK Context Data (returned from context.getData())
export interface ABsmartlyContextData {
  experiments: ABsmartlyExperiment[]
}

// ABsmartly SDK Context instance (the context object returned by SDK.createContext)
export interface ABsmartlyContext {
  ready: () => Promise<void>
  peek: (experimentName: string) => number | undefined
  treatment: (experimentName: string) => number
  override: (experimentName: string, variant: number) => void
  overrides: (experimentVariants: Record<string, number>) => void
  attributes: (attrs: Record<string, unknown>) => void
  track: (eventName: string, properties?: Record<string, unknown>) => void
  data: () => ABsmartlyContextData
  getData: () => ABsmartlyContextData
  getContextData: () => unknown
  publish: () => Promise<void>
}

export interface DOMChange {
  selector: string
  type:
    | 'text'
    | 'html'
    | 'style'
    | 'class'
    | 'attribute'
    | 'move'
    | 'delete'
    | 'javascript'
    | 'create'
    | 'styleRules'
  value?: string | Record<string, unknown>
  name?: string
  action?: 'add' | 'remove'
  code?: string
  target?: string
  targetSelector?: string // Alias for target (used in SDK plugins)
  position?: 'before' | 'after' | 'prepend' | 'append'
  styles?: Record<string, string>
  rules?: string
  trigger_on_view?: boolean // If true, track exposure when element becomes visible. Defaults to false (immediate)
}

export interface ExperimentVariant {
  name: string
  config?: {
    domChanges?: DOMChange[]
    html?: string
    content?: string
  }
}

export interface ExperimentData {
  name: string
  treatment: number
  variant?: string
  changes?: DOMChange[]
}

export interface ContextData {
  experiments: ExperimentData[]
  contextData?: ABsmartlyContextData
}

export interface OverridesMap {
  [experimentName: string]: number
}

export interface ContextAttributes {
  url?: string
  userAgent?: string
  ip?: string
  [key: string]: string | number | boolean | undefined
}

export interface CookieOptions {
  expiry?: number
  path?: string
  domain?: string
  sameSite?: 'Lax' | 'Strict' | 'None'
  secure?: boolean
}

export interface WebVitalMetric {
  name: string
  value: number
  rating?: 'good' | 'needs-improvement' | 'poor'
  delta?: number
}

export interface EventPayload {
  name: string
  properties?: Record<string, string | number | boolean | null | undefined>
}

export interface EcommerceItem {
  item_id?: string
  item_name?: string
  price?: number
  quantity?: number
  [key: string]: string | number | boolean | null | undefined
}

export interface EcommercePayload {
  type:
    | 'purchase'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'view_item'
    | 'begin_checkout'
  revenue?: number
  items?: EcommerceItem[]
  transaction_id?: string
  currency?: string
  [key: string]: string | number | boolean | EcommerceItem[] | undefined
}

export interface Logger {
  log: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
}
