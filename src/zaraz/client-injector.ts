import { MCEvent } from '@managed-components/types'
import { ABSmartlySettings } from '../types'
import { Logger } from '../types'
import {
  injectFailsafe,
  injectDebugInfo,
  injectClientBundleViaExecute,
} from '../shared/injection-helpers'

/**
 * Zaraz Client Injector
 * Wrapper around shared injection utilities for Zaraz mode
 */
export class ClientInjector {
  constructor(
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  /**
   * Injects client-side bundle for Zaraz mode
   * Uses the shared client bundle generator for consistent behavior with WebCM
   */
  injectClientCode(event: MCEvent): void {
    injectClientBundleViaExecute(event, this.settings, this.logger)
  }

  /**
   * Injects failsafe script to reveal page if initialization fails
   */
  injectFailsafe(event: MCEvent): void {
    injectFailsafe(event, this.settings, this.logger)
  }

  /**
   * Injects debug information to console
   */
  injectDebugInfo(event: MCEvent): void {
    injectDebugInfo(event, this.settings, this.logger)
  }
}
