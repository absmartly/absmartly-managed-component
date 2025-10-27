import { Logger } from '../types'

export function createLogger(enableDebug: boolean): Logger {
  const prefix = '[ABSmartly MC]'

  return {
    log: (...args: unknown[]) => {
      console.log(prefix, ...args)
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args)
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args)
    },
    debug: (...args: unknown[]) => {
      if (enableDebug) {
        console.log(`${prefix} [DEBUG]`, ...args)
      }
    },
  }
}
