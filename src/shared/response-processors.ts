import { ABsmartlySettings, ExperimentData, Logger } from '../types'
import { HTMLProcessor } from '../core/html-processor'

/**
 * Processes HTML with experiment data using HTMLProcessor
 * Applies Treatment tags and DOM changes
 *
 * @param html - HTML string to process
 * @param experimentData - Experiment data to apply
 * @param settings - ABsmartly settings
 * @param logger - Logger instance
 * @returns Processed HTML string
 */
export function processHTMLWithExperiments(
  html: string,
  experimentData: ExperimentData[],
  settings: ABsmartlySettings,
  logger: Logger
): string {
  const processor = new HTMLProcessor({
    settings,
    logger,
    useLinkedom: true,
  })

  return processor.processHTML(html, experimentData)
}

/**
 * Creates a new Response object from processed HTML
 * Preserves status, statusText, and headers from original response
 *
 * @param html - Processed HTML string
 * @param originalResponse - Original Response to copy metadata from
 * @returns New Response with processed HTML
 */
export function createResponseFromHTML(
  html: string,
  originalResponse: Response
): Response {
  return new Response(html, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: originalResponse.headers,
  })
}

/**
 * Checks if a path should be excluded from processing
 *
 * @param url - URL to check
 * @param excludedPaths - Array of path patterns to exclude
 * @param logger - Logger instance
 * @returns True if path should be excluded
 */
export function shouldExcludePath(
  url: string,
  excludedPaths: string[] | undefined,
  logger: Logger
): boolean {
  if (!excludedPaths || excludedPaths.length === 0) {
    return false
  }

  for (const path of excludedPaths) {
    if (url.includes(path)) {
      logger.debug('URL excluded from manipulation', { url, path })
      return true
    }
  }

  return false
}
