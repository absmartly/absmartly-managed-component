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
  COOKIE_NAME?: string
  COOKIE_MAX_AGE?: number
  COOKIE_DOMAIN?: string

  // Anti-Flicker (Zaraz mode only)
  HIDE_SELECTOR?: string
  HIDE_TIMEOUT?: number
  TRANSITION_MS?: string

  // Features
  ENABLE_SPA_MODE?: boolean
  ENABLE_WEB_VITALS?: boolean
  ENABLE_EMBEDS?: boolean
  ENABLE_DEBUG?: boolean

  // Performance
  SDK_TIMEOUT?: number
  CONTEXT_CACHE_TTL?: number
}

export interface DOMChange {
  selector: string
  type: 'text' | 'html' | 'style' | 'class' | 'attribute' | 'move' | 'delete' | 'javascript' | 'create' | 'styleRules'
  value?: any
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
  contextData?: any
}

export interface OverridesMap {
  [experimentName: string]: number
}

export interface ContextAttributes {
  url?: string
  userAgent?: string
  ip?: string
  [key: string]: any
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
  properties?: Record<string, any>
}

export interface EcommercePayload {
  type: 'purchase' | 'add_to_cart' | 'remove_from_cart' | 'view_item' | 'begin_checkout'
  revenue?: number
  items?: any[]
  transaction_id?: string
  currency?: string
  [key: string]: any
}

export interface Logger {
  log: (...args: any[]) => void
  error: (...args: any[]) => void
  warn: (...args: any[]) => void
  debug: (...args: any[]) => void
}
