#!/bin/bash
# Deployment script for ABsmartly Managed Component to Cloudflare Zaraz

echo "🚀 Deploying ABsmartly Managed Component to Cloudflare..."
echo ""

npm run deploy:zaraz

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Worker deployed to: https://custom-mc-absmartly.absmartly.workers.dev"
echo ""
echo "Next steps:"
echo "1. Go to Cloudflare Dashboard → Zaraz → Third-party tools"
echo "2. Click 'Add new tool' → 'Custom Managed Component'"
echo "3. Select 'custom-mc-absmartly' worker"
echo "4. Configure your ABsmartly settings"
echo "5. Grant permissions and add triggers"
echo ""
