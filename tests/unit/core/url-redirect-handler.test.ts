import { describe, it, expect, vi } from 'vitest'
import { URLRedirectHandler } from '../../../src/core/url-redirect-handler'
import { ABsmartlySettings, ABsmartlyContext } from '../../../src/types'
import { createLogger } from '../../../src/utils/logger'

function createMockContext(experiments: any[], overrides: Record<string, number> = {}): ABsmartlyContext {
  return {
    ready: vi.fn().mockResolvedValue(undefined),
    peek: vi.fn((expName: string) => overrides[expName]),
    treatment: vi.fn((expName: string) => overrides[expName] ?? 0),
    override: vi.fn(),
    overrides: vi.fn(),
    attributes: vi.fn(),
    track: vi.fn(),
    data: () => ({ experiments }),
    getData: () => ({ experiments }),
    getContextData: () => ({ experiments }),
    publish: vi.fn().mockResolvedValue(undefined),
  } as ABsmartlyContext
}

function createMockSettings(): ABsmartlySettings {
  return {
    DEPLOYMENT_MODE: 'webcm',
    SDK_API_KEY: 'test-key',
    ENDPOINT: 'https://test.absmartly.io',
    ENVIRONMENT: 'test',
    APPLICATION: 'test-app',
    ENABLE_DEBUG: false,
  }
}

describe('URLRedirectHandler', () => {
  const settings = createMockSettings()
  const logger = createLogger(false, 'test')

  describe('findRedirectMatch', () => {
    it('should find domain redirect match', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://old.example.com', to: 'https://new.example.com', type: 'domain' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://old.example.com/some/path?query=1', context)

      expect(match).not.toBeNull()
      expect(match?.experimentName).toBe('redirect-exp')
      expect(match?.variant).toBe(1)
      expect(match?.targetUrl).toBe('https://new.example.com/some/path?query=1')
      expect(match?.isControl).toBe(false)
    })

    it('should find page redirect match', () => {
      const experiments = [
        {
          name: 'page-redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/old-page', to: 'https://example.com/new-page', type: 'page' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'page-redirect-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/old-page?utm=test', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/new-page?utm=test')
    })

    it('should return null when no redirect match', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://other.com', to: 'https://new.com', type: 'domain' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).toBeNull()
    })

    it('should return null when variant has no redirect config', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://new.com', type: 'domain' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).toBeNull()
    })

    it('should handle control variant with redirect-same behavior', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://new.com', type: 'domain' },
                  ],
                  controlBehavior: 'redirect-same',
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(true)
      expect(match?.targetUrl).toBe('https://example.com/page')
    })

    it('should apply URL filter', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://new.com', type: 'domain' },
                  ],
                  urlFilter: {
                    include: ['/specific/*'],
                    matchType: 'path',
                  },
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const noMatch = handler.findRedirectMatch('https://example.com/other/page', context)
      expect(noMatch).toBeNull()

      const match = handler.findRedirectMatch('https://example.com/specific/page', context)
      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://new.com/specific/page')
    })

    it('should use custom variable name', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                custom_redirect_var: {
                  redirects: [
                    { from: 'https://old.com', to: 'https://new.com', type: 'domain' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 1 })
      const handler = new URLRedirectHandler({
        settings,
        logger,
        variableName: 'custom_redirect_var',
      })

      const match = handler.findRedirectMatch('https://old.com/page', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://new.com/page')
    })

    it('should return null for invalid URLs', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://old.com', to: 'https://new.com', type: 'domain' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('not-a-valid-url', context)

      expect(match).toBeNull()
    })
  })

  describe('preservePath option', () => {
    it('should preserve path when preservePath is true', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://old.com', to: 'https://new.com', type: 'domain', preservePath: true },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://old.com/some/path?query=1#hash', context)

      expect(match?.targetUrl).toBe('https://new.com/some/path?query=1#hash')
    })

    it('should not preserve path when preservePath is false', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://old.com', to: 'https://new.com', type: 'domain', preservePath: false },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://old.com/some/path?query=1', context)

      expect(match?.targetUrl).toBe('https://new.com/')
    })
  })
})
