import { parseHTML } from 'linkedom'
import { DOMChange, Logger } from '../types'
import {
  sanitizeHTMLContent,
  sanitizeAttributeValue,
} from '../utils/dom-sanitization'
import { insertElementAtPosition, InsertPosition } from '../utils/dom-position'
import { camelToKebab } from '../utils/string-transforms'

type LinkedomDocument = ReturnType<typeof parseHTML>['document']
type LinkedomElement = ReturnType<LinkedomDocument['querySelector']>

/**
 * Enhanced HTML parser using linkedom for full CSS selector support
 * Provides real DOM API with querySelector/querySelectorAll
 * Supports complex selectors, pseudo-classes, and attribute selectors
 */
export class HTMLParserLinkedom {
  constructor(
    private html: string,
    private logger?: Logger
  ) {}

  applyChanges(changes: DOMChange[]): string {
    // Parse HTML to real DOM
    const { document } = parseHTML(this.html)

    for (const change of changes) {
      try {
        this.applyChange(document, change)
      } catch (error) {
        this.logger?.error(
          '[ABSmartly MC] Failed to apply change:',
          error,
          change
        )
      }
    }

    // Return serialized HTML
    return document.toString()
  }

  private applyChange(document: LinkedomDocument, change: DOMChange): void {
    const { selector } = change

    // Use real querySelectorAll - supports all CSS selectors!
    const elements = document.querySelectorAll(selector)

    if (elements.length === 0) {
      this.logger?.warn(
        '[ABSmartly MC] No elements found for selector:',
        selector
      )
      return
    }

    // Apply change to all matching elements
    for (const element of elements) {
      this.applyChangeToElement(document, element, change)
    }
  }

  private applyChangeToElement(
    document: LinkedomDocument,
    element: LinkedomElement,
    change: DOMChange
  ): void {
    // Null safety guard
    if (!element) {
      this.logger?.warn('[ABSmartly MC] Element is null, skipping change')
      return
    }

    switch (change.type) {
      case 'text':
        element.textContent = String(change.value ?? '')
        break

      case 'html':
        if (typeof change.value === 'string') {
          element.innerHTML = sanitizeHTMLContent(change.value)
        } else {
          element.innerHTML = sanitizeHTMLContent(String(change.value ?? ''))
        }
        break

      case 'style':
        this.applyStyleChange(element, change.value)
        break

      case 'class':
        this.applyClassChange(element, change)
        break

      case 'attribute':
        this.applyAttributeChange(element, change)
        break

      case 'delete':
        element.remove()
        break

      case 'move':
        this.moveElement(document, element, change)
        break

      case 'javascript':
        // Can't execute JavaScript server-side, skip
        this.logger?.warn(
          '[ABSmartly MC] JavaScript changes not supported server-side:',
          change
        )
        break

      case 'create':
        this.createElement(document, element, change)
        break

      case 'styleRules':
        if (change.rules) {
          this.addStyleRules(document, change.rules)
        }
        break

      default:
        this.logger?.warn(
          '[ABSmartly MC] Unsupported change type:',
          change.type
        )
    }
  }

  private applyStyleChange(
    element: LinkedomElement,
    styles: string | Record<string, unknown> | undefined
  ): void {
    if (!element || !styles) return

    if (typeof styles === 'string') {
      // CSS string: "color: red; font-size: 14px"
      element.setAttribute('style', styles)
    } else if (typeof styles === 'object') {
      // Object: { color: 'red', fontSize: '14px' }
      const currentStyle = element.getAttribute('style') || ''
      const styleMap = this.parseStyleString(currentStyle)

      // Merge new styles
      for (const [key, value] of Object.entries(styles)) {
        const cssKey = camelToKebab(key)
        styleMap[cssKey] = String(value ?? '')
      }

      // Rebuild style string
      const newStyle = Object.entries(styleMap)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')

      element.setAttribute('style', newStyle)
    }
  }

  private applyClassChange(element: LinkedomElement, change: DOMChange): void {
    if (!element) return

    const classList = element.classList

    if (change.action === 'add') {
      classList.add(String(change.value ?? ''))
    } else if (change.action === 'remove') {
      classList.remove(String(change.value ?? ''))
    } else {
      // Replace entire class attribute
      element.className = String(change.value ?? '')
    }
  }

