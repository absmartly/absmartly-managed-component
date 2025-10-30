import { ContextData, Logger } from '../types'

function logError(logger: Logger | undefined, ...args: unknown[]): void {
  if (logger) {
    logger.error(...args)
  } else {
    console.error('[ABSmartly MC]', ...args)
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

export function generateSessionId(userId: string): string {
  // Simple session ID based on user + date
  const date = new Date().toISOString().split('T')[0]
  return `${userId}_${date}`
}

export function generateUUID(): string {
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
