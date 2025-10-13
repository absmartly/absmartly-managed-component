import { describe, it, expect } from 'vitest'
import {
  serializeContextData,
  deserializeContextData,
  generateSessionId,
  generateUUID,
  hashString,
  safeParseJSON,
} from '../../../src/utils/serializer'

describe('Serializer Utils', () => {
  describe('serializeContextData', () => {
    it('should serialize context data to JSON', () => {
      const data = {
        experiments: [
          { name: 'test', treatment: 1, variant: 'A', changes: [] },
        ],
      }

      const result = serializeContextData(data)
      expect(result).toBe(JSON.stringify(data))
    })

    it('should return empty experiments on serialization error', () => {
      const circularData: any = { experiments: [] }
      circularData.self = circularData // Create circular reference

      const result = serializeContextData(circularData)
      expect(result).toBe(JSON.stringify({ experiments: [] }))
    })
  })

  describe('deserializeContextData', () => {
    it('should deserialize JSON to context data', () => {
      const json = '{"experiments":[{"name":"test","treatment":1}]}'
      const result = deserializeContextData(json)

      expect(result).toEqual({
        experiments: [{ name: 'test', treatment: 1 }],
      })
    })

    it('should return empty experiments on parse error', () => {
      const result = deserializeContextData('invalid json')
      expect(result).toEqual({ experiments: [] })
    })
  })

  describe('generateSessionId', () => {
    it('should generate session ID with user ID and date', () => {
      const userId = 'user123'
      const result = generateSessionId(userId)

      expect(result).toContain(userId)
      expect(result).toContain('_')
      expect(result).toMatch(/user123_\d{4}-\d{2}-\d{2}/)
    })

    it('should generate same session ID for same user on same day', () => {
      const userId = 'user123'
      const result1 = generateSessionId(userId)
      const result2 = generateSessionId(userId)

      expect(result1).toBe(result2)
    })
  })

  describe('generateUUID', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = generateUUID()

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID()
      const uuid2 = generateUUID()

      expect(uuid1).not.toBe(uuid2)
    })
  })

  describe('hashString', () => {
    it('should generate hash for string', () => {
      const hash = hashString('test')

      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should generate same hash for same string', () => {
      const hash1 = hashString('test')
      const hash2 = hashString('test')

      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different strings', () => {
      const hash1 = hashString('test1')
      const hash2 = hashString('test2')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('safeParseJSON', () => {
    it('should parse valid JSON', () => {
      const result = safeParseJSON('{"key":"value"}')
      expect(result).toEqual({ key: 'value' })
    })

    it('should return fallback for invalid JSON', () => {
      const result = safeParseJSON('invalid', { default: true })
      expect(result).toEqual({ default: true })
    })

    it('should return null as default fallback', () => {
      const result = safeParseJSON('invalid')
      expect(result).toBeNull()
    })
  })
})
