# SDK Bundle Sources

This directory contains the TypeScript source files for ABsmartly SDK bundles.

## Architecture

### Shared Modules (Zero Duplication)
- **`shared/core.ts`** - Core SDK initialization primitives
- **`shared/absmartly-init.ts`** - Composable ABsmartlyInit factory
- **`shared/zaraz-integration.ts`** - Zaraz-specific event tracking
- **`shared/http-cookie-setter.ts`** - HttpOnly cookie setter for Zaraz mode

### Entry Points (Composition)
- **`zaraz/bundle-full.ts`** - Zaraz mode + WebVitals
- **`zaraz/bundle-lite.ts`** - Zaraz mode without WebVitals
- **`worker/bundle-full.ts`** - Worker mode + WebVitals
- **`worker/bundle-lite.ts`** - Worker mode without WebVitals

## Key Differences

### Zaraz Mode
- Imports `shared/zaraz-integration.ts`
- Calls `zaraz.track()` for exposures and goals
- Uses HttpOnly cookie setter
- Logs with `[ABsmartly Zaraz]` prefix

### Worker Mode
- Does NOT import `shared/zaraz-integration.ts`
- No `zaraz.track()` calls
- No HttpOnly cookie setter
- Logs with `[ABsmartly Worker]` prefix

## Plugin Imports

All bundles use clean plugin entry points:
```typescript
import { DOMChangesPluginLite } from '@absmartly/sdk-plugins/dom-changes'
import { CookiePlugin } from '@absmartly/sdk-plugins/cookie'
import { WebVitalsPlugin } from '@absmartly/sdk-plugins/web-vitals'
import { getOverrides } from '@absmartly/sdk-plugins/overrides'
```

## Build Process

1. TypeScript sources in `src/sdk-sources/` are compiled by esbuild
2. Generated JavaScript bundles go to `src/bundles/`
3. Generated inline TypeScript files for SDK injector go to `src/bundles/sdk-bundle-inline-*.ts`

**Build command:** `npm run bundle`

**Generated files:**
- `src/bundles/absmartly-sdk-bundle-zaraz-full.js` (218KB)
- `src/bundles/absmartly-sdk-bundle-zaraz-lite.js` (204KB)
- `src/bundles/absmartly-sdk-bundle-worker-full.js` (217KB)
- `src/bundles/absmartly-sdk-bundle-worker-lite.js` (203KB)

## Bundle Selection

The SDK injector (`src/core/sdk-injector.ts`) selects the correct bundle based on:
1. **Deployment mode** (`settings.DEPLOYMENT_MODE`): `zaraz` or `webcm`
2. **WebVitals enabled** (`settings.ENABLE_WEB_VITALS_PLUGIN`): `true` or `false`

Selection matrix:
| Mode   | WebVitals | Bundle Used        |
|--------|-----------|-------------------|
| Zaraz  | Yes       | zaraz-full        |
| Zaraz  | No        | zaraz-lite        |
| Worker | Yes       | worker-full       |
| Worker | No        | worker-lite       |

## Modifying Bundles

To modify bundle behavior:
1. Edit TypeScript sources in `src/sdk-sources/`
2. Run `npm run bundle` to regenerate
3. Never edit generated files in `src/bundles/` directly

## Tree-Shaking Results

✅ **Working!** Lite bundles are ~14KB smaller (WebVitals excluded)
