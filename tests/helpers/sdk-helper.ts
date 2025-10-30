import { SDK } from '@absmartly/javascript-sdk'
import type { EventLogger } from '@absmartly/javascript-sdk/types/sdk'
import type { ContextData } from '@absmartly/javascript-sdk/types/context'
import type { ABSmartlyContext } from '../../src/types'

export type { EventLogger }

export function createTestSDK(
  eventLogger?: EventLogger
): typeof SDK.prototype {
  return new SDK({
    endpoint: 'https://test.absmartly.io',
    apiKey: 'test-key',
    environment: 'test',
    application: 'test-app',
    retries: 0,
    timeout: 1000,
    eventLogger,
  })
}

export function createTestContext(
  sdk: typeof SDK.prototype,
  userId: string,
  contextData: ContextData
): ABSmartlyContext {
  const context = sdk.createContextWith(
    {
      units: {
        user_id: userId,
        session_id: `${userId}_test_session`,
      },
    },
    contextData
  ) as unknown as ABSmartlyContext

  return context
}

export default {
  createTestSDK,
  createTestContext,
}
