/**
 * Shared HTML sanitization utilities
 * Used by both html-parser.ts and html-parser-linkedom.ts
 */

import DOMPurify from 'dompurify'
import { parseHTML } from 'linkedom'
import { DOMPURIFY_CONFIG } from './dom-sanitization-config'
import { Logger } from '../types'

// Create a DOMPurify instance using linkedom's window
const { window } = parseHTML('<!DOCTYPE html>')
const purify = DOMPurify(window as unknown as Window & typeof globalThis)

/**
 * Sanitize HTML content using DOMPurify with shared configuration
 * Removes dangerous tags, attributes, and protocols
 */
export function sanitizeHTMLContent(html: string): string {
  let cleanHTML = purify.sanitize(html, DOMPURIFY_CONFIG)

  // Additional post-processing: remove data:text/html and javascript: URLs
  cleanHTML = cleanHTML.replace(
    /\s(href|src)=(["'])data:(?:text\/html|application\/javascript)[^'"]*\2/gi,
    ''
  )

  return cleanHTML
}

/**
 * Sanitize attribute values to prevent XSS
 * Blocks dangerous protocols (javascript:, data:, vbscript:) and event handlers
 */
export function sanitizeAttributeValue(
  name: string,
  value: string,
  logger?: Logger
): string {
  // Block dangerous protocols in href/src attributes
  if (name === 'href' || name === 'src') {
    const lowerValue = value.toLowerCase().trim()
    if (
      lowerValue.startsWith('javascript:') ||
      lowerValue.startsWith('data:') ||
      lowerValue.startsWith('vbscript:')
    ) {
      logger?.warn(
        '[ABSmartly MC] Blocked dangerous protocol in attribute:',
        name,
        value
      )
      return ''
    }
  }

  // Block event handler attributes
  if (name.toLowerCase().startsWith('on')) {
    logger?.warn('[ABSmartly MC] Blocked event handler attribute:', name)
    return ''
  }

  return value
}
