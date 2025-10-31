import { Manager } from '@managed-components/types'
import { Logger } from '../types'

const setupInstances = new WeakMap<Manager, boolean>()

/**
 * Checks if setup has already been initialized for a manager
 * Returns true if already initialized (duplicate setup detected)
 */
export function isDuplicateSetup(manager: Manager, logger: Logger): boolean {
  if (setupInstances.has(manager)) {
    logger.warn(
      'Already initialized for this manager, skipping duplicate setup'
    )
    return true
  }

  setupInstances.set(manager, true)
  return false
}

/**
 * Marks manager as cleaned up (removes from setup instances)
 */
export function markCleanedUp(manager: Manager): void {
  setupInstances.delete(manager)
}

/**
 * Creates a no-op cleanup function for duplicate setups
 */
export function createNoOpCleanup(logger: Logger): () => void {
  return () => {
    logger.debug('Cleanup called but already skipped duplicate setup')
  }
}
