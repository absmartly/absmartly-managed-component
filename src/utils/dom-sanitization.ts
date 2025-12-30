/**
 * Shared HTML sanitization utilities
 * Used by both html-parser.ts and html-parser-linkedom.ts
 *
 * Uses js-xss library for Cloudflare Workers compatibility
 * (DOMPurify requires DOM which doesn't work properly with linkedom in Workers)
 */

import xss, { IFilterXSSOptions, escapeAttrValue } from 'xss'
import { ALLOWED_TAGS } from './dom-sanitization-config'
import { Logger } from '../types'

// Base allowed attributes (xss library doesn't support wildcards)
const BASE_ALLOWED_ATTR = [
  'class',
  'id',
  'style',
  'title',
  'role',
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'type',
  'name',
  'value',
  'placeholder',
  'disabled',
  'readonly',
  'checked',
  'colspan',
  'rowspan',
  'controls',
  'autoplay',
  'loop',
  'muted',
]

const xssOptions: IFilterXSSOptions = {
  whiteList: ALLOWED_TAGS.reduce(
    (acc, tag) => {
      acc[tag] = BASE_ALLOWED_ATTR
      return acc
    },
    {} as Record<string, string[]>
  ),
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onIgnoreTagAttr: (_tag, name, value) => {
    // Allow data-* attributes
    if (name.startsWith('data-')) {
      return `${name}="${escapeAttrValue(value)}"`
    }
    // Allow aria-* attributes
    if (name.startsWith('aria-')) {
      return `${name}="${escapeAttrValue(value)}"`
    }
    return undefined
  },
}

/**
 * Sanitize HTML content by removing dangerous tags, attributes, and protocols
 * Uses js-xss library for Cloudflare Workers compatibility
 */
export function sanitizeHTMLContent(html: string): string {
  if (!html || html.trim() === '') {
    return ''
  }

  return xss(html, xssOptions)
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
        '[ABsmartly MC] Blocked dangerous protocol in attribute:',
        name,
        value
      )
      return ''
    }
  }

  // Block event handler attributes
  if (name.toLowerCase().startsWith('on')) {
    logger?.warn('[ABsmartly MC] Blocked event handler attribute:', name)
    return ''
  }

  return value
}
