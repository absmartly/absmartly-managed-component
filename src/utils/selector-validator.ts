/**
 * Validates and sanitizes CSS selectors to prevent injection attacks
 */

export function validateSelector(selector: string): string {
  if (!selector || typeof selector !== 'string') {
    return 'body'
  }

  const trimmed = selector.trim()

  if (trimmed.length === 0) {
    return 'body'
  }

  if (trimmed.length > 200) {
    console.warn('[ABSmartly MC] Selector too long, using default', {
      length: trimmed.length,
    })
    return 'body'
  }

  const allowedPattern = /^[a-zA-Z0-9\s\-_#.[\]="':,>+~*()]+$/
  if (!allowedPattern.test(trimmed)) {
    console.warn(
      '[ABSmartly MC] Invalid characters in selector, using default',
      {
        selector: trimmed,
      }
    )
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
      console.warn(
        '[ABSmartly MC] Dangerous pattern detected in selector, using default',
        {
          selector: trimmed,
        }
      )
      return 'body'
    }
  }

  return trimmed
}

/**
 * Escapes a selector for safe use in JavaScript strings
 */
export function escapeSelectorForJS(selector: string): string {
  const validated = validateSelector(selector)

  return validated
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}
