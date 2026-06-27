/**
 * Pure validation functions for wizard steps.
 * No DOM creation — only reads existing DOM state and adds/removes CSS classes.
 */

export interface ValidationError {
  fieldId: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export type ValidationMode = 'all_required' | 'any' | 'none'

const OPTION_SET_SELECTOR = 'fieldset.emtlkit--option-set'
const ERROR_CLASS = 'emtlkit--wizard-field-error'
const REQUIRED_INDICATOR_CLASS = 'emtlkit--required-indicator'
const SHAKE_CLASS = 'emtlkit--wizard-field-error--shake'

/** Check whether a fieldset has a user-supplied value. */
function fieldsetHasValue(fieldset: HTMLFieldSetElement): boolean {
  // Text input or textarea
  const textInput = fieldset.querySelector('input[type="text"], textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null
  if (textInput) {
    return textInput.value.trim().length > 0
  }

  // Checked radio or checkbox
  const checkedInput = fieldset.querySelector(
    'input[type="radio"]:checked, input[type="checkbox"]:checked'
  ) as HTMLInputElement | null
  if (checkedInput) {
    return true
  }

  // Select element
  const select = fieldset.querySelector('select') as HTMLSelectElement | null
  if (select) {
    return select.value.length > 0
  }

  // Fallback: check fieldset value attribute set by option set components
  const value = fieldset.getAttribute('value')
  return value !== null && value.trim().length > 0
}

function isRequired(fieldset: HTMLFieldSetElement): boolean {
  return fieldset.querySelector(`.${REQUIRED_INDICATOR_CLASS}`) !== null
}

function getFieldId(fieldset: HTMLFieldSetElement): string {
  return (
    fieldset.getAttribute('data-option-set-id') || fieldset.getAttribute('data-layer-id') || fieldset.id || 'unknown'
  )
}

function getFieldLabel(fieldset: HTMLFieldSetElement): string {
  const label = fieldset.querySelector('legend, label')
  return label?.textContent?.trim() || 'This field'
}

/** Mark a fieldset as invalid with shake animation. */
function markError(fieldset: HTMLFieldSetElement): void {
  fieldset.classList.add(ERROR_CLASS)
  fieldset.classList.remove(SHAKE_CLASS)
  // Force reflow to restart animation
  void fieldset.offsetWidth
  fieldset.classList.add(SHAKE_CLASS)

  // Auto-attach one-time listener to clear error on interaction
  const clearError = () => {
    fieldset.classList.remove(ERROR_CLASS, SHAKE_CLASS)
    fieldset.removeEventListener('input', clearError)
    fieldset.removeEventListener('change', clearError)
  }
  fieldset.addEventListener('input', clearError, { once: true })
  fieldset.addEventListener('change', clearError, { once: true })
}

/** Clear all error classes from a step container. */
export function clearStepErrors(stepContainer: HTMLElement): void {
  stepContainer.querySelectorAll(`.${ERROR_CLASS}`).forEach(el => {
    el.classList.remove(ERROR_CLASS, SHAKE_CLASS)
  })
}

/**
 * Validate a single wizard step container.
 * @param stepContainer - The `<details>` element wrapping the step.
 * @param mode - Validation mode: 'all_required' | 'any' | 'none'
 */
export function validateStep(stepContainer: HTMLElement, mode: ValidationMode): ValidationResult {
  if (mode === 'none') {
    return { valid: true, errors: [] }
  }

  const fieldsets = Array.from(stepContainer.querySelectorAll<HTMLFieldSetElement>(OPTION_SET_SELECTOR))

  if (fieldsets.length === 0) {
    return { valid: true, errors: [] }
  }

  const errors: ValidationError[] = []

  if (mode === 'all_required') {
    let firstError: HTMLFieldSetElement | null = null

    for (const fieldset of fieldsets) {
      if (!isRequired(fieldset)) continue

      if (!fieldsetHasValue(fieldset)) {
        const fieldId = getFieldId(fieldset)
        const label = getFieldLabel(fieldset)
        errors.push({ fieldId, message: `${label} is required` })
        markError(fieldset)
        if (!firstError) firstError = fieldset
      }
    }

    if (firstError) {
      // Scroll to first invalid field
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    return { valid: errors.length === 0, errors }
  }

  if (mode === 'any') {
    const anyFilled = fieldsets.some(fs => fieldsetHasValue(fs))
    if (!anyFilled && fieldsets.length > 0) {
      const fieldId = getFieldId(fieldsets[0])
      errors.push({ fieldId, message: 'Please fill in at least one field' })
      markError(fieldsets[0])
      fieldsets[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return { valid: errors.length === 0, errors }
  }

  return { valid: true, errors: [] }
}
