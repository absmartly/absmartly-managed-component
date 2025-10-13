import { Logger } from '../types'

export function createLogger(enableDebug: boolean): Logger {
  const prefix = '[ABSmartly MC]'

  return {
    log: (...args: any[]) => {
      console.log(prefix, ...args)
    },
    error: (...args: any[]) => {
      console.error(prefix, ...args)
    },
    warn: (...args: any[]) => {
      console.warn(prefix, ...args)
    },
    debug: (...args: any[]) => {
      if (enableDebug) {
        console.log(`${prefix} [DEBUG]`, ...args)
      }
    },
  }
}
