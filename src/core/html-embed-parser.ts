/**
 * HTML Embed Parser - Parses Treatment/TreatmentVariant tags
 *
 * Supports React-like syntax for inline variant definitions:
 * <Treatment name="hero_test">
 *   <TreatmentVariant variant="0">Control</TreatmentVariant>
 *   <TreatmentVariant variant="1">Treatment</TreatmentVariant>
 * </Treatment>
 *
 * Or with alphabetic variants:
 * <Treatment name="hero_test">
 *   <TreatmentVariant variant="A">Control</TreatmentVariant>
 *   <TreatmentVariant variant="B">Treatment</TreatmentVariant>
 * </Treatment>
 *
 * With trigger-on-view:
 * <Treatment name="hero_test" trigger-on-view>
 *   <TreatmentVariant variant="0">Control</TreatmentVariant>
 *   <TreatmentVariant variant="1">Treatment</TreatmentVariant>
 * </Treatment>
 */

export interface VariantDefinition {
  variant: string | number // A, B, C or 0, 1, 2
  content: string
}

export interface TreatmentTag {
  name: string
  triggerOnView: boolean
  variants: VariantDefinition[]
  fullMatch: string
}

export class HTMLEmbedParser {
  /**
   * Parse Treatment tags from HTML
   */
  static parseTreatmentTags(html: string): TreatmentTag[] {
    const treatments: TreatmentTag[] = []

    // Match <Treatment name="..." [trigger-on-view]>...</Treatment> blocks
    const treatmentRegex =
      /<Treatment\s+name=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/Treatment>/gi

    let match: RegExpExecArray | null
    while ((match = treatmentRegex.exec(html)) !== null) {
      const fullMatch = match[0]
      const name = match[1]
      const attributes = match[2]
      const innerContent = match[3]

      // Check for trigger-on-view attribute
      const triggerOnView = /\btrigger-on-view\b/.test(attributes)

      // Parse variants from inner content
      const variants = this.parseVariants(innerContent)

      treatments.push({
        name,
        triggerOnView,
        variants,
        fullMatch,
      })
    }

    return treatments
  }

  /**
   * Parse TreatmentVariant tags from treatment inner content
   */
  private static parseVariants(content: string): VariantDefinition[] {
    const variants: VariantDefinition[] = []

    // Match <TreatmentVariant variant="A">...</TreatmentVariant>
    const variantRegex =
      /<TreatmentVariant\s+([^>]+)>([\s\S]*?)<\/TreatmentVariant>/gi

    let match: RegExpExecArray | null
    while ((match = variantRegex.exec(content)) !== null) {
      const attributes = match[1]
      const variantContent = match[2].trim()

      // Extract variant identifier (can be "A", "B", "C" or 0, 1, 2)
      let variant: string | number = ''
      const variantMatch = attributes.match(/variant=["']?([^"'\s]+)["']?/)
      if (variantMatch) {
        const value = variantMatch[1]
        // Check if it's a number
        if (/^\d+$/.test(value)) {
          variant = parseInt(value, 10)
        } else {
          variant = value
        }
      }

      variants.push({
        variant,
        content: variantContent,
      })
    }

    return variants
  }

  /**
   * Replace Treatment tags with selected variant content
   *
   * @param variantMapping - Maps variant names to treatment numbers (e.g., {"A": 0, "B": 1, "control": 0})
   */
  static replaceTreatmentTag(
    html: string,
    treatmentTag: TreatmentTag,
    selectedTreatment: number | undefined,
    variantMapping: Record<string, number> = {}
  ): string {
    // Find the variant to use
    let variantContent: string | undefined

    if (selectedTreatment !== undefined && selectedTreatment >= 0) {
      // Try to find variant by:
      // 1. Direct treatment number match
      const directMatch = treatmentTag.variants.find(
        v => v.variant === selectedTreatment
      )
      if (directMatch) {
        variantContent = directMatch.content
      } else {
        // 2. Variant name mapping (e.g., "A" -> 0, "B" -> 1)
        const variantName = Object.keys(variantMapping).find(
          name => variantMapping[name] === selectedTreatment
        )
        if (variantName) {
          const namedMatch = treatmentTag.variants.find(
            v => v.variant === variantName
          )
          if (namedMatch) {
            variantContent = namedMatch.content
          }
        }

        // 3. Simple alphabetic mapping: A=0, B=1, C=2...
        if (!variantContent) {
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
          const expectedLetter = alphabet[selectedTreatment]
          const alphaMatch = treatmentTag.variants.find(
            v =>
              typeof v.variant === 'string' &&
              v.variant.toUpperCase() === expectedLetter
          )
          if (alphaMatch) {
            variantContent = alphaMatch.content
          }
        }
      }
    }

    // Fallback to control variant (0 or A) if no match
    if (variantContent === undefined) {
      // Try variant 0 (numeric control)
      const controlNumeric = treatmentTag.variants.find(v => v.variant === 0)
      if (controlNumeric) {
        variantContent = controlNumeric.content
      } else {
        // Try variant A (alphabetic control)
        const controlAlpha = treatmentTag.variants.find(
          v => typeof v.variant === 'string' && v.variant.toUpperCase() === 'A'
        )
        if (controlAlpha) {
          variantContent = controlAlpha.content
        }
      }
    }

    // If no control variant found, show nothing (empty string)
    if (variantContent === undefined) {
      variantContent = ''
    }

    // If trigger-on-view, wrap content with tracking attribute
    if (treatmentTag.triggerOnView) {
      variantContent = `<span trigger-on-view="${treatmentTag.name}">${variantContent}</span>`
    }

    // Replace the entire Treatment tag with variant content
    return html.replace(treatmentTag.fullMatch, variantContent)
  }

  /**
   * Process all Treatment tags in HTML
   */
  static processHTML(
    html: string,
    getTreatment: (experimentName: string) => number | undefined,
    variantMapping: Record<string, number> = {}
  ): string {
    let processedHTML = html

    // Parse all Treatment tags
    const treatments = this.parseTreatmentTags(html)

    // Replace each Treatment tag with appropriate variant
    for (const treatment of treatments) {
      const selectedTreatment = getTreatment(treatment.name)
      processedHTML = this.replaceTreatmentTag(
        processedHTML,
        treatment,
        selectedTreatment,
        variantMapping
      )
    }

    return processedHTML
  }

  /**
   * Validate Treatment tag structure
   */
  static validateTreatmentTag(tag: TreatmentTag): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check if name is provided
    if (!tag.name || tag.name.trim().length === 0) {
      errors.push('Treatment name is required')
    }

    // Check if variants exist
    if (tag.variants.length === 0) {
      errors.push('At least one variant is required')
    }

    // Check for duplicate variant identifiers
    const seenVariants = new Set<string | number>()
    for (const variant of tag.variants) {
      if (variant.variant !== undefined && variant.variant !== '') {
        const key =
          typeof variant.variant === 'string'
            ? variant.variant.toUpperCase()
            : variant.variant
        if (seenVariants.has(key)) {
          errors.push(`Duplicate variant identifier: ${variant.variant}`)
        }
        seenVariants.add(key)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
