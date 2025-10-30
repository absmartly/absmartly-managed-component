import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbedHandler } from '../../../src/zaraz/embed-handler'
import { ContextManager } from '../../../src/core/context-manager'
import { CookieHandler } from '../../../src/core/cookie-handler'
import { ABSmartlySettings, Logger } from '../../../src/types'
import { Manager } from '@managed-components/types'

describe('EmbedHandler', () => {
  let manager: Partial<Manager>
  let contextManager: Partial<ContextManager>
  let cookieHandler: Partial<CookieHandler>
  let settings: ABSmartlySettings
  let logger: Logger
  let mockContext: any
  let mockClient: any
  let mockPayload: Map<string, any>
  let embedCallback: Function

  beforeEach(() => {
    mockContext = {
      treatment: vi.fn(),
      getData: vi.fn(),
    }

    embedCallback = vi.fn()

    manager = {
      registerEmbed: vi.fn((name: string, callback: Function): boolean => {
        embedCallback = callback
        return true
      }),
    }

    contextManager = {
      getOrCreateContext: vi.fn().mockResolvedValue(mockContext),
    }

    cookieHandler = {
      getUserId: vi.fn().mockReturnValue('user123'),
    }

    settings = {
      DEPLOYMENT_MODE: 'zaraz',
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

    mockClient = {
      url: 'https://example.com',
    }

    mockPayload = new Map()
  })

  describe('setup', () => {
    it('should register experiment embed when embeds enabled', () => {
      const handler = new EmbedHandler(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      handler.setup()

      expect(manager.registerEmbed).toHaveBeenCalledWith('experiment', expect.any(Function))
      expect(logger.debug).toHaveBeenCalledWith('Setting up ABsmartly embeds')
      expect(logger.debug).toHaveBeenCalledWith('Embeds registered successfully')
    })

    it('should skip setup when embeds disabled', () => {
      settings.ENABLE_EMBEDS = false
      const handler = new EmbedHandler(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )

      handler.setup()

      expect(manager.registerEmbed).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('Embeds disabled, skipping setup')
    })
  })

  describe('handleExperimentEmbed', () => {
    beforeEach(() => {
      const handler = new EmbedHandler(
        manager as Manager,
        contextManager as ContextManager,
        cookieHandler as CookieHandler,
        settings,
        logger
      )
      handler.setup()
    })

    it('should return variant HTML for eligible user', async () => {
      mockPayload.set('exp-name', 'experiment1')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(1)
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: { html: '<div>Control</div>' } },
              { name: 'variant_a', config: { html: '<div>Variant A</div>' } },
            ],
          },
        ],
      })

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('<div>Variant A</div>')
      expect(cookieHandler.getUserId).toHaveBeenCalledWith(mockClient)
      expect(contextManager.getOrCreateContext).toHaveBeenCalledWith('user123')
    })

    it('should return default content when user not eligible', async () => {
      mockPayload.set('exp-name', 'experiment1')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(-1) // Not eligible

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('Default content')
    })

    it('should return default content when treatment is undefined', async () => {
      mockPayload.set('exp-name', 'experiment1')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(undefined)

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('Default content')
    })

    it('should return default content when no experiment name provided', async () => {
      mockPayload.set('default', 'Default content')

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('Default content')
      expect(logger.warn).toHaveBeenCalledWith('No experiment name provided for embed')
    })

    it('should return empty string if no default provided', async () => {
      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('')
    })

    it('should return default content when experiment not found', async () => {
      mockPayload.set('exp-name', 'nonexistent')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(1)
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'other_experiment',
            variants: [],
          },
        ],
      })

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('Default content')
      expect(logger.warn).toHaveBeenCalledWith('Experiment not found in context', {
        experimentName: 'nonexistent',
      })
    })

    it('should return default content when variant not found', async () => {
      mockPayload.set('exp-name', 'experiment1')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(5) // Out of range
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: { html: '<div>Control</div>' } },
            ],
          },
        ],
      })

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('Default content')
      expect(logger.warn).toHaveBeenCalledWith('Variant not found', {
        experimentName: 'experiment1',
        treatment: 5,
      })
    })

    it('should use config.content if config.html not available', async () => {
      mockPayload.set('exp-name', 'experiment1')
      mockPayload.set('default', 'Default content')

      mockContext.treatment.mockReturnValue(0)
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: { content: '<p>Content</p>' } },
            ],
          },
        ],
      })

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('<p>Content</p>')
    })

    it('should return empty string when no config.html or config.content', async () => {
      mockPayload.set('exp-name', 'experiment1')

      mockContext.treatment.mockReturnValue(0)
      mockContext.getData.mockReturnValue({
        experiments: [
          {
            name: 'experiment1',
            variants: [
              { name: 'control', config: {} },
            ],
          },
        ],
      })

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('')
    })

    it('should handle errors gracefully', async () => {
      mockPayload.set('exp-name', 'experiment1')

      contextManager.getOrCreateContext = vi.fn().mockRejectedValue(new Error('Context error'))

      const result = await embedCallback({ client: mockClient, parameters: Object.fromEntries(mockPayload) })

      expect(result).toBe('')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to handle experiment embed:',
        expect.any(Error)
      )
    })
  })
})
