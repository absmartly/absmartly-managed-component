# ABSmartly Managed Component - Cloudflare Zaraz Deployment Plan

## Executive Summary

This document outlines a comprehensive deployment strategy for deploying the ABSmartly Managed Component to Cloudflare Zaraz. The deployment uses Cloudflare Workers as the runtime environment, with integration into the Zaraz ecosystem through the `managed-component-to-cloudflare-worker` CLI tool.

**Current Status**: Project has TypeScript build errors that must be resolved before deployment can proceed.

---

## Table of Contents

1. [Current Project Analysis](#current-project-analysis)
2. [Cloudflare Zaraz Architecture](#cloudflare-zaraz-architecture)
3. [Prerequisites](#prerequisites)
4. [Build Issues to Resolve](#build-issues-to-resolve)
5. [Deployment Process](#deployment-process)
6. [Implementation Plan](#implementation-plan)
7. [Environment Configuration](#environment-configuration)
8. [Testing Strategy](#testing-strategy)
9. [Rollback Strategy](#rollback-strategy)
10. [Monitoring & Observability](#monitoring--observability)
11. [Best Practices](#best-practices)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Current Project Analysis

### Project Structure
```
/Users/joalves/git_tree/absmartly-managed-component/
├── src/
│   ├── index.ts                          # Main entry point (default export)
│   ├── core/                             # Shared core components
│   │   ├── context-manager.ts            # ABsmartly context creation
│   │   ├── cookie-handler.ts             # User ID/cookie management
│   │   ├── overrides-handler.ts          # QA override detection
│   │   └── event-tracker.ts              # Event tracking
│   ├── zaraz/                            # Zaraz-specific implementation
│   │   ├── setup.ts                      # Zaraz mode setup
│   │   ├── client-injector.ts            # client.execute() injection
│   │   ├── embed-handler.ts              # registerEmbed() handler
│   │   └── client-bundle/                # Client-side bundles
│   │       ├── scripts/
│   │       │   ├── dom-manipulator.js    # Client-side DOM manipulation
│   │       │   ├── init-template.js      # Initialization template
│   │       │   └── web-vitals-loader.js  # Web vitals tracking
│   │       ├── script-loader.ts          # Script loading utility
│   │       ├── anti-flicker.ts           # Anti-flicker CSS
│   │       ├── dom-manipulator.ts        # DOM manipulator wrapper
│   │       └── initializer.ts            # Init script generator
│   ├── webcm/                            # WebCM mode (alternative deployment)
│   │   ├── setup.ts
│   │   ├── response-manipulator.ts
│   │   └── html-parser.ts
│   ├── utils/
│   │   ├── logger.ts                     # Debug logging
│   │   └── serializer.ts                 # Data serialization
│   └── types/
│       └── index.ts                      # TypeScript definitions
├── tests/                                # Test suites
├── package.json                          # Project metadata & scripts
├── manifest.json                         # Zaraz component manifest
├── esbuild.js                           # Build configuration
├── tsconfig.json                        # TypeScript configuration
└── README.md                            # Documentation
```

### Current Build Configuration

**Build Tool**: esbuild (version 0.19.0)

**Build Script** (`esbuild.js`):
```javascript
require('esbuild').buildSync({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  target: ['esnext'],
  tsconfig: 'tsconfig.build.json',
  outfile: 'dist/index.js',
})
```

**Output**: Single bundled file at `dist/index.js` (currently in .gitignore)

### NPM Scripts Analysis

```json
{
  "lint": "eslint --ext .ts src",
  "lint:fix": "eslint --ext .ts src --fix",
  "bundle": "node esbuild.js",
  "build": "npm run typecheck && npm run lint && npm run bundle",
  "build:dev": "npm run typecheck && npm run bundle",
  "typecheck": "tsc --project tsconfig.build.json --noEmit",
  "test": "vitest run --globals --passWithNoTests",
  "test:watch": "vitest --globals --passWithNoTests",
  "test:ui": "vitest --ui --globals --passWithNoTests",
  "deploy:zaraz": "npm run build && npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc",
  "release": "npm run build && npm version patch && npm publish"
}
```

**Analysis**:
- `deploy:zaraz` script exists but is incomplete
- Uses `npx managed-component-to-cloudflare-worker` CLI tool
- Worker name: `absmartly-mc`
- Build must complete successfully before deployment

### Dependencies

**Runtime Dependencies**:
- `@absmartly/javascript-sdk` (^1.13.2) - Core ABsmartly SDK

**Dev Dependencies**:
- `@managed-components/types` (^1.3.1) - TypeScript types for Managed Components
- `@types/node` (^20.0.0)
- `@typescript-eslint/eslint-plugin` (^5.27.0)
- `esbuild` (^0.19.0) - Build tool
- `typescript` (^5.0.0)
- `vitest` (^0.34.0) - Testing framework
- `cheerio` (^1.0.0-rc.12) - HTML parsing (for WebCM mode)
- `jsdom` (^27.0.0) - DOM simulation for tests

### Manifest Configuration

The `manifest.json` defines the component configuration for Zaraz:

**Key Elements**:
- **Name**: ABsmartly
- **Namespace**: absmartly
- **Categories**: Analytics, Optimization
- **Provides**: events, experiments

**Required Settings**:
- `DEPLOYMENT_MODE`: "zaraz" (default)
- `ABSMARTLY_API_KEY`: API key for ABsmartly
- `ABSMARTLY_ENDPOINT`: API endpoint URL
- `ABSMARTLY_ENVIRONMENT`: Environment name
- `ABSMARTLY_APPLICATION`: Application name

**Optional Settings**:
- Cookie configuration (name, max age, domain)
- Anti-flicker settings (selector, timeout, transition)
- Feature flags (SPA mode, web vitals, embeds, debug)
- Performance tuning (SDK timeout, cache TTL)

**Required Permissions**:
- `client_network_requests` - Call ABsmartly API
- `execute_unsafe_scripts` - Inject client-side code
- `provide_server_functionality` - Server-side context creation
- `provide_widget` - Server-side embeds (optional)
- `access_client_kv` - Cookie management
- `serve_static_files` - Static assets (optional)

---

## 2. Cloudflare Zaraz Architecture

### What is Cloudflare Zaraz?

Cloudflare Zaraz is a third-party tool manager that runs on Cloudflare's edge network. It allows you to load and manage marketing, analytics, and other third-party tools without impacting page performance.

**Key Features**:
- Runs on Cloudflare Workers (V8 isolate runtime)
- Server-side execution at the edge
- Reduces client-side JavaScript
- Built-in privacy features
- Low latency (edge computing)

### Managed Components in Zaraz

**Managed Components Spec**: Open standard (managedcomponents.dev) for building privacy-first, edge-compatible third-party tools.

**Key Concepts**:

1. **Manager**: Provides APIs for component lifecycle
   - `manager.route()` - Handle incoming requests
   - `manager.registerEmbed()` - Server-side HTML replacement
   - `manager.addEventListener()` - Listen to events
   - `manager.proxy()` - Proxy external requests

2. **Client**: Represents the end user
   - `client.execute()` - Inject scripts/styles before `</head>`
   - `client.set()` / `client.get()` - Cookie management
   - `client.fetch()` - Make HTTP requests
   - `client.url` - Current page URL
   - `client.userAgent` - Browser info

3. **Settings**: Component configuration (from manifest.json)

### Cloudflare Workers as Runtime

**Deployment Model**:
```
User Request → Cloudflare Edge (Zaraz)
                    ↓
    [Execute Managed Component in Worker]
                    ↓
    [Modify HTML Response]
                    ↓
    Modified HTML → Browser
```

**Worker Constraints**:
- **CPU Time**: 50ms (free), 50ms (paid) per request
- **Memory**: 128MB
- **Script Size**: 1MB compressed (10MB uncompressed)
- **Subrequests**: 50 (free), 1000 (paid)
- **KV Operations**: Must be fast (edge-local)

**Runtime Environment**:
- V8 JavaScript engine
- No Node.js APIs (limited compatibility layer)
- ESM or CommonJS module format
- Web Standards APIs (fetch, URL, crypto, etc.)

### managed-component-to-cloudflare-worker Tool

**Package**: `managed-component-to-cloudflare-worker` (v1.7.1)

**What It Does**:
1. Takes your bundled Managed Component
2. Wraps it in a Cloudflare Worker
3. Deploys to Cloudflare using Wrangler
4. Makes it available in Zaraz dashboard

**Usage**:
```bash
npx managed-component-to-cloudflare-worker <component-path> <worker-name> [wrangler.toml]
```

**Arguments**:
- `<component-path>`: Path to bundled component (e.g., `./dist/index.js`)
- `<worker-name>`: Worker name (must start with `custom-mc-` for Zaraz)
- `[wrangler.toml]`: Optional custom Wrangler configuration

**Process**:
1. Creates temporary directory
2. Copies component file
3. Generates Wrangler configuration
4. Runs `wrangler publish` to deploy
5. Worker appears in Zaraz dashboard

**Requirements**:
- Wrangler CLI must be installed and authenticated
- Component must be pre-bundled (single file)
- Must have valid Cloudflare account with Workers enabled

---

## 3. Prerequisites

### Required Accounts & Access

1. **Cloudflare Account**
   - Workers enabled (free or paid plan)
   - Zaraz enabled (available on Free plan)
   - Zone (domain) configured in Cloudflare

2. **ABsmartly Account**
   - API key
   - Endpoint URL (e.g., https://api.absmartly.io/v1)
   - Environment configured
   - Application configured

### Required Tools

1. **Node.js & npm**
   - Node.js >= 17.0.0 (required by managed-component-to-cloudflare-worker)
   - npm >= 7.0.0
   - **Current Version**: v22.15.0 (detected in environment)

2. **Wrangler CLI** (Cloudflare Workers CLI)
   - **Installation**: `npm install -g wrangler` (or use npx)
   - **Current Status**: Installed at `/Users/joalves/.nvm/versions/node/v22.15.0/bin/wrangler`
   - **Authentication**: Must run `wrangler login` once

3. **Build Tools**
   - TypeScript compiler (installed)
   - esbuild (installed)
   - ESLint (installed)

### Authentication Setup

**Step 1: Authenticate Wrangler**
```bash
wrangler login
```
This opens a browser window to authorize Wrangler with your Cloudflare account.

**Step 2: Verify Authentication**
```bash
wrangler whoami
```
Should display your Cloudflare account email and Account ID.

**Step 3: List Zones (Optional)**
```bash
wrangler zones list
```
Shows available domains in your Cloudflare account.

### Environment Variables

**For Development/Testing**:
```bash
# Create .env.local (not committed)
ABSMARTLY_API_KEY=your-api-key-here
ABSMARTLY_ENDPOINT=https://api.absmartly.io/v1
ABSMARTLY_ENVIRONMENT=development
ABSMARTLY_APPLICATION=website
```

**For Production**:
- Settings configured in Zaraz dashboard
- Secrets stored in Cloudflare Workers environment variables
- No .env files used in production

### Permissions Checklist

- [ ] Cloudflare account with Workers enabled
- [ ] Wrangler authenticated (`wrangler login`)
- [ ] ABsmartly API key obtained
- [ ] ABsmartly environment configured
- [ ] Zaraz enabled on Cloudflare zone
- [ ] Git repository access (if using CI/CD)

---

## 4. Build Issues to Resolve

### Current Build Status

**Status**: Build FAILING (59+ TypeScript errors)

**Error Categories**:

1. **Type Import Issues** (7 errors)
   - `SDK` type vs value confusion in `context-manager.ts`
   - Missing `FetchedRequest` export in `@managed-components/types`

2. **Type Incompatibility** (15 errors)
   - `URL` type vs `string` incompatibility
   - `ClientSetOptions` missing `path` property
   - Mock return types not matching expected types

3. **Read-only Property Violations** (30+ errors)
   - Test files trying to modify read-only properties (url, payload, referer)
   - Need to use proper test mocking patterns

4. **API Signature Mismatches** (7 errors)
   - Function signatures not matching types
   - Missing required properties in test mocks

### Priority Issues for Deployment

**CRITICAL (Must Fix Before Deployment)**:

1. **context-manager.ts SDK Type Issues**
   ```typescript
   // Line 8: 'SDK' refers to a value, but is being used as a type
   // Line 25: SDK is not constructable
   ```
   **Impact**: Core functionality broken, context creation will fail
   **Fix**: Import SDK type correctly from @absmartly/javascript-sdk

2. **ClientSetOptions Missing 'path' Property**
   ```typescript
   // cookie-handler.ts lines 26, 57
   // overrides-handler.ts lines 62, 70
   ```
   **Impact**: Cookie management broken, user identity will not persist
   **Fix**: Check @managed-components/types version, may need to use different API

3. **FetchedRequest Export Missing**
   ```typescript
   // webcm/response-manipulator.ts, webcm/setup.ts
   ```
   **Impact**: WebCM mode broken (but not needed for Zaraz deployment)
   **Fix**: Can be deferred if only deploying Zaraz mode

4. **URL vs String Type Mismatches**
   ```typescript
   // Multiple files passing URL objects where strings expected
   ```
   **Impact**: Runtime errors possible
   **Fix**: Use `.toString()` or `.href` on URL objects

**MEDIUM (Fix Before Production)**:

5. **Test Files Type Errors**
   - 30+ errors in test files
   **Impact**: Tests won't run, can't verify functionality
   **Fix**: Update test mocks to match current types

**LOW (Tech Debt)**:

6. **Read-only Property Violations in Tests**
   **Impact**: Tests only
   **Fix**: Use proper test object creation patterns

### Recommended Fix Order

1. **Phase 1: Critical Zaraz Functionality** (Required for deployment)
   - [ ] Fix SDK type imports in `context-manager.ts`
   - [ ] Fix ClientSetOptions 'path' issues in cookie/override handlers
   - [ ] Fix URL vs string issues in zaraz files
   - [ ] Ensure `npm run bundle` succeeds

2. **Phase 2: WebCM Mode** (Can be deferred)
   - [ ] Fix FetchedRequest issues in webcm files
   - [ ] Or: Exclude webcm from build if only deploying Zaraz

3. **Phase 3: Testing** (Required for production)
   - [ ] Fix all test type errors
   - [ ] Run full test suite
   - [ ] Achieve > 80% coverage

### Workaround for Initial Deployment

If fixes take time, consider:

**Option A: Skip Type Checking for Initial Deployment**
```bash
# Modify package.json temporarily
"bundle-only": "node esbuild.js",
"deploy:zaraz:unsafe": "npm run bundle-only && npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc"
```

**Option B: Fix Only Critical Path**
- Fix only Zaraz-mode files (skip webcm, skip tests)
- Deploy to dev environment first
- Test manually before production

**Option C: Use TypeScript `skipLibCheck`**
```json
// tsconfig.build.json
{
  "compilerOptions": {
    "skipLibCheck": true  // Skip type checking of declaration files
  }
}
```

**Recommendation**: Fix critical issues (SDK type, cookie handler) before any deployment. Type safety prevents runtime errors.

---

## 5. Deployment Process

### Overview

The deployment process consists of:
1. **Build**: Bundle TypeScript into single JavaScript file
2. **Package**: Wrap component for Cloudflare Workers
3. **Deploy**: Publish Worker to Cloudflare
4. **Configure**: Set up in Zaraz dashboard
5. **Verify**: Test deployment

### Step-by-Step Deployment Workflow

#### Step 1: Build the Component

```bash
# From project root
cd /Users/joalves/git_tree/absmartly-managed-component

# Option A: Full build (with type checking and linting)
npm run build

# Option B: Dev build (skip linting)
npm run build:dev

# Option C: Bundle only (after fixes)
npm run bundle
```

**Expected Output**:
```
dist/
└── index.js    # ~100-300KB minified bundle
```

**Verify Build**:
```bash
ls -lh dist/index.js
file dist/index.js
head -n 10 dist/index.js
```

Should show:
- Single JavaScript file
- ESM format
- Contains bundled code

#### Step 2: Deploy to Cloudflare Workers

**Using Existing Script**:
```bash
npm run deploy:zaraz
```

This executes:
```bash
npm run build && npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc
```

**Manual Deployment** (more control):
```bash
# Build first
npm run build

# Deploy with specific options
npx managed-component-to-cloudflare-worker \
  ./dist/index.js \
  absmartly-mc
```

**What Happens**:
1. Creates temporary directory
2. Copies `dist/index.js` to temp location
3. Generates `wrangler.toml` configuration
4. Runs `wrangler publish`
5. Uploads Worker to Cloudflare
6. Returns Worker URL

**Expected Output**:
```
Published custom-mc-absmartly (0.XX sec)
  https://custom-mc-absmartly.<account>.workers.dev
```

#### Step 3: Configure in Zaraz Dashboard

**Navigate to Zaraz**:
1. Go to Cloudflare Dashboard
2. Select your zone (domain)
3. Click "Zaraz" in sidebar
4. Click "Tools Configuration" or "Third-party tools"

**Add Custom Managed Component**:
1. Click "Add new tool"
2. Scroll down to "Custom Managed Component"
3. Select your Worker from dropdown: `custom-mc-absmartly`
4. Click "Continue"

**Configure Settings**:
```
Tool Name: ABsmartly
Status: Active

REQUIRED SETTINGS:
- DEPLOYMENT_MODE: zaraz
- ABSMARTLY_API_KEY: <your-api-key>
- ABSMARTLY_ENDPOINT: https://api.absmartly.io/v1
- ABSMARTLY_ENVIRONMENT: production
- ABSMARTLY_APPLICATION: website

OPTIONAL SETTINGS:
- COOKIE_NAME: absmartly_id
- COOKIE_MAX_AGE: 365
- HIDE_SELECTOR: body
- HIDE_TIMEOUT: 3000
- TRANSITION_MS: 300
- ENABLE_SPA_MODE: true
- ENABLE_WEB_VITALS: false
- ENABLE_EMBEDS: true
- ENABLE_DEBUG: false (set to true for troubleshooting)
```

**Grant Permissions**:
Check all required permissions:
- [x] Server: Network Requests
- [x] Client: Execute
- [x] Client: Key-Value Store
- [ ] Server: Widget (if using embeds)
- [ ] Server: Static Files (optional)

**Set Triggers**:
- **Pageview**: Automatically triggered (leave as default)
- **Track**: Add triggers for custom events if needed

**Save Configuration**:
1. Click "Save"
2. Wait for configuration to propagate (usually < 1 minute)

#### Step 4: Verify Deployment

**Browser Console Test**:
1. Open your website in browser
2. Open DevTools (F12)
3. Check Console for ABsmartly logs (if DEBUG enabled)
4. Check Network tab for:
   - Zaraz script loaded
   - ABsmartly API calls to endpoint
   - Cookie set (`absmartly_id`)

**Manual Verification**:
```javascript
// In browser console
document.cookie.includes('absmartly_id')  // Should be true

// Check if ABsmartly context exists
window.absmartly  // Should be defined (if exposed)
```

**Zaraz Dashboard Verification**:
1. Go to Zaraz → Dashboard
2. Check "Tool Status"
3. ABsmartly should show as "Active"
4. Check "Events" tab for incoming events

**Worker Logs** (via Wrangler):
```bash
# Tail Worker logs in real-time
wrangler tail custom-mc-absmartly

# Or view in Cloudflare Dashboard
# Workers → custom-mc-absmartly → Logs
```

#### Step 5: Test Experiments

**QA Override Test**:
```
https://yoursite.com?absmartly_test_experiment=1
```

Check:
- Correct variant displayed
- No console errors
- ABsmartly API called with override

**Browser Extension Test**:
1. Install ABsmartly Browser Extension
2. Set override for specific experiment
3. Reload page
4. Verify override detected and applied

**Production Traffic Test**:
1. Create test experiment in ABsmartly dashboard
2. Set 50/50 traffic split
3. Visit page multiple times (or different browsers)
4. Verify random assignment working
5. Check ABsmartly dashboard for exposure events

---

## 6. Implementation Plan

### Phase 1: Fix Build Issues (HIGH PRIORITY)

**Objective**: Get `npm run build` to succeed

**Tasks**:

1. **Fix SDK Type Import** (context-manager.ts)
   ```typescript
   // Before:
   import SDK from '@absmartly/javascript-sdk'

   // After:
   import SDK, { type SDK as SDKType } from '@absmartly/javascript-sdk'
   // Or check SDK package exports
   ```
   **Time**: 30 minutes
   **Owner**: Developer

2. **Fix Cookie Handler Path Issue**
   - Check `@managed-components/types` version
   - Review ClientSetOptions interface
   - Either remove `path` or update types package
   ```bash
   npm update @managed-components/types
   ```
   **Time**: 1 hour
   **Owner**: Developer

3. **Fix URL Type Issues**
   - Convert `URL` objects to strings where needed
   ```typescript
   // Before:
   someFunction(client.url)

   // After:
   someFunction(client.url.toString())
   ```
   **Time**: 1 hour
   **Owner**: Developer

4. **Test Build**
   ```bash
   npm run bundle
   ls -lh dist/index.js
   ```
   **Time**: 15 minutes
   **Owner**: Developer

**Deliverable**: `dist/index.js` builds successfully

**Success Criteria**:
- [ ] `npm run bundle` succeeds
- [ ] `dist/index.js` exists and is < 1MB
- [ ] No critical TypeScript errors

### Phase 2: Initial Deployment to Dev (MEDIUM PRIORITY)

**Objective**: Deploy to Cloudflare Workers for testing

**Prerequisites**:
- Phase 1 complete
- Wrangler authenticated
- Dev ABsmartly environment configured

**Tasks**:

1. **Authenticate Wrangler** (if not done)
   ```bash
   wrangler login
   wrangler whoami
   ```
   **Time**: 5 minutes
   **Owner**: DevOps

2. **Test Deploy Script**
   ```bash
   npm run deploy:zaraz
   ```
   **Time**: 5 minutes
   **Owner**: DevOps

3. **Configure in Zaraz (Dev Zone)**
   - Add custom managed component
   - Configure with DEV ABsmartly settings
   - Grant permissions
   - Set Pageview trigger
   **Time**: 15 minutes
   **Owner**: DevOps

4. **Verify Deployment**
   - Check Worker logs
   - Test on dev site
   - Verify cookie set
   - Check API calls
   **Time**: 30 minutes
   **Owner**: QA

**Deliverable**: Component running in dev environment

**Success Criteria**:
- [ ] Worker deployed successfully
- [ ] Appears in Zaraz dashboard
- [ ] Pageview events trigger component
- [ ] ABsmartly API called successfully
- [ ] No JavaScript errors in console

### Phase 3: Fix Test Suite (LOW PRIORITY)

**Objective**: Get all tests passing

**Prerequisites**:
- Phase 1 complete

**Tasks**:

1. **Fix Test Mock Types**
   - Update all test mocks to match current types
   - Use proper test patterns for read-only properties
   ```typescript
   // Before:
   const client = { url: 'https://example.com' }
   client.url = 'https://new.com'  // Error: read-only

   // After:
   const client = { url: new URL('https://example.com') }
   // Create new mock instead of modifying
   ```
   **Time**: 4 hours
   **Owner**: Developer

2. **Run Test Suite**
   ```bash
   npm test
   npm run test:watch  # For iterative fixing
   ```
   **Time**: 1 hour
   **Owner**: Developer

3. **Achieve Coverage Target**
   - Aim for > 80% coverage
   - Add tests for new features
   **Time**: 2 hours
   **Owner**: Developer

**Deliverable**: All tests passing

**Success Criteria**:
- [ ] `npm test` succeeds with 0 errors
- [ ] > 80% code coverage
- [ ] All critical paths tested

### Phase 4: Production Deployment (HIGH PRIORITY)

**Objective**: Deploy to production Cloudflare zone

**Prerequisites**:
- Phase 1 complete
- Phase 2 complete (dev testing successful)
- Production ABsmartly environment ready

**Tasks**:

1. **Production Build**
   ```bash
   npm run build  # Full build with lint
   ```
   **Time**: 5 minutes
   **Owner**: DevOps

2. **Deploy to Production Worker**
   ```bash
   npm run deploy:zaraz
   # Or deploy to specific account if needed
   ```
   **Time**: 5 minutes
   **Owner**: DevOps

3. **Configure in Production Zaraz**
   - Use PRODUCTION zone
   - Configure with PRODUCTION ABsmartly settings
   - Start with "Inactive" status for testing
   - Grant all required permissions
   **Time**: 15 minutes
   **Owner**: DevOps

4. **Limited Rollout Test**
   - Activate on test pages only (using page rules)
   - Monitor for errors
   - Check performance metrics
   **Time**: 2 hours
   **Owner**: QA

5. **Full Rollout**
   - Activate for all pages
   - Monitor Worker CPU time
   - Watch for API rate limits
   - Check user experience (flicker duration)
   **Time**: 4 hours (monitoring)
   **Owner**: DevOps

**Deliverable**: Component live in production

**Success Criteria**:
- [ ] Worker deployed to production
- [ ] Configured in production Zaraz
- [ ] All experiments running correctly
- [ ] No performance degradation
- [ ] Error rate < 0.1%
- [ ] P95 latency < 100ms

### Phase 5: Monitoring & Optimization (ONGOING)

**Objective**: Ensure stable production operation

**Tasks**:

1. **Set Up Monitoring**
   - Cloudflare Analytics for Worker
   - ABsmartly dashboard for exposure events
   - Error tracking (Sentry or similar)
   - Performance monitoring (Web Vitals)
   **Time**: 2 hours
   **Owner**: DevOps

2. **Create Alerts**
   - Worker error rate > 1%
   - Worker CPU time > 40ms
   - ABsmartly API failure rate > 5%
   - Experiment assignment failures
   **Time**: 1 hour
   **Owner**: DevOps

3. **Optimize Performance**
   - Monitor Worker CPU time
   - Optimize bundle size if needed
   - Implement caching strategies
   - Reduce API call latency
   **Time**: Ongoing
   **Owner**: Developer

4. **Documentation**
   - Create runbook for common issues
   - Document deployment process
   - Create troubleshooting guide
   **Time**: 4 hours
   **Owner**: Technical Writer

**Deliverable**: Production monitoring in place

**Success Criteria**:
- [ ] Dashboards set up
- [ ] Alerts configured
- [ ] Response plan documented
- [ ] Team trained

### Timeline Estimate

| Phase | Duration | Blocking |
|-------|----------|----------|
| Phase 1: Fix Build Issues | 2-3 hours | YES (blocks all) |
| Phase 2: Dev Deployment | 1 hour | YES (blocks prod) |
| Phase 3: Fix Tests | 7 hours | NO (parallel) |
| Phase 4: Production Deployment | 1 day | NO (after Phase 2) |
| Phase 5: Monitoring | 1 day | NO (parallel) |

**Total Time**: 2-3 days (with parallel work)

**Critical Path**: Phase 1 → Phase 2 → Phase 4 (1 day minimum)

---

## 7. Environment Configuration

### Configuration Layers

1. **Build Time**: TypeScript/esbuild configuration
2. **Deploy Time**: Wrangler configuration
3. **Runtime**: Zaraz settings in dashboard

### Build Configuration

**tsconfig.build.json**:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**esbuild.js**:
```javascript
require('esbuild').buildSync({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  target: ['esnext'],
  tsconfig: 'tsconfig.build.json',
  outfile: 'dist/index.js',
})
```

**Optimization Opportunities**:
- Add `metafile: true` for bundle analysis
- Add `sourcemap: true` for debugging
- Add `loader` for .js file inclusion
- Configure `external` to exclude unused packages

### Wrangler Configuration

The `managed-component-to-cloudflare-worker` tool auto-generates `wrangler.toml`, but you can provide custom configuration:

**Basic wrangler.toml** (auto-generated):
```toml
name = "custom-mc-absmartly"
main = "index.js"
compatibility_date = "2023-05-15"
workers_dev = true

[build]
command = ""

[build.upload]
format = "service-worker"
```

**Advanced wrangler.toml** (custom):
```toml
name = "custom-mc-absmartly"
main = "index.js"
compatibility_date = "2023-05-15"
workers_dev = true
account_id = "your-account-id"

# KV Namespace for caching (if needed)
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# Environment variables (secrets)
[vars]
ENVIRONMENT = "production"

# Limits
[limits]
cpu_ms = 50

# Routes (if not using Zaraz)
# routes = [
#   { pattern = "example.com/*", zone_id = "zone-id" }
# ]
```

**When to Use Custom wrangler.toml**:
- Multiple environments (dev, staging, prod)
- KV namespace required for caching
- Custom routes
- Environment-specific settings

**Deployment with Custom Config**:
```bash
npx managed-component-to-cloudflare-worker \
  ./dist/index.js \
  absmartly-mc \
  ./wrangler.toml
```

### Zaraz Runtime Configuration

**Settings Schema** (from manifest.json):

```typescript
interface ABSmartlySettings {
  // Required
  DEPLOYMENT_MODE: 'zaraz' | 'webcm'
  ABSMARTLY_API_KEY: string
  ABSMARTLY_ENDPOINT: string
  ABSMARTLY_ENVIRONMENT: string
  ABSMARTLY_APPLICATION: string

  // Cookie Management
  COOKIE_NAME?: string              // Default: "absmartly_id"
  COOKIE_MAX_AGE?: number          // Default: 365 days
  COOKIE_DOMAIN?: string           // Default: current domain

  // Anti-Flicker (Zaraz only)
  HIDE_SELECTOR?: string           // Default: "body"
  HIDE_TIMEOUT?: number            // Default: 3000ms
  TRANSITION_MS?: number           // Default: 300ms

  // Features
  ENABLE_SPA_MODE?: boolean        // Default: true
  ENABLE_WEB_VITALS?: boolean      // Default: false
  ENABLE_EMBEDS?: boolean          // Default: true
  ENABLE_DEBUG?: boolean           // Default: false

  // Performance
  SDK_TIMEOUT?: number             // Default: 2000ms
  CONTEXT_CACHE_TTL?: number       // Default: 60s
}
```

**Environment-Specific Settings**:

**Development**:
```json
{
  "ABSMARTLY_ENDPOINT": "https://api-dev.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "development",
  "ENABLE_DEBUG": true,
  "SDK_TIMEOUT": 5000
}
```

**Staging**:
```json
{
  "ABSMARTLY_ENDPOINT": "https://api-staging.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "staging",
  "ENABLE_DEBUG": true,
  "SDK_TIMEOUT": 3000
}
```

**Production**:
```json
{
  "ABSMARTLY_ENDPOINT": "https://api.absmartly.io/v1",
  "ABSMARTLY_ENVIRONMENT": "production",
  "ENABLE_DEBUG": false,
  "SDK_TIMEOUT": 2000,
  "CONTEXT_CACHE_TTL": 60
}
```

### Secrets Management

**Sensitive Values**:
- `ABSMARTLY_API_KEY` - Never commit to git

**Best Practices**:

1. **Local Development**: Use `.env.local` (gitignored)
   ```bash
   ABSMARTLY_API_KEY=dev-key-here
   ```

2. **Zaraz Dashboard**: Enter API key in settings UI
   - Values stored securely by Cloudflare
   - Not exposed in logs
   - Encrypted at rest

3. **CI/CD**: Use secrets manager
   ```yaml
   # GitHub Actions example
   env:
     ABSMARTLY_API_KEY: ${{ secrets.ABSMARTLY_API_KEY }}
   ```

4. **Worker Environment Variables** (alternative to Zaraz settings)
   ```bash
   # Set secret via Wrangler
   wrangler secret put ABSMARTLY_API_KEY

   # Access in code via manager.ext.env
   const apiKey = manager.ext.env.ABSMARTLY_API_KEY
   ```

### Multi-Environment Strategy

**Option 1: Separate Workers Per Environment**
```bash
# Deploy dev
npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc-dev

# Deploy staging
npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc-staging

# Deploy production
npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc-prod
```

**Option 2: Same Worker, Different Zaraz Configurations**
- Deploy once: `absmartly-mc`
- Configure differently in each zone's Zaraz dashboard
- Use zone-specific settings

**Option 3: Environment Detection in Code**
```typescript
// Detect environment from zone name
const hostname = new URL(client.url).hostname
const isDev = hostname.includes('dev.') || hostname.includes('localhost')
const isStaging = hostname.includes('staging.')
const isProd = !isDev && !isStaging
```

**Recommendation**: Option 2 (same Worker, different configs) for simplicity

---

## 8. Testing Strategy

### Pre-Deployment Testing

**Unit Tests**:
```bash
npm test
```
- Test core logic in isolation
- Mock ABsmartly SDK
- Mock Manager and Client
- Aim for > 80% coverage

**Integration Tests**:
```bash
npm run test:integration  # If configured
```
- Test component with real Manager mock
- Verify client.execute() output
- Test embed registration
- Test event tracking flow

**Build Verification**:
```bash
npm run build
ls -lh dist/index.js  # Check size < 1MB
node -c dist/index.js  # Check syntax
```

### Dev Environment Testing

**Deployment Verification**:
1. Deploy to dev Worker
2. Configure in dev Zaraz
3. Visit dev site
4. Check browser console for errors
5. Verify Worker logs (wrangler tail)

**Functional Tests**:

**Test 1: Context Creation**
- Visit page
- Check cookie `absmartly_id` set
- Check ABsmartly API called
- Verify response structure

**Test 2: Experiment Assignment**
- Create test experiment in ABsmartly
- Visit page
- Verify correct variant displayed
- Check exposure event tracked

**Test 3: QA Override**
- Visit `?absmartly_experiment_name=1`
- Verify variant 1 displayed
- Check override cookie set

**Test 4: Browser Extension**
- Install extension
- Set override
- Verify override detected
- Check correct variant shown

**Test 5: SPA Mode**
- Navigate to different page (SPA)
- Verify experiments update
- Check new exposure events

**Test 6: Event Tracking**
- Trigger goal event
- Verify tracked in ABsmartly
- Check Zaraz event logs

**Performance Tests**:
- Measure page load time (before/after)
- Check Worker CPU time (< 50ms)
- Measure flicker duration (< 150ms)
- Check bundle size impact

### Staging Testing

**Load Testing**:
```bash
# Use tool like k6 or artillery
k6 run load-test.js
```
- Simulate production traffic
- Test Worker under load
- Verify no rate limiting
- Check error rate < 0.1%

**Cross-Browser Testing**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Android)

**A/B Test Validation**:
- Run multiple experiments
- Verify no conflicts
- Check treatment isolation
- Validate assignment randomness

### Production Testing

**Canary Deployment**:
1. Deploy to prod Worker
2. Configure in Zaraz (inactive)
3. Test on specific pages only
4. Monitor for 1-2 hours
5. Gradually roll out

**Monitoring Checklist**:
- [ ] Worker error rate < 0.1%
- [ ] Worker CPU time < 40ms (P95)
- [ ] ABsmartly API success rate > 99%
- [ ] Page load time increase < 50ms
- [ ] Flicker duration < 150ms
- [ ] No JavaScript errors in console
- [ ] Cookie set correctly
- [ ] Experiments assigned correctly
- [ ] Events tracked correctly

**Rollback Criteria**:
- Error rate > 1%
- Worker CPU time > 50ms
- Page load increase > 200ms
- Critical JavaScript errors
- Data loss in tracking

---

## 9. Rollback Strategy

### Rollback Scenarios

**Scenario 1: Worker Deployment Failed**
- Deployment itself failed
- Worker not created
- **Impact**: None (old version still running)
- **Action**: Fix issues, redeploy

**Scenario 2: Worker Deployed But Broken**
- New version has bugs
- Causing errors in production
- **Impact**: Medium (affecting all traffic)
- **Action**: Immediate rollback

**Scenario 3: Configuration Error**
- Wrong settings in Zaraz
- API key invalid
- **Impact**: Medium (component not working)
- **Action**: Fix configuration

**Scenario 4: Performance Degradation**
- Worker too slow
- Causing page delays
- **Impact**: High (affecting UX)
- **Action**: Rollback or disable

### Rollback Methods

**Method 1: Disable in Zaraz Dashboard**
- **Speed**: Immediate (< 1 minute)
- **Scope**: Disables component, keeps Worker
- **Data Loss**: None (component just stops running)

**Steps**:
1. Go to Zaraz Dashboard
2. Find ABsmartly tool
3. Click "Disable" or set Status to "Inactive"
4. Save
5. Wait for propagation (~30 seconds)

**Method 2: Rollback Worker Version**
- **Speed**: Fast (2-5 minutes)
- **Scope**: Reverts to previous Worker code
- **Data Loss**: None

**Steps**:
```bash
# List Worker versions
wrangler versions list

# Rollback to previous version
wrangler rollback --version <previous-version-id>

# Or deploy old version
git checkout <previous-commit>
npm run build
npm run deploy:zaraz
```

**Method 3: Deploy Hotfix**
- **Speed**: Medium (10-30 minutes)
- **Scope**: Fix specific issue
- **Data Loss**: None

**Steps**:
1. Identify issue
2. Fix in code
3. Test locally
4. Deploy: `npm run deploy:zaraz`
5. Verify fix

**Method 4: Change Zaraz Configuration**
- **Speed**: Fast (2-5 minutes)
- **Scope**: Change settings without redeploying
- **Data Loss**: None

**Steps**:
1. Go to Zaraz Dashboard
2. Edit ABsmartly tool settings
3. Change problematic setting (e.g., disable feature)
4. Save

### Rollback Decision Matrix

| Issue | Severity | Method | Time |
|-------|----------|--------|------|
| Worker won't deploy | Low | Fix & redeploy | 30 min |
| JavaScript errors | High | Disable in Zaraz | 1 min |
| Performance issue | High | Disable in Zaraz | 1 min |
| Wrong configuration | Medium | Fix config | 5 min |
| API errors | Medium | Check API key | 5 min |
| Flicker too long | Low | Adjust HIDE_TIMEOUT | 5 min |
| Missing features | Low | Update & redeploy | 1 hour |

### Rollback Playbook

**Step 1: Assess Impact**
```
Questions:
- Is production down?
- Are users experiencing errors?
- Is this a P0/P1/P2 issue?
- Can we fix forward or must rollback?
```

**Step 2: Immediate Mitigation**
```
If P0 (production down):
→ Disable in Zaraz immediately
→ Investigate cause
→ Fix or rollback Worker

If P1 (major issues):
→ Rollback Worker to previous version
→ Verify resolution
→ Fix issue in dev

If P2 (minor issues):
→ Create hotfix
→ Deploy after testing
```

**Step 3: Root Cause Analysis**
```
- Review Worker logs
- Check error reports
- Analyze metrics
- Identify specific commit/change
```

**Step 4: Fix & Redeploy**
```
- Fix issue in code
- Test in dev environment
- Deploy to staging
- Monitor for 1 hour
- Deploy to production
```

**Step 5: Post-Mortem**
```
- Document what happened
- Identify preventive measures
- Update tests to catch similar issues
- Improve monitoring/alerts
```

### Preventing Rollbacks

**Best Practices**:

1. **Gradual Rollouts**
   - Start with dev environment
   - Test in staging with production-like traffic
   - Canary deploy to 5% of traffic
   - Monitor for 1-2 hours before full rollout

2. **Feature Flags**
   ```typescript
   if (settings.ENABLE_NEW_FEATURE) {
     // New feature code
   } else {
     // Old feature code
   }
   ```
   - Can enable/disable without redeploying
   - Test in production safely

3. **Comprehensive Testing**
   - Unit tests for all code paths
   - Integration tests for critical flows
   - Load testing before production
   - Manual QA checklist

4. **Monitoring & Alerts**
   - Set up alerts before deployment
   - Monitor key metrics during rollout
   - Have team on standby for initial rollout

5. **Version Control**
   ```bash
   git tag v1.0.0
   git push --tags
   ```
   - Tag releases for easy rollback reference

---

## 10. Monitoring & Observability

### Key Metrics to Monitor

**Worker Performance**:
- **CPU Time**: Target < 40ms (P95), Max 50ms
- **Request Count**: Total requests handled
- **Error Rate**: Target < 0.1%
- **Success Rate**: Target > 99.9%
- **Invocation Count**: Requests per second

**ABsmartly Integration**:
- **API Call Success Rate**: Target > 99%
- **API Latency**: Target < 50ms (P95)
- **Context Creation Time**: Target < 100ms
- **Exposure Events**: Count & success rate
- **Goal Events**: Count & success rate

**User Experience**:
- **Flicker Duration**: Target < 150ms
- **Page Load Impact**: Target < 50ms increase
- **JavaScript Errors**: Count & types
- **Cookie Set Success**: Target 100%

**Business Metrics**:
- **Experiments Running**: Count
- **Users Assigned**: Count per experiment
- **Variant Distribution**: Should match traffic split
- **Conversion Rate**: Per variant

### Monitoring Tools

**1. Cloudflare Analytics**

**Access**: Cloudflare Dashboard → Workers → custom-mc-absmartly → Analytics

**Available Metrics**:
- Requests (total, per second)
- CPU time (average, P50, P95, P99)
- Error rate
- Success rate
- Status codes distribution

**Setup**: Automatic (no configuration needed)

**2. Cloudflare Logpush**

**Setup**:
```bash
# Enable Logpush for Worker
wrangler logpush create \
  --destination-conf "s3://bucket/path?region=us-west-2" \
  --dataset workers_trace_events \
  --filter '{"where":{"and":[{"key":"scriptName","operator":"eq","value":"custom-mc-absmartly"}]}}'
```

**Benefits**:
- Detailed request logs
- Error stack traces
- Custom log analysis
- Long-term storage

**3. Wrangler Tail (Live Logs)**

**Usage**:
```bash
# Tail logs in real-time
wrangler tail custom-mc-absmartly

# Filter for errors only
wrangler tail custom-mc-absmartly --status error

# Sample 10% of requests
wrangler tail custom-mc-absmartly --sampling-rate 0.1
```

**Use Cases**:
- Debugging during deployment
- Real-time issue investigation
- Verification testing

**4. ABsmartly Dashboard**

**Access**: ABsmartly web UI

**Available Metrics**:
- Exposure events per experiment
- Goal events per variant
- Conversion rates
- Statistical significance
- User assignment distribution

**Setup**: Automatic (if SDK configured correctly)

**5. Third-Party APM (Optional)**

**Options**:
- **Sentry**: Error tracking & performance
- **Datadog**: Full observability
- **New Relic**: APM & monitoring

**Example: Sentry Integration**:
```typescript
// In src/index.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: settings.ABSMARTLY_ENVIRONMENT,
  tracesSampleRate: 0.1,
})

try {
  // Component logic
} catch (error) {
  Sentry.captureException(error)
  throw error
}
```

### Dashboards

**Dashboard 1: Worker Health**

**Metrics**:
- Request rate (time series)
- Error rate (time series)
- CPU time (P50, P95, P99)
- Status code distribution

**Alert Thresholds**:
- Error rate > 1%
- CPU time P95 > 45ms
- CPU time P99 > 50ms

**Dashboard 2: ABsmartly Integration**

**Metrics**:
- API call count
- API success rate
- API latency distribution
- Context creation time

**Alert Thresholds**:
- API success rate < 95%
- API latency P95 > 200ms

**Dashboard 3: User Experience**

**Metrics**:
- Page load time (before/after component)
- JavaScript errors count
- Cookie set success rate
- Experiment assignment success rate

**Alert Thresholds**:
- JavaScript errors > 10/min
- Cookie failure rate > 1%

**Dashboard 4: Business Metrics**

**Metrics**:
- Active experiments count
- Users per experiment
- Exposures per experiment
- Goals per experiment
- Conversion rate per variant

**No alerts** (informational only)

### Logging Strategy

**Log Levels**:

```typescript
// In src/utils/logger.ts
export enum LogLevel {
  ERROR = 'ERROR',    // Always logged
  WARN = 'WARN',      // Always logged
  INFO = 'INFO',      // Logged if DEBUG enabled
  DEBUG = 'DEBUG',    // Logged if DEBUG enabled
}
```

**What to Log**:

**ERROR Level**:
- API call failures
- SDK initialization errors
- Invalid configuration
- Unexpected exceptions

**WARN Level**:
- API timeouts (retried)
- Missing cookies
- QA override detected
- Configuration using defaults

**INFO Level**:
- Component initialized
- Context created successfully
- Experiments assigned
- Events tracked

**DEBUG Level**:
- Request details
- API request/response bodies
- Cookie values
- Experiment configuration

**Example Log Output**:
```javascript
// With ENABLE_DEBUG: false
[ERROR] Failed to create ABsmartly context: API timeout
[WARN] No absmartly_id cookie found, generating new ID

// With ENABLE_DEBUG: true
[INFO] ABsmartly component initialized in zaraz mode
[DEBUG] Creating context with units: { user_id: "abc123" }
[DEBUG] API response: { experiments: [...], took: 87ms }
[INFO] Context created successfully, assigned to 3 experiments
```

### Alert Configuration

**Critical Alerts** (P0 - Page immediately):

```yaml
- name: Worker Error Rate High
  condition: error_rate > 5%
  window: 5 minutes
  action: Page on-call engineer

- name: Worker CPU Time Exceeded
  condition: cpu_time_p95 > 50ms
  window: 10 minutes
  action: Page on-call engineer

- name: ABsmartly API Down
  condition: api_success_rate < 50%
  window: 5 minutes
  action: Page on-call engineer
```

**Warning Alerts** (P1 - Slack notification):

```yaml
- name: Worker Error Rate Elevated
  condition: error_rate > 1%
  window: 15 minutes
  action: Slack #alerts

- name: Worker CPU Time High
  condition: cpu_time_p95 > 40ms
  window: 15 minutes
  action: Slack #alerts

- name: ABsmartly API Degraded
  condition: api_success_rate < 95%
  window: 10 minutes
  action: Slack #alerts

- name: Page Load Time Increased
  condition: page_load_time > baseline + 100ms
  window: 15 minutes
  action: Slack #alerts
```

**Info Alerts** (P2 - Email):

```yaml
- name: New Experiment Deployed
  condition: experiments_count increased
  action: Email team

- name: Traffic Pattern Anomaly
  condition: request_rate > 2x normal
  window: 30 minutes
  action: Email ops team
```

### Performance Benchmarks

**Baseline Metrics** (to establish after initial deployment):

```yaml
Worker Performance:
  cpu_time_p50: < 20ms
  cpu_time_p95: < 35ms
  cpu_time_p99: < 45ms
  error_rate: < 0.05%

ABsmartly API:
  latency_p50: < 30ms
  latency_p95: < 80ms
  latency_p99: < 150ms
  success_rate: > 99.5%

User Experience:
  flicker_duration: < 100ms
  page_load_increase: < 30ms
  cookie_success_rate: > 99.9%

Business Metrics:
  exposure_events_per_hour: (varies by traffic)
  goal_events_per_hour: (varies by traffic)
  assignment_success_rate: > 99%
```

**How to Measure**:

1. **Deploy to production**
2. **Monitor for 24 hours** with normal traffic
3. **Record P50/P95/P99** for each metric
4. **Set baselines** as targets
5. **Set alerts** at baseline + 20% threshold

---

## 11. Best Practices

### Code Best Practices

**1. Error Handling**
```typescript
// Always wrap external calls in try-catch
try {
  const response = await client.fetch(apiUrl, options)
  const data = await response.json()
  return data
} catch (error) {
  logger.error('API call failed:', error)
  // Return fallback or rethrow
  return null
}
```

**2. Timeouts**
```typescript
// Always set timeouts for external calls
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 2000)

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' }
  })
  return response
} finally {
  clearTimeout(timeout)
}
```

**3. Graceful Degradation**
```typescript
// Component should not break page if it fails
export default async function(manager: Manager, settings: ABSmartlySettings) {
  try {
    // Component logic
  } catch (error) {
    logger.error('Component failed, degrading gracefully:', error)
    // Don't inject anti-flicker CSS
    // Don't block page render
    // Log error for debugging
  }
}
```

**4. Caching**
```typescript
// Cache context data to reduce API calls
const cacheKey = `context_${userId}_${timestamp}`
const cached = await client.get(cacheKey)

if (cached) {
  return JSON.parse(cached)
}

const context = await createContext(userId)
await client.set(cacheKey, JSON.stringify(context), {
  expiry: 60 // 60 seconds
})
return context
```

**5. Performance**
```typescript
// Minimize bundle size
import { SDK } from '@absmartly/javascript-sdk'  // Named import
// Not: import * as ABSmartly from '@absmartly/javascript-sdk'

// Lazy load non-critical features
if (settings.ENABLE_WEB_VITALS) {
  const { trackWebVitals } = await import('./web-vitals')
  trackWebVitals(client)
}
```

### Deployment Best Practices

**1. Version Control**
```bash
# Tag each production deployment
git tag v1.2.3
git push origin v1.2.3

# Reference in deployment logs
npm run deploy:zaraz  # Deployed v1.2.3
```

**2. Changelog**
```markdown
# CHANGELOG.md

## [1.2.3] - 2025-10-23
### Fixed
- Fixed cookie path issue in context manager
- Resolved SDK type import errors

### Changed
- Updated ABsmartly SDK to 1.13.2

### Added
- Web Vitals tracking support
```

**3. Deployment Checklist**
```markdown
- [ ] All tests passing
- [ ] TypeScript build succeeds
- [ ] Bundle size < 1MB
- [ ] Tested in dev environment
- [ ] Changelog updated
- [ ] Version tagged in git
- [ ] Deployment announced to team
- [ ] Monitor for 1 hour after deployment
```

**4. Blue-Green Deployment** (for zero-downtime)
```bash
# Deploy new version with different name
npx managed-component-to-cloudflare-worker ./dist/index.js absmartly-mc-v2

# Configure in Zaraz (inactive)
# Test thoroughly
# Switch traffic (change Worker in Zaraz settings)
# Monitor for issues
# Keep old version for 24 hours (rollback option)
```

**5. CI/CD Integration**

**GitHub Actions Example**:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Authenticate Wrangler
        run: echo "${{ secrets.CLOUDFLARE_API_TOKEN }}" | wrangler login

      - name: Deploy to Cloudflare
        run: npm run deploy:zaraz
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          text: 'ABsmartly MC deployed to production'
```

### Configuration Best Practices

**1. Environment-Specific Settings**
```typescript
// Don't hardcode environment logic
if (hostname.includes('staging')) { ... }  // BAD

// Use configuration
if (settings.ABSMARTLY_ENVIRONMENT === 'staging') { ... }  // GOOD
```

**2. Sensible Defaults**
```typescript
const cookieName = settings.COOKIE_NAME || 'absmartly_id'
const hideTimeout = settings.HIDE_TIMEOUT || 3000
const enableDebug = settings.ENABLE_DEBUG || false
```

**3. Validate Settings**
```typescript
export default async function(manager: Manager, settings: ABSmartlySettings) {
  // Validate required settings early
  const required = [
    'ABSMARTLY_API_KEY',
    'ABSMARTLY_ENDPOINT',
    'ABSMARTLY_ENVIRONMENT',
    'ABSMARTLY_APPLICATION'
  ]

  for (const key of required) {
    if (!settings[key]) {
      throw new Error(`Missing required setting: ${key}`)
    }
  }

  // Continue with setup...
}
```

**4. Feature Flags**
```typescript
// Allow disabling features without redeploying
if (settings.ENABLE_SPA_MODE) {
  setupSPAMode(client)
}

if (settings.ENABLE_WEB_VITALS) {
  trackWebVitals(client)
}

if (settings.ENABLE_EMBEDS) {
  registerEmbeds(manager)
}
```

### Security Best Practices

**1. API Key Protection**
```typescript
// Never log API keys
logger.debug('API call', {
  url: apiUrl,
  key: apiKey  // BAD
})

logger.debug('API call', {
  url: apiUrl,
  key: '***'  // GOOD
})
```

**2. Input Validation**
```typescript
// Validate URL parameters (QA overrides)
const expName = new URL(client.url).searchParams.get('absmartly_exp_name')
if (expName && /^[a-zA-Z0-9_-]+$/.test(expName)) {
  // Safe to use
} else {
  // Invalid, ignore
}
```

**3. CSP Compatibility**
```typescript
// Use nonce for injected scripts (if CSP enabled)
client.execute(`
  <script nonce="${nonce}">
    // Script content
  </script>
`)
```

**4. Cookie Security**
```typescript
client.set('absmartly_id', userId, {
  httpOnly: true,      // Prevent XSS access
  secure: true,        // HTTPS only
  sameSite: 'Lax',     // CSRF protection
  maxAge: 365 * 86400  // 1 year
})
```

### Testing Best Practices

**1. Test Pyramid**
```
         E2E (10%)
      Integration (20%)
    Unit Tests (70%)
```

**2. Mock External Dependencies**
```typescript
// tests/mocks/absmartly-sdk.ts
export const mockSDK = {
  createContext: vi.fn().mockResolvedValue({
    experiments: [],
    assignments: {},
  }),
  track: vi.fn().mockResolvedValue(true),
}
```

**3. Test Critical Paths**
- Context creation success
- Context creation failure (graceful degradation)
- Cookie management
- QA override detection
- Event tracking
- Experiment assignment

**4. Test Edge Cases**
- Missing configuration
- API timeout
- Invalid API response
- Expired cookies
- Concurrent requests
- Browser without cookies

**5. Performance Testing**
```typescript
test('context creation completes within 100ms', async () => {
  const start = Date.now()
  await createContext(userId)
  const duration = Date.now() - start
  expect(duration).toBeLessThan(100)
})
```

---

## 12. Troubleshooting Guide

### Common Issues

#### Issue 1: Build Fails with TypeScript Errors

**Symptoms**:
- `npm run build` fails
- TypeScript errors in console
- dist/index.js not created

**Root Causes**:
- Type incompatibilities with @managed-components/types
- Wrong ABsmartly SDK imports
- Test mock type errors

**Solutions**:

1. **Check TypeScript version**:
   ```bash
   npm list typescript
   # Should be ^5.0.0
   ```

2. **Update dependencies**:
   ```bash
   npm update @managed-components/types
   npm update @absmartly/javascript-sdk
   ```

3. **Skip tests in build**:
   ```json
   // tsconfig.build.json
   {
     "exclude": ["node_modules", "dist", "tests"]
   }
   ```

4. **Use skipLibCheck** (temporary):
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "skipLibCheck": true
     }
   }
   ```

#### Issue 2: Deployment Fails

**Symptoms**:
- `npm run deploy:zaraz` fails
- Wrangler errors
- Worker not created

**Root Causes**:
- Wrangler not authenticated
- dist/index.js doesn't exist
- Network issues
- Account permissions

**Solutions**:

1. **Check authentication**:
   ```bash
   wrangler whoami
   # If not authenticated:
   wrangler login
   ```

2. **Check dist file exists**:
   ```bash
   ls -lh dist/index.js
   # If not, run build first:
   npm run build
   ```

3. **Check account permissions**:
   - Go to Cloudflare Dashboard
   - Account → Workers → Make sure you have access

4. **Try manual deployment**:
   ```bash
   npx managed-component-to-cloudflare-worker ./dist/index.js test-mc
   ```

5. **Check Cloudflare API status**:
   ```bash
   curl https://www.cloudflarestatus.com/api/v2/status.json
   ```

#### Issue 3: Worker Deployed But Not in Zaraz

**Symptoms**:
- Worker deployed successfully
- Not visible in Zaraz dashboard
- Can't add as Custom Managed Component

**Root Causes**:
- Worker name doesn't start with `custom-mc-`
- Wrong Cloudflare account
- Zaraz not enabled on zone

**Solutions**:

1. **Check Worker name**:
   ```bash
   wrangler list
   # Should see: custom-mc-absmartly
   ```

2. **Redeploy with correct name**:
   ```bash
   npx managed-component-to-cloudflare-worker \
     ./dist/index.js \
     custom-mc-absmartly
   ```

3. **Check Zaraz enabled**:
   - Cloudflare Dashboard → Zone → Zaraz
   - If not enabled, click "Get Started"

4. **Check same account**:
   - Wrangler account must match Cloudflare dashboard account

#### Issue 4: Component Not Executing

**Symptoms**:
- No errors in console
- Cookie not set
- ABsmartly API not called
- Experiments not applied

**Root Causes**:
- Component not activated in Zaraz
- Permissions not granted
- Triggers not configured
- Settings invalid

**Solutions**:

1. **Check component status**:
   - Zaraz Dashboard → Tools
   - ABsmartly should show "Active"

2. **Check permissions**:
   - Edit tool → Permissions tab
   - Grant all required permissions

3. **Check triggers**:
   - Edit tool → Triggers tab
   - At least "Pageview" should be configured

4. **Check settings**:
   - Edit tool → Settings tab
   - Verify API key, endpoint, environment, application

5. **Enable debug logging**:
   - Set ENABLE_DEBUG: true
   - Check console for logs

6. **Check Worker logs**:
   ```bash
   wrangler tail custom-mc-absmartly
   ```

#### Issue 5: Experiments Not Applied

**Symptoms**:
- Cookie set correctly
- API called successfully
- But experiments not visible on page

**Root Causes**:
- CSS selector wrong
- Anti-flicker timeout too short
- JavaScript errors
- DOM changes applied to wrong elements

**Solutions**:

1. **Check browser console**:
   - Look for JavaScript errors
   - Check if ABsmartly object exists

2. **Check DOM changes**:
   ```javascript
   // In console
   window.absmartlyDOMManipulator  // Should exist
   ```

3. **Verify selector**:
   - Check HIDE_SELECTOR matches your page
   - Default "body" should work for most sites

4. **Increase timeout**:
   - Set HIDE_TIMEOUT: 5000 (5 seconds)
   - Check if experiments then appear

5. **Check experiment configuration**:
   - In ABsmartly dashboard
   - Verify DOM changes are correct
   - Test selector using browser DevTools

#### Issue 6: Flicker Too Long

**Symptoms**:
- Page flashes blank content
- Content appears after noticeable delay
- User experience poor

**Root Causes**:
- HIDE_TIMEOUT too long
- API too slow
- Network latency
- Too many DOM changes

**Root Causes (cont)**:
- Worker CPU time high
- Context creation slow

**Solutions**:

1. **Reduce hide timeout**:
   - Try HIDE_TIMEOUT: 2000 (2 seconds)
   - Or HIDE_TIMEOUT: 1000 (1 second) for fast APIs

2. **Check API latency**:
   ```bash
   # Check Worker logs
   wrangler tail custom-mc-absmartly
   # Look for "Context created in Xms"
   ```

3. **Optimize hide selector**:
   - Instead of "body", hide only affected elements
   - Example: HIDE_SELECTOR: "#hero, #cta"

4. **Use transition**:
   - TRANSITION_MS: 200 (smooth fade-in)

5. **Check Worker CPU time**:
   - Cloudflare Dashboard → Worker Analytics
   - Should be < 40ms P95

6. **Optimize bundle size**:
   ```bash
   # Check bundle size
   ls -lh dist/index.js
   # If > 500KB, investigate and optimize
   ```

#### Issue 7: Cookie Not Set

**Symptoms**:
- absmartly_id cookie missing
- User gets new ID every page load
- Experiments change on refresh

**Root Causes**:
- Cookie domain mismatch
- Secure flag on HTTP site
- Cookie path wrong
- Browser blocking cookies

**Solutions**:

1. **Check cookie in DevTools**:
   - Application tab → Cookies
   - Look for "absmartly_id"

2. **Check cookie settings**:
   ```javascript
   // In Zaraz settings
   COOKIE_NAME: absmartly_id
   COOKIE_MAX_AGE: 365
   // Don't set COOKIE_DOMAIN (let browser decide)
   ```

3. **Check HTTPS**:
   - If site is HTTP, cookies with secure flag won't set
   - Test on HTTPS

4. **Check browser settings**:
   - Enable cookies
   - Disable "Block third-party cookies" for testing

5. **Check Worker logs**:
   ```bash
   wrangler tail custom-mc-absmartly
   # Look for "Setting cookie: absmartly_id"
   ```

#### Issue 8: High Error Rate

**Symptoms**:
- Cloudflare Analytics shows errors
- Worker throwing exceptions
- Console errors on page

**Root Causes**:
- Invalid API response
- Network errors
- Code bugs
- Invalid configuration

**Solutions**:

1. **Check error logs**:
   ```bash
   wrangler tail custom-mc-absmartly --status error
   ```

2. **Check ABsmartly API**:
   ```bash
   curl -X POST https://api.absmartly.io/v1/context \
     -H "X-API-Key: your-key" \
     -H "Content-Type: application/json" \
     -d '{"units":{"user_id":"test"}}'
   ```

3. **Verify API key**:
   - Check key is correct in Zaraz settings
   - Try regenerating key in ABsmartly dashboard

4. **Add error handling**:
   ```typescript
   try {
     await createContext(userId)
   } catch (error) {
     logger.error('Context creation failed:', error)
     // Return null or default context
     return null
   }
   ```

5. **Set up Sentry** (for detailed errors):
   - Install @sentry/node
   - Configure in component
   - Get detailed stack traces

#### Issue 9: Worker CPU Time Too High

**Symptoms**:
- Cloudflare Analytics shows high CPU time
- Approaching 50ms limit
- Occasional timeouts

**Root Causes**:
- Large bundle size
- Inefficient code
- Too many API calls
- Heavy DOM manipulation

**Solutions**:

1. **Analyze bundle**:
   ```bash
   # Add to esbuild.js
   metafile: true

   # Analyze bundle
   npm run bundle
   # Check metafile for large dependencies
   ```

2. **Optimize imports**:
   ```typescript
   // Before
   import * as ABSmartly from '@absmartly/javascript-sdk'

   // After (smaller bundle)
   import { SDK } from '@absmartly/javascript-sdk'
   ```

3. **Add caching**:
   ```typescript
   // Cache context for repeated requests
   const cacheKey = `ctx_${userId}`
   const cached = await client.get(cacheKey)
   if (cached) return JSON.parse(cached)
   ```

4. **Reduce API calls**:
   - Don't create context on every request
   - Cache for 60 seconds

5. **Profile code**:
   ```typescript
   const start = Date.now()
   await someOperation()
   logger.debug('Operation took', Date.now() - start, 'ms')
   ```

#### Issue 10: QA Overrides Not Working

**Symptoms**:
- URL params ignored
- Browser extension overrides not applied
- Always see default variant

**Root Causes**:
- Override cookie not set
- Override format wrong
- Override detection disabled
- Cookie domain mismatch

**Solutions**:

1. **Check URL format**:
   ```
   https://example.com?absmartly_experiment_name=1
   ```

2. **Check cookie**:
   - DevTools → Application → Cookies
   - Look for "absmartly_overrides"

3. **Manually set override**:
   ```javascript
   document.cookie = 'absmartly_overrides={"experiment_name":1}; path=/';
   ```

4. **Check Worker logs**:
   ```bash
   wrangler tail custom-mc-absmartly
   # Look for "Override detected"
   ```

5. **Enable debug logging**:
   ```javascript
   // In Zaraz settings
   ENABLE_DEBUG: true
   // Check console for override messages
   ```

### Debug Checklist

When troubleshooting any issue, go through this checklist:

```markdown
Environment:
- [ ] Wrangler authenticated
- [ ] Correct Cloudflare account
- [ ] Worker deployed successfully
- [ ] Worker visible in dashboard

Configuration:
- [ ] Component active in Zaraz
- [ ] All required permissions granted
- [ ] Pageview trigger configured
- [ ] API key valid
- [ ] Endpoint URL correct
- [ ] Environment name correct
- [ ] Application name correct

Runtime:
- [ ] Page loads without errors
- [ ] Cookie set correctly
- [ ] ABsmartly API called
- [ ] API returns successful response
- [ ] Experiments assigned
- [ ] DOM changes applied
- [ ] Events tracked

Performance:
- [ ] Worker CPU time < 50ms
- [ ] API latency < 100ms
- [ ] Flicker duration < 150ms
- [ ] No error rate spike

Logs:
- [ ] Check browser console
- [ ] Check Worker logs (wrangler tail)
- [ ] Check Cloudflare Analytics
- [ ] Check ABsmartly dashboard
```

### Getting Help

**1. Check Documentation**:
- This deployment plan
- README.md
- PLAN.md
- ABsmartly docs: https://docs.absmartly.com
- Managed Components: https://managedcomponents.dev
- Cloudflare Workers: https://developers.cloudflare.com/workers

**2. Check Logs**:
```bash
# Worker logs
wrangler tail custom-mc-absmartly

# Browser console
# Open DevTools → Console

# Cloudflare Analytics
# Dashboard → Workers → custom-mc-absmartly → Analytics
```

**3. Contact Support**:
- ABsmartly Support: support@absmartly.com
- Cloudflare Support: https://support.cloudflare.com
- GitHub Issues: https://github.com/absmartly/absmartly-managed-component/issues

**4. Community**:
- Managed Components Discord
- Cloudflare Workers Discord
- ABsmartly Slack (if available)

---

## Summary

This deployment plan provides a comprehensive guide to deploying the ABSmartly Managed Component to Cloudflare Zaraz. Key takeaways:

### Immediate Actions Required:

1. **Fix Build Errors** (CRITICAL)
   - Fix SDK type imports in context-manager.ts
   - Fix cookie handler ClientSetOptions issues
   - Fix URL vs string type mismatches
   - Estimated time: 2-3 hours

2. **Test Deployment to Dev** (HIGH)
   - Authenticate Wrangler
   - Deploy to dev Worker
   - Configure in dev Zaraz
   - Verify functionality
   - Estimated time: 1 hour

3. **Production Deployment** (HIGH)
   - Deploy to prod Worker
   - Configure in prod Zaraz
   - Monitor for issues
   - Full rollout
   - Estimated time: 1 day (with monitoring)

### Key Success Factors:

- **Build must succeed** before any deployment
- **Test thoroughly** in dev before production
- **Monitor closely** during initial rollout
- **Have rollback plan** ready
- **Document everything** for future reference

### Next Steps:

1. Address TypeScript errors (Phase 1 of Implementation Plan)
2. Test deployment in development environment
3. Create monitoring dashboards and alerts
4. Deploy to production with canary rollout
5. Monitor and optimize based on real traffic

### Contact & Support:

- **Project Repository**: /Users/joalves/git_tree/absmartly-managed-component
- **Session Context**: .claude/tasks/context_session_120868b7-2a7e-4cb9-a027-b45475aabe7c.md
- **This Document**: .claude/tasks/deployment_plan.md

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Author**: DevOps Automation Expert (Claude Code)
**Status**: Complete - Ready for Implementation
