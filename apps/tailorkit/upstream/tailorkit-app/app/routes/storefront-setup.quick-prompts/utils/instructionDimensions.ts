/**
 * Utility functions for parsing and updating dimension declarations
 * (Template Type, Visual Style, Content Theme) in instruction text.
 *
 * The existing parser in app/modules/PromptPresets/fns.ts expects these formats:
 * - Template Type: {name}
 * - Visual Style: {name}
 * - Content Theme: {name}
 */

export type DimensionType = 'template_type' | 'visual_style' | 'content_theme'

interface DimensionConfig {
  pattern: RegExp
  prefix: string
}

const DIMENSION_CONFIGS: Record<DimensionType, DimensionConfig> = {
  template_type: {
    pattern: /Template Type:\s*([^.\n]+)/i,
    prefix: 'Template Type:',
  },
  visual_style: {
    pattern: /Visual Style:\s*([^.\n]+)/i,
    prefix: 'Visual Style:',
  },
  content_theme: {
    pattern: /Content Theme:\s*([^.\n]+)/i,
    prefix: 'Content Theme:',
  },
}

/**
 * Parse instruction text to extract existing dimension selections
 */
export function parseDimensionsFromInstruction(instruction: string): {
  template_type: string | null
  visual_style: string | null
  content_theme: string | null
} {
  const result = {
    template_type: null as string | null,
    visual_style: null as string | null,
    content_theme: null as string | null,
  }

  for (const [key, config] of Object.entries(DIMENSION_CONFIGS)) {
    const match = instruction.match(config.pattern)
    if (match) {
      // Extract the first option if "or" is present (e.g., "line-art or silhouette" -> "line-art")
      const value = match[1].trim()
      const firstOption = value.split(/\s+or\s+/i)[0].trim()
      // Extract just the name part (e.g., "line-art (thin-line variant)" -> "line-art")
      const nameMatch = firstOption.match(/^([^(]+)/)
      result[key as DimensionType] = nameMatch ? nameMatch[1].trim() : firstOption
    }
  }

  return result
}

/**
 * Update instruction text with a new dimension value
 * - If declaration exists -> replace with new value
 * - If declaration doesn't exist -> append to instruction
 * - If value is null/empty -> remove the declaration
 */
export function updateInstructionWithDimension(
  instruction: string,
  dimensionType: DimensionType,
  value: string | null
): string {
  const config = DIMENSION_CONFIGS[dimensionType]
  const existingMatch = instruction.match(config.pattern)

  if (!value) {
    // Remove the declaration if value is empty
    if (existingMatch) {
      // Remove the entire declaration including any trailing period or newline
      return instruction
        .replace(new RegExp(`${config.prefix}\\s*[^.\\n]+\\.?\\s*`, 'i'), '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return instruction
  }

  const newDeclaration = `${config.prefix} ${value}`

  if (existingMatch) {
    // Replace existing declaration
    return instruction.replace(config.pattern, newDeclaration)
  }

  // Append new declaration
  const separator = instruction.trim().endsWith('.') ? ' ' : '. '
  return `${instruction.trim()}${separator}${newDeclaration}.`
}

/**
 * Get all dimensions from instruction as a map
 */
export function getAllDimensionsFromInstruction(instruction: string): Map<DimensionType, string | null> {
  const parsed = parseDimensionsFromInstruction(instruction)
  return new Map([
    ['template_type', parsed.template_type],
    ['visual_style', parsed.visual_style],
    ['content_theme', parsed.content_theme],
  ])
}
