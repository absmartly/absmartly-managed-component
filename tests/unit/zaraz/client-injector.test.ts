import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClientInjector } from '../../../src/zaraz/client-injector'
import { ABSmartlySettings, Logger, ContextData } from '../../../src/types'
import { MCEvent, Client } from '@managed-components/types'

// Mock the client bundle functions
vi.mock('../../../src/zaraz/client-bundle/initializer', () => ({
  generateClientBundle: vi.fn().mockReturnValue('<script>/* client bundle */</script>'),
  generateWebVitalsScript: vi.fn().mockReturnValue('<script>/* web vitals */</script>'),
}))

describe('ClientInjector', () => {
  let settings: ABSmartlySettings
  let logger: Logger
  let mockEvent: Partial<MCEvent>
  let mockClient: Partial<Client>
  let experimentData: ContextData

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      ENABLE_DEBUG: false,
      ENABLE_WEB_VITALS: false,
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

    experimentData = {
      experiments: [
        {
          name: 'experiment1',
          treatment: 1,
          variant: 'variant_a',
          changes: [],
        },
      ],
    }

    vi.clearAllMocks()
  })

  describe('injectExperimentCode', () => {
    it('should inject client bundle', () => {
      const injector = new ClientInjector(settings, logger)

      injector.injectExperimentCode(mockEvent as MCEvent, experimentData)

      expect(mockClient.execute).toHaveBeenCalledWith('<script>/* client bundle */</script>')
      expect(logger.debug).toHaveBeenCalledWith('Injecting client code', {
        experimentsCount: 1,
      })
      expect(logger.debug).toHaveBeenCalledWith('Client code injected successfully')
    })

    it('should inject web vitals script if enabled', () => {
      settings.ENABLE_WEB_VITALS = true
      const injector = new ClientInjector(settings, logger)

      injector.injectExperimentCode(mockEvent as MCEvent, experimentData)

      expect(mockClient.execute).toHaveBeenCalledWith('<script>/* client bundle */</script>')
      expect(mockClient.execute).toHaveBeenCalledWith('<script>/* web vitals */</script>')
      expect(logger.debug).toHaveBeenCalledWith('Web vitals script injected')
    })

    it('should not inject web vitals script if disabled', () => {
      settings.ENABLE_WEB_VITALS = false
      const injector = new ClientInjector(settings, logger)

      injector.injectExperimentCode(mockEvent as MCEvent, experimentData)

      expect(mockClient.execute).toHaveBeenCalledTimes(1)
      expect(mockClient.execute).toHaveBeenCalledWith('<script>/* client bundle */</script>')
    })

    it('should inject failsafe on error', () => {
      mockClient.execute = vi.fn().mockImplementation(() => {
        throw new Error('Injection failed')
      })
      const injector = new ClientInjector(settings, logger)

      injector.injectExperimentCode(mockEvent as MCEvent, experimentData)

      expect(logger.error).toHaveBeenCalledWith('Failed to inject client code:', expect.any(Error))
      // Failsafe should be attempted (will also fail in this test due to mock)
      expect(mockClient.execute).toHaveBeenCalled()
    })

    it('should handle empty experiment data', () => {
      const emptyData: ContextData = { experiments: [] }
      const injector = new ClientInjector(settings, logger)

      injector.injectExperimentCode(mockEvent as MCEvent, emptyData)

      expect(mockClient.execute).toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('Injecting client code', {
        experimentsCount: 0,
      })
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

      injector.injectDebugInfo(mockEvent as MCEvent, experimentData)

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('console.log')
      )
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('[ABSmartly] Experiment data:')
      )
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('[ABSmartly] Settings:')
      )
    })

    it('should not inject debug info when debug disabled', () => {
      settings.ENABLE_DEBUG = false
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent, experimentData)

      expect(mockClient.execute).not.toHaveBeenCalled()
    })

    it('should include correct settings in debug info', () => {
      settings.ENABLE_DEBUG = true
      settings.DEPLOYMENT_MODE = 'zaraz'
      settings.ENABLE_WEB_VITALS = true
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent, experimentData)

      const callArg = (mockClient.execute as any).mock.calls[0][0]
      expect(callArg).toContain("deployment: 'zaraz'")
      expect(callArg).toContain('webVitals: true')
    })

    it('should stringify experiment data correctly', () => {
      settings.ENABLE_DEBUG = true
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent, experimentData)

      const callArg = (mockClient.execute as any).mock.calls[0][0]
      expect(callArg).toContain('"experiments"')
      expect(callArg).toContain('"experiment1"')
    })

    it('should handle injection error', () => {
      settings.ENABLE_DEBUG = true
      mockClient.execute = vi.fn().mockImplementation(() => {
        throw new Error('Execute failed')
      })
      const injector = new ClientInjector(settings, logger)

      injector.injectDebugInfo(mockEvent as MCEvent, experimentData)

      expect(logger.error).toHaveBeenCalledWith('Failed to inject debug info:', expect.any(Error))
    })
  })
})
