import { describe, it, expect } from 'vitest'
import { camelToKebab, kebabToCamel } from '../../../src/utils/string-transforms'

describe('string-transforms', () => {
  describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(camelToKebab('backgroundColor')).toBe('background-color')
      expect(camelToKebab('fontSize')).toBe('font-size')
      expect(camelToKebab('marginTop')).toBe('margin-top')
      expect(camelToKebab('borderRadius')).toBe('border-radius')
    })

    it('should handle single word', () => {
      expect(camelToKebab('color')).toBe('color')
      expect(camelToKebab('margin')).toBe('margin')
    })

    it('should handle empty string', () => {
      expect(camelToKebab('')).toBe('')
    })

    it('should handle numbers', () => {
      expect(camelToKebab('fontSize12')).toBe('font-size12')
      expect(camelToKebab('margin2Top')).toBe('margin2-top')
    })

    it('should handle single character', () => {
      expect(camelToKebab('a')).toBe('a')
      expect(camelToKebab('A')).toBe('a')
    })

    it('should handle special cases', () => {
      expect(camelToKebab('WebkitTransform')).toBe('webkit-transform')
      expect(camelToKebab('MozBorderRadius')).toBe('moz-border-radius')
    })
  })

  describe('kebabToCamel', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('background-color')).toBe('backgroundColor')
      expect(kebabToCamel('font-size')).toBe('fontSize')
      expect(kebabToCamel('margin-top')).toBe('marginTop')
      expect(kebabToCamel('border-radius')).toBe('borderRadius')
    })

    it('should handle single word', () => {
      expect(kebabToCamel('color')).toBe('color')
      expect(kebabToCamel('margin')).toBe('margin')
    })

    it('should handle empty string', () => {
      expect(kebabToCamel('')).toBe('')
    })

    it('should handle multiple hyphens', () => {
      expect(kebabToCamel('border-top-left-radius')).toBe('borderTopLeftRadius')
      expect(kebabToCamel('webkit-transform-origin')).toBe('webkitTransformOrigin')
    })

    it('should handle already camelCase', () => {
      expect(kebabToCamel('backgroundColor')).toBe('backgroundColor')
    })

    it('should handle single character', () => {
      expect(kebabToCamel('a')).toBe('a')
    })

    it('should handle vendor prefixes', () => {
      expect(kebabToCamel('-webkit-transform')).toBe('WebkitTransform')
      expect(kebabToCamel('-moz-border-radius')).toBe('MozBorderRadius')
    })
  })

  describe('round-trip conversions', () => {
    it('should convert camel to kebab and back', () => {
      const original = 'backgroundColor'
      const kebab = camelToKebab(original)
      const camel = kebabToCamel(kebab)
      expect(camel).toBe(original)
    })

    it('should convert kebab to camel and back', () => {
      const original = 'background-color'
      const camel = kebabToCamel(original)
      const kebab = camelToKebab(camel)
      expect(kebab).toBe(original)
    })

    it('should handle multiple properties', () => {
      const properties = ['fontSize', 'marginTop', 'borderRadius', 'paddingLeft']
      
      for (const prop of properties) {
        const kebab = camelToKebab(prop)
        const camel = kebabToCamel(kebab)
        expect(camel).toBe(prop)
      }
    })
  })
})
