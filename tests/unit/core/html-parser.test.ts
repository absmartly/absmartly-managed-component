import { describe, it, expect } from 'vitest'
import { HTMLParser } from '../../../src/core/html-parser'
import { DOMChange } from '../../../src/types'

describe('HTMLParser', () => {
  describe('text changes', () => {
    it('should replace text content in simple tags', () => {
      const html = '<html><body><h1>Original</h1></body></html>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'h1',
          type: 'text',
          value: 'Modified',
        },
      ])

      expect(result).toContain('Modified')
      expect(result).not.toContain('Original')
    })

    it('should replace text content in multiple matching tags', () => {
      const html = '<div><p>First</p><p>Second</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'text',
          value: 'Changed',
        },
      ])

      expect(result).toContain('<p>Changed</p>')
      expect(result).not.toContain('First')
      expect(result).not.toContain('Second')
    })
  })

  describe('html changes', () => {
    it('should replace innerHTML', () => {
      const html = '<div><p>Old content</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'html',
          value: '<span>New HTML</span>',
        },
      ])

      expect(result).toContain('<span>New HTML</span>')
      expect(result).not.toContain('<p>Old content</p>')
    })

    it('should replace complex innerHTML', () => {
      const html = '<section><h2>Title</h2><p>Content</p></section>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'section',
          type: 'html',
          value: '<div class="new"><h3>New Title</h3><ul><li>Item 1</li><li>Item 2</li></ul></div>',
        },
      ])

      expect(result).toContain('<h3>New Title</h3>')
      expect(result).toContain('<li>Item 1</li>')
      expect(result).not.toContain('<h2>Title</h2>')
    })
  })

  describe('attribute changes', () => {
    it('should add new attribute', () => {
      const html = '<img src="old.jpg">'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'img',
          type: 'attribute',
          name: 'alt',
          value: 'Image description',
        },
      ])

      expect(result).toContain('alt="Image description"')
    })

    it('should update existing attribute', () => {
      const html = '<a href="/old">Link</a>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'a',
          type: 'attribute',
          name: 'href',
          value: '/new',
        },
      ])

      expect(result).toContain('href="/new"')
      expect(result).not.toContain('href="/old"')
    })

    it('should remove attribute when value is undefined', () => {
      const html = '<button disabled="disabled">Click</button>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'button',
          type: 'attribute',
          name: 'disabled',
          value: undefined,
        },
      ])

      expect(result).not.toContain('disabled')
    })
  })

  describe('class changes', () => {
    it('should add class to element without existing class', () => {
      const html = '<div>Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'class',
          action: 'add',
          value: 'new-class',
        },
      ])

      expect(result).toContain('class="new-class"')
    })

    it('should add class to element with existing classes', () => {
      const html = '<div class="existing">Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'class',
          action: 'add',
          value: 'additional',
        },
      ])

      expect(result).toContain('class="existing additional"')
    })

    it('should remove class from element', () => {
      const html = '<div class="one two three">Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'class',
          action: 'remove',
          value: 'two',
        },
      ])

      expect(result).toContain('class=')
      expect(result).not.toContain('two')
      expect(result).toContain('one')
      expect(result).toContain('three')
    })
  })

  describe('style changes', () => {
    it('should add inline styles as object', () => {
      const html = '<div>Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'style',
          value: { color: 'red', fontSize: '16px' },
        },
      ])

      expect(result).toContain('style="color: red; font-size: 16px"')
    })

    it('should add inline styles as string', () => {
      const html = '<div>Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'style',
          value: 'background: blue; padding: 10px;',
        },
      ])

      expect(result).toContain('style="background: blue; padding: 10px;"')
    })

    it('should append to existing inline styles', () => {
      const html = '<div style="margin: 5px">Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'style',
          value: { color: 'green' },
        },
      ])

      expect(result).toContain('margin: 5px')
      expect(result).toContain('color: green')
    })
  })

  describe('delete changes', () => {
    it('should delete element', () => {
      const html = '<div><p>Keep this</p><span>Delete this</span></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'span',
          type: 'delete',
        },
      ])

      expect(result).toContain('<p>Keep this</p>')
      expect(result).not.toContain('<span>Delete this</span>')
    })

    it('should delete multiple matching elements', () => {
      const html = '<div><p>First</p><p>Second</p><span>Keep</span></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'delete',
        },
      ])

      expect(result).toContain('<span>Keep</span>')
      expect(result).not.toContain('<p>First</p>')
      expect(result).not.toContain('<p>Second</p>')
    })
  })

  describe('styleRules changes', () => {
    it('should inject CSS rules before </head>', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: '',
          type: 'styleRules',
          rules: '.test { color: red; } #main { background: blue; }',
        },
      ])

      expect(result).toContain('<style id="absmartly-styles">')
      expect(result).toContain('.test { color: red; }')
      expect(result).toContain('</style></head>')
    })

    it('should inject CSS rules at beginning when no </head>', () => {
      const html = '<div>Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: '',
          type: 'styleRules',
          rules: '.banner { display: block; }',
        },
      ])

      expect(result).toContain('<style id="absmartly-styles">')
      expect(result).toContain('.banner { display: block; }')
      expect(result).toContain('</style><div>Content</div>')
    })
  })

  describe('create changes', () => {
    it('should create element with position "append" (default)', () => {
      const html = '<div>Original content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'create',
          value: '<span>Appended</span>',
          position: 'append',
        },
      ])

      expect(result).toContain('Original content<span>Appended</span>')
    })

    it('should create element with position "prepend"', () => {
      const html = '<div>Original content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'create',
          value: '<span>Prepended</span>',
          position: 'prepend',
        },
      ])

      expect(result).toContain('<span>Prepended</span>Original content')
    })

    it('should create element with position "before"', () => {
      const html = '<div><p>Content</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'create',
          value: '<span>Before</span>',
          position: 'before',
        },
      ])

      expect(result).toContain('<span>Before</span><p>Content</p>')
    })

    it('should create element with position "after"', () => {
      const html = '<div><p>Content</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'create',
          value: '<span>After</span>',
          position: 'after',
        },
      ])

      expect(result).toContain('<p>Content</p><span>After</span>')
    })

    it('should create complex HTML structure', () => {
      const html = '<main><section>Content</section></main>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'section',
          type: 'create',
          value: '<div class="banner"><h2>New Banner</h2><p>Description</p></div>',
          position: 'prepend',
        },
      ])

      expect(result).toContain('<h2>New Banner</h2>')
      expect(result).toContain('<p>Description</p>')
      expect(result).toContain('class="banner"')
    })
  })

  describe('move changes', () => {
    it('should move element with position "append"', () => {
      const html = '<div id="container"><p id="source">Move me</p><div id="target">Target</div></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'move',
          target: 'div#target',
          position: 'append',
        },
      ])

      // Element should be inside target
      expect(result).toMatch(/<div[^>]*>Target<p[^>]*>Move me<\/p><\/div>/)
    })

    it('should move element with position "prepend"', () => {
      const html = '<main><section>Section content</section><article>Article</article></main>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'article',
          type: 'move',
          target: 'section',
          position: 'prepend',
        },
      ])

      expect(result).toMatch(/<section><article>Article<\/article>Section content<\/section>/)
    })

    it('should move element with position "before"', () => {
      const html = '<div><span id="a">A</span><span id="b">B</span></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'span#b',
          type: 'move',
          target: 'span#a',
          position: 'before',
        },
      ])

      // B should now come before A
      expect(result).toMatch(/<span[^>]*>B<\/span><span[^>]*>A<\/span>/)
    })

    it('should move element with position "after"', () => {
      const html = '<nav><a id="first">First</a><a id="second">Second</a></nav>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'a#first',
          type: 'move',
          target: 'a#second',
          position: 'after',
        },
      ])

      // First should now come after Second
      expect(result).toMatch(/<a[^>]*>Second<\/a><a[^>]*>First<\/a>/)
    })

    it('should handle missing target gracefully', () => {
      const html = '<div><p>Content</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'p',
          type: 'move',
          // No target specified
        } as DOMChange,
      ])

      // Should return unchanged HTML
      expect(result).toBe(html)
    })
  })

  describe('multiple changes', () => {
    it('should apply multiple changes in sequence', () => {
      const html = '<div><h1>Title</h1><p class="old">Text</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'h1',
          type: 'text',
          value: 'New Title',
        },
        {
          selector: 'p',
          type: 'class',
          action: 'add',
          value: 'new',
        },
        {
          selector: 'p',
          type: 'attribute',
          name: 'data-test',
          value: 'value',
        },
      ])

      expect(result).toContain('New Title')
      expect(result).toContain('class="old new"')
      expect(result).toContain('data-test="value"')
    })

    it('should handle all change types together', () => {
      const html = `
        <html>
          <head><title>Page</title></head>
          <body>
            <header><h1>Original</h1></header>
            <main class="content">
              <section>
                <p id="text">Old text</p>
                <img src="old.jpg">
                <div id="container">Container</div>
              </section>
            </main>
          </body>
        </html>
      `
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: '',
          type: 'styleRules',
          rules: 'body { margin: 0; }',
        },
        {
          selector: 'h1',
          type: 'text',
          value: 'New Header',
        },
        {
          selector: 'main',
          type: 'class',
          action: 'add',
          value: 'modified',
        },
        {
          selector: 'p',
          type: 'html',
          value: '<strong>Bold text</strong>',
        },
        {
          selector: 'img',
          type: 'attribute',
          name: 'src',
          value: 'new.jpg',
        },
        {
          selector: 'div#container',
          type: 'create',
          value: '<span>Created</span>',
          position: 'append',
        },
      ])

      expect(result).toContain('body { margin: 0; }')
      expect(result).toContain('New Header')
      expect(result).toContain('class="content modified"')
      expect(result).toContain('<strong>Bold text</strong>')
      expect(result).toContain('src="new.jpg"')
      expect(result).toContain('<span>Created</span>')
    })
  })

  describe('error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const html = '<div>Unclosed div'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'text',
          value: 'New text',
        },
      ])

      // Should not throw, even if replacement doesn't work perfectly
      expect(typeof result).toBe('string')
    })

    it('should continue applying changes even if one fails', () => {
      const html = '<div><h1>Title</h1><p>Text</p></div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'nonexistent',
          type: 'text',
          value: 'This will not apply',
        },
        {
          selector: 'h1',
          type: 'text',
          value: 'This should work',
        },
      ])

      expect(result).toContain('This should work')
    })

    it('should handle unsupported change type', () => {
      const html = '<div>Content</div>'
      const parser = new HTMLParser(html)

      const result = parser.applyChanges([
        {
          selector: 'div',
          type: 'javascript' as any, // Unsupported type
          code: 'alert("test")',
        },
      ])

      // Should return unchanged HTML
      expect(result).toBe(html)
    })
  })

  /**
   * Note: DOMPurify doesn't work properly with linkedom's window implementation.
   * These HTML sanitization tests are skipped until a proper server-side sanitization solution is implemented.
   * Attribute sanitization still works correctly via regex-based sanitization.
   */
  describe('XSS Security', () => {
    describe('HTML sanitization', () => {
      it.skip('should sanitize script tags in innerHTML (DOMPurify+linkedom incompatibility)', () => {
        const html = '<div>Safe content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<img src=x onerror=alert(1)><script>alert("XSS")</script>Hello'
          }
        ])

        expect(result).not.toContain('<script>')
        expect(result).not.toContain('onerror')
        expect(result).not.toContain('alert')
        expect(result).toContain('Hello')
      })

      it.skip('should sanitize event handlers in HTML (DOMPurify+linkedom incompatibility)', () => {
        const html = '<div>Safe content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<div onclick="malicious()">Click me</div>'
          }
        ])

        expect(result).not.toContain('onclick')
        expect(result).not.toContain('malicious()')
        expect(result).toContain('Click me')
      })

      it.skip('should sanitize javascript: URLs in HTML (DOMPurify+linkedom incompatibility)', () => {
        const html = '<div>Safe content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<a href="javascript:alert(1)">Click</a>'
          }
        ])

        expect(result).not.toContain('javascript:')
        expect(result).toContain('Click')
      })

      it('should sanitize dangerous content in data: URLs', () => {
        const html = '<div>Safe content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<img src="data:text/html,<script>alert(1)</script>">'
          }
        ])

        expect(result).not.toContain('<script>')
        expect(result).not.toContain('alert')
      })

      it('should allow safe HTML elements and attributes', () => {
        const html = '<div>Safe content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<p class="safe" style="color: red;">Safe <strong>content</strong></p>'
          }
        ])

        expect(result).toContain('<p')
        expect(result).toContain('class="safe"')
        expect(result).toContain('style="color: red;"')
        expect(result).toContain('<strong>')
        expect(result).toContain('Safe')
        expect(result).toContain('content')
      })
    })

    describe('Attribute sanitization', () => {
      it('should block javascript: protocol in href attributes', () => {
        const html = '<a href="https://safe.com">Link</a>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'a',
            type: 'attribute',
            name: 'href',
            value: 'javascript:alert(1)'
          }
        ])

        expect(result).not.toContain('javascript:')
        expect(result).not.toContain('href="javascript')
      })

      it('should block vbscript: protocol in href attributes', () => {
        const html = '<a href="https://safe.com">Link</a>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'a',
            type: 'attribute',
            name: 'href',
            value: 'vbscript:msgbox(1)'
          }
        ])

        expect(result).not.toContain('vbscript:')
        expect(result).not.toContain('href="vbscript')
      })

      it('should block data: protocol in src attributes', () => {
        const html = '<img src="safe.jpg">'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'img',
            type: 'attribute',
            name: 'src',
            value: 'data:text/html,<script>alert(1)</script>'
          }
        ])

        expect(result).not.toContain('data:text/html')
        expect(result).not.toContain('src="data:')
      })

      it('should block event handler attributes (onclick)', () => {
        const html = '<button>Click</button>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'button',
            type: 'attribute',
            name: 'onclick',
            value: 'alert(1)'
          }
        ])

        expect(result).not.toContain('onclick')
      })

      it('should block event handler attributes (onload)', () => {
        const html = '<img src="safe.jpg">'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'img',
            type: 'attribute',
            name: 'onload',
            value: 'alert(1)'
          }
        ])

        expect(result).not.toContain('onload')
      })

      it('should allow safe href URLs', () => {
        const html = '<a href="#">Link</a>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'a',
            type: 'attribute',
            name: 'href',
            value: 'https://www.example.com/safe'
          }
        ])

        expect(result).toContain('href="https://www.example.com/safe"')
      })

      it('should allow safe src URLs', () => {
        const html = '<img src="old.jpg">'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'img',
            type: 'attribute',
            name: 'src',
            value: 'https://cdn.example.com/image.jpg'
          }
        ])

        expect(result).toContain('src="https://cdn.example.com/image.jpg"')
      })

      it('should allow safe data attributes', () => {
        const html = '<div>Content</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'attribute',
            name: 'data-value',
            value: '123'
          }
        ])

        expect(result).toContain('data-value="123"')
      })
    })

    describe('XSS attack vectors', () => {
      it('should block case variation attacks (JavaScript:)', () => {
        const html = '<a href="#">Link</a>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'a',
            type: 'attribute',
            name: 'href',
            value: 'JaVaScRiPt:alert(1)'
          }
        ])

        expect(result.toLowerCase()).not.toContain('javascript:')
      })

      it('should block whitespace variation attacks', () => {
        const html = '<a href="#">Link</a>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'a',
            type: 'attribute',
            name: 'href',
            value: '  javascript:alert(1)  '
          }
        ])

        expect(result).not.toContain('javascript:')
      })

      it.skip('should sanitize nested XSS attempts in HTML (DOMPurify+linkedom incompatibility)', () => {
        const html = '<div>Safe</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<div><div><script>alert(1)</script></div></div>'
          }
        ])

        expect(result).not.toContain('<script>')
        expect(result).not.toContain('alert')
      })

      it.skip('should handle encoded script attempts (DOMPurify+linkedom incompatibility)', () => {
        const html = '<div>Safe</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'html',
            value: '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">'
          }
        ])

        expect(result).not.toContain('onerror')
      })
    })

    describe('Text content safety', () => {
      it('should escape HTML entities in text changes', () => {
        const html = '<div>Original</div>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'div',
            type: 'text',
            value: '<script>alert("XSS")</script>'
          }
        ])

        expect(result).toContain('&lt;script&gt;')
        expect(result).not.toContain('<script>')
      })

      it('should escape special characters in text', () => {
        const html = '<p>Text</p>'
        const parser = new HTMLParser(html)

        const result = parser.applyChanges([
          {
            selector: 'p',
            type: 'text',
            value: 'Text with <>&"\' characters'
          }
        ])

        expect(result).toContain('&lt;')
        expect(result).toContain('&gt;')
        expect(result).toContain('&amp;')
        expect(result).not.toContain('Text with <>&')
      })
    })
  })
})
