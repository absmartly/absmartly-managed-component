# DOM Changes Feature Matrix: Original vs Zaraz

Quick reference checklist for feature comparison between implementations.

## Legend
- ✅ Fully Implemented
- ⚠️ Partially Implemented / Different Format
- ❌ Not Implemented
- 🔧 Implementation Details Differ

---

## Core Change Types

| Feature | Original | Zaraz | Notes |
|---------|----------|-------|-------|
| **text** | ✅ | ✅ | Identical implementation |
| **html** | ✅ | ✅ | Identical implementation |
| **style** | ✅ | ⚠️ | Original has camelCase conversion, important flags |
| **styleRules** | ✅ | ✅ | Both inject CSS into stylesheet |
| **class** | ✅ | ⚠️ | Different schema: arrays vs action+value |
| **attribute** | ✅ | ⚠️ | Original: multi-attr object, Zaraz: single attr with name |
| **javascript** | ✅ | ✅ | Both use `new Function()` |
| **move** | ✅ | ✅ | Same position options |
| **create** | ✅ | ⚠️ | Original more robust, Zaraz has positioning issues |
| **delete** | ✅ | ✅ | Identical implementation |

---

## Advanced DOM Features

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **Pending Changes (waitForElement)** | ✅ | ⚠️ | Critical for lazy-loaded content |
| **Observer Root Customization** | ✅ | ❌ | Performance optimization for large DOMs |
| **Style Persistence** | ✅ | ❌ | Critical for React/Vue apps |
| **CSS Pseudo-states (hover/focus)** | ✅ | ✅ | Both support styleRules |
| **Important Flag for Styles** | ✅ | ❌ | Style priority control |
| **Element Creation** | ✅ | ⚠️ | Original handles multiple elements better |

---

## Experiment Configuration

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **URL Filtering** | ✅ | ❌ | Cannot target specific pages/paths |
| **URL Filter - Include Patterns** | ✅ | ❌ | Critical for multi-page experiments |
| **URL Filter - Exclude Patterns** | ✅ | ❌ | Prevent changes on certain pages |
| **URL Filter - Regex Mode** | ✅ | ❌ | Advanced URL matching |
| **URL Filter - Match Types** | ✅ | ❌ | domain/path/query/hash matching |
| **Global Change Defaults** | ✅ | ❌ | waitForElement, persistStyle, etc. |
| **Per-Variant Configuration** | ✅ | ❌ | Different config per variant |

---

## Exposure Tracking & SRM Prevention

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **Basic On-View Tracking** | ✅ | ✅ | Both have IntersectionObserver |
| **Cross-Variant Tracking** | ✅ | ❌ | **Critical for SRM prevention** |
| **Exposure Deduplication** | ✅ | ⚠️ | Original: per-element, Zaraz: per-experiment |
| **trigger_on_view Support** | ✅ | ✅ | Viewport-based exposure |
| **Immediate Trigger Tracking** | ✅ | ❌ | Track non-viewport experiments |
| **All-Variant Selector Tracking** | ✅ | ❌ | Track elements from all variants |
| **URL-Aware Trigger Logic** | ✅ | ❌ | Only track on matching URLs |

---

## SPA & Dynamic Content

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **SPA Mode** | ✅ | ⚠️ | Original more sophisticated |
| **Mutation Observer** | ✅ | ⚠️ | Original watches more scenarios |
| **React Hydration Recovery** | ✅ | ❌ | Re-apply changes after hydration |
| **URL Change Detection** | ✅ | ⚠️ | Original: event-based, Zaraz: polling |
| **Route Change Handling** | ✅ | ⚠️ | Original re-evaluates URL filters |
| **pushState Interception** | ✅ | ❌ | Immediate route change detection |
| **replaceState Interception** | ✅ | ❌ | Immediate route change detection |
| **popstate Listener** | ✅ | ❌ | Back/forward navigation |
| **Change Re-application on Route** | ✅ | ⚠️ | Zaraz clears, doesn't re-evaluate |

---

