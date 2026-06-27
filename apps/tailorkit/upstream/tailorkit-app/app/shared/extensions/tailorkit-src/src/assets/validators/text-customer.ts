import type { FieldValidator } from './field-validator'
import { isJSON } from '../fns/is-json'

/**
 * Validator for text_customer field type.
 * Checks if the text value is non-empty after parsing JSON if needed.
 */
export const textCustomerValidator: FieldValidator = {
  validate(layerValue: unknown): boolean {
    if (!layerValue) return false

    let textValue = layerValue

    if (isJSON(layerValue)) {
      const parsed = JSON.parse(layerValue as string)
      textValue = parsed.settings?.content || parsed.content || parsed.text || parsed.value || ''
    }

    return typeof textValue === 'string' && textValue.trim() !== ''
  },
}
