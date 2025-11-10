# Zaraz Setup Guide

Complete step-by-step guide to add your ABsmartly Managed Component to Cloudflare Zaraz.

## Prerequisites

✅ Worker deployed: `custom-mc-absmartly`
✅ Worker URL: https://custom-mc-absmartly.absmartly.workers.dev

## Step 1: Access Zaraz

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your website/domain
3. In the left sidebar, click **Zaraz**

## Step 2: Add Custom Managed Component

1. Click **Third-party tools** in the Zaraz menu
2. Click the **Add new tool** button
3. In the tool selection modal:
   - Scroll to the bottom or search for **"Custom Managed Component"**
   - Click on **Custom Managed Component**

## Step 3: Select Your Worker

1. In the "Select Worker" dropdown, choose:
   - **`custom-mc-absmartly`**
2. Give your tool a name (e.g., "ABsmartly A/B Testing")
3. Click **Continue** or **Save**

## Step 4: Configure ABsmartly Settings

⚠️ **Important:** You need to manually add each setting field. See **[ZARAZ_SETTINGS_GUIDE.md](./ZARAZ_SETTINGS_GUIDE.md)** for detailed instructions with screenshots.

**Quick summary:** Click "+ Add Field" and add these required settings (you'll need your ABsmartly credentials):

| Setting Name | Description | Example |
|--------------|-------------|---------|
| `ABSMARTLY_API_KEY` | Your ABsmartly API key | `your-api-key-here` |
| `ABSMARTLY_ENDPOINT` | ABsmartly API endpoint | `https://your-endpoint.absmartly.io/v1` |
| `ABSMARTLY_ENVIRONMENT` | Environment name | `production` or `development` |
| `ABSMARTLY_APPLICATION` | Application name | `your-app-name` |

### Optional Settings

| Setting Name | Description | Default |
|--------------|-------------|---------|
| `ABSMARTLY_UNIT_TYPE` | Unit identifier type | `user_id` |
| `ABSMARTLY_TIMEOUT` | API timeout in ms | `3000` |
| `ABSMARTLY_ENABLE_DEBUG` | Enable debug logging | `false` |

## Step 5: Grant Permissions

The ABsmartly MC needs these permissions to function:

✅ **Required Permissions:**
- ✅ `execute_unsafe_scripts` - For anti-flicker code
- ✅ `serve_static_files` - For serving client scripts
- ✅ `provide_server_functionality` - For experiment assignment
- ✅ `access_client_kv` - For context caching
- ✅ `set_cookies` - For user identification

Check all required permissions and click **Save** or **Continue**.

## Step 6: Add Triggers

### Automatic Trigger (Recommended)
The component automatically handles:
- ✅ **Pageview** events (automatically tracked)

### Optional Custom Triggers
You can add custom triggers for:
- **Track Events** - Track custom events (conversions, clicks, etc.)
- **Page Changes** - SPA route changes
- **Custom Events** - Domain-specific events

**Example Custom Trigger:**
- Trigger name: `Track Conversion`
- Event type: `Track`
- Condition: `{{ client.__zarazTrack }} equals "conversion"`

## Step 7: Publish Changes

1. Review your configuration
2. Click **Publish** in the top right
3. Your changes will be live within seconds

## Step 8: Verify Installation

### Check Anti-Flicker
1. Open your website
2. Open browser DevTools (F12)
3. In Console, check for:
   ```
   [ABSmartly MC] Anti-flicker applied
   ```

### Check Experiment Assignment
1. In DevTools Console, run:
   ```javascript
   document.cookie.split(';').find(c => c.includes('absmartly'))
   ```
2. You should see an ABsmartly context cookie

### Check Network Requests
1. Go to Network tab in DevTools
2. Filter by "absmartly"
3. You should see requests to your ABsmartly endpoint

## Troubleshooting

### Issue: Anti-flicker not working
- Check that `execute_unsafe_scripts` permission is granted
- Verify `ABSMARTLY_ENDPOINT` is correct
- Check browser console for errors

### Issue: No experiments showing
- Verify `ABSMARTLY_API_KEY` is correct
- Check that experiments are published in ABsmartly dashboard
- Ensure `ABSMARTLY_ENVIRONMENT` matches your setup

### Issue: Performance issues
- Increase `ABSMARTLY_TIMEOUT` if API is slow
- Check KV namespace is properly bound (see deployment logs)
- Enable `ABSMARTLY_ENABLE_DEBUG` to see timing logs

## Advanced Configuration

### Custom Unit Identifier
By default, ABsmartly uses `user_id` from cookies. To use a different identifier:

Set `ABSMARTLY_UNIT_TYPE` to one of:
- `user_id` (default)
- `session_id`
- `anonymous_id`
- Custom field name from your data layer

### Treatment Tags in HTML
You can use treatment tags directly in your HTML:

```html
<div data-absmartly-treatment="experiment_name">
  <span data-variant="control">Original Text</span>
  <span data-variant="treatment">New Text</span>
</div>
```

The component will automatically show/hide variants based on experiment assignment.

### Visual Editor Support
The ABsmartly Visual Editor works automatically. Changes made in the editor will be applied at the edge with zero flicker.

## Need Help?

- **ABsmartly Docs:** https://docs.absmartly.com
- **Zaraz Docs:** https://developers.cloudflare.com/zaraz
- **Worker URL:** https://custom-mc-absmartly.absmartly.workers.dev
- **GitHub Issues:** https://github.com/absmartly/absmartly-managed-component/issues
