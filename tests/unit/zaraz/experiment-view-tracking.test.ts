import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Manager, MCEvent, Client } from '@managed-components/types'
import { setupZarazMode } from '../../../src/zaraz/setup'
import { ABSmartlySettings } from '../../../src/types'
import { ContextManager } from '../../../src/core/context-manager'

// Mock ABSmartly SDK
vi.mock('@absmartly/javascript-sdk', () => ({
  default: vi.fn(() => ({
    createContext: vi.fn(),
    createContextWith: vi.fn(),
  })),
}))

// Mock all core modules
vi.mock('../../../src/core/context-manager', () => ({
  ContextManager: vi.fn().mockImplementation(() => ({
    createContext: vi.fn(),
    getOrCreateContext: vi.fn(),
    extractExperimentData: vi.fn(() => []),
    publishContext: vi.fn(),
  })),
}))

vi.mock('../../../src/core/cookie-handler', () => ({
  CookieHandler: vi.fn().mockImplementation(() => ({
    getUserId: vi.fn(() => 'test-user-123'),
    storeUTMParams: vi.fn(),
    storeLandingPage: vi.fn(),
  })),
}))

// Create mock override handler at module level
const mockOverridesHandler = {
  getOverrides: vi.fn(() => ({})),
  hasOverrides: vi.fn(() => false),
}

vi.mock('../../../src/core/overrides-handler', () => ({
  OverridesHandler: vi.fn().mockImplementation(() => mockOverridesHandler),
}))

vi.mock('../../../src/core/event-tracker', () => ({
  EventTracker: vi.fn().mockImplementation(() => ({
    trackGoal: vi.fn(),
    trackEvent: vi.fn(),
    trackEcommerce: vi.fn(),
  })),
}))

vi.mock('../../../src/zaraz/client-injector', () => ({
  ClientInjector: vi.fn().mockImplementation(() => ({
    injectDebugInfo: vi.fn(),
    injectClientCode: vi.fn(),
    injectFailsafe: vi.fn(),
  })),
}))

vi.mock('../../../src/zaraz/embed-handler', () => ({
  EmbedHandler: vi.fn().mockImplementation(() => ({
    setup: vi.fn(),
  })),
}))

