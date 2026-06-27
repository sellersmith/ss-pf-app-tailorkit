/**
 * Generic Value Extractors
 *
 * Extract values from layer data without knowing the field type.
 * Handles raw values, JSON strings, and nested objects.
 */

import { isJSON } from '../fns/is-json'

/**
 * Extract string value from any layer data.
 * Handles:
 * - Raw strings
 * - JSON strings with content/text/value fields
 * - Objects with settings.content, content, text, or value properties
 *
 * @param value - The layer value to extract from
 * @returns The extracted string value, or empty string if not found
 */
export function extractStringValue(value: unknown): string {
  if (value === null) return ''

  if (typeof value === 'string') {
    if (isJSON(value)) {
      try {
        const parsed = JSON.parse(value)
        // Check common text fields - order matters (most specific first)
        return parsed.settings?.content ?? parsed.content ?? parsed.text ?? parsed.value ?? ''
      } catch {
        return value
      }
    }
    return value
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const settings = obj.settings as Record<string, unknown> | undefined
    return (
      (settings?.content as string) ?? (obj.content as string) ?? (obj.text as string) ?? (obj.value as string) ?? ''
    )
  }

  return String(value)
}

/**
 * Extract object value from any layer data.
 * Handles:
 * - Raw objects
 * - JSON strings that parse to objects
 *
 * @param value - The layer value to extract from
 * @returns The extracted object, or null if not an object
 */
export function extractObjectValue(value: unknown): Record<string, unknown> | null {
  if (value === null) return null

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string' && isJSON(value)) {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      return null
    }
  }

  return null
}
