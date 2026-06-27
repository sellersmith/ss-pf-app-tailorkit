import type { ShineOnMapping } from '~/modules/Fulfillments/ShineOn/types'

export interface PersonalizationInput {
  /** Customer's text input per layer: { layerId: textValue } */
  layerTexts: Record<string, string>
  /** Selected font (if applicable) */
  selectedFont?: string
  /** Selected size (if applicable, e.g., ring size) */
  selectedSize?: string
  /** Rendered artwork URL from canvas */
  printUrl?: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Builds ShineOn order line item `properties` from mapping + customer personalization.
 * Used at fulfillment time (Phase 04).
 */
export function buildPersonalizationPayload(
  mapping: ShineOnMapping,
  input: PersonalizationInput
): Record<string, string> {
  const properties: Record<string, string> = {}

  // Map engraving lines
  for (const line of mapping.engravingLines) {
    if (line.layerId && input.layerTexts[line.layerId]) {
      const text = input.layerTexts[line.layerId]
      // Truncate to max chars if set (ShineOn silently truncates anyway)
      const truncated = line.maxChars > 0 ? text.slice(0, line.maxChars) : text
      properties[`Engraving Line ${line.lineNumber}`] = truncated
    }
  }

  // Map font
  if (mapping.fontMapping) {
    const font = input.selectedFont || mapping.fontMapping.defaultFont
    if (font) {
      properties['Engraving Font'] = font
    }
  }

  // Map size (rings)
  if (mapping.sizeMapping?.layerId && input.selectedSize) {
    properties['Size (US)'] = input.selectedSize
  }

  // Add print URL (rendered artwork)
  if (input.printUrl) {
    properties['print_url'] = input.printUrl
  }

  return properties
}

/**
 * Validates that a mapping is complete enough for fulfillment.
 * Returns validation errors if mapping is incomplete.
 */
export function validateMapping(mapping: ShineOnMapping | null | undefined): ValidationResult {
  const errors: string[] = []

  if (!mapping) {
    return { valid: false, errors: ['ShineOn mapping is not configured'] }
  }

  // Check that at least one engraving line or print URL is mapped
  const hasEngravingMapped = mapping.engravingLines.some(line => line.layerId)
  const hasPrintUrl = !!mapping.printUrl?.printAreaId

  if (!hasEngravingMapped && !hasPrintUrl) {
    errors.push('At least one engraving line or print area must be mapped')
  }

  // Check font mapping has a default
  if (mapping.engravingLines.length > 0 && !mapping.fontMapping?.defaultFont) {
    errors.push('Default font must be set for engraving products')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validates personalization input against mapping constraints.
 */
export function validatePersonalizationInput(mapping: ShineOnMapping, input: PersonalizationInput): ValidationResult {
  const errors: string[] = []

  for (const line of mapping.engravingLines) {
    if (!line.layerId) continue
    const text = input.layerTexts[line.layerId]
    if (text && line.maxChars > 0 && text.length > line.maxChars) {
      errors.push(`Engraving Line ${line.lineNumber} exceeds ${line.maxChars} character limit`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
