import { SDK } from '@absmartly/javascript-sdk'
import type { EventLogger } from '@absmartly/javascript-sdk/types/sdk'
import type { ContextData } from '@absmartly/javascript-sdk/types/context'
// @ts-expect-error - lib/provider doesn't have type definitions
import { ContextDataProvider } from '@absmartly/javascript-sdk/lib/provider'
import type { ABSmartlyContext } from '../../src/types'

export type { EventLogger }

class MockContextDataProvider extends ContextDataProvider {
  private mockData: ContextData
  private delay: number

  constructor(mockData: ContextData = { experiments: [] }, delay = 0) {
    super()
    this.mockData = mockData
    this.delay = delay
  }

  async getContextData(): Promise<ContextData> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay))
    }
    return Promise.resolve(this.mockData)
  }
}


export function createTestSDK(
  eventLogger?: EventLogger,
  mockData?: ContextData,
  delay = 0
): typeof SDK.prototype {
  const provider = new MockContextDataProvider(mockData, delay)

  return new SDK({
    endpoint: 'https://test.absmartly.io',
    apiKey: 'test-key',
    environment: 'test',
    application: 'test-app',
    retries: 0,
    timeout: 1000,
    eventLogger,
    provider,
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
