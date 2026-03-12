import { describe, it, expect, vi } from 'vitest'
import { URLRedirectHandler, URLRedirect } from '../../../src/core/url-redirect-handler'
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
  const logger = createLogger(false, 'worker')

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

    it('should return match for control variant when other variants have redirect config', () => {
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

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(true)
      expect(match?.experimentName).toBe('redirect-exp')
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

  describe('pattern redirect type', () => {
    it('should match wildcard pattern and substitute captures', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://absmartly.com/*', to: 'https://absmartly.com/v1/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://absmartly.com/for-data-teams', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://absmartly.com/v1/for-data-teams')
      expect(match?.experimentName).toBe('pattern-exp')
      expect(match?.variant).toBe(1)
    })

    it('should match wildcard pattern for root path', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://absmartly.com/*', to: 'https://absmartly.com/v1/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://absmartly.com/', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://absmartly.com/v1/')
    })

    it('should preserve query string with pattern redirect', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/new/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page?utm=test#section', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/new/page?utm=test#section')
    })

    it('should not match pattern with different origin', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://other.com/*', to: 'https://other.com/v1/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).toBeNull()
    })

    it('should support multiple wildcards with indexed references', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*/page/*', to: 'https://example.com/$2/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/section/page/detail', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/detail/section')
    })

    it('should match deep nested paths', () => {
      const experiments = [
        {
          name: 'pattern-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/prefix/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'pattern-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/a/b/c/d', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/prefix/a/b/c/d')
    })
  })

  describe('path-prefix redirect type', () => {
    it('should prepend path prefix to current path', () => {
      const experiments = [
        {
          name: 'prefix-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://example.com/v1', type: 'path-prefix' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'prefix-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/about', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/v1/about')
    })

    it('should prepend path prefix to root path', () => {
      const experiments = [
        {
          name: 'prefix-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://example.com/v1', type: 'path-prefix' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'prefix-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/v1/')
    })

    it('should preserve query string and hash with path-prefix', () => {
      const experiments = [
        {
          name: 'prefix-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://example.com/v1', type: 'path-prefix' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'prefix-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page?q=1#top', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/v1/page?q=1#top')
    })

    it('should not match path-prefix with different origin', () => {
      const experiments = [
        {
          name: 'prefix-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://other.com', to: 'https://other.com/v1', type: 'path-prefix' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'prefix-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).toBeNull()
    })

    it('should handle trailing slash on prefix', () => {
      const experiments = [
        {
          name: 'prefix-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'variant',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://example.com/v1/', type: 'path-prefix' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'prefix-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/about', context)

      expect(match).not.toBeNull()
      expect(match?.targetUrl).toBe('https://example.com/v1/about')
    })
  })

  describe('exposure tracking for variants without __url_redirect', () => {
    it('should return a match for control (variant 0) when other variants have matching redirects', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
                  ],
                  controlBehavior: 'no-redirect',
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
      expect(match?.experimentName).toBe('redirect-exp')
      expect(match?.variant).toBe(0)
      expect(match?.targetUrl).toBe('https://example.com/page')
      expect(match?.controlBehavior).toBe('no-redirect')
    })

    it('should pass through redirect-same controlBehavior for client-side use', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
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
      expect(match?.controlBehavior).toBe('redirect-same')
      expect(match?.targetUrl).toBe('https://example.com/page')
    })

    it('should pass through controlBehavior on treatment match', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
                  ],
                  controlBehavior: 'redirect-same',
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 1 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(false)
      expect(match?.controlBehavior).toBe('redirect-same')
      expect(match?.targetUrl).toBe('https://example.com/v1/page')
    })

    it('should return a match for a non-control variant that has no __url_redirect config', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment-a',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
                  ],
                },
              }),
            },
            { name: 'treatment-b', config: JSON.stringify({ some_other_var: 'value' }) },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 2 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(false)
      expect(match?.experimentName).toBe('redirect-exp')
      expect(match?.variant).toBe(2)
      expect(match?.targetUrl).toBe('https://example.com/page')
    })

    it('should return a match for control on root path', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com', to: 'https://example.com/v1', type: 'path-prefix' },
                  ],
                  controlBehavior: 'no-redirect',
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/', context)

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(true)
      expect(match?.targetUrl).toBe('https://example.com/')
    })

    it('should return a match when default controlBehavior (no-redirect) is used', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
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

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(true)
      expect(match?.experimentName).toBe('redirect-exp')
    })

    it('should not return a match when URL does not match any redirect from any variant', () => {
      const experiments = [
        {
          name: 'redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://other.com/*', to: 'https://other.com/v1/$1', type: 'pattern' },
                  ],
                  controlBehavior: 'no-redirect',
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

    it('should check redirects across multiple variants', () => {
      const experiments = [
        {
          name: 'multi-variant-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment-a',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://other.com/*', to: 'https://other.com/a/$1', type: 'pattern' },
                  ],
                },
              }),
            },
            {
              name: 'treatment-b',
              config: JSON.stringify({
                __url_redirect: {
                  redirects: [
                    { from: 'https://example.com/*', to: 'https://example.com/b/$1', type: 'pattern' },
                  ],
                },
              }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'multi-variant-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

      expect(match).not.toBeNull()
      expect(match?.isControl).toBe(true)
      expect(match?.experimentName).toBe('multi-variant-exp')
    })

    it('should not return a match when no variant has __url_redirect config', () => {
      const experiments = [
        {
          name: 'non-redirect-exp',
          variants: [
            { name: 'control', config: null },
            {
              name: 'treatment',
              config: JSON.stringify({ some_other_var: 'value' }),
            },
          ],
        },
      ]

      const context = createMockContext(experiments, { 'non-redirect-exp': 0 })
      const handler = new URLRedirectHandler({ settings, logger })

      const match = handler.findRedirectMatch('https://example.com/page', context)

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

  describe('redirect mode', () => {
    it('should parse mode as reverse-proxy', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern', mode: 'reverse-proxy' },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBe('reverse-proxy')
    })

    it('should parse mode as numeric status code', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern', mode: 301 },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBe(301)
    })

    it('should parse string status codes as numbers', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern', mode: '308' },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBe(308)
    })

    it('should ignore invalid mode values', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern', mode: 'invalid' },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBeUndefined()
    })

    it('should ignore invalid numeric status codes', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern', mode: 404 },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBeUndefined()
    })

    it('should leave mode undefined when not specified', () => {
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
                    { from: 'https://example.com/*', to: 'https://example.com/v1/$1', type: 'pattern' },
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

      expect(match).not.toBeNull()
      expect(match?.redirect.mode).toBeUndefined()
    })
  })

  describe('resolveMode', () => {
    it('should default to reverse-proxy on server', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page' }
      expect(URLRedirectHandler.resolveMode(redirect, 'server')).toBe('reverse-proxy')
    })

    it('should default to 302 on client', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page' }
      expect(URLRedirectHandler.resolveMode(redirect, 'client')).toBe(302)
    })

    it('should respect explicit reverse-proxy on server', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page', mode: 'reverse-proxy' }
      expect(URLRedirectHandler.resolveMode(redirect, 'server')).toBe('reverse-proxy')
    })

    it('should fallback reverse-proxy to 302 on client', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page', mode: 'reverse-proxy' }
      expect(URLRedirectHandler.resolveMode(redirect, 'client')).toBe(302)
    })

    it('should respect 301 on server', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page', mode: 301 }
      expect(URLRedirectHandler.resolveMode(redirect, 'server')).toBe(301)
    })

    it('should respect 301 on client', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page', mode: 301 }
      expect(URLRedirectHandler.resolveMode(redirect, 'client')).toBe(301)
    })

    it('should respect 308 on both sides', () => {
      const redirect: URLRedirect = { from: 'a', to: 'b', type: 'page', mode: 308 }
      expect(URLRedirectHandler.resolveMode(redirect, 'server')).toBe(308)
      expect(URLRedirectHandler.resolveMode(redirect, 'client')).toBe(308)
    })
  })
})
