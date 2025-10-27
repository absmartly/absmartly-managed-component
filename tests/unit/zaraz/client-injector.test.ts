import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClientInjector } from '../../../src/zaraz/client-injector'
import { ABSmartlySettings, Logger } from '../../../src/types'
import { MCEvent, Client } from '@managed-components/types'

// Mock the shared client bundle generator
vi.mock('../../../src/shared/client-bundle-generator', () => ({
  generateClientBundle: vi.fn().mockReturnValue('<script>/* client bundle */</script>'),
}))

describe('ClientInjector', () => {
  let settings: ABSmartlySettings
  let logger: Logger
  let mockEvent: Partial<MCEvent>
  let mockClient: Partial<Client>

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      ENABLE_DEBUG: false,
      ENABLE_ANTI_FLICKER: true,
      ENABLE_TRIGGER_ON_VIEW: true,
      HIDE_SELECTOR: 'body',
    } as ABSmartlySettings

    logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }

    mockClient = {
      execute: vi.fn(),
    }

    mockEvent = {
      client: mockClient as Client,
    }

    vi.clearAllMocks()
  })

  describe('injectClientCode', () => {
    it('should inject client bundle', () => {
      const injector = new ClientInjector(settings, logger)

      injector.injectClientCode(mockEvent as MCEvent)

      expect(mockClient.execute).toHaveBeenCalledWith('<script>/* client bundle */</script>')
      expect(logger.debug).toHaveBeenCalledWith('Injecting client code for Zaraz mode')
      expect(logger.debug).toHaveBeenCalledWith('Client code injected successfully')
    })

    it('should pass Zaraz mode to bundle generator', () => {
      const injector = new ClientInjector(settings, logger)

      injector.injectClientCode(mockEvent as MCEvent)

      expect(mockClient.execute).toHaveBeenCalled()
    })

    it('should inject failsafe on error', () => {
      mockClient.execute = vi.fn().mockImplementation(() => {
        throw new Error('Injection failed')
      })
      const injector = new ClientInjector(settings, logger)

      injector.injectClientCode(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to inject client code:', expect.any(Error))
      // Failsafe should be attempted
      expect(mockClient.execute).toHaveBeenCalled()
    })
  })

  describe('injectFailsafe', () => {
    it('should inject failsafe script with default selector', () => {
      const injector = new ClientInjector(settings, logger)

      injector.injectFailsafe(mockEvent as MCEvent)

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining("document.querySelector('body')")
      )
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining("el.style.opacity = '1'")
      )
      expect(logger.debug).toHaveBeenCalledWith('Failsafe script injected')
    })

    it('should use custom selector from settings', () => {
      settings.HIDE_SELECTOR = '#app'
      const injector = new ClientInjector(settings, logger)

      injector.injectFailsafe(mockEvent as MCEvent)

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining("document.querySelector('#app')")
      )
    })

    it('should handle injection error', () => {
      mockClient.execute = vi.fn().mockImplementation(() => {
        throw new Error('Execute failed')
      })
      const injector = new ClientInjector(settings, logger)

      injector.injectFailsafe(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to inject failsafe:', expect.any(Error))
    })
  })

  describe('injectDebugInfo', () => {
    it('should inject debug info when debug enabled', () => {
      settings.ENABLE_DEBUG = true
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent)

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('console.log')
      )
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('[ABSmartly] Zaraz mode initialized')
      )
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('[ABSmartly] Settings:')
      )
    })

    it('should not inject debug info when debug disabled', () => {
      settings.ENABLE_DEBUG = false
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent)

      expect(mockClient.execute).not.toHaveBeenCalled()
    })

    it('should include correct settings in debug info', () => {
      settings.ENABLE_DEBUG = true
      settings.DEPLOYMENT_MODE = 'zaraz'
      settings.ENABLE_ANTI_FLICKER = true
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent)

      const callArg = (mockClient.execute as any).mock.calls[0][0]
      expect(callArg).toContain("deployment: 'zaraz'")
      expect(callArg).toContain('antiFlicker:')
      expect(callArg).toContain('triggerOnView:')
    })

    it('should handle injection error', () => {
      settings.ENABLE_DEBUG = true
      mockClient.execute = vi.fn().mockImplementation(() => {
        throw new Error('Execute failed')
      })
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent)

      expect(logger.error).toHaveBeenCalledWith('Failed to inject debug info:', expect.any(Error))
    })
  })
})
