import { textCustomerValidator } from './text-customer'
import { imageOptionValidator } from './image-option'

/**
 * Interface for field validators using Strategy Pattern.
 * Each validator handles validation for a specific field type.
 */
export interface FieldValidator {
  /** Check if the layer value satisfies the required field */
  validate(layerValue: unknown): boolean
}

/**
 * Registry of field validators by type.
 * Add new validators here when supporting additional field types.
 */
export const FIELD_VALIDATORS: Record<string, FieldValidator> = {
  text_customer: textCustomerValidator,
  image_option: imageOptionValidator,
}
