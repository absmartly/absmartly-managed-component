import { SDK } from '@absmartly/javascript-sdk'
import type { EventLogger } from '@absmartly/javascript-sdk/types/sdk'
import type { ContextData } from '@absmartly/javascript-sdk/types/context'
// @ts-expect-error - lib/provider doesn't have type definitions
import { ContextDataProvider } from '@absmartly/javascript-sdk/lib/provider'
// @ts-expect-error - lib/publisher doesn't have type definitions
import { ContextPublisher } from '@absmartly/javascript-sdk/lib/publisher'
import type { PublishParams } from '@absmartly/javascript-sdk/types/publisher'
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

class MockContextPublisher extends ContextPublisher {
  async publish(request: PublishParams): Promise<void> {
    return Promise.resolve()
  }
}

export function createTestSDK(
  eventLogger?: EventLogger,
  mockData?: ContextData,
  delay = 0
): typeof SDK.prototype {
  const provider = new MockContextDataProvider(mockData, delay)
  const publisher = new MockContextPublisher()

  return new SDK({
    endpoint: 'https://test.absmartly.io',
    apiKey: 'test-key',
    environment: 'test',
    application: 'test-app',
    retries: 0,
    timeout: 1000,
    eventLogger,
    provider,
    publisher,
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
