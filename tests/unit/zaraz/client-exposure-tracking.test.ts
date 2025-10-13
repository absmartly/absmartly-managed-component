// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDOMManipulatorBundle } from '../../../src/zaraz/client-bundle/dom-manipulator'

// Mock zaraz global
const mockZaraz = {
  track: vi.fn(),
}

describe('Client-Side Exposure Tracking', () => {
  let ABSmartlyDOMManipulator: any
  let manipulator: any
  let mockIntersectionObserver: any

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = ''

    // Create window.zaraz mock
    ;(global as any).zaraz = mockZaraz
    mockZaraz.track.mockClear()

    // Mock IntersectionObserver for jsdom
    mockIntersectionObserver = vi.fn()
    mockIntersectionObserver.prototype.observe = vi.fn()
    mockIntersectionObserver.prototype.unobserve = vi.fn()
    mockIntersectionObserver.prototype.disconnect = vi.fn()
    ;(global as any).IntersectionObserver = mockIntersectionObserver

    // Evaluate the DOM manipulator bundle to get the constructor
    const bundle = getDOMManipulatorBundle()
    eval(bundle)
    ABSmartlyDOMManipulator = (window as any).ABSmartlyDOMManipulator

    // Create manipulator instance
    manipulator = new ABSmartlyDOMManipulator({ debug: false })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    delete (window as any).ABSmartlyDOMManipulator
    delete (global as any).zaraz
    delete (global as any).IntersectionObserver
  })

  describe('immediate trigger (trigger_on_view: false or undefined)', () => {
    it('should NOT track exposure for immediate changes (tracked server-side)', () => {
      document.body.innerHTML = '<div class="button">Click me</div>'

      const changes = [
        {
          selector: '.button',
          type: 'style',
          value: { backgroundColor: 'red' },
          trigger_on_view: false, // Immediate trigger
        },
      ]

      manipulator.applyChanges('exp1', changes)

      // Should NOT call zaraz.track for immediate changes
      // (exposure already tracked server-side)
      expect(mockZaraz.track).not.toHaveBeenCalled()

      // Should NOT add tracking attributes
      const element = document.querySelector('.button')
      expect(element?.getAttribute('data-ab-experiment')).toBeNull()
      expect(element?.getAttribute('data-ab-trigger-on-view')).toBeNull()
    })

    it('should NOT track when trigger_on_view is undefined (defaults to immediate)', () => {
      document.body.innerHTML = '<h1>Title</h1>'

      const changes = [
        {
          selector: 'h1',
          type: 'text',
          value: 'New Title',
          // trigger_on_view undefined = immediate
        },
      ]

      manipulator.applyChanges('exp2', changes)

      expect(mockZaraz.track).not.toHaveBeenCalled()
    })
  })

  describe('on-view trigger (trigger_on_view: true)', () => {
    it('should mark elements with tracking attributes when trigger_on_view is true', () => {
      document.body.innerHTML = '<div class="content">Content</div>'

      const changes = [
        {
          selector: '.content',
          type: 'style',
          value: { backgroundColor: 'blue' },
          trigger_on_view: true,
        },
      ]

      manipulator.applyChanges('exp-onview', changes)

      const element = document.querySelector('.content')
      expect(element?.getAttribute('data-ab-experiment')).toBe('exp-onview')
      expect(element?.getAttribute('data-ab-trigger-on-view')).toBe('true')
    })

    it('should observe elements with trigger_on_view for viewport visibility', () => {
      document.body.innerHTML = '<div class="banner">Banner</div>'

      const changes = [
        {
          selector: '.banner',
          type: 'html',
          value: '<strong>New Banner</strong>',
          trigger_on_view: true,
        },
      ]

      // Spy on observe method
      const observeSpy = vi.spyOn(manipulator.intersectionObserver, 'observe')

      manipulator.applyChanges('exp-banner', changes)

      const element = document.querySelector('.banner')
      expect(observeSpy).toHaveBeenCalledWith(element)
    })

    it('should call zaraz.track when element becomes visible', () => {
      document.body.innerHTML = '<div class="product">Product</div>'

      const changes = [
        {
          selector: '.product',
          type: 'class',
          action: 'add',
          value: 'highlighted',
          trigger_on_view: true,
        },
      ]

      manipulator.applyChanges('exp-product', changes)

      const element = document.querySelector('.product')

      // Simulate IntersectionObserver callback
      const callback = manipulator.intersectionObserver.callback || manipulator.intersectionObserver
      if (callback) {
        // Manually trigger the intersection callback
        manipulator.trackExperimentView('exp-product')
      }

      expect(mockZaraz.track).toHaveBeenCalledWith('ExperimentView', {
        experimentName: 'exp-product',
      })
    })

    it('should only track each experiment once', () => {
      document.body.innerHTML = `
        <div class="elem1">Element 1</div>
        <div class="elem2">Element 2</div>
      `

      const changes = [
        {
          selector: '.elem1',
          type: 'style',
          value: { color: 'red' },
          trigger_on_view: true,
        },
        {
          selector: '.elem2',
          type: 'style',
          value: { color: 'blue' },
          trigger_on_view: true,
        },
      ]

      manipulator.applyChanges('exp-multi', changes)

      // Track first element
      manipulator.trackExperimentView('exp-multi')

      expect(mockZaraz.track).toHaveBeenCalledTimes(1)
      expect(mockZaraz.track).toHaveBeenCalledWith('ExperimentView', {
        experimentName: 'exp-multi',
      })

      // Try to track again - should be ignored
      manipulator.trackExperimentView('exp-multi')

      // Still only called once
      expect(mockZaraz.track).toHaveBeenCalledTimes(1)
    })
  })

  describe('multiple experiments', () => {
    it('should track different experiments independently', () => {
      document.body.innerHTML = `
        <div class="exp1-element">Exp 1</div>
        <div class="exp2-element">Exp 2</div>
      `

      const exp1Changes = [
        {
          selector: '.exp1-element',
          type: 'style',
          value: { color: 'red' },
          trigger_on_view: true,
        },
      ]

      const exp2Changes = [
        {
          selector: '.exp2-element',
          type: 'style',
          value: { color: 'blue' },
          trigger_on_view: false, // Immediate
        },
      ]

      manipulator.applyChanges('exp1', exp1Changes)
      manipulator.applyChanges('exp2', exp2Changes)

      // exp1 should have tracking attributes
      const exp1Elem = document.querySelector('.exp1-element')
      expect(exp1Elem?.getAttribute('data-ab-experiment')).toBe('exp1')

      // exp2 should NOT have tracking attributes (immediate)
      const exp2Elem = document.querySelector('.exp2-element')
      expect(exp2Elem?.getAttribute('data-ab-experiment')).toBeNull()
    })

    it('should track multiple on-view experiments separately', () => {
      document.body.innerHTML = `
        <div class="hero">Hero</div>
        <div class="footer">Footer</div>
      `

      manipulator.applyChanges('exp-hero', [
        { selector: '.hero', type: 'style', value: { height: '500px' }, trigger_on_view: true },
      ])

      manipulator.applyChanges('exp-footer', [
        { selector: '.footer', type: 'style', value: { background: 'gray' }, trigger_on_view: true },
      ])

      // Track first experiment
      manipulator.trackExperimentView('exp-hero')
      expect(mockZaraz.track).toHaveBeenCalledWith('ExperimentView', {
        experimentName: 'exp-hero',
      })

      // Track second experiment
      manipulator.trackExperimentView('exp-footer')
      expect(mockZaraz.track).toHaveBeenCalledWith('ExperimentView', {
        experimentName: 'exp-footer',
      })

      // Should have tracked both
      expect(mockZaraz.track).toHaveBeenCalledTimes(2)
    })
  })

  describe('mixed trigger types within same experiment', () => {
    it('should handle mix of immediate and on-view triggers', () => {
      document.body.innerHTML = `
        <div class="immediate">Immediate</div>
        <div class="on-view">On View</div>
      `

      const changes = [
        {
          selector: '.immediate',
          type: 'text',
          value: 'Changed Immediately',
          trigger_on_view: false,
        },
        {
          selector: '.on-view',
          type: 'text',
          value: 'Changed On View',
          trigger_on_view: true,
        },
      ]

      manipulator.applyChanges('exp-mixed', changes)

      // Only on-view element should have tracking attributes
      const immediateElem = document.querySelector('.immediate')
      const onViewElem = document.querySelector('.on-view')

      expect(immediateElem?.getAttribute('data-ab-experiment')).toBeNull()
      expect(onViewElem?.getAttribute('data-ab-experiment')).toBe('exp-mixed')
      expect(onViewElem?.getAttribute('data-ab-trigger-on-view')).toBe('true')
    })
  })

  describe('change types with trigger_on_view', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div class="target">Target</div>'
    })

    it('should work with text changes', () => {
      manipulator.applyChanges('exp-text', [
        { selector: '.target', type: 'text', value: 'New Text', trigger_on_view: true },
      ])

      const elem = document.querySelector('.target')
      expect(elem?.textContent).toBe('New Text')
      expect(elem?.getAttribute('data-ab-experiment')).toBe('exp-text')
    })

    it('should work with html changes', () => {
      manipulator.applyChanges('exp-html', [
        { selector: '.target', type: 'html', value: '<strong>Bold</strong>', trigger_on_view: true },
      ])

      const elem = document.querySelector('.target')
      expect(elem?.innerHTML).toContain('<strong>Bold</strong>')
      expect(elem?.getAttribute('data-ab-experiment')).toBe('exp-html')
    })

    it('should work with style changes', () => {
      manipulator.applyChanges('exp-style', [
        { selector: '.target', type: 'style', value: { color: 'red' }, trigger_on_view: true },
      ])

      const elem = document.querySelector('.target') as HTMLElement
      expect(elem?.style.color).toBe('red')
      expect(elem?.getAttribute('data-ab-experiment')).toBe('exp-style')
    })

    it('should work with class changes', () => {
      manipulator.applyChanges('exp-class', [
        { selector: '.target', type: 'class', action: 'add', value: 'active', trigger_on_view: true },
      ])

      const elem = document.querySelector('.target')
      expect(elem?.classList.contains('active')).toBe(true)
      expect(elem?.getAttribute('data-ab-experiment')).toBe('exp-class')
    })

    it('should work with attribute changes', () => {
      manipulator.applyChanges('exp-attr', [
        { selector: '.target', type: 'attribute', name: 'data-test', value: 'value', trigger_on_view: true },
      ])

      const elem = document.querySelector('.target')
      expect(elem?.getAttribute('data-test')).toBe('value')
      expect(elem?.getAttribute('data-ab-experiment')).toBe('exp-attr')
    })
  })

  describe('edge cases', () => {
    it('should handle elements not found', () => {
      manipulator.applyChanges('exp-missing', [
        { selector: '.nonexistent', type: 'text', value: 'Text', trigger_on_view: true },
      ])

      // Should not throw
      expect(mockZaraz.track).not.toHaveBeenCalled()
    })

    it('should handle missing zaraz gracefully', () => {
      delete (global as any).zaraz

      document.body.innerHTML = '<div class="elem">Element</div>'

      manipulator.applyChanges('exp-no-zaraz', [
        { selector: '.elem', type: 'text', value: 'Text', trigger_on_view: true },
      ])

      // Should not throw when tracking
      expect(() => {
        manipulator.trackExperimentView('exp-no-zaraz')
      }).not.toThrow()
    })

    it('should handle multiple elements with same selector', () => {
      document.body.innerHTML = `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
      `

      manipulator.applyChanges('exp-multiple', [
        { selector: '.item', type: 'class', action: 'add', value: 'highlighted', trigger_on_view: true },
      ])

      const items = document.querySelectorAll('.item')
      items.forEach((item) => {
        expect(item.classList.contains('highlighted')).toBe(true)
        expect(item.getAttribute('data-ab-experiment')).toBe('exp-multiple')
      })
    })

    it('should not re-apply already applied changes', () => {
      document.body.innerHTML = '<div class="elem">Original</div>'

      const changes = [
        { selector: '.elem', type: 'text', value: 'Changed', trigger_on_view: true },
      ]

      // Apply once
      manipulator.applyChanges('exp-once', changes)
      const elem = document.querySelector('.elem')
      expect(elem?.textContent).toBe('Changed')

      // Apply again
      manipulator.applyChanges('exp-once', changes)

      // Should still only say "Changed", not applied twice
      expect(elem?.textContent).toBe('Changed')
    })
  })

  describe('IntersectionObserver not supported', () => {
    it('should handle browsers without IntersectionObserver', () => {
      // Create new manipulator without IntersectionObserver
      const IntersectionObserverBackup = (global as any).IntersectionObserver
      delete (global as any).IntersectionObserver

      const manipulatorNoIO = new ABSmartlyDOMManipulator({ debug: false })

      expect(manipulatorNoIO.intersectionObserver).toBeNull()

      // Restore
      ;(global as any).IntersectionObserver = IntersectionObserverBackup
    })
  })

  describe('SPA mode', () => {
    it('should store experiment name with pending changes', () => {
      manipulator.options.spa = true

      // Try to apply change to element that doesn't exist yet
      manipulator.applyChanges('exp-spa', [
        { selector: '.future-element', type: 'text', value: 'Future', trigger_on_view: true },
      ])

      // Check pending changes structure
      expect(manipulator.pendingChanges.length).toBe(1)
      expect(manipulator.pendingChanges[0].experimentName).toBe('exp-spa')
      expect(manipulator.pendingChanges[0].change.selector).toBe('.future-element')
    })
  })
})
