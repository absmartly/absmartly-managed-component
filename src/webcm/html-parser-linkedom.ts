import { parseHTML } from 'linkedom'
import DOMPurify from 'isomorphic-dompurify'
import { DOMChange, Logger } from '../types'

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
        this.logger?.error('[ABSmartly MC] Failed to apply change:', error, change)
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
      this.logger?.warn('[ABSmartly MC] No elements found for selector:', selector)
      return
    }

    // Apply change to all matching elements
    for (const element of elements) {
      this.applyChangeToElement(document, element, change)
    }
  }

  private sanitizeHTML(html: string): string {
    let cleanHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
        'b', 'bdi', 'bdo', 'blockquote', 'br', 'button',
        'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
        'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
        'em', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
        'i', 'img', 'input', 'ins',
        'kbd', 'label', 'legend', 'li', 'main', 'map', 'mark', 'meter',
        'nav', 'ol', 'optgroup', 'option', 'output',
        'p', 'picture', 'pre', 'progress',
        'q', 'rp', 'rt', 'ruby',
        's', 'samp', 'section', 'select', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
        'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr', 'track',
        'u', 'ul', 'var', 'video', 'wbr'
      ],
      ALLOWED_ATTR: [
        'class', 'id', 'style', 'title', 'role', 'aria-*', 'data-*',
        'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
        'type', 'name', 'value', 'placeholder', 'disabled', 'readonly', 'checked',
        'colspan', 'rowspan', 'controls', 'autoplay', 'loop', 'muted'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      FORBID_TAGS: ['script', 'object', 'link', 'meta'],
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    })

    cleanHTML = cleanHTML.replace(/\s(href|src)=(["'])data:(?:text\/html|application\/javascript)[^'"]*\2/gi, '')

    return cleanHTML
  }

  private applyChangeToElement(
    document: LinkedomDocument,
    element: LinkedomElement,
    change: DOMChange
  ): void {
    switch (change.type) {
      case 'text':
        element.textContent = change.value
        break

      case 'html':
        element.innerHTML = this.sanitizeHTML(change.value)
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
        this.logger?.warn('[ABSmartly MC] Unsupported change type:', change.type)
    }
  }

  private applyStyleChange(
    element: LinkedomElement,
    styles: string | Record<string, string> | undefined
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
        const cssKey = this.camelToKebab(key)
        styleMap[cssKey] = String(value)
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
      classList.add(change.value)
    } else if (change.action === 'remove') {
      classList.remove(change.value)
    } else {
      // Replace entire class attribute
      element.className = change.value
    }
  }

  private sanitizeAttributeValue(name: string, value: string): string {
    // Block dangerous protocols in href/src attributes
    if (name === 'href' || name === 'src') {
      const lowerValue = value.toLowerCase().trim()
      if (
        lowerValue.startsWith('javascript:') ||
        lowerValue.startsWith('data:') ||
        lowerValue.startsWith('vbscript:')
      ) {
        this.logger?.warn('[ABSmartly MC] Blocked dangerous protocol in attribute:', name, value)
        return ''
      }
    }

    // Block event handler attributes
    if (name.toLowerCase().startsWith('on')) {
      this.logger?.warn('[ABSmartly MC] Blocked event handler attribute:', name)
      return ''
    }

    return value
  }

  private applyAttributeChange(
    element: LinkedomElement,
    change: DOMChange
  ): void {
    if (!element || !change.name) return

    if (change.value === null || change.value === undefined) {
      element.removeAttribute(change.name)
    } else {
      const sanitizedValue = this.sanitizeAttributeValue(change.name, String(change.value))
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
      this.logger?.warn('[ABSmartly MC] Move operation requires target selector')
      return
    }

    const target = document.querySelector(change.target)
    if (!target) {
      this.logger?.warn('[ABSmartly MC] Target not found for move:', change.target)
      return
    }

    // Remove from current position
    element.remove()

    // Insert at target position
    switch (change.position) {
      case 'before':
        target.parentNode.insertBefore(element, target)
        break
      case 'after':
        target.parentNode.insertBefore(element, target.nextSibling)
        break
      case 'prepend':
        target.insertBefore(element, target.firstChild)
        break
      case 'append':
      default:
        target.appendChild(element)
        break
    }
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

    // Create new element
    const newElement = document.createElement(config.tag || 'div')

    // Set HTML content (sanitized to prevent XSS)
    if (config.html) {
      newElement.innerHTML = this.sanitizeHTML(config.html)
    }

    // Set attributes (sanitized to prevent XSS)
    if (config.attributes) {
      for (const [name, value] of Object.entries(config.attributes)) {
        const sanitizedValue = this.sanitizeAttributeValue(name, String(value))
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

    // Insert at specified position
    switch (change.position) {
      case 'before':
        target.parentNode.insertBefore(newElement, target)
        break
      case 'after':
        target.parentNode.insertBefore(newElement, target.nextSibling)
        break
      case 'prepend':
        target.insertBefore(newElement, target.firstChild)
        break
      case 'append':
      default:
        target.appendChild(newElement)
        break
    }
  }

  private addStyleRules(document: LinkedomDocument, rules: string): void {
    // Find or create style element
    let styleElement = document.querySelector('#absmartly-styles')

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.setAttribute('id', 'absmartly-styles')

      // Insert in head if it exists
      const head = document.querySelector('head')
      if (head) {
        head.appendChild(styleElement)
      } else {
        // Otherwise insert at beginning of body or document
        const body = document.querySelector('body')
        if (body) {
          body.insertBefore(styleElement, body.firstChild)
        } else {
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

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }
}
