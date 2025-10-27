import { DOMChange } from '../types'

// Simple HTML parser for applying DOM changes server-side
// For production, could use cheerio or similar, but keeping it simple for now

export class HTMLParser {
  constructor(private html: string) {}

  applyChanges(changes: DOMChange[]): string {
    let modifiedHTML = this.html

    for (const change of changes) {
      try {
        modifiedHTML = this.applyChange(modifiedHTML, change)
      } catch (error) {
        console.error('[ABSmartly MC] Failed to apply change:', error)
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
        return this.replaceTextContent(html, selector, change.value)

      case 'html':
        return this.replaceInnerHTML(html, selector, change.value)

      case 'attribute':
        if (!change.name) {
          throw new Error('attribute change requires name property')
        }
        return this.setAttribute(html, selector, change.name, change.value)

      case 'class':
        if (change.action === 'add') {
          return this.addClass(html, selector, change.value)
        } else {
          return this.removeClass(html, selector, change.value)
        }

      case 'style':
        return this.addInlineStyle(html, selector, change.value)

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
        console.warn(
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
    // Simple implementation - replace text between opening and closing tags
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`(<${tag}[^>]*>)([^<]*)(</${tag}>)`, 'gi')
    return html.replace(pattern, `$1${newText}$3`)
  }

  private replaceInnerHTML(
    html: string,
    selector: string,
    newHTML: string
  ): string {
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`(<${tag}[^>]*>)(.*?)(</${tag}>)`, 'gis')
    return html.replace(pattern, `$1${newHTML}$3`)
  }

  private setAttribute(
    html: string,
    selector: string,
    attrName: string,
    attrValue: string | number | boolean | Record<string, unknown> | undefined
  ): string {
    const tag = this.extractTagFromSelector(selector)

    if (attrValue === null || attrValue === undefined) {
      // Remove attribute
      const pattern = new RegExp(
        `(<${tag}[^>]*?)\\s${attrName}="[^"]*"([^>]*>)`,
        'gi'
      )
      return html.replace(pattern, '$1$2')
    } else {
      // Add or update attribute
      const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')
      return html.replace(pattern, (match, attrs) => {
        if (attrs.includes(`${attrName}=`)) {
          // Update existing
          attrs = attrs.replace(
            new RegExp(`${attrName}="[^"]*"`, 'gi'),
            `${attrName}="${attrValue}"`
          )
        } else {
          // Add new
          attrs += ` ${attrName}="${attrValue}"`
        }
        return `<${tag}${attrs}>`
      })
    }
  }

  private addClass(html: string, selector: string, className: string): string {
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')

    return html.replace(pattern, (match, attrs) => {
      if (attrs.includes('class=')) {
        attrs = attrs.replace(/class="([^"]*)"/, `class="$1 ${className}"`)
      } else {
        attrs += ` class="${className}"`
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
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')

    return html.replace(pattern, (match, attrs) => {
      attrs = attrs.replace(new RegExp(`\\s?${className}\\s?`, 'g'), ' ')
      return `<${tag}${attrs}>`
    })
  }

  private addInlineStyle(
    html: string,
    selector: string,
    styles: string | Record<string, string>
  ): string {
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`<${tag}([^>]*)>`, 'gi')

    const styleString =
      typeof styles === 'string' ? styles : this.objectToStyleString(styles)

    return html.replace(pattern, (match, attrs) => {
      if (attrs.includes('style=')) {
        attrs = attrs.replace(/style="([^"]*)"/, `style="$1; ${styleString}"`)
      } else {
        attrs += ` style="${styleString}"`
      }
      return `<${tag}${attrs}>`
    })
  }

  private deleteElement(html: string, selector: string): string {
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis')
    return html.replace(pattern, '')
  }

  private addStyleRules(html: string, rules: string): string {
    // Add style rules in a <style> tag before </head>
    const styleTag = `<style id="absmartly-styles">${rules}</style>`

    if (html.includes('</head>')) {
      return html.replace('</head>', `${styleTag}</head>`)
    } else {
      // If no </head>, add at the beginning
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
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ')
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }

  private createElement(html: string, change: DOMChange): string {
    const { selector, value, position = 'append' } = change
    const tag = this.extractTagFromSelector(selector)
    const pattern = new RegExp(`(<${tag}[^>]*>)(.*?)(</${tag}>)`, 'gis')

    return html.replace(pattern, (match, openTag, content, closeTag) => {
      switch (position) {
        case 'before':
          return `${value}${match}`
        case 'after':
          return `${match}${value}`
        case 'prepend':
          return `${openTag}${value}${content}${closeTag}`
        case 'append':
        default:
          return `${openTag}${content}${value}${closeTag}`
      }
    })
  }

  private moveElement(html: string, change: DOMChange): string {
    const { selector, target, position = 'append' } = change

    if (!target) {
      console.warn('[ABSmartly MC] Move operation requires a target selector')
      return html
    }

    // Extract the element to move
    const sourcePattern = this.buildSelectorPattern(selector)
    const sourceMatch = sourcePattern.exec(html)

    if (!sourceMatch) {
      console.warn(
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
      switch (position) {
        case 'before':
          return `${elementToMove}${match}`
        case 'after':
          return `${match}${elementToMove}`
        case 'prepend':
          return `${openTag}${elementToMove}${content}${closeTag}`
        case 'append':
        default:
          return `${openTag}${content}${elementToMove}${closeTag}`
      }
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
