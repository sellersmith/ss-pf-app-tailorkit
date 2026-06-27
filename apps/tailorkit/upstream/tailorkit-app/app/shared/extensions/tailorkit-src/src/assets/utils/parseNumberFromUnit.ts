/**
 * Regular expression to match number and unit patterns
 * Supports: px, %, em, rem, vh, vw, and unitless numbers
 */
const NUM_REGEX = /^(-?[0-9]*\.?[0-9]+)(px|%|em|rem|vh|vw|in|cm|mm|pt|pc)?$/i

/**
 * Supported CSS unit types
 */
export type CSSUnit = 'px' | '%' | 'em' | 'rem' | 'vh' | 'vw' | 'in' | 'cm' | 'mm' | 'pt' | 'pc'

/**
 * Result interface for parsed number and unit
 */
export interface ParsedNumberUnit {
  /** The numeric value extracted from the string */
  num: number
  /** The unit extracted from the string, defaults to 'px' */
  u: CSSUnit
}

/**
 * Parses a string containing a number and optional unit into separate components
 *
 * @param str - The input string to parse (e.g., "10px", "50%", "2.5em", "100")
 * @returns An object containing the numeric value and unit
 *
 * @example
 * ```typescript
 * parseNumberFromUnit("10px") // { num: 10, u: "px" }
 * parseNumberFromUnit("50%") // { num: 50, u: "%" }
 * parseNumberFromUnit("2.5") // { num: 2.5, u: "px" }
 * parseNumberFromUnit("--") // { num: 0, u: "px" }
 * parseNumberFromUnit("invalid") // { num: 0, u: "px" }
 * ```
 */
export const parseNumberFromUnit = (str: string): ParsedNumberUnit => {
  // Handle edge cases
  if (typeof str !== 'string') {
    return { num: 0, u: 'px' }
  }

  // Normalize the input string
  const normalizedStr = str.trim() === '--' ? '' : str.trim()

  // Return default for empty or whitespace strings
  if (!normalizedStr || normalizedStr.includes(' ')) {
    return { num: 0, u: 'px' }
  }

  const match = normalizedStr.match(NUM_REGEX)

  if (match) {
    const [, numStr, unit] = match
    const parsedNum = parseFloat(numStr)

    // Check for valid number
    if (isNaN(parsedNum)) {
      return { num: 0, u: 'px' }
    }

    return {
      num: parsedNum,
      u: (unit as CSSUnit) || 'px',
    }
  }

  // Return default if no match
  return { num: 0, u: 'px' }
}