## HTML Injection

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **HTML Injection** | ✅ | ❌ | Cannot inject scripts/tracking |
| **Head Start Injection** | ✅ | ❌ | After `<head>` tag |
| **Head End Injection** | ✅ | ❌ | Before `</head>` tag |
| **Body Start Injection** | ✅ | ❌ | After `<body>` tag |
| **Body End Injection** | ✅ | ❌ | Before `</body>` tag |
| **Injection URL Filtering** | ✅ | ❌ | Filter injections by URL |
| **Parallel Injection & Changes** | ✅ | ❌ | Minimize flicker |

---

## Anti-Flicker & Loading

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **Anti-Flicker Support** | ✅ | ⚠️ | Zaraz: basic, Original: advanced |
| **Body Hide Mode** | ✅ | ❌ | Hide entire page |
| **Element Hide Mode** | ✅ | ❌ | Hide specific elements |
| **Custom Selector** | ✅ | ❌ | Target specific elements |
| **Timeout Failsafe** | ✅ | ❌ | Auto-show on timeout |
| **Smooth Transitions** | ✅ | ❌ | Fade-in animations |
| **Instant Reveal Option** | ✅ | ❌ | No transition mode |

---

## Developer Experience

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **Debug Mode** | ✅ | ⚠️ | Original: structured, Zaraz: console.log |
| **Performance Tracking** | ✅ | ❌ | Measure operation duration |
| **Structured Logging** | ✅ | ❌ | Rich debug data |
| **Experiment Summary** | ✅ | ❌ | Success/pending/total stats |
| **Error Handling** | ✅ | ⚠️ | Original more comprehensive |
| **Event System** | ✅ | ❌ | Lifecycle hooks (on/off/emit) |
| **TypeScript Types** | ✅ | ❌ | Type safety |

---

## Integration & Extensibility

| Feature | Original | Zaraz | Impact |
|---------|----------|-------|--------|
| **Browser Extension Integration** | ✅ | ❌ | Visual editor support |
| **Extension Message Protocol** | ✅ | ❌ | Two-way communication |
| **Preview Mode** | ✅ | ❌ | Test before publishing |
| **Plugin Registration** | ✅ | ❌ | Register with context |
| **Context Integration** | ✅ | ⚠️ | Original: `__plugins`, Zaraz: standalone |
| **API Methods** | ✅ | ⚠️ | Original has more methods |
| **Cleanup/Destroy** | ✅ | ❌ | Resource cleanup |

---

## Data Format Compatibility

| Feature | Original | Zaraz | Compatibility |
|---------|----------|-------|---------------|
| **Legacy Array Format** | ✅ | ✅ | Compatible |
| **Wrapped Config Format** | ✅ | ⚠️ | Zaraz ignores config |
| **Class: Array Add/Remove** | ✅ | ❌ | Incompatible |
| **Class: Action+Value** | ❌ | ✅ | Incompatible |
| **Attribute: Multi-property** | ✅ | ❌ | Incompatible |
| **Attribute: Single with Name** | ❌ | ✅ | Incompatible |
| **Style: Important Flag** | ✅ | ❌ | Incompatible |
| **Style: PersistStyle Flag** | ✅ | ❌ | Incompatible |
| **waitForElement** | ✅ | 🔧 | Auto-enabled in SPA mode |
| **observerRoot** | ✅ | ❌ | Incompatible |
| **trigger_on_view** | ✅ | ✅ | Compatible |

---

## Architecture & Code Quality

| Aspect | Original | Zaraz | Notes |
|--------|----------|-------|-------|
| **Language** | TypeScript | JavaScript (ES5) | Original: type-safe |
| **Module System** | ES6 Modules | IIFE | Zaraz: browser-ready |
| **Dependencies** | Multiple modules | Single file | Zaraz: simpler |
| **Code Organization** | Class-based OOP | Constructor function | Original: more structured |
| **Separation of Concerns** | ✅ Multiple files | ❌ Single file | Original: maintainable |
| **Test Coverage** | ✅ Comprehensive | ❌ None visible | Original: tested |
| **Build Process** | ✅ TypeScript + bundling | ❌ None | Zaraz: simpler deploy |
| **Bundle Size** | ~50KB | ~7KB | Zaraz: smaller |

