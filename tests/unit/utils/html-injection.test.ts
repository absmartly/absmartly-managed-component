import { describe, it, expect } from 'vitest'
import { injectIntoHTML } from '../../../src/utils/html-injection'

describe('html-injection', () => {
  describe('injectIntoHTML', () => {
    describe('injection before </head>', () => {
      it('should inject content before </head> tag', () => {
        const html = '<html><head><title>Test</title></head><body></body></html>'
        const content = '<script src="test.js"></script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<script src="test.js"></script></head>')
        expect(result.indexOf(content)).toBeLessThan(result.indexOf('</head>'))
      })

      it('should preserve existing head content', () => {
        const html = '<html><head><title>Test</title><meta charset="utf-8"></head><body></body></html>'
        const content = '<link rel="stylesheet" href="style.css">'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<title>Test</title>')
        expect(result).toContain('<meta charset="utf-8">')
        expect(result).toContain(content)
      })

      it('should inject multiple times on repeated calls', () => {
        const html = '<html><head></head><body></body></html>'
        const content1 = '<script>console.log(1)</script>'
        const content2 = '<script>console.log(2)</script>'
        
        const result1 = injectIntoHTML(html, content1)
        const result2 = injectIntoHTML(result1, content2)

        expect(result2).toContain(content1)
        expect(result2).toContain(content2)
      })

      it('should prefer </head> over </body>', () => {
        const html = '<html><head></head><body></body></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        const headCloseIndex = result.indexOf('</head>')
        const contentIndex = result.indexOf(content)
        const bodyCloseIndex = result.indexOf('</body>')

        expect(contentIndex).toBeLessThan(headCloseIndex)
        expect(contentIndex).toBeLessThan(bodyCloseIndex)
      })

      it('should handle case-sensitive </head>', () => {
        const html = '<html><head></head><body></body></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain(content + '</head>')
      })
    })

    describe('injection before </body>', () => {
      it('should inject content before </body> when no </head>', () => {
        const html = '<html><body><div>Content</div></body></html>'
        const content = '<script>console.log("test")</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<script>console.log("test")</script></body>')
        expect(result.indexOf(content)).toBeLessThan(result.indexOf('</body>'))
      })

      it('should preserve existing body content', () => {
        const html = '<html><body><h1>Title</h1><p>Paragraph</p></body></html>'
        const content = '<script>init()</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<h1>Title</h1>')
        expect(result).toContain('<p>Paragraph</p>')
        expect(result).toContain(content)
      })

      it('should inject before closing body tag', () => {
        const html = '<body><div>Test</div></body>'
        const content = '<div id="injected">Injected</div>'
        const result = injectIntoHTML(html, content)

        const injectedIndex = result.indexOf(content)
        const bodyCloseIndex = result.indexOf('</body>')

        expect(injectedIndex).toBeLessThan(bodyCloseIndex)
        expect(injectedIndex).toBeGreaterThan(result.indexOf('<div>Test</div>'))
      })
    })

    describe('append when no closing tags', () => {
      it('should append content when no </head> or </body>', () => {
        const html = '<html><div>Content</div></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toBe(html + content)
        expect(result.endsWith(content)).toBe(true)
      })

      it('should append to empty HTML', () => {
        const html = ''
        const content = '<div>Test</div>'
        const result = injectIntoHTML(html, content)

        expect(result).toBe(content)
      })

      it('should append to plain text', () => {
        const html = 'Plain text content'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toBe(html + content)
      })

      it('should append to fragment without closing tags', () => {
        const html = '<div><span>Test</span><p>Content</p>'
        const content = '<div>Injected</div>'
        const result = injectIntoHTML(html, content)

        expect(result).toBe(html + content)
      })
    })

    describe('complex HTML structures', () => {
      it('should handle complete HTML document', () => {
        const html = `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Test Page</title>
            </head>
            <body>
              <h1>Hello World</h1>
            </body>
          </html>
        `
        const content = '<script src="analytics.js"></script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain(content + '</head>')
      })

      it('should handle HTML with multiple head and body tags', () => {
        // Only replaces first occurrence
        const html = '<head></head><body></body><head></head>'
        const content = 'X'
        const result = injectIntoHTML(html, content)

        expect(result).toBe('<head>X</head><body></body><head></head>')
      })

      it('should handle nested tags before injection point', () => {
        const html = '<html><head><style>.test { color: red; }</style></head><body></body></html>'
        const content = '<link rel="stylesheet" href="app.css">'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<style>.test { color: red; }</style>')
        expect(result).toContain(content)
      })
    })

    describe('edge cases', () => {
      it('should handle empty content', () => {
        const html = '<html><head></head><body></body></html>'
        const content = ''
        const result = injectIntoHTML(html, content)

        expect(result).toBe('<html><head></head><body></body></html>')
      })

      it('should handle very long HTML', () => {
        const longContent = 'x'.repeat(10000)
        const html = `<html><head></head><body>${longContent}</body></html>`
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain(content)
        expect(result).toContain(longContent)
      })

      it('should handle special characters in content', () => {
        const html = '<html><head></head><body></body></html>'
        const content = '<script>alert("Test & \' < > \\n")</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain(content)
      })

      it('should handle HTML entities', () => {
        const html = '<html><head></head><body>&lt;div&gt;</body></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('&lt;div&gt;')
        expect(result).toContain(content)
      })

      it('should handle self-closing tags in content', () => {
        const html = '<html><head></head><body></body></html>'
        const content = '<meta name="test" content="value" />'
        const result = injectIntoHTML(html, content)

        expect(result).toContain(content)
      })

      it('should handle malformed HTML', () => {
        const html = '<html><head><body>Mixed tags</body></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        expect(result).toBeDefined()
        expect(result).toContain(content)
      })

      it('should handle uppercase tags', () => {
        const html = '<HTML><HEAD></HEAD><BODY></BODY></HTML>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        // Should not match uppercase tags
        expect(result).toBe(html + content)
      })

      it('should handle mixed case tags', () => {
        const html = '<html><Head></Head><Body></Body></html>'
        const content = '<script>test</script>'
        const result = injectIntoHTML(html, content)

        // Should not match mixed case
        expect(result).toBe(html + content)
      })
    })

    describe('practical use cases', () => {
      it('should inject analytics script before </head>', () => {
        const html = '<html><head><title>My Site</title></head><body><h1>Hello</h1></body></html>'
        const content = `
          <script>
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-XXXX');
          </script>
        `
        const result = injectIntoHTML(html, content)

        expect(result).toContain('gtm.js')
        expect(result.indexOf(content)).toBeLessThan(result.indexOf('</head>'))
      })

      it('should inject stylesheet link before </head>', () => {
        const html = '<html><head></head><body></body></html>'
        const content = '<link rel="stylesheet" href="https://cdn.example.com/styles.css">'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('<link rel="stylesheet"')
        expect(result.indexOf(content)).toBeLessThan(result.indexOf('</head>'))
      })

      it('should inject defer script before </body>', () => {
        const html = '<html><body><div id="app"></div></body></html>'
        const content = '<script src="bundle.js" defer></script>'
        const result = injectIntoHTML(html, content)

        expect(result).toContain('bundle.js')
        expect(result.indexOf(content)).toBeLessThan(result.indexOf('</body>'))
      })

      it('should inject multiple scripts in sequence', () => {
        let html = '<html><head></head><body></body></html>'
        const scripts = [
          '<script src="vendor.js"></script>',
          '<script src="app.js"></script>',
          '<script src="analytics.js"></script>',
        ]

        for (const script of scripts) {
          html = injectIntoHTML(html, script)
        }

        scripts.forEach(script => {
          expect(html).toContain(script)
        })
      })
    })
  })
})
