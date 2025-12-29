import { ContextData, Logger } from '../types'

function logError(logger: Logger | undefined, ...args: unknown[]): void {
  if (logger) {
    logger.error(...args)
  } else {
    console.error('[ABsmartly MC]', ...args)
  }
}

export function serializeContextData(
  data: ContextData,
  logger?: Logger
): string {
  try {
    return JSON.stringify(data)
  } catch (error) {
    logError(logger, 'Failed to serialize context data:', error)
    return JSON.stringify({ experiments: [] })
  }
}

export function deserializeContextData(
  json: string,
  logger?: Logger
): ContextData {
  try {
    return JSON.parse(json)
  } catch (error) {
    logError(logger, 'Failed to deserialize context data:', error)
    return { experiments: [] }
  }
}

/**
 * Generate a fast unique ID (timestamp + random)
 * Matches the ID generation from CookiePlugin and absmartly-worker
 * Format: timestamp (base36) + random (base36)
 * Example: "l1234abc56def" (15-20 characters)
 */
export function generateUUID(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * Legacy UUID v4 generator (not used, kept for reference)
 */
export function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

export function safeParseJSON<T = unknown>(
  json: string,
  fallback: T | null = null,
  logger?: Logger
): T | null {
  try {
    return JSON.parse(json) as T
  } catch (error) {
    logError(logger, 'JSON parse error in safeParseJSON:', error, {
      jsonPreview: json.substring(0, 100),
    })
    return fallback
  }
}
