import { ABSmartlySettings, ExperimentData } from '../types'
import { HTMLParser } from '../webcm/html-parser'
import { HTMLParserLinkedom } from '../webcm/html-parser-linkedom'
import { HTMLEmbedParser } from './html-embed-parser'
import { Logger } from '../types'

export interface HTMLProcessorOptions {
  settings: ABSmartlySettings
  logger: Logger
  useLinkedom?: boolean // Whether to use linkedom parser (true) or regex parser (false)
}

/**
 * Shared HTML processor for both Zaraz and WebCM modes
 * Handles Treatment tags and DOM changes in a single, unified way
 */
export class HTMLProcessor {
  constructor(private options: HTMLProcessorOptions) {}

  /**
   * Process HTML with Treatment tags and DOM changes
   * This is the main method used by both Zaraz and WebCM modes
   */
  processHTML(html: string, experimentData: ExperimentData[]): string {
    let processedHTML = html

    // 1. Process Treatment tags (if enabled)
    if (this.options.settings.ENABLE_EMBEDS) {
      processedHTML = this.processTreatmentTags(processedHTML, experimentData)
    }

    // 2. Apply DOM changes from experiments
    processedHTML = this.applyDOMChanges(processedHTML, experimentData)

    return processedHTML
  }

  /**
   * Process Treatment tags in HTML
   */
  private processTreatmentTags(
    html: string,
    experimentData: ExperimentData[]
  ): string {
    try {
      // Check if HTML contains Treatment tags
      const treatments = HTMLEmbedParser.parseTreatmentTags(html)
      if (treatments.length === 0) {
        this.options.logger.debug('No Treatment tags found in HTML')
        return html
      }

      this.options.logger.debug('Found Treatment tags', {
        count: treatments.length,
      })

      // Create a map of experiment names to treatments for quick lookup
      const treatmentMap = new Map<string, number>()
      for (const exp of experimentData) {
        if (exp.treatment !== undefined && exp.treatment >= 0) {
          treatmentMap.set(exp.name, exp.treatment)
        }
      }

      // Create getTreatment function
      const getTreatment = (experimentName: string): number | undefined => {
        return treatmentMap.get(experimentName)
      }

      // Process HTML with Treatment tags
      const variantMapping = this.options.settings.VARIANT_MAPPING || {}
      const processedHTML = HTMLEmbedParser.processHTML(
        html,
        getTreatment,
        variantMapping
      )

      this.options.logger.debug('Treatment tags processed successfully')

      return processedHTML
    } catch (error) {
      this.options.logger.error('Failed to process Treatment tags:', error)
      return html
    }
  }

  /**
   * Apply DOM changes from experiments
   */
  private applyDOMChanges(
    html: string,
    experimentData: ExperimentData[]
  ): string {
    let processedHTML = html

    for (const experiment of experimentData) {
      if (experiment.changes && experiment.changes.length > 0) {
        this.options.logger.debug('Applying DOM changes', {
          experiment: experiment.name,
          treatment: experiment.treatment,
          changesCount: experiment.changes.length,
        })

        try {
          processedHTML = this.applyChangesWithParser(
            processedHTML,
            experiment.changes
          )
        } catch (error) {
          this.options.logger.error('Failed to apply DOM changes:', error)
          // Continue to next experiment
        }
      }
    }

    return processedHTML
  }

  /**
   * Apply changes using the appropriate parser
   * Uses linkedom for full CSS selector support, falls back to regex parser
   */
  private applyChangesWithParser(html: string, changes: DOMChange[]): string {
    // Try linkedom parser first (if enabled)
    if (this.options.useLinkedom) {
      try {
        const parser = new HTMLParserLinkedom(html, this.options.logger)
        return parser.applyChanges(changes)
      } catch (linkedomError) {
        this.options.logger.warn(
          'Linkedom parser failed, falling back to regex parser:',
          linkedomError
        )
      }
    }

    // Fallback to regex parser (always available)
    try {
      const parser = new HTMLParser(html)
      return parser.applyChanges(changes)
    } catch (regexError) {
      this.options.logger.error(
        'Both linkedom and regex parsers failed to apply changes:',
        regexError
      )
      // Return original HTML if both parsers fail
      return html
    }
  }
}
