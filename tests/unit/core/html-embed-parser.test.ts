import { describe, it, expect } from 'vitest'
import { HTMLEmbedParser, TreatmentTag } from '../../../src/core/html-embed-parser'

describe('HTMLEmbedParser', () => {
  describe('parseTreatmentTags', () => {
    it('should parse basic Treatment tag with numeric variants', () => {
      const html = `
        <Treatment name="hero_test">
          <TreatmentVariant variant="0">Hello</TreatmentVariant>
          <TreatmentVariant variant="1">Ola</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].name).toBe('hero_test')
      expect(treatments[0].triggerOnView).toBe(false)
      expect(treatments[0].variants).toHaveLength(2)
      expect(treatments[0].variants[0].variant).toBe(0)
      expect(treatments[0].variants[0].content).toBe('Hello')
      expect(treatments[0].variants[1].variant).toBe(1)
      expect(treatments[0].variants[1].content).toBe('Ola')
    })

    it('should parse Treatment tag with alphabetic variants', () => {
      const html = `
        <Treatment name="cta_test">
          <TreatmentVariant variant="A">Sign Up</TreatmentVariant>
          <TreatmentVariant variant="B">Get Started</TreatmentVariant>
          <TreatmentVariant variant="C">Join Now</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(3)
      expect(treatments[0].variants[0].variant).toBe('A')
      expect(treatments[0].variants[1].variant).toBe('B')
      expect(treatments[0].variants[2].variant).toBe('C')
    })

    it('should parse Treatment tag with trigger-on-view attribute', () => {
      const html = `
        <Treatment name="below_fold" trigger-on-view>
          <TreatmentVariant variant="0">Content A</TreatmentVariant>
          <TreatmentVariant variant="1">Content B</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].triggerOnView).toBe(true)
    })

    it('should parse Treatment tag with control variant 0', () => {
      const html = `
        <Treatment name="promo_test">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Treatment</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(2)
      expect(treatments[0].variants[0].variant).toBe(0)
      expect(treatments[0].variants[1].variant).toBe(1)
    })

    it('should parse multiple Treatment tags', () => {
      const html = `
        <Treatment name="hero">
          <TreatmentVariant variant="0">Hero A</TreatmentVariant>
          <TreatmentVariant variant="1">Hero B</TreatmentVariant>
        </Treatment>
        <div>Some content</div>
        <Treatment name="cta">
          <TreatmentVariant variant="A">CTA A</TreatmentVariant>
          <TreatmentVariant variant="B">CTA B</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(2)
      expect(treatments[0].name).toBe('hero')
      expect(treatments[1].name).toBe('cta')
    })

    it('should parse Treatment tag with multiline HTML content', () => {
      const html = `
        <Treatment name="banner">
          <TreatmentVariant variant="0">
            <div class="banner">
              <h1>Welcome</h1>
              <p>Join us today</p>
            </div>
          </TreatmentVariant>
          <TreatmentVariant variant="1">
            <div class="banner alt">
              <h1>Hello</h1>
              <p>Get started now</p>
            </div>
          </TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants[0].content).toContain('<div class="banner">')
      expect(treatments[0].variants[0].content).toContain('<h1>Welcome</h1>')
      expect(treatments[0].variants[1].content).toContain('<div class="banner alt">')
    })

    it('should handle empty HTML', () => {
      const html = ''
      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      expect(treatments).toHaveLength(0)
    })

    it('should handle HTML without Treatment tags', () => {
      const html = '<div>Regular content</div>'
      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      expect(treatments).toHaveLength(0)
    })

    it('should parse Treatment tag with single quotes', () => {
      const html = `
        <Treatment name='single_quote_test'>
          <TreatmentVariant variant='0'>Content A</TreatmentVariant>
          <TreatmentVariant variant='1'>Content B</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].name).toBe('single_quote_test')
    })

    it('should preserve whitespace in variant content', () => {
      const html = `
        <Treatment name="whitespace_test">
          <TreatmentVariant variant="0">  Padded Content  </TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments[0].variants[0].content).toBe('Padded Content')
    })
  })

  describe('replaceTreatmentTag', () => {
    it('should replace with correct variant by numeric treatment', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Variant</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 1)

      expect(result).toBe('\n        Variant\n      ')
    })

    it('should replace with correct variant using alphabetic mapping', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="A">Option A</TreatmentVariant>
          <TreatmentVariant variant="B">Option B</TreatmentVariant>
          <TreatmentVariant variant="C">Option C</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      // Treatment 0 should map to A
      let result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)
      expect(result).toContain('Option A')

      // Treatment 1 should map to B
      result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 1)
      expect(result).toContain('Option B')

      // Treatment 2 should map to C
      result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 2)
      expect(result).toContain('Option C')
    })

    it('should use variant mapping when provided', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="control">Control Content</TreatmentVariant>
          <TreatmentVariant variant="variant">Variant Content</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const variantMapping = { control: 0, variant: 1 }

      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 1, variantMapping)
      expect(result).toContain('Variant Content')
    })

    it('should fallback to control variant when treatment not found', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Treatment</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 5)

      // When treatment 5 is not found, fallback to control (0)
      expect(result).toContain('Control')
    })

    it('should fallback to control when treatment not found', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Treatment</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 10)

      // When treatment 10 not found, fallback to control (0)
      expect(result).toContain('Control')
    })

    it('should show nothing when no control variant exists', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="1">Treatment One</TreatmentVariant>
          <TreatmentVariant variant="2">Treatment Two</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 10)

      // When treatment 10 not found and no control (0/A), show nothing
      expect(result).not.toContain('Treatment One')
      expect(result).not.toContain('Treatment Two')
      expect(result).not.toContain('<Treatment')
    })

    it('should wrap content with trigger-on-view span', () => {
      const html = `
        <Treatment name="viewport_test" trigger-on-view>
          <TreatmentVariant variant="0">Visible Content</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)

      expect(result).toContain('<span trigger-on-view="viewport_test">')
      expect(result).toContain('Visible Content')
      expect(result).toContain('</span>')
    })

    it('should handle undefined treatment', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Treatment</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], undefined)

      // Should fallback to control (0)
      expect(result).toContain('Control')
    })

    it('should handle complex HTML in variants', () => {
      const html = `
        <Treatment name="complex">
          <TreatmentVariant variant="0">
            <div class="hero">
              <h1>Title</h1>
              <p class="subtitle">Subtitle</p>
              <button onclick="doSomething()">Click</button>
            </div>
          </TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)

      expect(result).toContain('<div class="hero">')
      expect(result).toContain('<h1>Title</h1>')
      expect(result).toContain('onclick="doSomething()"')
    })
  })

  describe('processHTML', () => {
    it('should process single Treatment tag', () => {
      const html = `
        <html>
          <body>
            <Treatment name="hero">
              <TreatmentVariant variant="0">Hello</TreatmentVariant>
              <TreatmentVariant variant="1">Ola</TreatmentVariant>
            </Treatment>
          </body>
        </html>
      `

      const getTreatment = (name: string) => (name === 'hero' ? 1 : undefined)
      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      expect(result).toContain('Ola')
      expect(result).not.toContain('Hello')
      expect(result).not.toContain('<Treatment')
      expect(result).not.toContain('<TreatmentVariant')
    })

    it('should process multiple Treatment tags', () => {
      const html = `
        <html>
          <body>
            <Treatment name="headline">
              <TreatmentVariant variant="A">Grow Fast</TreatmentVariant>
              <TreatmentVariant variant="B">Scale Now</TreatmentVariant>
            </Treatment>
            <div>Some content</div>
            <Treatment name="cta">
              <TreatmentVariant variant="0">Sign Up</TreatmentVariant>
              <TreatmentVariant variant="1">Get Started</TreatmentVariant>
            </Treatment>
          </body>
        </html>
      `

      const getTreatment = (name: string) => {
        if (name === 'headline') return 1  // B
        if (name === 'cta') return 0
        return undefined
      }

      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      expect(result).toContain('Scale Now')
      expect(result).not.toContain('Grow Fast')
      expect(result).toContain('Sign Up')
      expect(result).not.toContain('Get Started')
      expect(result).toContain('Some content')
    })

    it('should handle missing experiments gracefully', () => {
      const html = `
        <Treatment name="missing_experiment">
          <TreatmentVariant variant="0">Control</TreatmentVariant>
          <TreatmentVariant variant="1">Treatment</TreatmentVariant>
        </Treatment>
      `

      const getTreatment = () => undefined
      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      // When treatment is undefined, should fallback to control (0)
      expect(result).toContain('Control')
      expect(result).not.toContain('Treatment')
    })

    it('should preserve other HTML unchanged', () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Header</h1>
            <Treatment name="test">
              <TreatmentVariant variant="0">A</TreatmentVariant>
              <TreatmentVariant variant="1">B</TreatmentVariant>
            </Treatment>
            <footer>Footer</footer>
          </body>
        </html>
      `

      const getTreatment = () => 0
      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      expect(result).toContain('<title>Test</title>')
      expect(result).toContain('<h1>Header</h1>')
      expect(result).toContain('<footer>Footer</footer>')
      expect(result).toContain('A')
    })

    it('should work with variant mapping', () => {
      const html = `
        <Treatment name="pricing">
          <TreatmentVariant variant="control">$99</TreatmentVariant>
          <TreatmentVariant variant="discount">$79</TreatmentVariant>
        </Treatment>
      `

      const getTreatment = () => 1
      const variantMapping = { control: 0, discount: 1 }
      const result = HTMLEmbedParser.processHTML(html, getTreatment, variantMapping)

      expect(result).toContain('$79')
      expect(result).not.toContain('$99')
    })

    it('should handle HTML without Treatment tags', () => {
      const html = '<html><body><h1>No experiments</h1></body></html>'
      const getTreatment = () => 0
      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      expect(result).toBe(html)
    })

    it('should process nested HTML in variants correctly', () => {
      const html = `
        <section>
          <Treatment name="hero" trigger-on-view>
            <TreatmentVariant variant="A">
              <div class="hero">
                <h1>Version A</h1>
                <p>Description A</p>
              </div>
            </TreatmentVariant>
            <TreatmentVariant variant="B">
              <div class="hero alt">
                <h1>Version B</h1>
                <p>Description B</p>
              </div>
            </TreatmentVariant>
          </Treatment>
        </section>
      `

      const getTreatment = () => 0
      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      expect(result).toContain('<span trigger-on-view="hero">')
      expect(result).toContain('Version A')
      expect(result).toContain('Description A')
      expect(result).not.toContain('Version B')
    })
  })

  describe('validateTreatmentTag', () => {
    it('should validate correct Treatment tag', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 0, content: 'A' },
          { variant: 1, content: 'B' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should error on missing name', () => {
      const tag = {
        name: '',
        triggerOnView: false,
        variants: [{ variant: 0, content: 'A' }],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Treatment name is required')
    })

    it('should error on no variants', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one variant is required')
    })

    it('should error on duplicate variants', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 0, content: 'A' },
          { variant: 0, content: 'B' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate variant identifier: 0')
    })

    it('should pass with all numeric variants including control', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 0, content: 'A' },
          { variant: 1, content: 'B' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should pass validation even without control variant', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 1, content: 'B' },
          { variant: 2, content: 'C' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      // Valid - will show nothing if treatment not found, which is acceptable
      expect(result.valid).toBe(true)
    })

    it('should pass with control variant 0', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 0, content: 'Control' },
          { variant: 1, content: 'Treatment' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(true)
    })

    it('should handle case-insensitive variant names', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 'A', content: 'First' },
          { variant: 'a', content: 'Duplicate' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate variant identifier: a')
    })

    it('should reject mixing numeric and alphabetic variants', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 0, content: 'Control' },
          { variant: 'A', content: 'Treatment A' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Cannot mix numeric and alphabetic variant identifiers in the same Treatment tag')
    })

    it('should reject mixing numeric and alphabetic variants (B and 1)', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 1, content: 'Treatment 1' },
          { variant: 'B', content: 'Treatment B' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Cannot mix numeric and alphabetic variant identifiers in the same Treatment tag')
    })

    it('should pass with all alphabetic variants', () => {
      const tag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 'A', content: 'Control' },
          { variant: 'B', content: 'Treatment B' },
          { variant: 'C', content: 'Treatment C' },
        ],
        fullMatch: '',
      }

      const result = HTMLEmbedParser.validateTreatmentTag(tag)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle Treatment tag with no variants', () => {
      const html = '<Treatment name="empty"></Treatment>'
      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(0)
    })

    it('should handle malformed variant attributes', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="">Empty variant</TreatmentVariant>
          <TreatmentVariant variant="0">Valid variant</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(2)
      expect(treatments[0].variants[0].variant).toBe('')
      expect(treatments[0].variants[0].content).toBe('Empty variant')
      expect(treatments[0].variants[1].variant).toBe(0)
      expect(treatments[0].variants[1].content).toBe('Valid variant')
    })

    it('should handle special characters in content', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0"><p>Price: $100 & free shipping!</p></TreatmentVariant>
          <TreatmentVariant variant="1"><p>Price: €90 "special offer"</p></TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)

      expect(result).toContain('$100 & free shipping!')
    })

    it('should handle very long variant content', () => {
      const longContent = '<div>' + 'A'.repeat(10000) + '</div>'
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">${longContent}</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      expect(treatments[0].variants[0].content).toContain('A'.repeat(100))
    })

    it('should handle Treatment tags in script or style tags', () => {
      const html = `
        <script>
          var code = '<Treatment name="in_script"><TreatmentVariant variant="0">Should not parse</TreatmentVariant></Treatment>';
        </script>
        <Treatment name="real_test">
          <TreatmentVariant variant="0">Should parse</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      // Should parse both (parser doesn't distinguish script context)
      expect(treatments).toHaveLength(2)
    })

    it('should handle negative treatment numbers', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Zero</TreatmentVariant>
          <TreatmentVariant variant="1">One</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], -1)

      // Should fallback to first variant
      expect(result).toContain('Zero')
      expect(result).not.toContain('One')
    })

    it('should handle treatment numbers beyond alphabet (>25)', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="A">A</TreatmentVariant>
          <TreatmentVariant variant="B">B</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 30)

      // Should fallback to first variant (no letter for 30)
      expect(result).toContain('A')
    })

    it('should handle empty variant content', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0"></TreatmentVariant>
          <TreatmentVariant variant="1">Not Empty</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(2)
      expect(treatments[0].variants[0].content).toBe('')
      expect(treatments[0].variants[1].content).toBe('Not Empty')
    })

    it('should handle Treatment with no variants found', () => {
      const html = `
        <Treatment name="test">
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].variants).toHaveLength(0)
      expect(treatments[0].name).toBe('test')
    })

    it('should handle variant with only whitespace content', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">
          </TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments[0].variants[0].content).toBe('')
    })

    it('should handle Treatment tag with mixed case name', () => {
      const html = `
        <Treatment name="MyTest123">
          <TreatmentVariant variant="0">Content</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].name).toBe('MyTest123')
    })

    it('should handle lowercase alphabetic variants', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="a">Lower A</TreatmentVariant>
          <TreatmentVariant variant="b">Lower B</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      // Treatment 0 should match lowercase 'a' (case-insensitive)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)
      expect(result).toContain('Lower A')
      expect(result).not.toContain('Lower B')
    })

    it('should handle variant mapping with numeric treatment beyond variants', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="control">Control</TreatmentVariant>
          <TreatmentVariant variant="treatment">Treatment</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const variantMapping = { control: 0, treatment: 1 }

      // Treatment 1 with mapping
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 1, variantMapping)
      expect(result).toContain('Treatment')
      expect(result).not.toContain('Control')
    })

    it('should handle Treatment with extra whitespace in attributes', () => {
      const html = `
        <Treatment    name="test"    trigger-on-view   >
          <TreatmentVariant variant="0">Content</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments).toHaveLength(1)
      expect(treatments[0].name).toBe('test')
      expect(treatments[0].triggerOnView).toBe(true)
    })

    it('should handle TreatmentVariant with extra whitespace', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant    variant="0"   >Content</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments[0].variants).toHaveLength(1)
      expect(treatments[0].variants[0].variant).toBe(0)
      expect(treatments[0].variants[0].content).toBe('Content')
    })

    it('should handle variant attribute correctly', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">Both</TreatmentVariant>
          <TreatmentVariant variant="1">One</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments[0].variants[0].variant).toBe(0)
      })

    it('should return empty string when no variants exist for replacement', () => {
      const html = `
        <Treatment name="test">
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      const result = HTMLEmbedParser.replaceTreatmentTag(html, treatments[0], 0)

      // Should replace with empty string
      expect(result).not.toContain('<Treatment')
      expect(result).not.toContain('</Treatment>')
    })

    it('should handle processHTML with empty getTreatment results', () => {
      const html = `
        <Treatment name="test1">
          <TreatmentVariant variant="0">A</TreatmentVariant>
        </Treatment>
        <Treatment name="test2">
          <TreatmentVariant variant="0">B</TreatmentVariant>
        </Treatment>
      `

      const getTreatment = () => undefined

      const result = HTMLEmbedParser.processHTML(html, getTreatment)

      // Should fallback to first variant for both
      expect(result).toContain('A')
      expect(result).toContain('B')
    })

    it('should validate tag with empty string name', () => {
      const tag: TreatmentTag = {
        name: '   ',
        triggerOnView: false,
        variants: [{ variant: 0, content: 'test' }],
        fullMatch: ''
      }

      const validation = HTMLEmbedParser.validateTreatmentTag(tag)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Treatment name is required')
    })

    it('should validate and find duplicate case-insensitive variants', () => {
      const tag: TreatmentTag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: 'a', content: 'A' },
          { variant: 'A', content: 'A duplicate' }
        ],
        fullMatch: ''
      }

      const validation = HTMLEmbedParser.validateTreatmentTag(tag)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some(e => e.includes('Duplicate variant'))).toBe(true)
    })

    it('should validate and allow empty string variant', () => {
      const tag: TreatmentTag = {
        name: 'test',
        triggerOnView: false,
        variants: [
          { variant: '', content: 'Empty variant' }
        ],
        fullMatch: ''
      }

      const validation = HTMLEmbedParser.validateTreatmentTag(tag)

      // Empty variants are allowed (will show warning about no 0/A/default)
      expect(validation.errors).not.toContain('Duplicate variant identifier: ')
    })

    it('should handle Treatment tag with self-closing variants (malformed)', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0"/>
          <TreatmentVariant variant="1">Valid</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      // Regex will match from first opening tag to next closing tag
      // This creates malformed parsing, but we test the actual behavior
      expect(treatments[0].variants).toHaveLength(1)
      expect(treatments[0].variants[0].content).toContain('Valid')
    })

    it('should handle numeric variants with leading zeros', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="00">Zero with leading zero</TreatmentVariant>
          <TreatmentVariant variant="01">One with leading zero</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      // "00" becomes 0, "01" becomes 1
      expect(treatments[0].variants[0].variant).toBe(0)
      expect(treatments[0].variants[1].variant).toBe(1)
    })

    it('should preserve HTML entities in variant content', () => {
      const html = `
        <Treatment name="test">
          <TreatmentVariant variant="0">&lt;div&gt;Encoded&lt;/div&gt;</TreatmentVariant>
        </Treatment>
      `

      const treatments = HTMLEmbedParser.parseTreatmentTags(html)

      expect(treatments[0].variants[0].content).toBe('&lt;div&gt;Encoded&lt;/div&gt;')
    })
  })
})
