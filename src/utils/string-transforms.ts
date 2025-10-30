/**
 * String transformation utilities
 * Used for CSS property name conversions
 */

/**
 * Convert camelCase string to kebab-case
 * Example: backgroundColor -> background-color
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Convert kebab-case string to camelCase
 * Example: background-color -> backgroundColor
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}
