import { ComponentSettings as MCComponentSettings } from '@managed-components/types'

export interface ABSmartlySettings extends MCComponentSettings {
  // Deployment
  DEPLOYMENT_MODE: 'zaraz' | 'webcm'

  // ABsmartly
  ABSMARTLY_API_KEY: string
  ABSMARTLY_ENDPOINT: string
  ABSMARTLY_ENVIRONMENT: string
  ABSMARTLY_APPLICATION: string

  // Cookie Management
  ENABLE_COOKIE_MANAGEMENT?: boolean
  COOKIE_NAME?: string
  PUBLIC_COOKIE_NAME?: string
  EXPIRY_COOKIE_NAME?: string
  COOKIE_MAX_AGE?: number
  COOKIE_DOMAIN?: string

  // Anti-Flicker (Optional, both modes)
  ENABLE_ANTI_FLICKER?: boolean   // Default: true
  HIDE_SELECTOR?: string          // Default: 'body'
  HIDE_TIMEOUT?: number           // Default: 3000
  TRANSITION_MS?: string          // Default: '300'

  // Client-Side Features (Optional, both modes)
  INJECT_CLIENT_BUNDLE?: boolean     // Default: true
  ENABLE_TRIGGER_ON_VIEW?: boolean   // Default: true

  // Features
  ENABLE_WEB_VITALS?: boolean
  ENABLE_EMBEDS?: boolean
  ENABLE_DEBUG?: boolean
  ENABLE_OVERRIDES?: boolean
  ENABLE_UTM_TRACKING?: boolean
  ENABLE_SERVER_SIDE_INIT?: boolean

  // Client SDK Injection
  INJECT_CLIENT_SDK?: boolean
  PASS_SERVER_PAYLOAD?: boolean
  CLIENT_SDK_STRATEGY?: 'cdn' | 'custom' | 'zaraz-bundle' | 'bundled'
  CLIENT_SDK_URL?: string
  CLIENT_SDK_CDN_PROVIDER?: 'unpkg' | 'jsdelivr'
  CLIENT_SDK_VERSION?: string

  // Overrides
  OVERRIDE_QUERY_PREFIX?: string

  // Performance
  SDK_TIMEOUT?: number
  CONTEXT_CACHE_TTL?: number

  // WebCM Track Endpoint (WebCM mode only)
  TRACK_ENDPOINT?: string         // Default: '/absmartly'
  TRACK_BATCH_TIMEOUT?: number    // Default: 0 (no batching)
  TRACK_BATCH_SIZE?: number       // Default: 1 (no batching)
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
export interface ABSmartlyExperiment {
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
export interface ABSmartlyContextData {
  experiments: ABSmartlyExperiment[]
}

// ABsmartly SDK Context instance (the context object returned by SDK.createContext)
export interface ABSmartlyContext {
  ready: () => Promise<void>
  peek: (experimentName: string) => number | undefined
  treatment: (experimentName: string) => number
  override: (experimentName: string, variant: number) => void
  attributes: (attrs: Record<string, unknown>) => void
  getData: () => ABSmartlyContextData
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
  contextData?: ABSmartlyContextData
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
}
