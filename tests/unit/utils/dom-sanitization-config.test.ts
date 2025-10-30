import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP,
  FORBID_ATTR,
  FORBID_TAGS,
  DOMPURIFY_CONFIG,
} from '../../../src/utils/dom-sanitization-config'

describe('dom-sanitization-config', () => {
  describe('ALLOWED_TAGS', () => {
    it('should contain common HTML tags', () => {
      expect(ALLOWED_TAGS).toContain('div')
      expect(ALLOWED_TAGS).toContain('span')
      expect(ALLOWED_TAGS).toContain('p')
      expect(ALLOWED_TAGS).toContain('a')
    })

    it('should be an array with many tags', () => {
      expect(Array.isArray(ALLOWED_TAGS)).toBe(true)
      expect(ALLOWED_TAGS.length).toBeGreaterThan(50)
    })

    it('should not contain script tag', () => {
      expect(ALLOWED_TAGS).not.toContain('script')
    })
  })

  describe('ALLOWED_ATTR', () => {
    it('should contain common attributes', () => {
      expect(ALLOWED_ATTR).toContain('class')
      expect(ALLOWED_ATTR).toContain('id')
      expect(ALLOWED_ATTR).toContain('style')
    })

    it('should be an array', () => {
      expect(Array.isArray(ALLOWED_ATTR)).toBe(true)
    })
  })

  describe('FORBID_TAGS', () => {
    it('should forbid dangerous tags', () => {
      expect(FORBID_TAGS).toContain('script')
      expect(FORBID_TAGS).toContain('object')
      expect(FORBID_TAGS).toContain('link')
      expect(FORBID_TAGS).toContain('meta')
    })
  })

  describe('FORBID_ATTR', () => {
    it('should forbid dangerous attributes', () => {
      expect(FORBID_ATTR).toContain('onerror')
      expect(FORBID_ATTR).toContain('onload')
      expect(FORBID_ATTR).toContain('onclick')
      expect(FORBID_ATTR).toContain('onmouseover')
    })
  })

  describe('ALLOWED_URI_REGEXP', () => {
    it('should allow safe protocols', () => {
      expect(ALLOWED_URI_REGEXP.test('https://example.com')).toBe(true)
      expect(ALLOWED_URI_REGEXP.test('http://example.com')).toBe(true)
      expect(ALLOWED_URI_REGEXP.test('/relative/path')).toBe(true)
    })

    it('should block dangerous protocols', () => {
      expect(ALLOWED_URI_REGEXP.test('javascript:alert(1)')).toBe(false)
      expect(ALLOWED_URI_REGEXP.test('data:text/html,<script>')).toBe(false)
    })

    it('should be a RegExp', () => {
      expect(ALLOWED_URI_REGEXP).toBeInstanceOf(RegExp)
    })
  })

  describe('DOMPURIFY_CONFIG', () => {
    it('should have all required properties', () => {
      expect(DOMPURIFY_CONFIG).toHaveProperty('ALLOWED_TAGS')
      expect(DOMPURIFY_CONFIG).toHaveProperty('ALLOWED_ATTR')
      expect(DOMPURIFY_CONFIG).toHaveProperty('FORBID_TAGS')
      expect(DOMPURIFY_CONFIG).toHaveProperty('FORBID_ATTR')
      expect(DOMPURIFY_CONFIG).toHaveProperty('SANITIZE_DOM')
    })

    it('should have correct boolean flags', () => {
      expect(DOMPURIFY_CONFIG.SANITIZE_DOM).toBe(true)
      expect(DOMPURIFY_CONFIG.KEEP_CONTENT).toBe(true)
      expect(DOMPURIFY_CONFIG.RETURN_DOM).toBe(false)
      expect(DOMPURIFY_CONFIG.RETURN_DOM_FRAGMENT).toBe(false)
    })
  })

  describe('security coverage', () => {
    it('should prevent script execution', () => {
      expect(FORBID_TAGS).toContain('script')
      expect(FORBID_ATTR).toContain('onerror')
    })

    it('should allow safe content', () => {
      expect(ALLOWED_TAGS).toContain('div')
      expect(ALLOWED_ATTR).toContain('class')
    })
  })
})
