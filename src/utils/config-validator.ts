import type { ABsmartlySettings, Logger } from '../types'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface NumericConstraints {
  min?: number
  max?: number
  fieldName: string
  defaultValue: number
}

const NUMERIC_CONSTRAINTS: Record<string, NumericConstraints> = {
  SDK_TIMEOUT: {
    min: 100,
    max: 30000,
    fieldName: 'SDK_TIMEOUT',
    defaultValue: 2000,
  },
  HIDE_TIMEOUT: {
    min: 0,
    max: 10000,
    fieldName: 'HIDE_TIMEOUT',
    defaultValue: 3000,
  },
  TRACK_BATCH_TIMEOUT: {
    min: 0,
    max: 60000,
    fieldName: 'TRACK_BATCH_TIMEOUT',
    defaultValue: 0,
  },
  TRACK_BATCH_SIZE: {
    min: 1,
    max: 100,
    fieldName: 'TRACK_BATCH_SIZE',
    defaultValue: 1,
  },
}

export function validateNumericConfig(
  value: number | undefined,
  constraints: NumericConstraints,
  logger?: Logger
): number {
  if (value === undefined || value === null) {
    if (logger) {
      logger.debug(
        `${constraints.fieldName} not set, using default: ${constraints.defaultValue}`
      )
    }
    return constraints.defaultValue
  }

  if (typeof value !== 'number' || isNaN(value)) {
    if (logger) {
      logger.warn(
        `Invalid ${constraints.fieldName} value: ${value}. Using default: ${constraints.defaultValue}`
      )
    }
    return constraints.defaultValue
  }

  if (constraints.min !== undefined && value < constraints.min) {
    if (logger) {
      logger.warn(
        `${constraints.fieldName} value ${value} is below minimum ${constraints.min}. Using minimum.`
      )
    }
    return constraints.min
  }

  if (constraints.max !== undefined && value > constraints.max) {
    if (logger) {
      logger.warn(
        `${constraints.fieldName} value ${value} exceeds maximum ${constraints.max}. Using maximum.`
      )
    }
    return constraints.max
  }

  return value
}

export function validateSettings(
  settings: ABsmartlySettings,
  logger?: Logger
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!settings.SDK_API_KEY || settings.SDK_API_KEY.trim() === '') {
    errors.push('SDK_API_KEY is required')
  }

  if (!settings.ENDPOINT || settings.ENDPOINT.trim() === '') {
    errors.push('ENDPOINT is required')
  }

  if (!settings.ENVIRONMENT || settings.ENVIRONMENT.trim() === '') {
    errors.push('ENVIRONMENT is required')
  }

  if (!settings.APPLICATION || settings.APPLICATION.trim() === '') {
    errors.push('APPLICATION is required')
  }

  const sdkTimeout = validateNumericConfig(
    settings.SDK_TIMEOUT,
    NUMERIC_CONSTRAINTS.SDK_TIMEOUT,
    logger
  )
  if (
    sdkTimeout !== settings.SDK_TIMEOUT &&
    settings.SDK_TIMEOUT !== undefined
  ) {
    warnings.push(
      `SDK_TIMEOUT adjusted from ${settings.SDK_TIMEOUT} to ${sdkTimeout}`
    )
  }

  const hideTimeout = validateNumericConfig(
    settings.HIDE_TIMEOUT,
    NUMERIC_CONSTRAINTS.HIDE_TIMEOUT,
    logger
  )
  if (
    hideTimeout !== settings.HIDE_TIMEOUT &&
    settings.HIDE_TIMEOUT !== undefined
  ) {
    warnings.push(
      `HIDE_TIMEOUT adjusted from ${settings.HIDE_TIMEOUT} to ${hideTimeout}`
    )
  }

  if (settings.TRACK_BATCH_TIMEOUT !== undefined) {
    const batchTimeout = validateNumericConfig(
      settings.TRACK_BATCH_TIMEOUT,
      NUMERIC_CONSTRAINTS.TRACK_BATCH_TIMEOUT,
      logger
    )
    if (batchTimeout !== settings.TRACK_BATCH_TIMEOUT) {
      warnings.push(
        `TRACK_BATCH_TIMEOUT adjusted from ${settings.TRACK_BATCH_TIMEOUT} to ${batchTimeout}`
      )
    }
  }

  if (settings.TRACK_BATCH_SIZE !== undefined) {
    const batchSize = validateNumericConfig(
      settings.TRACK_BATCH_SIZE,
      NUMERIC_CONSTRAINTS.TRACK_BATCH_SIZE,
      logger
    )
    if (batchSize !== settings.TRACK_BATCH_SIZE) {
      warnings.push(
        `TRACK_BATCH_SIZE adjusted from ${settings.TRACK_BATCH_SIZE} to ${batchSize}`
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function getValidatedNumericConfig(
  settings: ABsmartlySettings,
  fieldName: keyof typeof NUMERIC_CONSTRAINTS,
  logger?: Logger
): number {
  const constraints = NUMERIC_CONSTRAINTS[fieldName]
  if (!constraints) {
    throw new Error(`Unknown numeric config field: ${fieldName}`)
  }

  const value = settings[fieldName] as number | undefined
  return validateNumericConfig(value, constraints, logger)
}
