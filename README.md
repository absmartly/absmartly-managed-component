# ABsmartly Managed Component

Flicker-free A/B testing at the edge with ABsmartly - powered by Cloudflare Zaraz and WebCM.

## Features

- 🚀 **Edge-based context creation** - 60-70% faster than client-only SDK
- ⚡ **Zero flicker** - Server-side HTML processing in both Zaraz and WebCM modes
- 🎨 **Visual Editor support** - All 10 DOM change types
- 🔧 **Two deployment modes** - Zaraz (Cloudflare) or WebCM (custom infrastructure)
- 🍪 **Persistent user identity** - Cookie-based tracking
- 🧪 **QA override support** - URL params + Browser Extension
- 📊 **Event tracking** - Goals, ecommerce, web vitals
- 📱 **SPA compatible** - Works with React, Vue, Angular via ABsmartly SDK
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

1. **Deploy the Worker**
   ```bash
   npm install
   npm run deploy:zaraz
   ```

2. **Add to Zaraz**

   See the complete setup guide: **[ZARAZ_SETUP.md](./ZARAZ_SETUP.md)**

   Quick summary:
   - Go to Cloudflare Dashboard → Zaraz → Third-party tools
   - Click "Add new tool" → "Custom Managed Component"
   - Select `custom-mc-absmartly` worker
   - Configure ABsmartly settings
   - Grant permissions and publish
   - Add triggers (Pageview is automatic)

3. **Done!** Your experiments will now run with minimal flicker.

### Option B: WebCM Proxy (Custom Infrastructure)

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
         "ABSMARTLY_APPLICATION": "website"
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
- When you control the infrastructure (nginx, etc.)
- Custom routing and filtering requirements
- Integration with existing proxies
- Complex CSS selectors (with linkedom support)

**How it works**:
1. Edge creates ABsmartly context
2. Modifies HTML response directly using linkedom
3. Browser receives final HTML (no JavaScript needed)
4. Optional: SPA bridge for client-side navigation

**Flicker**: 0ms (HTML is already modified)

### Mode Comparison

|  Feature               | Zaraz Mode                              | WebCM Mode                            |
|------------------------|-----------------------------------------|---------------------------------------|
| **Deployment**         | Via Cloudflare Dashboard                | Custom proxy/infrastructure           |
| **Setup Complexity**   | Easy (few clicks)                       | Advanced (req. proxy setup)           |
| **HTML Processing**    | Server-side (linkedom)                  | Server-side (linkedom)                |
| **CSS Selectors**      | Full support                            | Full support                          |
| **DOM Changes**        | Server-side                             | Server-side                           |
| **Treatment Tags**     | Server-side                             | Server-side                           |
| **Flicker**            | 0ms                                     | 0ms                                   |
| **On-View Tracking**   | Yes                                     | Yes                                   |
| **Client-side Bundle** | ~2-2.5KB (anti-flicker, trigger-on-view)| ~2-2.5KB (same bundle)                |
| **Event Tracking**     | Pageview, track, event, ecommerce       | track, event, ecommerce               |
| **Use Case**           | Easy deployment, Zaraz users            | Custom infrastructure, zero client JS |

### Key Differences Explained

**🎉 Both modes now have COMPLETE feature parity for A/B testing:**
- ✅ Both use linkedom for full CSS selector support
- ✅ Both process HTML server-side (zero flicker)
- ✅ Both support Treatment tags and DOM changes identically
- ✅ Both support on-view exposure tracking (ExperimentView events)
- ✅ Both inject the same lightweight client bundle (~2-2.5KB for anti-flicker + trigger-on-view)
- ✅ Both handle the same event types

**The ONLY differences are:**

1. **Deployment Method**
   - **Zaraz**: Deploy via Cloudflare Dashboard in minutes (no infrastructure changes)
   - **WebCM**: Deploy via custom proxy infrastructure (nginx → WebCM → origin)

2. **Event Handling**
   - **Zaraz**: Full event ecosystem including `pageview` event
   - **WebCM**: `track`, `event`, `ecommerce` events (no pageview)

3. **Client SDK Integration**
   - **Zaraz**: Optional client SDK injection for client-side A/B testing (SPA navigation)
   - **WebCM**: Use ABsmartly SDK directly for SPA support (no bridge needed)

**Choose Zaraz if:**
- You already use Cloudflare and want easy 1-click setup
- You want experiments running without infrastructure changes
- You need built-in client SDK support for client-side A/B testing

