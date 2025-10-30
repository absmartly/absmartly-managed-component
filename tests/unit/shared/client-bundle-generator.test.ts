import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateClientBundle } from '../../../src/shared/client-bundle-generator'
import type { ABSmartlySettings, Logger } from '../../../src/types'

describe('generateClientBundle', () => {
  let settings: ABSmartlySettings
  let logger: Logger

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'test',
      ABSMARTLY_APPLICATION: 'test-app',
      ENABLE_ANTI_FLICKER: true,
      ENABLE_TRIGGER_ON_VIEW: true,
      INJECT_CLIENT_BUNDLE: true
    }

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn()
    }
  })

  describe('Zaraz mode', () => {
    it('should generate bundle with all components', () => {
      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('<style')
      expect(bundle).toContain('opacity: 0')
      expect(bundle).toContain('trigger-on-view')
      expect(bundle).toContain('zaraz.track')
      expect(bundle).toContain('zaraz')
    })

    it('should respect ENABLE_ANTI_FLICKER setting', () => {
      settings.ENABLE_ANTI_FLICKER = false

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      // Should have trigger-on-view but not anti-flicker
      expect(bundle).toContain('trigger-on-view')
      expect(bundle).not.toContain('opacity: 0')
    })

    it('should respect ENABLE_TRIGGER_ON_VIEW setting', () => {
      settings.ENABLE_TRIGGER_ON_VIEW = false

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      // Should have anti-flicker but not trigger-on-view
      expect(bundle).toContain('opacity: 0')
      expect(bundle).not.toContain('IntersectionObserver')
    })

    it('should include hide timeout', () => {
      settings.HIDE_TIMEOUT = 5000

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('5000')
    })

    it('should include hide selector', () => {
      settings.HIDE_SELECTOR = '.main-content'

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('.main-content')
    })

    it('should include transition duration', () => {
      settings.TRANSITION_MS = '500'

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('500ms')
    })

    it('should include debug flag', () => {
      settings.ENABLE_DEBUG = true

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('true')
      expect(bundle).toContain('ABSmartlyInit')
    })
  })

  describe('WebCM mode', () => {
    it('should generate bundle with mode set to webcm', () => {
      const bundle = generateClientBundle({
        mode: 'webcm',
        settings,
        logger
      })

      expect(bundle).toContain('webcm')
      expect(bundle).toContain('fetch')
      expect(bundle).toContain('/absmartly')
    })

    it('should use POST to /absmartly endpoint in WebCM mode', () => {
      const bundle = generateClientBundle({
        mode: 'webcm',
        settings,
        logger
      })

      expect(bundle).toContain("method: 'POST'")
      expect(bundle).toContain("'/absmartly'")
    })

    it('should have similar bundle size as Zaraz mode', () => {
      const zarazBundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      const webcmBundle = generateClientBundle({
        mode: 'webcm',
        settings,
        logger
      })

      // Both should be around 2-2.5KB (within 20% variance)
      const zarazSize = zarazBundle.length
      const webcmSize = webcmBundle.length
      const difference = Math.abs(zarazSize - webcmSize)
      const maxDifference = Math.max(zarazSize, webcmSize) * 0.2

      expect(difference).toBeLessThan(maxDifference)
    })
  })

  describe('Both modes', () => {
    it('should include script tags', () => {
      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(bundle).toContain('<script>')
      expect(bundle).toContain('</script>')
    })

    it('should be under 6KB (including actual script files)', () => {
      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      const sizeInKB = bundle.length / 1024
      expect(sizeInKB).toBeLessThan(6)
    })

    it('should handle disabled anti-flicker and trigger-on-view', () => {
      settings.ENABLE_ANTI_FLICKER = false
      settings.ENABLE_TRIGGER_ON_VIEW = false

      const bundle = generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      // Should still have some content (init script at minimum)
      expect(bundle.length).toBeGreaterThan(0)
      expect(bundle).toContain('ABSmartlyInit')
    })

    it('should log debug information', () => {
      generateClientBundle({
        mode: 'zaraz',
        settings,
        logger
      })

      expect(logger.debug).toHaveBeenCalledWith('Generating client bundle', {
        mode: 'zaraz'
      })
      expect(logger.debug).toHaveBeenCalledWith('Client bundle generated', {
        size: expect.any(Number)
      })
    })
  })
})
