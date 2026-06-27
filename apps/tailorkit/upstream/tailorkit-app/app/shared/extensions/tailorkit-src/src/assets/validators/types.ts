/**
 * Declarative Validation System Types
 *
 * Rule-based validation inspired by React Hook Form pattern.
 * Validators are generic and don't know about specific field types.
 */

/**
 * Supported validation rule types.
 * Add new rules here when extending the validation system.
 */
export type RuleType = 'required' | 'notEmpty' | 'minLength' | 'maxLength' | 'pattern' | 'hasProperty'

/**
 * A single validation rule to apply to a field.
 * Rules are composable - multiple rules can be applied to one field.
 */
export interface ValidationRule {
  /** The type of validation to perform */
  type: RuleType
  /** Optional parameters for the rule (e.g., length for minLength, pattern for regex) */
  params?: Record<string, unknown>
  /** Custom error message to display when validation fails */
  message?: string
}

/**
 * Field definition for validation.
 * Describes a field's location and its validation rules.
 */
export interface FieldDefinition {
  /** The print area ID where this field belongs */
  printAreaId: string
  /** The layer ID of the field */
  layerId: string
  /** Validation rules to apply to this field */
  rules: ValidationRule[]
  /** Human-readable label for error messages */
  label?: string
  /** IDs of controller layers that toggle this field's visibility */
  isControlledBy?: string[]
}

/**
 * Result of validating multiple fields.
 */
export interface ValidationResult {
  /** Whether all fields passed validation */
  isValid: boolean
  /** List of validation errors (empty if isValid is true) */
  errors: ValidationError[]
}

/**
 * A single validation error.
 */
export interface ValidationError {
  /** The field label or ID that failed validation */
  field: string
  /** The rule type that failed */
  rule: RuleType
  /** Optional custom error message */
  message?: string
}

/**
 * Function signature for rule validators.
 * Takes a value and optional params, returns true if valid.
 */
export type RuleValidator = (value: unknown, params?: Record<string, unknown>) => boolean
