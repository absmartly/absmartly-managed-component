import { describe, it, expect, vi } from 'vitest'
import { HTMLParserLinkedom } from '../../../src/webcm/html-parser-linkedom'
import { DOMChange } from '../../../src/types'

describe('HTMLParserLinkedom - XSS Security', () => {
  const mockLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  describe('HTML sanitization', () => {
    it('should sanitize script tags in innerHTML', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<img src=x onerror=alert(1)><script>alert("XSS")</script>Hello'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
      expect(result).toContain('Hello')
    })

    it('should sanitize event handlers in HTML', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<div onclick="malicious()">Click me</div>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('onclick')
      expect(result).not.toContain('malicious()')
      expect(result).toContain('Click me')
    })

    it('should sanitize javascript: URLs in HTML', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<a href="javascript:alert(1)">Click</a>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('javascript:')
      expect(result).toContain('Click')
    })

    it('should allow safe HTML elements and attributes', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<p class="safe" style="color: red;">Safe <strong>content</strong></p>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('<p')
      expect(result).toContain('class="safe"')
      expect(result).toContain('style="color: red;"')
      expect(result).toContain('<strong>')
      expect(result).toContain('Safe')
      expect(result).toContain('content')
    })

    it('should sanitize SVG-based XSS attacks', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<svg onload=alert(1)><script>alert("XSS")</script></svg>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('onload')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should sanitize dangerous content in data: URLs', () => {
      const html = '<div id="test">Safe content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<img src="data:text/html,<script>alert(1)</script>">'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should sanitize HTML in createElement', () => {
      const html = '<div id="parent">Parent</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#parent',
          type: 'create',
          value: {
            tag: 'div',
            html: '<script>alert("XSS")</script><p>Safe content</p>'
          },
          position: 'append'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('<p>Safe content</p>')
    })
  })

  describe('Attribute sanitization', () => {
    it('should block javascript: protocol in href attributes', () => {
      const html = '<a id="link" href="https://safe.com">Link</a>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#link',
          type: 'attribute',
          name: 'href',
          value: 'javascript:alert(1)'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('javascript:')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Blocked dangerous protocol'),
        expect.any(String),
        expect.any(String)
      )
    })

    it('should block vbscript: protocol in href attributes', () => {
      const html = '<a id="link" href="https://safe.com">Link</a>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#link',
          type: 'attribute',
          name: 'href',
          value: 'vbscript:msgbox(1)'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('vbscript:')
    })

    it('should block data: protocol in src attributes', () => {
      const html = '<img id="img" src="safe.jpg">'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#img',
          type: 'attribute',
          name: 'src',
          value: 'data:text/html,<script>alert(1)</script>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('data:text/html')
    })

    it('should block event handler attributes (onclick)', () => {
      const html = '<button id="btn">Click</button>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#btn',
          type: 'attribute',
          name: 'onclick',
          value: 'alert(1)'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('onclick')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Blocked event handler attribute'),
        expect.any(String)
      )
    })

    it('should block event handler attributes (onload)', () => {
      const html = '<img id="img" src="safe.jpg">'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#img',
          type: 'attribute',
          name: 'onload',
          value: 'alert(1)'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('onload')
    })

    it('should allow safe href URLs', () => {
      const html = '<a id="link" href="#">Link</a>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#link',
          type: 'attribute',
          name: 'href',
          value: 'https://www.example.com/safe'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('href="https://www.example.com/safe"')
    })

    it('should allow safe src URLs', () => {
      const html = '<img id="img" src="old.jpg">'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#img',
          type: 'attribute',
          name: 'src',
          value: 'https://cdn.example.com/image.jpg'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('src="https://cdn.example.com/image.jpg"')
    })

    it('should allow safe data attributes', () => {
      const html = '<div id="elem">Content</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#elem',
          type: 'attribute',
          name: 'data-value',
          value: '123'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('data-value="123"')
    })

    it('should sanitize attributes in createElement', () => {
      const html = '<div id="parent">Parent</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#parent',
          type: 'create',
          value: {
            tag: 'a',
            attributes: {
              href: 'javascript:alert(1)',
              onclick: 'malicious()',
              'data-safe': 'value'
            }
          },
          position: 'append'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('onclick')
      expect(result).toContain('data-safe="value"')
    })
  })

  describe('XSS attack vectors', () => {
    it('should block case variation attacks (JavaScript:)', () => {
      const html = '<a id="link" href="#">Link</a>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#link',
          type: 'attribute',
          name: 'href',
          value: 'JaVaScRiPt:alert(1)'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result.toLowerCase()).not.toContain('javascript:')
    })

    it('should block whitespace variation attacks', () => {
      const html = '<a id="link" href="#">Link</a>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#link',
          type: 'attribute',
          name: 'href',
          value: '  javascript:alert(1)  '
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('javascript:')
    })

    it('should sanitize nested XSS attempts in HTML', () => {
      const html = '<div id="test">Safe</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<div><div><script>alert(1)</script></div></div>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should handle encoded script attempts', () => {
      const html = '<div id="test">Safe</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).not.toContain('onerror')
    })
  })

  describe('Functional tests with sanitization', () => {
    it('should still support safe HTML changes', () => {
      const html = '<div id="test">Original</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'html',
          value: '<h1>New Title</h1><p>New paragraph</p>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('<h1>New Title</h1>')
      expect(result).toContain('<p>New paragraph</p>')
    })

    it('should still support text changes', () => {
      const html = '<div id="test">Original</div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#test',
          type: 'text',
          value: '<script>alert(1)</script>'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('&lt;script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('should support multiple safe changes', () => {
      const html = '<div id="container"><div id="a">A</div><div id="b">B</div></div>'
      const parser = new HTMLParserLinkedom(html, mockLogger)

      const changes: DOMChange[] = [
        {
          selector: '#a',
          type: 'html',
          value: '<span>Safe A</span>'
        },
        {
          selector: '#b',
          type: 'attribute',
          name: 'class',
          value: 'safe-class'
        }
      ]

      const result = parser.applyChanges(changes)

      expect(result).toContain('<span>Safe A</span>')
      expect(result).toContain('class="safe-class"')
    })
  })
})