**Choose WebCM if:**
- You control your own infrastructure (nginx, reverse proxy, etc.)
- You need custom request routing or filtering logic
- You want to integrate with an existing edge proxy
- You prefer to manage the deployment yourself

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

### Anti-Flicker Settings (Both Modes)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ENABLE_ANTI_FLICKER` | boolean | `true` | Enable anti-flicker CSS injection |
| `HIDE_SELECTOR` | string | `"body"` | CSS selector to hide during loading |
| `HIDE_TIMEOUT` | number | `3000` | Maximum hide time in milliseconds |
| `TRANSITION_MS` | string | `"300"` | Fade-in duration in milliseconds |

### Client-Side Features (Both Modes)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `INJECT_CLIENT_BUNDLE` | boolean | `true` | Inject client bundle (anti-flicker + trigger-on-view) |
| `ENABLE_TRIGGER_ON_VIEW` | boolean | `true` | Enable viewport exposure tracking with IntersectionObserver |

### Client SDK Injection (Zaraz Only)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `INJECT_CLIENT_SDK` | boolean | `true` | Inject ABsmartly SDK for client-side A/B testing (SPAs) |
| `CLIENT_SDK_STRATEGY` | string | `"zaraz-bundle"` | SDK injection strategy: `"zaraz-bundle"` (served from /_zaraz/absmartly-sdk.js), `"cdn"` (from CDN), or `"custom"` |
| `CLIENT_SDK_CDN_PROVIDER` | string | `"unpkg"` | CDN provider for external SDK: `"unpkg"` or `"jsdelivr"` (used when strategy is `"cdn"`) |
| `CLIENT_SDK_VERSION` | string | `"latest"` | SDK version to load from CDN (e.g., `"1.15.0"`, `"latest"`) (used when strategy is `"cdn"`) |
| `CLIENT_SDK_URL` | string | - | Custom SDK URL (only used if `CLIENT_SDK_STRATEGY` is `"custom"`) |
| `PASS_SERVER_PAYLOAD` | boolean | `true` | Pass server-side context data to client SDK (avoids CDN fetch on pageload) |