  private applyAttributeChange(
    element: LinkedomElement,
    change: DOMChange
  ): void {
    if (!element || !change.name) return

    if (change.value === null || change.value === undefined) {
      element.removeAttribute(change.name)
    } else {
      const sanitizedValue = sanitizeAttributeValue(
        change.name,
        String(change.value),
        this.logger
      )
      if (sanitizedValue !== '') {
        element.setAttribute(change.name, sanitizedValue)
      } else {
        // Don't set empty/blocked attributes
        element.removeAttribute(change.name)
      }
    }
  }

  private moveElement(
    document: LinkedomDocument,
    element: LinkedomElement,
    change: DOMChange
  ): void {
    if (!element) return

    if (!change.target) {
      this.logger?.warn(
        '[ABSmartly MC] Move operation requires target selector'
      )
      return
    }

    const target = document.querySelector(change.target)
    if (!target) {
      this.logger?.warn(
        '[ABSmartly MC] Target not found for move:',
        change.target
      )
      return
    }

    // Null safety guard for parentNode
    if (!target.parentNode) {
      this.logger?.warn('[ABSmartly MC] Target has no parent node')
      return
    }

    // Remove from current position
    element.remove()

    // Insert at target position using shared utility
    const position = (change.position as InsertPosition) || 'append'
    insertElementAtPosition(position, element, target)
  }

  private createElement(
    document: LinkedomDocument,
    parentElement: LinkedomElement,
    change: DOMChange
  ): void {
    if (!parentElement) return

    const config = change.value

    if (!config || typeof config !== 'object') {
      this.logger?.warn('[ABSmartly MC] Invalid create config:', config)
      return
    }

    // Create new element with null safety guard
    const tagName = String((config.tag as string) || 'div')
    const newElement = document.createElement(tagName)

    // Set HTML content (sanitized to prevent XSS)
    if (config.html && typeof config.html === 'string') {
      newElement.innerHTML = sanitizeHTMLContent(config.html)
    } else if (config.html) {
      newElement.innerHTML = sanitizeHTMLContent(String(config.html))
    }

    // Set attributes (sanitized to prevent XSS)
    if (config.attributes) {
      for (const [name, value] of Object.entries(config.attributes)) {
        const sanitizedValue = sanitizeAttributeValue(
          name,
          String(value),
          this.logger
        )
        if (sanitizedValue !== '') {
          newElement.setAttribute(name, sanitizedValue)
        }
      }
    }

    // Determine target element
    let target = parentElement
    if (change.target) {
      const targetElement = document.querySelector(change.target)
      if (targetElement) {
        target = targetElement
      }
    }

    // Null safety guard for parentNode
    if (
      !target.parentNode &&
      (change.position === 'before' || change.position === 'after')
    ) {
      this.logger?.warn(
        '[ABSmartly MC] Target has no parent node for before/after position'
      )
      // Fall back to append
      target.appendChild(newElement)
      return
    }

    // Insert at specified position using shared utility
    const position = (change.position as InsertPosition) || 'append'
    insertElementAtPosition(position, newElement, target)
  }

  private addStyleRules(document: LinkedomDocument, rules: string): void {
    // Find or create style element
    let styleElement = document.querySelector('#absmartly-styles')

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.setAttribute('id', 'absmartly-styles')

      // Null safety guard - Insert in head if it exists
      const head = document.querySelector('head')
      if (head) {
        head.appendChild(styleElement)
      } else {
        // Otherwise insert at beginning of body or document
        const body = document.querySelector('body')
        if (body) {
          body.insertBefore(styleElement, body.firstChild)
        } else if (document.documentElement) {
          // Null safety guard for documentElement
          document.documentElement.insertBefore(
            styleElement,
            document.documentElement.firstChild
          )
        }
      }
    }

    // Append rules
    styleElement.textContent = (styleElement.textContent || '') + '\n' + rules
  }

  // Utility functions

  private parseStyleString(styleString: string): Record<string, string> {
    const styles: Record<string, string> = {}

    if (!styleString) return styles

    const declarations = styleString.split(';')
    for (const declaration of declarations) {
      const [key, value] = declaration.split(':').map(s => s.trim())
      if (key && value) {
        styles[key] = value
      }
    }

    return styles
  }
}
