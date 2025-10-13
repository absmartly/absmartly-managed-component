# ABsmartly Managed Component

Flicker-free A/B testing at the edge with ABsmartly - powered by Cloudflare Zaraz and WebCM.

## Features

- 🚀 **Edge-based context creation** - 60-70% faster than client-only SDK
- ⚡ **Minimal flicker** - 50-150ms (Zaraz) or 0ms (WebCM)
- 🎨 **Visual Editor support** - All 10 DOM change types
- 🔧 **Two deployment modes** - Zaraz (easy) or WebCM (maximum performance)
- 🍪 **Persistent user identity** - Cookie-based tracking
- 🧪 **QA override support** - URL params + Browser Extension
- 📊 **Event tracking** - Goals, ecommerce, web vitals
- 📱 **SPA support** - React, Vue, Angular compatible

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

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `DEPLOYMENT_MODE` | string | `"zaraz"` | Deployment mode: "zaraz" or "webcm" |
| `ABSMARTLY_API_KEY` | string | **required** | ABsmartly API key |
| `ABSMARTLY_ENDPOINT` | string | **required** | API endpoint (e.g., https://api.absmartly.io/v1) |
| `ABSMARTLY_ENVIRONMENT` | string | **required** | Environment name |
| `ABSMARTLY_APPLICATION` | string | **required** | Application name |
| `COOKIE_NAME` | string | `"absmartly_id"` | Cookie name for user ID |
| `COOKIE_MAX_AGE` | number | `365` | Cookie lifetime (days) |
| `HIDE_SELECTOR` | string | `"body"` | CSS selector to hide during loading (Zaraz only) |
| `HIDE_TIMEOUT` | number | `3000` | Max hide time (ms) |
| `TRANSITION_MS` | number | `300` | Fade-in duration (ms) |
| `ENABLE_SPA_MODE` | boolean | `true` | Enable SPA support |
| `ENABLE_WEB_VITALS` | boolean | `false` | Track web vitals |
| `ENABLE_EMBEDS` | boolean | `true` | Enable server-side embeds |
| `ENABLE_DEBUG` | boolean | `false` | Debug logging |

## Usage

### Automatic Mode (No HTML Changes)

Just enable the component - it handles everything automatically.

### Embed Mode (Zaraz - Server-Side Rendering)

```html
<!-- Hero experiment -->
<div data-component-embed="absmartly-experiment"
     data-exp-name="hero_test"
     data-default="<h1>Welcome</h1>">
</div>

<!-- CTA experiment -->
<div data-component-embed="absmartly-experiment"
     data-exp-name="cta_button_test"
     data-default="<button>Sign Up</button>">
</div>
```

### Testing Experiments (QA Mode)

**URL Override:**
```
https://yoursite.com?absmartly_hero_test=1
```

**Browser Extension:**
Install ABsmartly Browser Extension - overrides are detected automatically.

## Supported DOM Change Types

All 10 types from ABsmartly Visual Editor:

- ✅ text - Change text content
- ✅ html - Replace innerHTML
- ✅ style - Modify inline styles
- ✅ class - Add/remove classes
- ✅ attribute - Set/remove attributes
- ✅ move - Relocate elements
- ✅ delete - Remove elements
- ✅ javascript - Execute custom code
- ✅ create - Create new elements
- ✅ styleRules - Add CSS rules

## Performance

| Metric | Client SDK | Zaraz MC | WebCM MC |
|--------|-----------|----------|----------|
| Context Creation | 150-300ms | 50-100ms | 50-100ms |
| Flicker Duration | 300-500ms | 50-150ms | **0ms** |
| Page Load Impact | +500KB | +50KB | 0KB |

## Architecture

See [PLAN.md](./PLAN.md) for detailed architecture and implementation plan.

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
├── core/                         # Shared core components
│   ├── context-manager.ts
│   ├── cookie-handler.ts
│   ├── overrides-handler.ts
│   └── event-tracker.ts
├── zaraz/                        # Zaraz mode
│   ├── setup.ts
│   ├── client-injector.ts
│   ├── embed-handler.ts
│   └── client-bundle/
├── webcm/                        # WebCM mode
│   ├── setup.ts
│   ├── response-manipulator.ts
│   └── html-parser.ts
└── utils/                        # Utilities
    ├── logger.ts
    └── serializer.ts
```

## Documentation

- [Cloudflare Zaraz Deployment Guide](./docs/ZARAZ_DEPLOYMENT.md)
- [WebCM Deployment Guide](./docs/WEBCM_DEPLOYMENT.md)
- [Configuration Reference](./docs/CONFIGURATION.md)
- [Implementation Plan](./PLAN.md)

## License

MIT

## Support

- GitHub Issues: https://github.com/absmartly/absmartly-managed-component/issues
- ABsmartly Docs: https://docs.absmartly.com
- Email: support@absmartly.com
