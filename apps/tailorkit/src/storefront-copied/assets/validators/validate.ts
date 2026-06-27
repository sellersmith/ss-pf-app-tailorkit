/**
 * Field Validation Function
 *
 * Validates fields against their rules using the declarative validation system.
 * No type awareness - just runs rules against values.
 */

import type { FieldDefinition, ValidationResult, ValidationError, RuleType } from './types'
import { RULE_VALIDATORS } from './rule-validators'

/**
 * Validate multiple fields against their rules.
 *
 * @param fields - Array of field definitions with rules
 * @param metaData - State data containing field values by printAreaId/layerId
 * @returns ValidationResult with isValid flag and any errors
 */
export function validateFields(
  fields: FieldDefinition[],
  metaData: Record<string, Record<string, unknown>> | undefined
): ValidationResult {
  const errors: ValidationError[] = []

  for (const field of fields) {
    // Get the field value from metaData
    const value = metaData?.[field.printAreaId]?.[field.layerId]

    // Run each rule until one fails
    for (const rule of field.rules) {
      const validator = RULE_VALIDATORS[rule.type as RuleType]
      if (!validator) continue // Skip unknown rule types

      const isValid = validator(value, rule.params)

      if (!isValid) {
        errors.push({
          field: field.label ?? field.layerId,
          rule: rule.type as RuleType,
          message: rule.message,
        })
        // Stop at first error for this field
        break
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
