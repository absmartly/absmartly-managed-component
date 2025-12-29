import { Logger } from '../types'

export type LoggerMode = 'worker' | 'zaraz' | 'webcm'

const MODE_PREFIXES: Record<LoggerMode, string> = {
  worker: '[ABsmartly Worker]',
  zaraz: '[ABsmartly Zaraz]',
  webcm: '[ABsmartly WebCM]',
}

export function createLogger(
  enableDebug: boolean,
  mode: LoggerMode = 'zaraz'
): Logger {
  const prefix = MODE_PREFIXES[mode]

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
    info: (...args: unknown[]) => {
      console.info(prefix, ...args)
    },
  }
}
