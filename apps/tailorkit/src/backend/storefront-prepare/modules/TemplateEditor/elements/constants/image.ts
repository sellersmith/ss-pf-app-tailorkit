import type { ImageUploaderOptions } from '../../../../_external-types'
import type { ImageDataOptionSet } from '../../../../types/psd'

export const DEFAULT_IMAGE_OPTION_SET_DATA: ImageDataOptionSet = {
  files: [],
}

/**
 * Default image uploader options.
 *
 * **Design Pattern**: Mutually exclusive radio button behavior
 * - UI controls: Radio buttons for "Buyer's image" vs "Your image"
 * - Backend flags: `enableBuyerImage` XOR `enableSellerImage` (one true, one false)
 * - Nested flags: Granular controls within each mode (checkboxes)
 *
 * **Flag Hierarchy**:
 * 1. Top-level mode: `enableBuyerImage` OR `enableSellerImage` (mutually exclusive)
 * 2. Nested options:
 *    - Buyer mode: `allowCustomerUploadImage`, `allowCustomerGenerateImageWithAI`, etc.
 *    - Seller mode: `allowCustomerUseImageOptionSet`
 *
 * **Backward Compatibility**:
 * Old templates may have both flags true or both false. UI handles this gracefully by
 * deriving the selected mode from flag combinations.
 *
 * @see ImageSettings.enableBuyerImage - Flag for buyer upload/AI generation
 * @see ImageSettings.enableSellerImage - Flag for merchant option sets
 */
export const DEFAULT_IMAGE_UPLOADER_OPTION_DATA: ImageUploaderOptions = {
  required: false,
  allowCustomerUseImageOptionSet: false,
  allowCustomerUploadImage: false,
  allowCustomerGenerateImageWithAI: false,
  allowCustomerToUseReferenceImage: false,
  enabledQuickPrompts: [],
  enabledTemplateTypes: [],
  enabledVisualStyles: [],
  enabledContentThemes: [],
  allowCustomerToUseQuickPrompts: false,
  allowCustomerToUseTemplateTypes: false,
  allowCustomerToUseVisualStyles: false,
  allowCustomerToUseContentThemes: false,
  allowCustomerToEditImage: {
    allowTransform: true,
    allowRotate: true,
    allowZoom: true,
    allowRemoveBackground: true,
  },
  autoRemoveSolidWhiteBackground: false,
}
