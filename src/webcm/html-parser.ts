import { DOMChange, Logger } from '../types'
import {
  sanitizeHTMLContent,
  sanitizeAttributeValue,
} from '../utils/dom-sanitization'
import { insertAtPosition, InsertPosition } from '../utils/dom-position'
import { camelToKebab } from '../utils/string-transforms'

export class HTMLParser {
  constructor(
    private html: string,
    private logger?: Logger
  ) {}

  private escapeHTML(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    }
    return String(text).replace(/[&<>"']/g, char => escapeMap[char])
  }

  private escapeAttribute(value: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    }
    return String(value)
      .replace(/[&<>"']/g, char => escapeMap[char])
      .replace(/\n/g, '&#10;')
  }

  private validateClassName(className: string): string {
    return className.replace(/[^\w\s-]/g, '')
  }

  private sanitizeStyleString(styles: string): string {
    const dangerousPatterns = [
      /javascript:/gi,
      /expression\s*\(/gi,
      /import\s+/gi,
      /@import/gi,
      /behavior\s*:/gi,
      /-moz-binding/gi,
    ]

    let sanitized = styles
    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '')
    }
    return sanitized
  }

  applyChanges(changes: DOMChange[]): string {
    let modifiedHTML = this.html

    for (const change of changes) {
      try {
        modifiedHTML = this.applyChange(modifiedHTML, change)
      } catch (error) {
        this.logger?.error('[ABSmartly MC] Failed to apply change:', error)
      }
    }

    return modifiedHTML
  }

  private applyChange(html: string, change: DOMChange): string {
    const { selector, type } = change

    // For server-side changes, we'll use regex-based replacements
    // This is a simplified implementation - could use cheerio for more robust parsing

    switch (type) {
      case 'text':
        return this.replaceTextContent(
          html,
          selector,
          String(change.value ?? '')
        )

      case 'html':
        return this.replaceInnerHTML(html, selector, String(change.value ?? ''))

      case 'attribute':
        if (!change.name) {
          throw new Error('attribute change requires name property')
        }
        return this.setAttribute(html, selector, change.name, change.value)

      case 'class':
        if (change.action === 'add') {
          return this.addClass(html, selector, String(change.value ?? ''))
        } else {
          return this.removeClass(html, selector, String(change.value ?? ''))
        }

      case 'style': {
        // Handle style value type conversion
        let styleValue: string | Record<string, string> | undefined
        if (typeof change.value === 'string') {
          styleValue = change.value
        } else if (change.value && typeof change.value === 'object') {
          // Convert Record<string, unknown> to Record<string, string>
          const styleObj: Record<string, string> = {}
          for (const [key, val] of Object.entries(change.value)) {
            styleObj[key] = String(val ?? '')
          }
          styleValue = styleObj
        } else {
          styleValue = undefined
        }
        return this.addInlineStyle(html, selector, styleValue)
      }

      case 'delete':
        return this.deleteElement(html, selector)

      case 'styleRules':
        if (!change.rules) {
          throw new Error('styleRules change requires rules property')
        }
        return this.addStyleRules(html, change.rules)

      case 'create':
        return this.createElement(html, change)

      case 'move':
        return this.moveElement(html, change)

      default:
        this.logger?.warn(
          '[ABSmartly MC] Unsupported server-side change type:',
          type
        )
        return html
    }
  }

  private replaceTextContent(
    html: string,
    selector: string,
    newText: string
  ): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`(<${tag}[^>]*>)([^<]*)(</${tag}>)`, 'gi')
    const escapedText = this.escapeHTML(newText)
    return html.replace(pattern, `$1${escapedText}$3`)
  }

  private replaceInnerHTML(
    html: string,
    selector: string,
    newHTML: string
  ): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`(<${tag}[^>]*>)(.*?)(</${tag}>)`, 'gis')
    const sanitizedHTML = sanitizeHTMLContent(newHTML)
    return html.replace(pattern, `$1${sanitizedHTML}$3`)
  }

  private setAttribute(
    html: string,
    selector: string,
    attrName: string,
    attrValue: string | number | boolean | Record<string, unknown> | undefined
  ): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }

    if (attrValue === null || attrValue === undefined) {
      const pattern = new RegExp(
        `(<${tag}[^>]*?)\\s${attrName}="[^"]*"([^>]*>)`,
        'gi'
      )
      return html.replace(pattern, '$1$2')
    } else {
      const stringValue = String(attrValue)
      const sanitizedValue = sanitizeAttributeValue(
        attrName,
        stringValue,
        this.logger
      )

      if (sanitizedValue === '') {
        const pattern = new RegExp(
          `(<${tag}[^>]*?)\\s${attrName}="[^"]*"([^>]*>)`,
          'gi'
        )
        return html.replace(pattern, '$1$2')
      }

      const escapedValue = this.escapeAttribute(sanitizedValue)
      const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')
      return html.replace(pattern, (match, attrs) => {
        if (attrs.includes(`${attrName}=`)) {
          attrs = attrs.replace(
            new RegExp(`${attrName}="[^"]*"`, 'gi'),
            `${attrName}="${escapedValue}"`
          )
        } else {
          attrs += ` ${attrName}="${escapedValue}"`
        }
        return `<${tag}${attrs}>`
      })
    }
  }

  private addClass(html: string, selector: string, className: string): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')
    const validClassName = this.validateClassName(className)

    return html.replace(pattern, (match, attrs) => {
      if (attrs.includes('class=')) {
        attrs = attrs.replace(/class="([^"]*)"/, `class="$1 ${validClassName}"`)
      } else {
        attrs += ` class="${validClassName}"`
      }
      return `<${tag}${attrs}>`
    })
  }

  private removeClass(
    html: string,
    selector: string,
    className: string
  ): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')
    const validClassName = this.validateClassName(className)

    return html.replace(pattern, (match, attrs) => {
      attrs = attrs.replace(new RegExp(`\\s?${validClassName}\\s?`, 'g'), ' ')
      return `<${tag}${attrs}>`
    })
  }

  private addInlineStyle(
    html: string,
    selector: string,
    styles: string | Record<string, string> | undefined
  ): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')

    const styleString =
      typeof styles === 'string'
        ? styles
        : this.objectToStyleString(styles || {})
    const sanitizedStyle = this.sanitizeStyleString(styleString)

    return html.replace(pattern, (match, attrs) => {
      if (attrs.includes('style=')) {
        attrs = attrs.replace(
          /style="([^"]*)"/,
          `style="$1; ${sanitizedStyle}"`
        )
      } else {
        attrs += ` style="${sanitizedStyle}"`
      }
      return `<${tag}${attrs}>`
    })
  }

  private deleteElement(html: string, selector: string): string {
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis')
    return html.replace(pattern, '')
  }

  private addStyleRules(html: string, rules: string): string {
    const sanitizedRules = this.sanitizeStyleString(rules)
    const styleTag = `<style id="absmartly-styles">${sanitizedRules}</style>`

    if (html.includes('</head>')) {
      return html.replace('</head>', `${styleTag}</head>`)
    } else {
      return styleTag + html
    }
  }

  private extractTagFromSelector(selector: string): string {
    // Extract tag name from selector (e.g., "div.class" -> "div", "h1" -> "h1", "#id" -> "div" as fallback)
    const match = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/)
    return match ? match[1] : 'div'
  }

  private objectToStyleString(styles: Record<string, string>): string {
    return Object.entries(styles)
      .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
      .join('; ')
  }

  private createElement(html: string, change: DOMChange): string {
    const { selector, value, position = 'append' } = change
    const tag = this.extractTagFromSelector(selector)
    // Null safety guard
    if (!tag) {
      this.logger?.warn(
        '[ABSmartly MC] Invalid selector, no tag found:',
        selector
      )
      return html
    }
    const pattern = new RegExp(`(<${tag}[^>]*>)(.*?)(</${tag}>)`, 'gis')
    const sanitizedValue = sanitizeHTMLContent(String(value ?? ''))

    return html.replace(pattern, (match, openTag, content, closeTag) => {
      // Use shared utility for position insertion
      return insertAtPosition(
        position as InsertPosition,
        sanitizedValue,
        match,
        openTag,
        content,
        closeTag
      )
    })
  }

  private moveElement(html: string, change: DOMChange): string {
    const { selector, target, position = 'append' } = change

    if (!target) {
      this.logger?.warn(
        '[ABSmartly MC] Move operation requires a target selector'
      )
      return html
    }

    // Extract the element to move
    const sourcePattern = this.buildSelectorPattern(selector)
    const sourceMatch = sourcePattern.exec(html)

    // Null safety guard
    if (!sourceMatch) {
      this.logger?.warn(
        '[ABSmartly MC] Source element not found for move:',
        selector
      )
      return html
    }

    const elementToMove = sourceMatch[0]

    // Remove element from original position (only first match)
    html = html.replace(sourcePattern, '')

    // Insert at target position
    const targetPattern = this.buildSelectorPattern(target, true)

    return html.replace(targetPattern, (match, openTag, content, closeTag) => {
      // Use shared utility for position insertion
      return insertAtPosition(
        position as InsertPosition,
        elementToMove,
        match,
        openTag,
        content,
        closeTag
      )
    })
  }

  private buildSelectorPattern(selector: string, withCapture = false): RegExp {
    const tag = this.extractTagFromSelector(selector)

    // Check for ID selector (e.g., "div#myId" or "#myId")
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/)

    if (idMatch) {
      const id = idMatch[1]
      if (withCapture) {
        // Capture opening tag, content, and closing tag separately
        return new RegExp(
          `(<${tag}[^>]*id="${id}"[^>]*>)(.*?)(</${tag}>)`,
          'is'
        )
      } else {
        // Capture entire element
        return new RegExp(`<${tag}[^>]*id="${id}"[^>]*>.*?</${tag}>`, 'is')
      }
    }

    // Check for class selector (e.g., "div.myClass" or ".myClass")
    const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/)

    if (classMatch) {
      const className = classMatch[1]
      if (withCapture) {
        return new RegExp(
          `(<${tag}[^>]*class="[^"]*${className}[^"]*"[^>]*>)(.*?)(</${tag}>)`,
          'is'
        )
      } else {
        return new RegExp(
          `<${tag}[^>]*class="[^"]*${className}[^"]*"[^>]*>.*?</${tag}>`,
          'is'
        )
      }
    }

    // Default: match by tag only
    if (withCapture) {
      return new RegExp(`(<${tag}[^>]*>)(.*?)(</${tag}>)`, 'is')
    } else {
      return new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'is')
    }
  }
}
