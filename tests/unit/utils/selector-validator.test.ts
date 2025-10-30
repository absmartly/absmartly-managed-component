import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSelector, escapeSelectorForJS } from '../../../src/utils/selector-validator'
import { Logger } from '../../../src/types'

describe('selector-validator', () => {
  let logger: Logger

  beforeEach(() => {
    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }
  })

  describe('validateSelector', () => {
    describe('valid CSS selectors', () => {
      it('should accept simple class selector', () => {
        const result = validateSelector('.container', logger)
        expect(result).toBe('.container')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept ID selector', () => {
        const result = validateSelector('#main', logger)
        expect(result).toBe('#main')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept element selector', () => {
        const result = validateSelector('div', logger)
        expect(result).toBe('div')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept combined selectors', () => {
        const result = validateSelector('div.container', logger)
        expect(result).toBe('div.container')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept descendant selectors', () => {
        const result = validateSelector('div .content p', logger)
        expect(result).toBe('div .content p')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept child selectors', () => {
        const result = validateSelector('ul > li', logger)
        expect(result).toBe('ul > li')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept adjacent sibling selectors', () => {
        const result = validateSelector('h1 + p', logger)
        expect(result).toBe('h1 + p')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept general sibling selectors', () => {
        const result = validateSelector('h1 ~ p', logger)
        expect(result).toBe('h1 ~ p')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept attribute selectors', () => {
        const result = validateSelector('[data-id="123"]', logger)
        expect(result).toBe('[data-id="123"]')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept pseudo-classes', () => {
        const result = validateSelector('a:hover', logger)
        expect(result).toBe('a:hover')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept pseudo-elements', () => {
        const result = validateSelector('p::first-line', logger)
        expect(result).toBe('p::first-line')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept nth-child selectors', () => {
        const result = validateSelector('li:nth-child(2)', logger)
        expect(result).toBe('li:nth-child(2)')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept wildcard selector', () => {
        const result = validateSelector('*', logger)
        expect(result).toBe('*')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept comma-separated selectors', () => {
        const result = validateSelector('div, span, p', logger)
        expect(result).toBe('div, span, p')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should trim whitespace', () => {
        const result = validateSelector('  .container  ', logger)
        expect(result).toBe('.container')
        expect(logger.warn).not.toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - javascript:', () => {
      it('should reject javascript: protocol', () => {
        const result = validateSelector('javascript:alert(1)', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalledWith(
          'Dangerous pattern detected in selector, using default',
          { selector: 'javascript:alert(1)' }
        )
      })

      it('should reject JavaScript: (mixed case)', () => {
        const result = validateSelector('JavaScript:alert(1)', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject JAVASCRIPT: (uppercase)', () => {
        const result = validateSelector('JAVASCRIPT:alert(1)', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - script tags', () => {
      it('should reject <script> tags', () => {
        const result = validateSelector('<script>alert(1)</script>', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject <Script> (mixed case)', () => {
        const result = validateSelector('<Script>alert(1)</Script>', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject closing script tags', () => {
        const result = validateSelector('</script>', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - event handlers', () => {
      it('should reject onclick=', () => {
        const result = validateSelector('div[onclick="alert(1)"]', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject onerror=', () => {
        const result = validateSelector('img[onerror="alert(1)"]', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject onload=', () => {
        const result = validateSelector('[onload="hack()"]', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject onMouseOver=', () => {
        const result = validateSelector('[onMouseOver="hack()"]', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - CSS injection', () => {
      it('should reject expression()', () => {
        const result = validateSelector('div[style="width:expression(alert(1))"]', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject @import', () => {
        const result = validateSelector('@import url(evil.css)', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - template literals', () => {
      it('should reject template literal syntax ${', () => {
        const result = validateSelector('div${inject}', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject backticks', () => {
        const result = validateSelector('`malicious`', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('dangerous patterns - HTML comments', () => {
      it('should reject HTML comment start', () => {
        const result = validateSelector('<!-- comment', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject HTML comment end', () => {
        const result = validateSelector('comment -->', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('length validation', () => {
      it('should reject selectors over 200 characters', () => {
        const longSelector = 'a'.repeat(201)
        const result = validateSelector(longSelector, logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalledWith('Selector too long, using default', {
          length: 201,
        })
      })

      it('should accept selector with exactly 200 characters', () => {
        const selector = 'a'.repeat(200)
        const result = validateSelector(selector, logger)
        expect(result).toBe(selector)
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should accept selector with 199 characters', () => {
        const selector = 'a'.repeat(199)
        const result = validateSelector(selector, logger)
        expect(result).toBe(selector)
        expect(logger.warn).not.toHaveBeenCalled()
      })
    })

    describe('invalid characters', () => {
      it('should reject selectors with @', () => {
        const result = validateSelector('div@invalid', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalledWith(
          'Invalid characters in selector, using default',
          { selector: 'div@invalid' }
        )
      })

      it('should reject selectors with ;', () => {
        const result = validateSelector('div;script', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject selectors with {', () => {
        const result = validateSelector('div{color:red}', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject selectors with }', () => {
        const result = validateSelector('div}', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })

      it('should reject unicode characters', () => {
        const result = validateSelector('div.测试', logger)
        expect(result).toBe('body')
        expect(logger.warn).toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('should return body for empty string', () => {
        const result = validateSelector('', logger)
        expect(result).toBe('body')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should return body for whitespace only', () => {
        const result = validateSelector('   ', logger)
        expect(result).toBe('body')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should return body for null input', () => {
        const result = validateSelector(null as any, logger)
        expect(result).toBe('body')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should return body for undefined input', () => {
        const result = validateSelector(undefined as any, logger)
        expect(result).toBe('body')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should return body for non-string input', () => {
        const result = validateSelector(123 as any, logger)
        expect(result).toBe('body')
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('should work without logger', () => {
        const result = validateSelector('.container')
        expect(result).toBe('.container')
      })

      it('should work without logger for invalid selector', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const result = validateSelector('javascript:alert(1)')
        expect(result).toBe('body')
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
      })
    })
  })

  describe('escapeSelectorForJS', () => {
    it('should escape single quotes', () => {
      const result = escapeSelectorForJS("[data-name='test']", logger)
      expect(result).toContain("\\'")
    })

    it('should escape double quotes', () => {
      const result = escapeSelectorForJS('[data-name="test"]', logger)
      expect(result).toContain('\\"')
    })

    it('should reject selectors with backslashes', () => {
      const result = escapeSelectorForJS('div\\ntest', logger)
      expect(result).toBe('body')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should escape newlines', () => {
      const result = escapeSelectorForJS('div\ntest', logger)
      expect(result).toContain('\\n')
    })

    it('should escape carriage returns', () => {
      const result = escapeSelectorForJS('div\rtest', logger)
      expect(result).toContain('\\r')
    })

    it('should validate selector before escaping', () => {
      const result = escapeSelectorForJS('javascript:alert(1)', logger)
      expect(result).toBe('body')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should escape valid selector', () => {
      const result = escapeSelectorForJS('.container', logger)
      expect(result).toBe('.container')
    })

    it('should escape multiple special characters', () => {
      const result = escapeSelectorForJS("[data='test\"value']", logger)
      expect(result).toContain("\\'")
      expect(result).toContain('\\"')
    })

    it('should work without logger', () => {
      const result = escapeSelectorForJS('.container')
      expect(result).toBe('.container')
    })

    it('should handle empty string', () => {
      const result = escapeSelectorForJS('', logger)
      expect(result).toBe('body')
    })

    it('should reject selector with backslashes even if it has other escapable characters', () => {
      const input = "test\\'test\"test\\ntest\\r"
      const result = escapeSelectorForJS(input, logger)
      expect(result).toBe('body')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
    it('should handle complex valid selector', () => {
      const selector = 'div.container > ul li:nth-child(2)[data-active="true"]'
      const result = validateSelector(selector, logger)
      expect(result).toBe(selector)
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should handle and escape complex valid selector', () => {
      const selector = '[data-value="test\'s"]'
      const result = escapeSelectorForJS(selector, logger)
      expect(result).toContain("\\'")
    })

    it('should reject complex dangerous selector', () => {
      const selector = 'div[onclick="alert(1)"] > script'
      const result = validateSelector(selector, logger)
      expect(result).toBe('body')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should validate then escape in sequence', () => {
      const selector = '.container'
      const validated = validateSelector(selector, logger)
      const escaped = escapeSelectorForJS(validated, logger)
      expect(escaped).toBe('.container')
    })
  })
})