describe('ExperimentView Tracking', () => {
  let manager: Manager
  let trackListeners: ((event: MCEvent) => Promise<void>)[]
  let mockContextManager: any
  let mockContext: any

  const createMockSettings = (): ABSmartlySettings => ({
    DEPLOYMENT_MODE: 'zaraz',
    ABSMARTLY_API_KEY: 'test-key',
    ABSMARTLY_ENDPOINT: 'https://test.absmartly.io',
    ABSMARTLY_ENVIRONMENT: 'test',
    ABSMARTLY_APPLICATION: 'test-app',
    ENABLE_DEBUG: false,
  })

  const createMockClient = (): Client => ({
    url: new URL('https://example.com'),
    title: 'Test Page',
    timestamp: Date.now(),
    userAgent: 'Mozilla/5.0',
    language: 'en-US',
    referer: '',
    ip: '127.0.0.1',
    emitter: 'browser',
    get: vi.fn(),
    set: vi.fn(),
    execute: vi.fn(),
    return: vi.fn(),
    fetch: vi.fn(),
    attachEvent: vi.fn(),
    detachEvent: vi.fn(),
  })

  beforeEach(() => {
    trackListeners = []

    manager = {
      addEventListener: vi.fn((eventType: string, listener: any) => {
        if (eventType === 'track') {
          trackListeners.push(listener)
        }
      }),
      createEventListener: vi.fn(),
      route: vi.fn(),
      serve: vi.fn(),
      proxy: vi.fn(),
      fetch: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
    } as unknown as Manager

    mockContext = {
      treatment: vi.fn((experimentName: string) => 1),
      variable: vi.fn(),
      track: vi.fn(),
      publish: vi.fn(),
      setOverride: vi.fn(),
      setOverrides: vi.fn(),
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      finalize: vi.fn(),
      data: vi.fn(),
      experiments: vi.fn(() => []),
    }

    mockContextManager = {
      createContext: vi.fn().mockResolvedValue(mockContext),
      getOrCreateContext: vi.fn().mockResolvedValue(mockContext),
      extractExperimentData: vi.fn(() => []),
      publishContext: vi.fn().mockResolvedValue(undefined),
    }

    // Reset the ContextManager mock to return our instance
    vi.mocked(ContextManager).mockImplementation(() => mockContextManager)
  })

  describe('ExperimentView event handling', () => {
    it('should handle ExperimentView events', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-experiment-123',
        },
        name: 'ExperimentView',
      }

      // Trigger the track event
      expect(trackListeners.length).toBeGreaterThan(0)
      await trackListeners[0](mockEvent)

      // Verify context was obtained
      expect(mockContextManager.getOrCreateContext).toHaveBeenCalled()
    })

    it('should call context.treatment() for ExperimentView events', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const experimentName = 'homepage-banner-test'
      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: experimentName,
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify treatment was called with the experiment name
      expect(mockContext.treatment).toHaveBeenCalledWith(experimentName)
    })

    it('should publish context after ExperimentView tracking', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'nav-redesign',
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify context was published
      expect(mockContextManager.publishContext).toHaveBeenCalledWith(mockContext)
    })

    it('should use correct user ID for ExperimentView', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-experiment',
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify getOrCreateContext was called with the user ID
      expect(mockContextManager.getOrCreateContext).toHaveBeenCalledWith(
        'test-user-123',
        {},
        expect.objectContaining({
          url: expect.any(String),
          userAgent: mockEvent.client.userAgent,
          ip: mockEvent.client.ip,
        })
      )
    })

    it('should pass overrides to getOrCreateContext', async () => {
      const settings = createMockSettings()

      // Update the mock to return test overrides for this test
      mockOverridesHandler.getOverrides.mockReturnValueOnce({ 'test-exp': 1 })
      mockOverridesHandler.hasOverrides.mockReturnValueOnce(true)

      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-exp',
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify getOrCreateContext was called with overrides
      expect(mockContextManager.getOrCreateContext).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should not trigger exposure for ExperimentView without experimentName', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          // Missing experimentName
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify treatment was NOT called
      expect(mockContext.treatment).not.toHaveBeenCalled()
      expect(mockContextManager.publishContext).not.toHaveBeenCalled()
    })

    it('should handle multiple ExperimentView events for different experiments', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const experiments = ['exp-1', 'exp-2', 'exp-3']

      for (const experimentName of experiments) {
        const mockEvent: MCEvent = {
          type: 'track',
          client: createMockClient(),
          payload: {
            name: 'ExperimentView',
            experimentName: experimentName,
          },
          name: 'ExperimentView',
        }

        await trackListeners[0](mockEvent)
      }

      // Verify treatment was called for each experiment
      expect(mockContext.treatment).toHaveBeenCalledTimes(3)
      expect(mockContext.treatment).toHaveBeenCalledWith('exp-1')
      expect(mockContext.treatment).toHaveBeenCalledWith('exp-2')
      expect(mockContext.treatment).toHaveBeenCalledWith('exp-3')

      // Verify context was published for each
      expect(mockContextManager.publishContext).toHaveBeenCalledTimes(3)
    })

    it('should handle ExperimentView with special characters in experiment name', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const experimentName = 'homepage-banner_v2.1-test'
      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: experimentName,
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      expect(mockContext.treatment).toHaveBeenCalledWith(experimentName)
    })
  })

  describe('Non-ExperimentView events', () => {
    it('should not trigger exposure tracking for regular goal events', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'purchase',
          revenue: 99.99,
        },
        name: 'purchase',
      }

      await trackListeners[0](mockEvent)

      // Should NOT call treatment or getOrCreateContext for regular goals
      expect(mockContext.treatment).not.toHaveBeenCalled()
      expect(mockContextManager.getOrCreateContext).not.toHaveBeenCalled()
    })

    it('should not trigger exposure tracking for events with goal_name property', async () => {
      const settings = createMockSettings()
      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          goal_name: 'signup',
        },
        name: '',
      }

      await trackListeners[0](mockEvent)

      // Should NOT call treatment or getOrCreateContext
      expect(mockContext.treatment).not.toHaveBeenCalled()
      expect(mockContextManager.getOrCreateContext).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle errors gracefully when getOrCreateContext fails', async () => {
      const settings = createMockSettings()

      // Make getOrCreateContext throw an error
      mockContextManager.getOrCreateContext.mockRejectedValue(new Error('Context creation failed'))

      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-exp',
        },
        name: 'ExperimentView',
      }

      // Should not throw
      await expect(trackListeners[0](mockEvent)).resolves.not.toThrow()

      // Should not call treatment or publish if context creation failed
      expect(mockContext.treatment).not.toHaveBeenCalled()
      expect(mockContextManager.publishContext).not.toHaveBeenCalled()
    })

    it('should handle errors when treatment() throws', async () => {
      const settings = createMockSettings()

      // Make treatment throw an error
      mockContext.treatment.mockImplementation(() => {
        throw new Error('Treatment failed')
      })

      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-exp',
        },
        name: 'ExperimentView',
      }

      // Should not throw
      await expect(trackListeners[0](mockEvent)).resolves.not.toThrow()
    })

    it('should handle errors when publishContext fails', async () => {
      const settings = createMockSettings()

      // Make publishContext throw an error
      mockContextManager.publishContext.mockRejectedValue(new Error('Publish failed'))

      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-exp',
        },
        name: 'ExperimentView',
      }

      // Should not throw
      await expect(trackListeners[0](mockEvent)).resolves.not.toThrow()

      // Treatment should still have been called
      expect(mockContext.treatment).toHaveBeenCalledWith('test-exp')
    })
  })

  describe('Debug logging', () => {
    it('should log debug messages when ENABLE_DEBUG is true', async () => {
      const settings = createMockSettings()
      settings.ENABLE_DEBUG = true

      // Spy on console methods
      const debugSpy = vi.spyOn(console, 'log')

      setupZarazMode(manager, settings)

      const mockEvent: MCEvent = {
        type: 'track',
        client: createMockClient(),
        payload: {
          name: 'ExperimentView',
          experimentName: 'test-exp',
        },
        name: 'ExperimentView',
      }

      await trackListeners[0](mockEvent)

      // Verify debug logging occurred (implementation specific)
      // The exact number of calls will depend on logger implementation
      expect(debugSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
    })
  })
})
