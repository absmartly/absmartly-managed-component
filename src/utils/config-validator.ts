import type { ABSmartlySettings, Logger } from '../types'

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
  CONTEXT_CACHE_TTL: {
    min: 0,
    max: 86400,
    fieldName: 'CONTEXT_CACHE_TTL',
    defaultValue: 300,
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
  settings: ABSmartlySettings,
  logger?: Logger
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!settings.ABSMARTLY_API_KEY || settings.ABSMARTLY_API_KEY.trim() === '') {
    errors.push('ABSMARTLY_API_KEY is required')
  }

  if (
    !settings.ABSMARTLY_ENDPOINT ||
    settings.ABSMARTLY_ENDPOINT.trim() === ''
  ) {
    errors.push('ABSMARTLY_ENDPOINT is required')
  }

  if (
    !settings.ABSMARTLY_ENVIRONMENT ||
    settings.ABSMARTLY_ENVIRONMENT.trim() === ''
  ) {
    errors.push('ABSMARTLY_ENVIRONMENT is required')
  }

  if (
    !settings.ABSMARTLY_APPLICATION ||
    settings.ABSMARTLY_APPLICATION.trim() === ''
  ) {
    errors.push('ABSMARTLY_APPLICATION is required')
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

  const cacheTTL = validateNumericConfig(
    settings.CONTEXT_CACHE_TTL,
    NUMERIC_CONSTRAINTS.CONTEXT_CACHE_TTL,
    logger
  )
  if (
    cacheTTL !== settings.CONTEXT_CACHE_TTL &&
    settings.CONTEXT_CACHE_TTL !== undefined
  ) {
    warnings.push(
      `CONTEXT_CACHE_TTL adjusted from ${settings.CONTEXT_CACHE_TTL} to ${cacheTTL}`
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
  settings: ABSmartlySettings,
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
