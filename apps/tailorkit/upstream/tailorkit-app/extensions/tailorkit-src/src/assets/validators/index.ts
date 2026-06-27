/**
 * Declarative Validation System
 *
 * Rule-based validation inspired by React Hook Form pattern.
 * No type awareness - validators are generic and composable.
 */

// Types
export type {
  RuleType,
  ValidationRule,
  FieldDefinition,
  ValidationResult,
  ValidationError,
  RuleValidator,
} from './types'

// Core validation
export { validateFields } from './validate'
export { RULE_VALIDATORS } from './rule-validators'

// Value extractors
export { extractStringValue, extractObjectValue } from './extractors'
