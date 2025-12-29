import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from '../../../src/utils/logger'

describe('Logger', () => {
  let consoleLogSpy: any
  let consoleErrorSpy: any
  let consoleWarnSpy: any

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('default mode (zaraz)', () => {
    it('should log messages with zaraz prefix by default', () => {
      const logger = createLogger(false)
      logger.log('test message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Zaraz]', 'test message')
    })

    it('should log errors with zaraz prefix', () => {
      const logger = createLogger(false)
      logger.error('error message')

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ABsmartly Zaraz]', 'error message')
    })

    it('should log warnings with zaraz prefix', () => {
      const logger = createLogger(false)
      logger.warn('warning message')

      expect(consoleWarnSpy).toHaveBeenCalledWith('[ABsmartly Zaraz]', 'warning message')
    })
  })

  describe('worker mode', () => {
    it('should log messages with worker prefix', () => {
      const logger = createLogger(false, 'worker')
      logger.log('test message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Worker]', 'test message')
    })

    it('should log debug messages with worker prefix when enabled', () => {
      const logger = createLogger(true, 'worker')
      logger.debug('debug message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Worker] [DEBUG]', 'debug message')
    })
  })

  describe('webcm mode', () => {
    it('should log messages with webcm prefix', () => {
      const logger = createLogger(false, 'webcm')
      logger.log('test message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly WebCM]', 'test message')
    })
  })

  describe('zaraz mode (explicit)', () => {
    it('should log messages with zaraz prefix', () => {
      const logger = createLogger(false, 'zaraz')
      logger.log('test message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Zaraz]', 'test message')
    })
  })

  describe('debug mode', () => {
    it('should not log debug messages when debug is disabled', () => {
      const logger = createLogger(false)
      logger.debug('debug message')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should log debug messages when debug is enabled', () => {
      const logger = createLogger(true)
      logger.debug('debug message')

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Zaraz] [DEBUG]', 'debug message')
    })
  })

  it('should handle multiple arguments', () => {
    const logger = createLogger(false, 'worker')
    logger.log('message', { data: 'test' }, 123)

    expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Worker]', 'message', { data: 'test' }, 123)
  })
})