---

## Performance Characteristics

| Metric | Original | Zaraz | Winner |
|--------|----------|-------|--------|
| **Bundle Size** | ~50KB (minified) | ~7KB | Zaraz |
| **Initialization Speed** | Moderate | Fast | Zaraz |
| **Runtime Performance** | Optimized | Good | Similar |
| **Memory Usage** | Higher (more features) | Lower | Zaraz |
| **Feature Completeness** | High | Low | Original |
| **Browser Compatibility** | Modern browsers | IE11+ | Zaraz |

---

## Critical Missing Features in Zaraz

### High Impact (Breaks Functionality)
1. ❌ **URL Filtering** - Cannot target specific pages
2. ❌ **Cross-Variant Exposure Tracking** - SRM risk
3. ❌ **Style Persistence** - Breaks in React/Vue apps
4. ❌ **HTML Injection** - Cannot inject tracking code
5. ❌ **Anti-Flicker Timeout Failsafe** - UX risk

### Medium Impact (Degrades Experience)
6. ❌ **Sophisticated Pending Changes** - Unreliable for lazy content
7. ❌ **Browser Extension Integration** - No visual editor
8. ❌ **Event System** - No lifecycle hooks
9. ❌ **Multi-attribute/class Changes** - Multiple entries needed
10. ❌ **Performance Tracking** - No visibility into issues

### Low Impact (Nice to Have)
11. ❌ **Structured Debug Logs** - Harder to troubleshoot
12. ❌ **TypeScript Types** - No type safety
13. ❌ **Global Change Defaults** - More verbose config
14. ❌ **Plugin Registration** - No context integration
15. ❌ **Cleanup/Destroy** - Memory leak risk

---

## Use Case Recommendations

### ✅ Use Original Plugin When:
- Running experiments on React/Vue/Angular apps
- Need URL filtering for multi-page experiments
- Require SRM prevention (cross-variant tracking)
- Using browser extension / visual editor
- Need anti-flicker protection
- Working with lazy-loaded/dynamic content
- Need HTML injection capabilities
- Enterprise deployment with robustness requirements

### ✅ Use Zaraz Implementation When:
- Simple text/style experiments only
- Static sites (no framework conflicts)
- Performance is critical (small bundle)
- Edge deployment preferred
- Don't need visual editor
- Accept SRM risk for simpler deployment
- IE11 support required
- Very basic experiments only

---

## Migration Checklist

### From Original to Zaraz
- [ ] Convert class changes: array → action+value
- [ ] Split multi-attribute changes into separate entries
- [ ] Remove URL filtering (implement at edge level)
- [ ] Add manual anti-flicker script
- [ ] Remove HTML injections (inject separately)
- [ ] Accept SRM risk or implement custom tracking
- [ ] Test on React/Vue apps (style persistence lost)
- [ ] Remove browser extension integration
- [ ] Simplify debug logging expectations

### From Zaraz to Original
- [ ] Convert class changes: action+value → array
- [ ] Combine attribute changes into objects
- [ ] Add URL filtering configurations
- [ ] Configure anti-flicker settings
- [ ] Migrate HTML injections to __inject_html
- [ ] Enable cross-variant tracking
- [ ] Add persistStyle to React/Vue experiments
- [ ] Set up browser extension if needed
- [ ] Enable debug mode for detailed logs

---

## Summary

**Original SDK Plugin**: Enterprise-grade, feature-complete solution
- Best for: Complex experiments, React/Vue apps, multi-page sites
- Trade-off: Larger bundle, more complex

**Zaraz Implementation**: Lightweight, simplified version  
- Best for: Simple experiments, static sites, edge deployment
- Trade-off: Missing critical features, SRM risk

**Recommendation**: Use Original for production experiments requiring robustness and accuracy. Use Zaraz only for very simple experiments where feature limitations are acceptable.