### Feature Flags

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ENABLE_WEB_VITALS` | boolean | `false` | Track Core Web Vitals (CLS, LCP, FID, etc.) |
| `ENABLE_EMBEDS` | boolean | `true` | Enable server-side Treatment tag processing |
| `INJECT_CLIENT_DATA` | boolean | `false` | Inject experiment data into page (WebCM only) |
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

#### WebCM Mode - Basic
```javascript
{
  "DEPLOYMENT_MODE": "webcm",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website"
}
```

#### Zaraz Mode - With Client SDK (SPAs)
```javascript
{
  "DEPLOYMENT_MODE": "zaraz",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website",
  "INJECT_CLIENT_SDK": true,
  // CLIENT_SDK_STRATEGY defaults to "zaraz-bundle" (served from /_zaraz/absmartly-sdk.js)
  "PASS_SERVER_PAYLOAD": true
}
```

#### Zaraz Mode - Client SDK from CDN
```javascript
{
  "DEPLOYMENT_MODE": "zaraz",
  "ABSMARTLY_API_KEY": "your-api-key",
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ABSMARTLY_APPLICATION": "website",
  "INJECT_CLIENT_SDK": true,
  "CLIENT_SDK_STRATEGY": "cdn",
  "CLIENT_SDK_CDN_PROVIDER": "jsdelivr",
  "CLIENT_SDK_VERSION": "1.15.0",
  "PASS_SERVER_PAYLOAD": true
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

Variant 0 or A serves as the control/default when no treatment is assigned:

```html
<Treatment name="promo_banner">
  <TreatmentVariant variant="A">Limited Time: 50% Off!</TreatmentVariant>
  <TreatmentVariant variant="0">Shop Now</TreatmentVariant>
</Treatment>
```

**Note:** The parser implicitly uses variant `0` (numeric) or variant `A` (alphabetic) as the default when no matching treatment is found. You must explicitly specify `variant="0"` or `variant="A"` to define control content.

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
    <TreatmentVariant variant="0">
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
- `variant` (required): Treatment number (0, 1, 2) or letter (A, B, C)

**Variant Rules:**
- Use **numeric variants only** (0, 1, 2, 3) OR **alphabetic variants only** (A, B, C, D)
- Do **not mix** numeric and alphabetic variants in the same Treatment tag
- ❌ Invalid: `<TreatmentVariant variant="0">` and `<TreatmentVariant variant="A">` in same Treatment
- ✅ Valid: `<TreatmentVariant variant="0">` and `<TreatmentVariant variant="1">` in same Treatment
- ✅ Valid: `<TreatmentVariant variant="A">` and `<TreatmentVariant variant="B">` in same Treatment
- Variant 0 (numeric) or A (alphabetic) implicitly serves as the control/default

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

Both modes support Single-Page Applications through the **ABsmartly SDK**:

**First Page Load:**
- Server-side: HTML is manipulated at the edge (0ms flicker)
- Browser receives final HTML with experiment applied

**Client-Side Navigation:**
- ABsmartly SDK detects navigation via History API
- Automatically fetches new context for current URL
- Applies experiment treatments client-side
- No managed component action needed

**Configuration:**

Simply use the ABsmartly SDK on your SPA as you would normally:

```javascript
const context = await sdk.createContext({ ... })
context.ready().then(() => {
  const treatment = context.treatment('experiment_name')
  // Apply treatment in your component
})
context.publish()
```

The managed component handles:
- Initial page load experiments (server-side)
- Context creation with correct user identity
- Exposure tracking via `context.publish()`

The ABsmartly SDK handles:
- Client-side navigation detection
- On-demand context creation during navigation
- Treatment application in client code

**Why this approach?**
- Simpler integration (no duplicate logic)
- Better control over when treatments apply
- Works with any framework
- Reduces managed component complexity

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
| Flicker Duration | 300-500ms | **0ms** | **0ms** |
| Page Load Impact | +500KB | +2.5KB | +2.5KB |
| CSS Selectors | Basic | Full (linkedom) | Full (linkedom) |
| Server Response Time | 0ms | 0ms | +10-30ms |

**Note**: Both Zaraz and WebCM modes are now functionally identical. They share the same server-side HTML processing, client bundle, and performance characteristics. The only difference is deployment method (Cloudflare vs. custom proxy).

### Bundle Sizes

| Mode | Client Bundle | Server Bundle |
|------|--------------|---------------|
| Zaraz | ~2-2.5KB (anti-flicker + trigger-on-view) | - |
| WebCM | ~2-2.5KB (same as Zaraz) | 721KB (includes linkedom) |

**Note**: Client bundle size is minimal and shared between both modes. It includes anti-flicker CSS, trigger-on-view script, and initialization code only. No DOM manipulation code is included.

### Best Practices

**For best performance:**

1. **Minimize DOM changes**: Fewer changes = faster application
2. **Use specific selectors**: `.hero-title` is faster than `div > h1`
3. **Avoid JavaScript changes**: Use declarative changes when possible
4. **Set appropriate timeout**: `HIDE_TIMEOUT` should match your P95 load time
5. **Both modes deliver zero flicker**: No performance trade-off between Zaraz and WebCM

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
  - ABsmartly dashboard configuration
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

Both modes now have **identical performance and features** (zero flicker, full CSS selector support, etc.).

**Use Zaraz if:**
- You're already using Cloudflare
- You want quick deployment via dashboard (no infrastructure changes)
- You want built-in client SDK support

**Use WebCM if:**
- You control your own infrastructure
- You need custom request routing or filtering
- You prefer managing deployment yourself

### Do Treatment tags work in WebCM mode?

Yes! Treatment tags work in both Zaraz and WebCM modes. When `ENABLE_EMBEDS` is true, the HTML embed parser processes Treatment tags server-side and replaces them with the appropriate variant content before sending the response to the browser.

### How does trigger-on-view work?

1. Server replaces Treatment tag with content + `trigger-on-view` attribute
2. Client injects IntersectionObserver that scans for elements with this attribute
3. Watches each element with 50% visibility threshold
4. When element becomes visible, sends `ExperimentView` track event
5. ABsmartly records the exposure at that moment (solves below-the-fold SRM)

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

1. Ensure ABsmartly SDK is properly configured on your frontend
2. Check if framework uses History API (React Router, Vue Router, etc.)
3. Verify SDK is fetching contexts on navigation (check Network tab)
4. For hash routing (#/path), ensure SDK is configured with `hashRouting: true`
5. Check browser console for SDK errors with `ENABLE_DEBUG: true` on the managed component

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
