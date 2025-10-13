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

  it('should log messages with prefix', () => {
    const logger = createLogger(false)
    logger.log('test message')

    expect(consoleLogSpy).toHaveBeenCalledWith('[ABSmartly MC]', 'test message')
  })

  it('should log errors with prefix', () => {
    const logger = createLogger(false)
    logger.error('error message')

    expect(consoleErrorSpy).toHaveBeenCalledWith('[ABSmartly MC]', 'error message')
  })

  it('should log warnings with prefix', () => {
    const logger = createLogger(false)
    logger.warn('warning message')

    expect(consoleWarnSpy).toHaveBeenCalledWith('[ABSmartly MC]', 'warning message')
  })

  it('should not log debug messages when debug is disabled', () => {
    const logger = createLogger(false)
    logger.debug('debug message')

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it('should log debug messages when debug is enabled', () => {
    const logger = createLogger(true)
    logger.debug('debug message')

    expect(consoleLogSpy).toHaveBeenCalledWith('[ABSmartly MC] [DEBUG]', 'debug message')
  })

  it('should handle multiple arguments', () => {
    const logger = createLogger(false)
    logger.log('message', { data: 'test' }, 123)

    expect(consoleLogSpy).toHaveBeenCalledWith('[ABSmartly MC]', 'message', { data: 'test' }, 123)
  })
})
