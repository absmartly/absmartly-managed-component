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
    try {
      const { document } = parseHTML(this.html)

      for (const change of changes) {
        try {
          this.applyChange(document, change)
        } catch (error) {
          this.logger?.error(
            '[ABsmartly MC] Failed to apply change:',
            error,
            change
          )
        }
      }

      return document.toString()
    } catch (error) {
      this.logger?.error('[ABsmartly MC] linkedom parsing failed:', {
        error: error instanceof Error ? error.message : String(error),
        htmlLength: this.html.length,
        htmlPreview: this.html.substring(0, 200),
      })
      throw error
    }
  }

  private applyChange(document: LinkedomDocument, change: DOMChange): void {
    const { selector } = change

    const elements = document.querySelectorAll(selector)

    if (elements.length === 0) {
      this.logger?.warn(
        '[ABsmartly MC] No elements found for selector:',
        selector
      )
      return
    }

    for (const element of elements) {
      this.applyChangeToElement(document, element, change)
    }
  }

  private applyChangeToElement(
    document: LinkedomDocument,
    element: LinkedomElement,
    change: DOMChange
  ): void {
    if (!element) {
      this.logger?.warn('[ABsmartly MC] Element is null, skipping change')
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
        this.logger?.warn(
          '[ABsmartly MC] JavaScript changes not supported server-side:',
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
          '[ABsmartly MC] Unsupported change type:',
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
      element.setAttribute('style', styles)
    } else if (typeof styles === 'object') {
      const currentStyle = element.getAttribute('style') || ''
      const styleMap = this.parseStyleString(currentStyle)

      for (const [key, value] of Object.entries(styles)) {
        const cssKey = camelToKebab(key)
        styleMap[cssKey] = String(value ?? '')
      }

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
        '[ABsmartly MC] Move operation requires target selector'
      )
      return
    }

    const target = document.querySelector(change.target)
    if (!target) {
      this.logger?.warn(
        '[ABsmartly MC] Target not found for move:',
        change.target
      )
      return
    }

    if (!target.parentNode) {
      this.logger?.warn('[ABsmartly MC] Target has no parent node')
      return
    }

    element.remove()

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
      this.logger?.warn('[ABsmartly MC] Invalid create config:', config)
      return
    }

    const tagName = String((config.tag as string) || 'div')
    const newElement = document.createElement(tagName)

    if (config.html && typeof config.html === 'string') {
      newElement.innerHTML = sanitizeHTMLContent(config.html)
    } else if (config.html) {
      newElement.innerHTML = sanitizeHTMLContent(String(config.html))
    }

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

    let target = parentElement
    if (change.target) {
      const targetElement = document.querySelector(change.target)
      if (targetElement) {
        target = targetElement
      }
    }

    if (
      !target.parentNode &&
      (change.position === 'before' || change.position === 'after')
    ) {
      this.logger?.warn(
        '[ABsmartly MC] Target has no parent node for before/after position'
      )
      target.appendChild(newElement)
      return
    }

    const position = (change.position as InsertPosition) || 'append'
    insertElementAtPosition(position, newElement, target)
  }

  private addStyleRules(document: LinkedomDocument, rules: string): void {
    let styleElement = document.querySelector('#absmartly-styles')

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.setAttribute('id', 'absmartly-styles')

      const head = document.querySelector('head')
      if (head) {
        head.appendChild(styleElement)
      } else {
        const body = document.querySelector('body')
        if (body) {
          body.insertBefore(styleElement, body.firstChild)
        } else if (document.documentElement) {
          document.documentElement.insertBefore(
            styleElement,
            document.documentElement.firstChild
          )
        }
      }
    }

    styleElement.textContent = (styleElement.textContent || '') + '\n' + rules
  }

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
