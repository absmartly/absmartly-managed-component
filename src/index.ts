import { Manager } from '@managed-components/types'
import { ABSmartlySettings } from './types'
import { setupZarazMode } from './zaraz/setup'
import { setupWebCMMode } from './webcm/setup'
import { createLogger } from './utils/logger'

export default async function (manager: Manager, settings: ABSmartlySettings) {
  const logger = createLogger(settings.ENABLE_DEBUG || false)

  try {
    // Validate required settings
    if (!settings.ABSMARTLY_API_KEY) {
      throw new Error('ABSMARTLY_API_KEY is required')
    }

    if (!settings.ABSMARTLY_ENDPOINT) {
      throw new Error('ABSMARTLY_ENDPOINT is required')
    }

    if (!settings.ABSMARTLY_ENVIRONMENT) {
      throw new Error('ABSMARTLY_ENVIRONMENT is required')
    }

    if (!settings.ABSMARTLY_APPLICATION) {
      throw new Error('ABSMARTLY_APPLICATION is required')
    }

    // Route to appropriate setup based on deployment mode
    const deploymentMode = settings.DEPLOYMENT_MODE || 'zaraz'

    logger.log(`Starting ABsmartly Managed Component in ${deploymentMode} mode`)

    if (deploymentMode === 'webcm') {
      setupWebCMMode(manager, settings)
    } else {
      // Default to Zaraz mode
      setupZarazMode(manager, settings)
    }
  } catch (error) {
    logger.error('Failed to initialize ABsmartly Managed Component:', error)
    throw error
  }
}
