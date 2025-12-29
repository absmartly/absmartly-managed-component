import { describe, it, expect } from 'vitest'
import {
  serializeContextData,
  deserializeContextData,
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

  describe('generateUUID', () => {
    it('should generate fast unique ID format (timestamp + random)', () => {
      const uuid = generateUUID()

      // Should be alphanumeric string (base36)
      expect(uuid).toMatch(/^[0-9a-z]+$/)
      // Should be reasonable length (timestamp base36 ~8 chars + random ~10 chars)
      expect(uuid.length).toBeGreaterThan(10)
      expect(uuid.length).toBeLessThan(30)
    })

    it('should generate unique IDs', () => {
      const uuid1 = generateUUID()
      const uuid2 = generateUUID()

      expect(uuid1).not.toBe(uuid2)
    })

    it('should match format from CookiePlugin and absmartly-worker', () => {
      const uuid = generateUUID()

      // Timestamp portion (first ~8 chars in base36)
      const timestampPart = uuid.substring(0, 8)
      expect(timestampPart).toMatch(/^[0-9a-z]+$/)

      // Random portion (rest of string)
      const randomPart = uuid.substring(8)
      expect(randomPart).toMatch(/^[0-9a-z]+$/)
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
