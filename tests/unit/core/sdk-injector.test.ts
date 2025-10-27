import { describe, it, expect, beforeEach } from 'vitest'
import { SDKInjector } from '../../../src/core/sdk-injector'
import { ABSmartlySettings } from '../../../src/types'
import { createLogger } from '../../../src/utils/logger'

describe('SDKInjector', () => {
  let settings: ABSmartlySettings
  let injector: SDKInjector

  beforeEach(() => {
    settings = {
      DEPLOYMENT_MODE: 'zaraz',
      ABSMARTLY_API_KEY: 'test-key',
      ABSMARTLY_ENDPOINT: 'https://api.absmartly.io/v1',
      ABSMARTLY_ENVIRONMENT: 'production',
      ABSMARTLY_APPLICATION: 'test-app',
      INJECT_CLIENT_SDK: true,
      PASS_SERVER_PAYLOAD: true,
      CLIENT_SDK_STRATEGY: 'cdn',
      CLIENT_SDK_CDN_PROVIDER: 'unpkg',
    } as ABSmartlySettings

    const logger = createLogger(false)
    injector = new SDKInjector({ settings, logger })
  })

  describe('shouldInjectSDK', () => {
    it('should return true when INJECT_CLIENT_SDK is true', () => {
      expect(injector.shouldInjectSDK()).toBe(true)
    })

    it('should return false when INJECT_CLIENT_SDK is false', () => {
      settings.INJECT_CLIENT_SDK = false
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      expect(injector.shouldInjectSDK()).toBe(false)
    })

    it('should return false when INJECT_CLIENT_SDK is undefined', () => {
      delete settings.INJECT_CLIENT_SDK
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      expect(injector.shouldInjectSDK()).toBe(false)
    })
  })

  describe('generateInjectionScript', () => {
    it('should return empty string when INJECT_CLIENT_SDK is false', () => {
      settings.INJECT_CLIENT_SDK = false
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toBe('')
    })

    it('should generate script with CDN URL when strategy is cdn', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('<script>')
      expect(script).toContain('unpkg.com/@absmartly/javascript-sdk')
      expect(script).toContain('"test-user"')
      expect(script).toContain('ABsmartly.SDK')
    })

    it('should use jsdelivr CDN when provider is jsdelivr', () => {
      settings.CLIENT_SDK_CDN_PROVIDER = 'jsdelivr'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('cdn.jsdelivr.net/npm/@absmartly/javascript-sdk')
    })

    it('should use custom URL when strategy is custom', () => {
      settings.CLIENT_SDK_STRATEGY = 'custom'
      settings.CLIENT_SDK_URL = 'https://custom.cdn.com/sdk.js'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('https://custom.cdn.com/sdk.js')
    })

    it('should use specified SDK version when provided', () => {
      settings.CLIENT_SDK_VERSION = '2.5.0'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('@2.5.0')
    })

    it('should pass server payload when PASS_SERVER_PAYLOAD is true', () => {
      const contextData = {
        experiments: [
          { id: 1, name: 'test-exp', variants: [] },
        ],
      }

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData,
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('serverData')
      expect(script).toContain(JSON.stringify(contextData))
      expect(script).toContain('createContextWith')
    })

    it('should not pass server payload when PASS_SERVER_PAYLOAD is false', () => {
      settings.PASS_SERVER_PAYLOAD = false
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      // Should pass null as serverData parameter
      expect(script).toContain(', null,')
      // Should use createContext (not createContextWith) in the else branch
      expect(script).toContain('createContext({')
    })

    it('should include overrides in script', () => {
      const overrides = {
        'test-exp': 1,
        'another-exp': 2,
      }

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides,
        experiments: [],
      })

      expect(script).toContain(JSON.stringify(overrides))
      expect(script).toContain('context.override')
    })

    it('should use IIFE pattern (no window globals)', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('(function(config, unitId, serverData, overrides)')
      expect(script).toMatch(/\}\)\(.*\);/)
      expect(script).not.toContain('window.__')
    })

    it('should include SDK configuration', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('"endpoint":"https://api.absmartly.io/v1"')
      expect(script).toContain('"apiKey":"test-key"')
      expect(script).toContain('"environment":"production"')
      expect(script).toContain('"application":"test-app"')
    })

    it('should include error handling', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('catch (error)')
      expect(script).toContain('console.error')
      expect(script).toContain('[ABsmartly] Failed to initialize SDK')
    })

    it('should set ABsmartlyContext on window', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('window.ABsmartlyContext = context')
    })
  })

  describe('bundled strategy', () => {
    it('should generate placeholder when strategy is bundled', () => {
      settings.CLIENT_SDK_STRATEGY = 'bundled'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('console.warn')
      expect(script).toContain('Bundled SDK not yet implemented')
    })
  })

  describe('CDN URL generation', () => {
    it('should default to unpkg with latest version', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('unpkg.com/@absmartly/javascript-sdk@latest')
    })

    it('should use custom version when specified', () => {
      settings.CLIENT_SDK_VERSION = '1.2.3'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('@absmartly/javascript-sdk@1.2.3')
    })

    it('should fallback to unpkg when CDN provider is invalid', () => {
      settings.CLIENT_SDK_CDN_PROVIDER = 'invalid' as any
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('unpkg.com')
    })
  })

  describe('SDK initialization logic', () => {
    it('should use createContextWith when server data is passed', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('if (serverData)')
      expect(script).toContain('createContextWith')
    })

    it('should use createContext when no server data', () => {
      settings.PASS_SERVER_PAYLOAD = false
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('createContext')
      expect(script).toContain('context.ready()')
    })

    it('should apply overrides when present', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: { 'test-exp': 1 },
        experiments: [],
      })

      expect(script).toContain('if (Object.keys(overrides).length > 0)')
      expect(script).toContain('for (var exp in overrides)')
      expect(script).toContain('context.override(exp, overrides[exp])')
    })

    it('should log success when server data is used', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('SDK initialized with server payload')
      expect(script).toContain('no CDN fetch')
    })
  })

  describe('script structure', () => {
    it('should be valid JavaScript', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toMatch(/<script[\s\S]*<\/script>/)
      // Should have 2 script tags: one for SDK src, one for init code
      expect(script.match(/<script/g)?.length).toBe(2)
      expect(script.match(/<\/script>/g)?.length).toBe(2)
    })

    it('should properly escape JSON in script', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user-with-"quotes"',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('\\"quotes\\"')
    })

    it('should use direct script tag with src attribute', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('<script src="')
      expect(script).toContain(' async></script>')
      expect(script).not.toContain('document.createElement')
    })

    it('should have 2 script tags (one for SDK, one for init)', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      const scriptTags = script.match(/<script/g)
      expect(scriptTags?.length).toBe(2)
    })
  })

  describe('zaraz-bundle strategy', () => {
    it('should use ABsmartlyInit helper for zaraz-bundle', () => {
      settings.CLIENT_SDK_STRATEGY = 'zaraz-bundle'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('/_zaraz/absmartly-sdk.js')
      expect(script).toContain('ABsmartlyInit(config, unitId, serverData, overrides)')
      expect(script).not.toContain('new ABsmartly.SDK')
    })

    it('should wait for ABsmartlyInit to be defined', () => {
      settings.CLIENT_SDK_STRATEGY = 'zaraz-bundle'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('if (typeof ABsmartlyInit !== \'undefined\')')
      expect(script).toContain('setTimeout(init, 50)')
    })

    it('should use DOMContentLoaded for zaraz-bundle', () => {
      settings.CLIENT_SDK_STRATEGY = 'zaraz-bundle'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('document.readyState')
      expect(script).toContain('DOMContentLoaded')
    })
  })

  describe('cdn and custom strategies', () => {
    it('should use full SDK initialization for CDN', () => {
      settings.CLIENT_SDK_STRATEGY = 'cdn'
      injector = new SDKInjector({ settings, logger: createLogger(false) })

      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('new ABsmartly.SDK(config)')
      expect(script).toContain('createContext')
      expect(script).not.toContain('ABsmartlyInit')
    })

    it('should wait for ABsmartly.SDK for CDN strategy', () => {
      const script = injector.generateInjectionScript({
        unitId: 'test-user',
        contextData: { experiments: [] },
        overrides: {},
        experiments: [],
      })

      expect(script).toContain('if (typeof ABsmartly !== \'undefined\' && ABsmartly.SDK)')
      expect(script).toContain('setTimeout(init, 50)')
    })
  })
})
