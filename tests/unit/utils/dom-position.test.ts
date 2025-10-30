import { describe, it, expect, vi } from 'vitest'
import { insertAtPosition, insertElementAtPosition, InsertPosition } from '../../../src/utils/dom-position'

describe('dom-position', () => {
  describe('insertAtPosition', () => {
    const match = '<div>content</div>'
    const openTag = '<div>'
    const innerContent = 'content'
    const closeTag = '</div>'
    const content = '<span>new</span>'

    it('should insert before element', () => {
      const result = insertAtPosition('before', content, match, openTag, innerContent, closeTag)
      expect(result).toBe('<span>new</span><div>content</div>')
    })

    it('should insert after element', () => {
      const result = insertAtPosition('after', content, match, openTag, innerContent, closeTag)
      expect(result).toBe('<div>content</div><span>new</span>')
    })

    it('should prepend to element', () => {
      const result = insertAtPosition('prepend', content, match, openTag, innerContent, closeTag)
      expect(result).toContain(content)
      expect(result).toContain(innerContent)
      expect(result).toMatch(/<div>.*<span>new<\/span>.*content.*<\/div>/)
    })

    it('should append to element', () => {
      const result = insertAtPosition('append', content, match, openTag, innerContent, closeTag)
      expect(result).toContain(content)
      expect(result).toContain(innerContent)
      expect(result).toMatch(/<div>.*content.*<span>new<\/span>.*<\/div>/)
    })

    it('should default to append for invalid position', () => {
      const result = insertAtPosition('invalid' as InsertPosition, content, match, openTag, innerContent, closeTag)
      expect(result).toContain(content)
      expect(result).toContain(innerContent)
    })

    it('should handle empty content', () => {
      const result = insertAtPosition('before', '', match, openTag, innerContent, closeTag)
      expect(result).toContain('<div>content</div>')
    })
  })

  describe('insertElementAtPosition', () => {
    it('should call appendChild for append position', () => {
      const target = {
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
        parentNode: {
          insertBefore: vi.fn(),
        },
      }
      const element = {}

      insertElementAtPosition('append', element as any, target as any)
      expect(target.appendChild).toHaveBeenCalledWith(element)
    })

    it('should call insertBefore for prepend position', () => {
      const firstChild = {}
      const target = {
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
        firstChild,
      }
      const element = {}

      insertElementAtPosition('prepend', element as any, target as any)
      expect(target.insertBefore).toHaveBeenCalledWith(element, firstChild)
    })

    it('should call parent insertBefore for before position', () => {
      const parent = {
        insertBefore: vi.fn(),
      }
      const target = {
        parentNode: parent,
      }
      const element = {}

      insertElementAtPosition('before', element as any, target as any)
      expect(parent.insertBefore).toHaveBeenCalledWith(element, target)
    })

    it('should call parent insertBefore for after position', () => {
      const nextSibling = {}
      const parent = {
        insertBefore: vi.fn(),
      }
      const target = {
        parentNode: parent,
        nextSibling,
      }
      const element = {}

      insertElementAtPosition('after', element as any, target as any)
      expect(parent.insertBefore).toHaveBeenCalledWith(element, nextSibling)
    })
  })
})
