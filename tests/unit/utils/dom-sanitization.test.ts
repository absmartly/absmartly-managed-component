import { describe, it, expect } from 'vitest'
import { sanitizeHTMLContent, sanitizeAttributeValue } from '../../../src/utils/dom-sanitization'

describe('dom-sanitization', () => {
  describe('sanitizeHTMLContent', () => {
    it('should remove script tags', () => {
      const html = '<div>Hello</div><script>alert("xss")</script><p>World</p>'
      const result = sanitizeHTMLContent(html)

      expect(result).not.toContain('<script')
      expect(result).not.toContain('alert')
      expect(result).toContain('<div>Hello</div>')
      expect(result).toContain('<p>World</p>')
    })

    it('should remove dangerous event handlers', () => {
      const testCases = [
        '<div onclick="alert(1)">Test</div>',
        '<img onerror="alert(1)" src="x">',
        '<body onload="alert(1)">Test</body>',
        '<div onmouseover="alert(1)">Test</div>',
      ]

      for (const html of testCases) {
        const result = sanitizeHTMLContent(html)
        expect(result).not.toMatch(/on(click|error|load|mouseover)=/i)
      }
    })

    it('should block javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitizeHTMLContent(html)

      expect(result).not.toContain('javascript:')
    })

    it('should block data:text/html URLs via regex post-processing', () => {
      const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
      const result = sanitizeHTMLContent(html)

      // The regex post-processing removes data:text/html URLs
      expect(result).not.toContain('data:text/html')
    })

    it('should allow safe HTML tags', () => {
      const html = '<div><p>Hello <strong>World</strong></p><ul><li>Item</li></ul></div>'
      const result = sanitizeHTMLContent(html)

      expect(result).toContain('<div>')
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>')
    })

    it('should preserve allowed attributes', () => {
      const html = '<div class="test" id="main" data-value="123">Content</div>'
      const result = sanitizeHTMLContent(html)

      expect(result).toContain('class="test"')
      expect(result).toContain('id="main"')
      expect(result).toContain('data-value="123"')
    })

    it('should handle empty string', () => {
      const result = sanitizeHTMLContent('')
      expect(result).toBe('')
    })

    it('should handle plain text', () => {
      const result = sanitizeHTMLContent('Just plain text')
      expect(result).toBe('Just plain text')
    })

    it('should remove object and link tags', () => {
      const html = '<div>Test</div><object data="evil.swf"></object><link rel="import" href="evil.html">'
      const result = sanitizeHTMLContent(html)

      expect(result).not.toContain('<object')
      expect(result).not.toContain('<link')
      expect(result).toContain('<div>Test</div>')
    })
  })

  describe('sanitizeAttributeValue', () => {
    it('should block javascript: protocol in href', () => {
      const result = sanitizeAttributeValue('href', 'javascript:alert(1)')
      expect(result).toBe('')
    })

    it('should block data: protocol in src', () => {
      const result = sanitizeAttributeValue('src', 'data:text/html,<script>alert(1)</script>')
      expect(result).toBe('')
    })

    it('should block vbscript: protocol', () => {
      const result = sanitizeAttributeValue('href', 'vbscript:msgbox(1)')
      expect(result).toBe('')
    })

    it('should block event handler attributes', () => {
      const handlers = ['onclick', 'onerror', 'onload', 'onmouseover']
      
      for (const handler of handlers) {
        const result = sanitizeAttributeValue(handler, 'alert(1)')
        expect(result).toBe('')
      }
    })

    it('should allow safe href URLs', () => {
      const urls = [
        'https://example.com',
        'http://example.com',
        'mailto:test@example.com',
        '/relative/path',
        '#anchor',
      ]

      for (const url of urls) {
        const result = sanitizeAttributeValue('href', url)
        expect(result).toBe(url)
      }
    })

    it('should allow safe attributes', () => {
      expect(sanitizeAttributeValue('class', 'btn btn-primary')).toBe('btn btn-primary')
      expect(sanitizeAttributeValue('id', 'main-content')).toBe('main-content')
      expect(sanitizeAttributeValue('data-value', '123')).toBe('123')
      expect(sanitizeAttributeValue('aria-label', 'Close')).toBe('Close')
    })

    it('should handle case-insensitive protocols', () => {
      expect(sanitizeAttributeValue('href', 'JAVASCRIPT:alert(1)')).toBe('')
      expect(sanitizeAttributeValue('href', 'JavaScript:alert(1)')).toBe('')
      expect(sanitizeAttributeValue('href', 'DATA:text/html,x')).toBe('')
    })

    it('should handle protocols with whitespace', () => {
      expect(sanitizeAttributeValue('href', '  javascript:alert(1)')).toBe('')
      expect(sanitizeAttributeValue('href', '\tjavascript:alert(1)')).toBe('')
    })
  })
})
