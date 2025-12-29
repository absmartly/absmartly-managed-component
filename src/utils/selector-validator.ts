/**
 * Validates and sanitizes CSS selectors to prevent injection attacks
 */

import { Logger } from '../types'

function logWarn(logger: Logger | undefined, ...args: unknown[]): void {
  if (logger) {
    logger.warn(...args)
  } else {
    console.warn('[ABsmartly MC]', ...args)
  }
}

export function validateSelector(selector: string, logger?: Logger): string {
  if (!selector || typeof selector !== 'string') {
    return 'body'
  }

  const trimmed = selector.trim()

  if (trimmed.length === 0) {
    return 'body'
  }

  if (trimmed.length > 200) {
    logWarn(logger, 'Selector too long, using default', {
      length: trimmed.length,
    })
    return 'body'
  }

  const allowedPattern = /^[a-zA-Z0-9\s\-_#.[\]="':,>+~*()]+$/
  if (!allowedPattern.test(trimmed)) {
    logWarn(logger, 'Invalid characters in selector, using default', {
      selector: trimmed,
    })
    return 'body'
  }

  const dangerousPatterns = [
    /javascript:/i,
    /<script/i,
    /<\/script/i,
    /on\w+\s*=/i,
    /expression\s*\(/i,
    /@import/i,
    /<!--/,
    /-->/,
    /\$\{/,
    /`/,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      logWarn(logger, 'Dangerous pattern detected in selector, using default', {
        selector: trimmed,
      })
      return 'body'
    }
  }

  return trimmed
}

/**
 * Escapes a selector for safe use in JavaScript strings
 */
export function escapeSelectorForJS(selector: string, logger?: Logger): string {
  const validated = validateSelector(selector, logger)

  return validated
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}
