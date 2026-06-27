/**
 * Rule Validators Registry
 *
 * Generic validators that work with any field type.
 * Add new rules here to extend the validation system.
 */

import type { RuleType, RuleValidator } from './types'
import { extractStringValue, extractObjectValue } from './extractors'

/**
 * Registry of rule validators by type.
 * Each validator is a pure function: (value, params) => boolean
 *
 * To add a new rule:
 * 1. Add the rule type to RuleType union in types.ts
 * 2. Add the validator function here
 */
export const RULE_VALIDATORS: Record<RuleType, RuleValidator> = {
  /**
   * Check if value exists (not null/undefined)
   */
  required: value => value !== null && value !== undefined,

  /**
   * Check if string value is not empty after trim.
   * Also validates objects by checking for url/src/imageUrl properties (for images).
   */
  notEmpty: value => {
    if (value === null || value === undefined) return false

    // First check if it's an object with image-like properties
    const obj = extractObjectValue(value)
    if (obj) {
      // Check for image URL properties (common in image option layers)
      if (obj.url || obj.src || obj.imageUrl) {
        return true
      }
    }

    // Fall back to string extraction
    const str = extractStringValue(value)
    return str.trim() !== ''
  },

  /**
   * Check minimum string length
   * Params: { length: number }
   */
  minLength: (value, params) => {
    const str = extractStringValue(value)
    const minLen = (params?.length as number) ?? 0
    return str.length >= minLen
  },

  /**
   * Check maximum string length
   * Params: { length: number }
   */
  maxLength: (value, params) => {
    const str = extractStringValue(value)
    const maxLen = (params?.length as number) ?? Infinity
    return str.length <= maxLen
  },

  /**
   * Check if object has at least one of the specified properties with truthy value.
   * Useful for validating images (url, src, imageUrl).
   * Params: { properties: string[] }
   */
  hasProperty: (value, params) => {
    const obj = extractObjectValue(value)
    if (!obj) return false

    const props = (params?.properties as string[]) ?? []
    return props.some(prop => !!obj[prop])
  },

  /**
   * Check if string matches a regex pattern
   * Params: { pattern: string }
   */
  pattern: (value, params) => {
    const str = extractStringValue(value)
    const patternStr = params?.pattern as string
    if (!patternStr) return true // No pattern = always valid

    try {
      const regex = new RegExp(patternStr)
      return regex.test(str)
    } catch {
      // Invalid regex pattern - treat as valid to avoid blocking
      return true
    }
  },
}
