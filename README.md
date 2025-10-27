# ABsmartly Managed Component

Flicker-free A/B testing at the edge with ABsmartly - powered by Cloudflare Zaraz and WebCM.

## Features

- 🚀 **Edge-based context creation** - 60-70% faster than client-only SDK
- ⚡ **Zero flicker** - Server-side HTML processing in both Zaraz and WebCM modes
- 🎨 **Visual Editor support** - All 10 DOM change types
- 🔧 **Two deployment modes** - Zaraz (easy) or WebCM (maximum performance)
- 🍪 **Persistent user identity** - Cookie-based tracking
- 🧪 **QA override support** - URL params + Browser Extension
- 📊 **Event tracking** - Goals, ecommerce, web vitals
- 📱 **SPA support** - React, Vue, Angular compatible
- 🎯 **Treatment tags** - React-like HTML syntax for inline experiments
- 👁️ **Viewport tracking** - Client-side exposure on element visibility
- 🔍 **Full CSS selectors** - Complex selectors with linkedom (both modes)

## Table of Contents

- [Quick Start](#quick-start)
- [Deployment Modes](#deployment-modes)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Automatic Mode](#automatic-mode-no-html-changes)
  - [Treatment Tags](#treatment-tags-new)
  - [Legacy Embeds](#legacy-embeds-zaraz)
  - [QA Mode](#testing-experiments-qa-mode)
- [Supported DOM Change Types](#supported-dom-change-types)
- [Performance](#performance)
- [Documentation](#documentation)
- [Development](#development)

## Quick Start

### Option A: Cloudflare Zaraz (Recommended)

1. **Build the component**
   ```bash
   npm install
   npm run build
   npm run deploy:zaraz
   ```

2. **Add to Zaraz**
   - Go to Cloudflare Dashboard → Zaraz → Third-party tools
   - Click "Add new tool" → "Custom Managed Component"
   - Select the `absmartly-mc` worker
   - Configure settings (see [Configuration](#configuration))
   - Grant permissions
   - Add triggers (Pageview is automatic)

3. **Done!** Your experiments will now run with minimal flicker.

### Option B: WebCM Proxy (Maximum Performance)

1. **Install WebCM**
   ```bash
   npm install -g webcm
   ```

2. **Create `webcm.config.json`**
   ```json
   {
     "hostname": "localhost",
     "port": 1337,
     "target": "http://localhost:3000",
     "components": [{
       "name": "absmartly",
       "path": "./dist/index.js",
       "settings": {
         "DEPLOYMENT_MODE": "webcm",
         "ABSMARTLY_API_KEY": "your-api-key",
         "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
         "ABSMARTLY_ENVIRONMENT": "production",
         "ABSMARTLY_APPLICATION": "website",
         "ENABLE_SPA_MODE": true
       }
     }]
   }
   ```

3. **Run WebCM**
   ```bash
   webcm --config webcm.config.json
   ```

4. **Deploy to production** (nginx → WebCM → Origin)

## Deployment Modes

### Zaraz Mode (Server-Side with Request Interception)

**Architecture**: Edge modifies HTML → Browser receives final version

**Best for**:
- Easy deployment via Cloudflare Dashboard
- Websites already using Cloudflare Zaraz
- When you need flexibility to switch between modes
- Zero-flicker experiments with server-side DOM changes

**How it works**:
1. Edge intercepts HTTP requests and creates ABsmartly context
2. Modifies HTML response with Treatment tags and DOM changes
3. Browser receives final HTML (zero flicker!)
4. Optional: Client-side JavaScript for on-view tracking and SPA support

**Flicker**: 0ms (HTML is modified server-side before reaching browser)

### WebCM Mode (Server-Side)

**Architecture**: Edge modifies HTML → Browser receives final version

**Best for**:
- Maximum performance and zero flicker
- SEO-critical pages
- When you control the infrastructure
- Complex CSS selectors (with linkedom support)

**How it works**:
1. Edge creates ABsmartly context
2. Modifies HTML response directly using linkedom
3. Browser receives final HTML (no JavaScript needed)
4. Optional: SPA bridge for client-side navigation

**Flicker**: 0ms (HTML is already modified)

### Mode Comparison

| Feature | Zaraz Mode | WebCM Mode |
|---------|------------|------------|
| **Deployment** | Via Cloudflare Dashboard | Custom proxy/infrastructure |
| **Setup Complexity** | Easy (few clicks) | Advanced (requires proxy setup) |
| **HTML Processing** | ✅ Server-side (linkedom) | ✅ Server-side (linkedom) |
| **CSS Selectors** | ✅ Full support | ✅ Full support |
| **DOM Changes** | ✅ Server-side | ✅ Server-side |
| **Treatment Tags** | ✅ Server-side | ✅ Server-side |
| **Flicker** | 0ms | 0ms |
| **On-View Tracking** | ✅ Yes | ✅ Yes |
| **SPA API Endpoint** | ✅ Yes (`/__absmartly/context`) | ✅ Yes (`/__absmartly/context`) |
| **Client-side JS** | ✅ Always injected (~7KB) | ❌ Optional (SPA mode only) |
| **Event Tracking** | Pageview, track, event, ecommerce | track, event, ecommerce |
| **Use Case** | Easy deployment, Zaraz users | Custom infrastructure |

### Key Differences Explained

**🎉 Both modes now have COMPLETE feature parity for A/B testing:**
- ✅ Both use linkedom for full CSS selector support
- ✅ Both process HTML server-side (zero flicker)
- ✅ Both support Treatment tags and DOM changes identically
- ✅ Both support on-view exposure tracking (ExperimentView events)
- ✅ Both provide SPA API endpoint (`/__absmartly/context`)
- ✅ Both handle the same event types

**The ONLY differences now are:**

1. **Deployment Method**
   - **Zaraz**: Deploy via Cloudflare Dashboard in minutes (no infrastructure changes)
   - **WebCM**: Deploy via custom proxy infrastructure (nginx → WebCM → origin)

2. **Client-side JavaScript**
   - **Zaraz**: Always injects ~7KB client bundle (includes on-view tracking, anti-flicker, web vitals)
   - **WebCM**: Optional client JS only when `ENABLE_SPA_MODE: true` is set

3. **Event Handling**
   - **Zaraz**: Full event ecosystem including `pageview` event
   - **WebCM**: `track`, `event`, `ecommerce` events (no pageview)

**Choose Zaraz if:** You want easy deployment, already use Cloudflare Zaraz, or don't mind ~7KB client JS

**Choose WebCM if:** You want zero client JS by default, have custom proxy infrastructure, or need full control

## Configuration

### Required Settings

| Setting | Type | Description |
|---------|------|-------------|
| `ABSMARTLY_API_KEY` | string | ABsmartly API key from dashboard |
| `ABSMARTLY_ENDPOINT` | string | API endpoint (e.g., `https://api.absmartly.io/v1`) |
| `ABSMARTLY_ENVIRONMENT` | string | Environment name (e.g., `production`, `development`) |
| `ABSMARTLY_APPLICATION` | string | Application name from ABsmartly |

### Deployment Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `DEPLOYMENT_MODE` | string | `"zaraz"` | Deployment mode: `"zaraz"` or `"webcm"` |

### Cookie Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `COOKIE_NAME` | string | `"absmartly_id"` | Cookie name for user ID |
| `COOKIE_MAX_AGE` | number | `365` | Cookie lifetime in days |

### Anti-Flicker Settings (Zaraz Mode)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `HIDE_SELECTOR` | string | `"body"` | CSS selector to hide during loading |
| `HIDE_TIMEOUT` | number | `3000` | Maximum hide time in milliseconds |
| `TRANSITION_MS` | number | `300` | Fade-in duration in milliseconds |

### Feature Flags

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ENABLE_SPA_MODE` | boolean | `true` | Enable SPA navigation support |
| `ENABLE_WEB_VITALS` | boolean | `false` | Track Core Web Vitals (CLS, LCP, FID, etc.) |
| `ENABLE_EMBEDS` | boolean | `true` | Enable server-side Treatment tag processing |
| `INJECT_CLIENT_DATA` | boolean | `true` | Inject experiment data into page (WebCM only) |
| `ENABLE_DEBUG` | boolean | `false` | Enable debug logging in browser console |

### Advanced Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `VARIANT_MAPPING` | object | `{}` | Map variant names to treatment numbers (e.g., `{"control": 0, "variant": 1}`) |
| `EXCLUDED_PATHS` | array | `[]` | Paths to exclude from manipulation (WebCM only) |

### Configuration Examples

#### Zaraz Mode - Basic
```javascript
{
  "DEPLOYMENT_MODE": "zaraz",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website"
}
```

#### Zaraz Mode - With Treatment Tags
```javascript
{
  "DEPLOYMENT_MODE": "zaraz",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website",
  "ENABLE_EMBEDS": true,
  "VARIANT_MAPPING": {
    "control": 0,
    "variant_a": 1,
    "variant_b": 2
  }
}
```

#### WebCM Mode - With SPA Support
```javascript
{
  "DEPLOYMENT_MODE": "webcm",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website",
  "ENABLE_SPA_MODE": true,
  "INJECT_CLIENT_DATA": true
}
```

## Usage

### Automatic Mode (No HTML Changes)

Just enable the component - it handles everything automatically:

1. Creates ABsmartly context on the edge
2. Assigns users to experiment treatments
3. Applies DOM changes from Visual Editor
4. Tracks exposures and goals

**No code changes required!**

### Treatment Tags (NEW)

React-like HTML syntax for defining experiment variants inline. Works in both Zaraz and WebCM modes.

#### Basic Example

```html
<Treatment name="hero_test">
  <TreatmentVariant variant="0">Hello World</TreatmentVariant>
  <TreatmentVariant variant="1">Ola Mundo</TreatmentVariant>
</Treatment>
```

**Server-side output for user in treatment 1:**
```html
Ola Mundo
```

#### Alphabetic Variants

Use letters instead of numbers for better readability:

```html
<Treatment name="hero_test">
  <TreatmentVariant variant="A">Version A</TreatmentVariant>
  <TreatmentVariant variant="B">Version B</TreatmentVariant>
  <TreatmentVariant variant="C">Version C</TreatmentVariant>
</Treatment>
```

Automatic mapping: A=0, B=1, C=2, ...

#### Named Variants

Use custom variant names with `VARIANT_MAPPING`:

```html
<Treatment name="pricing_test">
  <TreatmentVariant variant="control">$99/month</TreatmentVariant>
  <TreatmentVariant variant="discount">$79/month</TreatmentVariant>
</Treatment>
```

**Configuration:**
```javascript
{
  "VARIANT_MAPPING": {
    "control": 0,
    "discount": 1
  }
}
```

#### Default Fallback

Show default content when user is not in the experiment:

```html
<Treatment name="promo_banner">
  <TreatmentVariant variant="A">Limited Time: 50% Off!</TreatmentVariant>
  <TreatmentVariant default>Shop Now</TreatmentVariant>
</Treatment>
```

#### Trigger-on-View (Viewport Tracking)

Track exposure only when content enters the viewport:

```html
<Treatment name="below_fold_cta" trigger-on-view>
  <TreatmentVariant variant="A">Sign Up Free</TreatmentVariant>
  <TreatmentVariant variant="B">Get Started</TreatmentVariant>
</Treatment>
```

**Server-side output:**
```html
<span trigger-on-view="below_fold_cta">Get Started</span>
```

**Client-side behavior:**
- IntersectionObserver watches for element visibility
- Tracks exposure when element is 50% visible
- Prevents SRM from never-seen variants

#### Complex Example

```html
<section class="hero">
  <Treatment name="hero_headline" trigger-on-view>
    <TreatmentVariant variant="A">
      <h1>Grow Your Business</h1>
      <p class="subheadline">Join 10,000+ companies</p>
    </TreatmentVariant>
    <TreatmentVariant variant="B">
      <h1>Scale with Confidence</h1>
      <p class="subheadline">Trusted by industry leaders</p>
    </TreatmentVariant>
    <TreatmentVariant default>
      <h1>Welcome</h1>
    </TreatmentVariant>
  </Treatment>

  <Treatment name="hero_cta">
    <TreatmentVariant variant="A">
      <button class="btn-primary">Start Free Trial</button>
    </TreatmentVariant>
    <TreatmentVariant variant="B">
      <button class="btn-primary">Get Started Free</button>
    </TreatmentVariant>
  </Treatment>
</section>
```

#### Treatment Tags Reference

**Supported Attributes:**

`<Treatment>`:
- `name` (required): Experiment name from ABsmartly
- `trigger-on-view` (optional): Enable viewport tracking

`<TreatmentVariant>`:
- `variant` (optional): Treatment number (0, 1, 2) or letter (A, B, C) or custom name


**Processing:**
- Server-side: Entire Treatment block is replaced with selected variant
- Only the selected variant content remains in HTML
- No loading or client-side rendering needed
- Works with JavaScript disabled

**Tracking:**
- Default: Exposure tracked server-side when HTML is generated
- With `trigger-on-view`: Exposure tracked client-side when visible
- Sends `ExperimentView` event to ABsmartly

**Availability:**
- ✅ Zaraz mode
- ✅ WebCM mode

**More Examples**: See [Treatment Tags Complete Guide](docs/TREATMENT_TAGS_GUIDE.md) for:
- E-commerce product cards
- Landing page heroes
- Pricing page variations
- Email signup forms
- Complex multi-variant tests
- Troubleshooting guide
- API reference

#### Advanced Treatment Tag Examples

**Named Variants with Mapping:**
```html
<!-- HTML -->
<Treatment name="pricing">
  <TreatmentVariant variant="control">$9/month</TreatmentVariant>
  <TreatmentVariant variant="premium">$15/month</TreatmentVariant>
</Treatment>

<!-- Configuration -->
{
  "VARIANT_MAPPING": {
    "control": 0,
    "premium": 1
  }
}
```

**Multiple Treatments with Complex HTML:**
```html
<div class="hero">
  <h1>
    <Treatment name="headline">
      <TreatmentVariant variant="A">Transform Your Business</TreatmentVariant>
      <TreatmentVariant variant="B">10x Your Revenue</TreatmentVariant>
    </Treatment>
  </h1>

  <Treatment name="cta_section" trigger-on-view>
    <TreatmentVariant variant="0">
      <button class="btn-primary">Start Free Trial</button>
      <p>No credit card required</p>
    </TreatmentVariant>
    <TreatmentVariant variant="1">
      <button class="btn-success btn-large">Get Started Free</button>
      <p>✓ 30-day money back guarantee</p>
      <p>✓ Cancel anytime</p>
    </TreatmentVariant>
  </Treatment>
</div>
```


### Legacy Embeds (Zaraz)

For backwards compatibility, the old embed format is still supported:

```html
<div data-component-embed="absmartly-experiment"
     data-exp-name="hero_test"
     data-default="<h1>Welcome</h1>">
</div>
```

**Note**: Treatment tags are recommended for new implementations.

### Testing Experiments (QA Mode)

#### URL Override

Force specific treatments via URL parameters:

```
https://yoursite.com?absmartly_experiment_name=1
```

Examples:
- `?absmartly_hero_test=0` - Force treatment 0
- `?absmartly_hero_test=1` - Force treatment 1
- `?absmartly_hero_test=2&absmartly_cta_test=1` - Multiple overrides

#### Browser Extension

Install the ABsmartly Browser Extension for a better QA experience:
- Visual treatment picker
- Experiment list
- Override management
- No URL parameters needed

Overrides are automatically detected and applied.

### SPA Support

#### Zaraz Mode - Client-Side

Automatically detects navigation in React, Vue, Angular, etc.:

- Watches for DOM changes
- Re-applies pending DOM changes after navigation
- Polls for path changes (fallback)

**Configuration:**
```javascript
{
  "ENABLE_SPA_MODE": true
}
```

**No code changes required** - works automatically!

#### WebCM Mode - Hybrid

Server-side first load + client-side navigation:

1. First page load: Server-side HTML manipulation (0ms flicker)
2. Navigation: Client-side bridge fetches new experiments
3. Applies changes client-side without page reload

**How it works:**
- Injects SPA bridge script into HTML
- Intercepts `history.pushState` / `replaceState`
- Fetches experiments via `/__absmartly/context` endpoint
- Applies DOM changes client-side

**Configuration:**
```javascript
{
  "ENABLE_SPA_MODE": true,
  "INJECT_CLIENT_DATA": true
}
```

## Supported DOM Change Types

All 10 types from ABsmartly Visual Editor are supported:

### 1. Text Change
Change text content of elements
```javascript
{
  "selector": "h1.hero-title",
  "type": "text",
  "value": "New Headline"
}
```

### 2. HTML Change
Replace innerHTML
```javascript
{
  "selector": ".banner",
  "type": "html",
  "value": "<div class='promo'>Sale!</div>"
}
```

### 3. Style Change
Modify inline styles
```javascript
{
  "selector": ".cta-button",
  "type": "style",
  "styles": {
    "backgroundColor": "#ff0000",
    "fontSize": "18px"
  }
}
```

### 4. Class Change
Add or remove CSS classes
```javascript
{
  "selector": ".card",
  "type": "class",
  "action": "add",
  "value": "highlighted"
}
```

### 5. Attribute Change
Set or remove attributes
```javascript
{
  "selector": "img.hero",
  "type": "attribute",
  "name": "src",
  "value": "/images/hero-v2.jpg"
}
```

### 6. Move Element
Relocate elements in the DOM
```javascript
{
  "selector": ".testimonial",
  "type": "move",
  "target": ".sidebar",
  "position": "append"
}
```

### 7. Delete Element
Remove elements from the DOM
```javascript
{
  "selector": ".old-banner",
  "type": "delete"
}
```

### 8. JavaScript
Execute custom JavaScript
```javascript
{
  "selector": "body",
  "type": "javascript",
  "value": "console.log('Experiment loaded');"
}
```

### 9. Create Element
Create new DOM elements
```javascript
{
  "selector": ".container",
  "type": "create",
  "html": "<div class='new-feature'>Try it now!</div>",
  "position": "beforeend"
}
```

### 10. Style Rules
Add global CSS rules
```javascript
{
  "selector": "body",
  "type": "styleRules",
  "css": ".special { color: blue; font-weight: bold; }"
}
```

### Trigger-on-View Support

Add viewport tracking to any change:

```javascript
{
  "selector": ".below-fold-section",
  "type": "text",
  "value": "Visible content",
  "trigger_on_view": true
}
```

**Behavior:**
- Change is applied immediately
- Exposure is tracked when element enters viewport
- Uses IntersectionObserver (50% visibility threshold)
- Prevents SRM for below-the-fold experiments

## Performance

### Benchmark Comparison

| Metric | Client SDK | Zaraz MC | WebCM MC |
|--------|-----------|----------|----------|
| Context Creation | 150-300ms | 50-100ms | 50-100ms |
| Flicker Duration | 300-500ms | 50-150ms | **0ms** |
| Page Load Impact | +500KB | +50KB | 0KB |
| CSS Selectors | Basic | Basic | Full (linkedom) |
| Server Response | 0ms | 0ms | +10-30ms |

### Bundle Sizes

| Mode | Client Bundle | Server Bundle |
|------|--------------|---------------|
| Zaraz | ~7KB | - |
| WebCM | 0KB | 721KB (includes linkedom) |

### Best Practices

**For best performance:**

1. **Minimize DOM changes**: Fewer changes = faster application
2. **Use specific selectors**: `.hero-title` is faster than `div > h1`
3. **Avoid JavaScript changes**: Use declarative changes when possible
4. **Set appropriate timeout**: `HIDE_TIMEOUT` should match your P95 load time
5. **Use WebCM for zero flicker**: When infrastructure allows

## Documentation

### Comprehensive Guides

- **[Treatment Tags Complete Guide](docs/TREATMENT_TAGS_GUIDE.md)** - Everything about Treatment Tags
  - Quick start and basic syntax
  - Variant identifiers (numeric, alphabetic, named)
  - Advanced features (trigger-on-view, defaults, mappings)
  - Configuration and best practices
  - Troubleshooting and FAQ
  - API reference and examples

- **[Setup Guide](docs/SETUP_GUIDE.md)** - Production deployment guide
  - ABSmartly dashboard configuration
  - Server-side experiment setup
  - Cloudflare Zaraz configuration
  - DOM changes reference
  - End-to-end examples
  - Migration from original plugin

- **[Future Enhancements](docs/FUTURE_ENHANCEMENTS.md)** - Experimental features and roadmap
  - JavaScript bundle processing (CSR SPA support)
  - Advanced targeting rules
  - Multi-armed bandit algorithms
  - Edge-Side Includes (ESI)
  - GraphQL API and real-time updates

### Test Coverage

The codebase includes comprehensive test coverage:

- **HTML Embed Parser**: 57 test cases covering all edge cases
  - Parsing (numeric, alphabetic, trigger-on-view, defaults)
  - Replacement logic (fallbacks, mappings, wrapping)
  - Processing (multiple treatments, missing experiments)
  - Validation (duplicates, defaults, structure)
  - Edge cases (whitespace, entities, malformed HTML)

Run tests:
```bash
npm test
```

Run specific test suite:
```bash
npm test tests/unit/core/html-embed-parser.test.ts
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Build for development (skip lint)
npm run build:dev

# Test
npm test

# Test with watch mode
npm run test:watch

# Test with UI
npm run test:ui
```

## Project Structure

```
src/
├── index.ts                      # Main entry point
├── types.ts                      # TypeScript types
├── core/                         # Shared core components
│   ├── context-manager.ts        # ABsmartly SDK integration
│   ├── cookie-handler.ts         # User identity & cookies
│   ├── overrides-handler.ts      # QA overrides
│   └── event-tracker.ts          # Goal & event tracking
├── zaraz/                        # Zaraz mode
│   ├── setup.ts                  # Zaraz initialization
│   ├── client-injector.ts        # Script injection
│   ├── embed-handler.ts          # Embed processing
│   ├── html-embed-parser.ts      # Treatment tag parser (NEW)
│   └── client-bundle/            # Client-side code
│       ├── dom-manipulator.ts    # DOM changes bundler
│       ├── initializer.ts        # Initialization bundler
│       └── scripts/
│           ├── dom-manipulator.js    # DOM manipulation
│           ├── init-template.js      # Init template
│           └── web-vitals-loader.js  # Web vitals
├── webcm/                        # WebCM mode
│   ├── setup.ts                  # WebCM initialization
│   ├── response-manipulator.ts   # HTML manipulation
│   ├── html-parser.ts            # Regex-based parser
│   ├── html-parser-linkedom.ts   # Linkedom parser (NEW)
│   └── spa-bridge.ts             # SPA navigation (NEW)
└── utils/                        # Utilities
    ├── logger.ts                 # Logging
    ├── serializer.ts             # Data serialization
    └── script-loader.ts          # Script loading
```

## Documentation

- [Setup Guide](./docs/SETUP_GUIDE.md) - Complete setup instructions
- [DOM Changes Comparison](/.claude/tasks/dom_changes_comparison.md) - Feature comparison
- [Implementation Plan](./PLAN.md) - Technical architecture
- [Session Context](/.claude/tasks/context_session_120868b7-2a7e-4cb9-a027-b45475aabe7c.md) - Development log

## FAQ

### When should I use Zaraz vs WebCM?

**Use Zaraz if:**
- You're already using Cloudflare
- You want easy deployment via dashboard
- You need Treatment tags
- 50-150ms flicker is acceptable

**Use WebCM if:**
- You need zero flicker
- You control the infrastructure
- You need complex CSS selectors
- SEO is critical

### Do Treatment tags work in WebCM mode?

Yes! Treatment tags work in both Zaraz and WebCM modes. When `ENABLE_EMBEDS` is true, the HTML embed parser processes Treatment tags server-side and replaces them with the appropriate variant content before sending the response to the browser.

### How does trigger-on-view work?

1. Server replaces Treatment tag with content + tracking attribute
2. Client scans for `[trigger-on-view]` elements on page load
3. IntersectionObserver watches each element
4. When element is 50% visible, sends `ExperimentView` event
5. ABsmartly records exposure at that moment

### Can I use Treatment tags with Visual Editor changes?

Yes! They work together:
- Treatment tags: Inline variant content
- Visual Editor: DOM changes applied on top
- Both use the same experiment assignments

### What's the difference between Treatment tags and embeds?

- **Treatment tags**: React-like HTML syntax, server-side processing, clean output
- **Legacy embeds**: Zaraz embed format, attribute-based, backwards compatibility

Treatment tags are recommended for new implementations.

## Migration Guide

### From Client-Side SDK

1. Remove ABsmartly JavaScript SDK from your site
2. Configure managed component with same API credentials
3. Keep experiment configurations in ABsmartly dashboard
4. Visual Editor changes work automatically
5. Update tracking code to use `zaraz.track()` (Zaraz) or keep existing (WebCM)

### From Original Plugin

See [DOM Changes Comparison](/.claude/tasks/dom_changes_comparison.md) for detailed feature differences.

**Quick checklist:**
- ✅ Basic DOM changes (text, html, style, class, etc.) - Full compatibility
- ✅ On-view tracking - Supported with `trigger_on_view`
- ⚠️ URL filtering - Not supported (use server-side routing instead)
- ⚠️ Cross-variant tracking - Not supported (may cause SRM)
- ⚠️ Style persistence - Not supported (may have issues with React/Vue)

## Troubleshooting

### Experiments not showing

1. Check API credentials in configuration
2. Verify experiment is running in ABsmartly dashboard
3. Check browser console for errors (`ENABLE_DEBUG: true`)
4. Confirm user is eligible (audience filters, etc.)
5. Try QA override: `?absmartly_experiment_name=1`

### Flicker on page load

1. Increase `HIDE_TIMEOUT` if experiments are slow to load
2. Use WebCM mode for zero flicker
3. Reduce number of DOM changes
4. Optimize `HIDE_SELECTOR` (narrower = better)

### SPA not working

1. Ensure `ENABLE_SPA_MODE: true`
2. Check if framework uses History API (React Router, Vue Router, etc.)
3. For hash routing (#/path), may need custom integration
4. WebCM: Ensure `INJECT_CLIENT_DATA: true` for SPA bridge

### Treatment tags not rendering

1. Verify `ENABLE_EMBEDS: true`
2. Check HTML syntax (closing tags, quotes, etc.)
3. Ensure experiment name matches ABsmartly dashboard
4. Check variant identifiers (0, 1, 2 or A, B, C)
5. Verify `VARIANT_MAPPING` if using custom names

## License

MIT

## Support

- **GitHub Issues**: https://github.com/absmartly/absmartly-managed-component/issues
- **ABsmartly Docs**: https://docs.absmartly.com
- **Email**: support@absmartly.com
