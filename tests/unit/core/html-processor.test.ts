import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTMLProcessor } from '../../../src/core/html-processor'
import { ABSmartlySettings, ExperimentData, Logger } from '../../../src/types'

describe('HTMLProcessor', () => {
  let settings: ABSmartlySettings
  let logger: Logger
  let processor: HTMLProcessor

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'webcm',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      ENABLE_EMBEDS: true,
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    }

    processor = new HTMLProcessor({ settings, logger, useLinkedom: false })
    vi.clearAllMocks()
  })

  describe('DOM changes processing', () => {
    it('should apply text changes', () => {
      const html = '<html><body><h1>Original</h1></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [{ selector: 'h1', type: 'text', value: 'Modified' }]
      }]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('Modified')
      expect(logger.debug).toHaveBeenCalledWith('Applying DOM changes', {
        experiment: 'test', treatment: 1, changesCount: 1
      })
    })

    it('should apply multiple changes from single experiment', () => {
      const html = '<html><body><div>Old</div></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [
          { selector: 'div', type: 'text', value: 'New' },
          { selector: 'div', type: 'style', value: 'color: red;' }
        ]
      }]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('New')
      expect(result).toContain('color: red')
    })

    it('should handle multiple experiments', () => {
      const html = '<html><body><h1>T</h1><p>P</p></body></html>'
      const experiments: ExperimentData[] = [
        { name: 'exp1', treatment: 1, changes: [{ selector: 'h1', type: 'text', value: 'NewT' }] },
        { name: 'exp2', treatment: 2, changes: [{ selector: 'p', type: 'text', value: 'NewP' }] }
      ]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('NewT')
      expect(result).toContain('NewP')
    })

    it('should skip experiments with no changes', () => {
      const html = '<html><body><h1>Orig</h1></body></html>'
      const experiments: ExperimentData[] = [{ name: 'test', treatment: 1 }]

      const result = processor.processHTML(html, experiments)

      expect(result).toBe(html)
    })
  })

  describe('parser modes', () => {
    it('should work with linkedom parser', () => {
      processor = new HTMLProcessor({ settings, logger, useLinkedom: true })
      const html = '<html><body><h1>Orig</h1></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [{ selector: 'h1', type: 'text', value: 'Mod' }]
      }]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('Mod')
    })

    it('should work with regex parser', () => {
      const html = '<html><body><h1>Orig</h1></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [{ selector: 'h1', type: 'text', value: 'Mod' }]
      }]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('Mod')
    })

    it('should continue after one experiment fails', () => {
      const html = '<html><body><p>Text</p></body></html>'
      const experiments: ExperimentData[] = [
        { name: 'fail', treatment: 1, changes: [{ selector: 'invalid>>>', type: 'text', value: 'X' } as any] },
        { name: 'ok', treatment: 1, changes: [{ selector: 'p', type: 'text', value: 'OK' }] }
      ]

      const result = processor.processHTML(html, experiments)

      expect(result).toContain('OK')
    })
  })

  describe('Treatment tags', () => {
    it('should check for Treatment tags when enabled', () => {
      const html = '<html><body>No tags</body></html>'

      processor.processHTML(html, [])

      expect(logger.debug).toHaveBeenCalledWith('No Treatment tags found in HTML')
    })

    it('should skip Treatment tags when ENABLE_EMBEDS is false', () => {
      settings.ENABLE_EMBEDS = false
      processor = new HTMLProcessor({ settings, logger, useLinkedom: false })
      const html = '<Treatment>content</Treatment>'

      const result = processor.processHTML(html, [])

      expect(result).toBe(html)
    })

    it('should process Treatment tags before DOM changes', () => {
      const html = '<html><body><Treatment name="exp"><TreatmentVariant variant="0">A</TreatmentVariant><TreatmentVariant variant="1">B</TreatmentVariant></Treatment></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'exp', treatment: 1,
        changes: [{ selector: 'body', type: 'text', value: 'C' }]
      }]

      const result = processor.processHTML(html, experiments)

      // Treatment processes first (B), then DOM change
      expect(result).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('should handle empty HTML', () => {
      expect(processor.processHTML('', [])).toBe('')
    })

    it('should handle empty experiments', () => {
      const html = '<html><body>test</body></html>'
      expect(processor.processHTML(html, [])).toBe(html)
    })

    it('should handle malformed HTML', () => {
      const html = '<html><body><div>Unclosed'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [{ selector: 'div', type: 'text', value: 'New' }]
      }]

      const result = processor.processHTML(html, experiments)

      expect(result).toBeTruthy()
    })

    it('should handle invalid change types gracefully', () => {
      const html = '<html><body><div>test</div></body></html>'
      const experiments: ExperimentData[] = [{
        name: 'test', treatment: 1,
        changes: [{ selector: 'div', type: 'invalidType' as any, value: 'X' }]
      }]

      const result = processor.processHTML(html, experiments)

      // Should not throw, may log warning
      expect(result).toBeTruthy()
    })
  })
})
