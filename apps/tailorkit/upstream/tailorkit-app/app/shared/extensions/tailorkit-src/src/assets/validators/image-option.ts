import type { FieldValidator } from './field-validator'
import { isJSON } from '../fns/is-json'

/**
 * Validator for image_option field type.
 * Checks if an image URL exists in the layer value.
 */
export const imageOptionValidator: FieldValidator = {
  validate(layerValue: unknown): boolean {
    if (!layerValue) return false

    if (isJSON(layerValue)) {
      const parsed = JSON.parse(layerValue as string)
      return !!(parsed.url || parsed.src || parsed.imageUrl)
    }

    return typeof layerValue === 'string' && layerValue.length > 0
  },
}
