# Zaraz Settings Configuration Guide

This guide shows you how to configure settings for your ABsmartly Custom Managed Component in Cloudflare Zaraz.

## 🆕 Recommended: ZARAZ_CONFIG Option

The simplest way to configure your ABsmartly component is using the `ZARAZ_CONFIG` setting. This allows you to pass all your configuration as a single JSON object:

```
Field Name: ZARAZ_CONFIG
Type: Text
Value: {
  "ABSMARTLY_ENDPOINT": "https://demo2.absmartly.com",
  "ABSMARTLY_ENVIRONMENT": "Prod",
  "ABSMARTLY_APPLICATION": "absmartly.com",
  "ENABLE_DEBUG": "true"
}
```

**Key benefits:**
- ✅ All settings in one place
- ✅ Individual settings override ZARAZ_CONFIG (e.g., keep API key separate)
- ✅ Empty string values are treated as undefined (ZARAZ_CONFIG takes precedence)

**Example: Keep API Key Separate**
```
ZARAZ_CONFIG: { "ABSMARTLY_ENDPOINT": "...", "ABSMARTLY_ENVIRONMENT": "..." }
ABSMARTLY_API_KEY: {{secrets.absmartly_api_key}}  ← Individual setting overrides
```

This is especially useful for keeping sensitive values like API keys in Zaraz's secret variables while storing other configuration in JSON.

---

## ✅ Alternative: Pre-Configured Fields

As of the latest deployment, the ABsmartly component now includes a `manifest.json` with pre-defined fields. When you add the tool in Zaraz, you should see the following fields automatically appear in the settings dropdown:

**Required Fields:**
- API Key
- Endpoint URL
- Environment
- Application Name

**Optional Fields:**
- Enable Debug Logging
- API Timeout (ms)
- Enable Anti-Flicker
- Anti-Flicker Timeout (ms)

If you see these fields in the dropdown, simply select them and enter your values. If they don't appear (older deployment), follow the manual instructions below.

## Fallback: Manual Field Configuration

If the fields don't appear automatically in the dropdown, you can add them manually:

### Step-by-Step Process

1. In the "Tool Settings" modal, click **"+ Add Field"** under the "settings" section
2. For each required setting below:
   - Enter the **Field Name** exactly as shown (case-sensitive!)
   - Select **Type**: Text or String
   - Enter your **Value**
   - Click **Add** or **Save**

## Required Settings (Must Configure)

### 1. ABSMARTLY_API_KEY

```
Field Name: ABSMARTLY_API_KEY
Type: Text
Value: <your-absmartly-api-key>
```

**Where to find:**
- ABsmartly Dashboard → Settings → API Keys
- Or contact your ABsmartly account manager

---

### 2. ABSMARTLY_ENDPOINT

```
Field Name: ABSMARTLY_ENDPOINT
Type: Text
Value: https://sandbox.absmartly.io/v1
```

**Common values:**
- Sandbox: `https://sandbox.absmartly.io/v1`
- Production: `https://production.absmartly.io/v1`
- Custom: Your organization's endpoint

**Where to find:**
- ABsmartly Dashboard → Settings → Endpoints
- Check your ABsmartly SDK configuration

---

### 3. ABSMARTLY_ENVIRONMENT

```
Field Name: ABSMARTLY_ENVIRONMENT
Type: Text
Value: production
```

**Valid values:**
- `production` - For production deployments
- `development` - For dev/staging
- `staging` - For staging environments
- Any custom environment name from your ABsmartly setup

---

### 4. ABSMARTLY_APPLICATION

```
Field Name: ABSMARTLY_APPLICATION
Type: Text
Value: website
```

**Value should match:**
- The application name in your ABsmartly dashboard
- The application configured in your experiments

**Common examples:**
- `website`
- `web-app`
- `marketing-site`
- `ecommerce`

---

## Optional Settings (Recommended)

### Debug Logging

```
Field Name: ENABLE_DEBUG
Type: Boolean or Text
Value: true
```

Enable this to see detailed logs in browser console. Useful for testing!

---

### Performance Settings

```
Field Name: SDK_TIMEOUT
Type: Number
Value: 3000
```

How long to wait for ABsmartly API response (in milliseconds).

---

### Anti-Flicker Configuration

```
Field Name: ENABLE_ANTI_FLICKER
Type: Boolean
Value: true
```

```
Field Name: HIDE_TIMEOUT
Type: Number
Value: 3000
```

```
Field Name: HIDE_SELECTOR
Type: Text
Value: body
```

These control the anti-flicker behavior. Default values work for most sites.

---

## Advanced Optional Settings

### Cookie Management

```
Field Name: COOKIE_DOMAIN
Type: Text
Value: .yourdomain.com
```

Set if you need cross-subdomain tracking.

```
Field Name: COOKIE_MAX_AGE
Type: Number
Value: 31536000
```

Cookie expiry in seconds (default: 1 year).

---

### Client SDK Injection

```
Field Name: INJECT_CLIENT_SDK
Type: Boolean
Value: true
```

```
Field Name: CLIENT_SDK_STRATEGY
Type: Text
Value: cdn
```

Valid strategies: `cdn`, `bundled`, `custom`

---

## Complete Example Configuration

Here's what your settings should look like when complete:

| Field Name | Value | Required |
|------------|-------|----------|
| `ABSMARTLY_API_KEY` | `sk_abc123...` | ✅ Yes |
| `ABSMARTLY_ENDPOINT` | `https://sandbox.absmartly.io/v1` | ✅ Yes |
| `ABSMARTLY_ENVIRONMENT` | `production` | ✅ Yes |
| `ABSMARTLY_APPLICATION` | `website` | ✅ Yes |
| `ENABLE_DEBUG` | `true` | No |
| `SDK_TIMEOUT` | `3000` | No |

## After Adding Settings

1. Click **Save** at the bottom of the Tool Settings modal
2. Close the modal
3. Grant the required permissions (see main setup guide)
4. Add triggers (Pageview is automatic)
5. Click **Publish** in the top right

## Verification

After publishing, check your browser console on your website:

```javascript
// Should see initialization log
[ABsmartly MC] Anti-flicker applied

// Check for ABsmartly context cookie
document.cookie.split(';').find(c => c.includes('absmartly'))
```

## Troubleshooting

### "Missing required setting" errors

Make sure:
- Field names are **exact** (case-sensitive)
- All 4 required fields are added
- Values don't have extra spaces

### Settings not saving

- Click **Save** in the modal after adding each field
- Click **Publish** to deploy changes
- Wait 10-30 seconds for propagation

### Wrong endpoint

Check your ABsmartly dashboard for the correct endpoint URL. It should include `/v1` at the end.

## Need Help?

- **Full setup guide:** [ZARAZ_SETUP.md](./ZARAZ_SETUP.md)
- **ABsmartly Docs:** https://docs.absmartly.com
- **Worker URL:** https://custom-mc-absmartly.absmartly.workers.dev
