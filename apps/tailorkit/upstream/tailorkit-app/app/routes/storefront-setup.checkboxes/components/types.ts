import { EPlacementType, ETriggerProductsType } from '~/enums/checkbox'
import type { CheckboxDocument, UpsellProduct, CheckboxContent, Popup, EContentType } from '~/types/checkbox'

/**
 * Content type options
 */
export const CONTENT_TYPE_OPTIONS: Array<{ label: string; value: EContentType }> = [
  { label: 'Heading only', value: 'heading_only' },
  { label: 'Description only', value: 'description_only' },
  { label: 'Heading and description', value: 'heading_and_description' },
]

/**
 * Form state for add-on add/edit
 */
export interface CheckboxFormState {
  // Widget Config
  title: string
  isActive: boolean

  // Placement
  typePlacement: EPlacementType

  // Trigger Products
  triggerProductsType: ETriggerProductsType
  targetProducts: string[]
  excludeUpsellProducts: boolean
  excludeTriggerProductsType: ETriggerProductsType | null
  excludeTriggerProducts: string[]

  // Add-on Product
  upsellProducts: UpsellProduct[]
  canRemoveWhenTriggersCleared: boolean

  // Display Content
  checkboxContent: CheckboxContent

  // Popup
  popup: Popup

  // Cart specific
  hideCartDrawer: boolean
}

/**
 * Validation error types
 */
export type CheckboxValidationError = 'BLANK_TITLE' | 'NO_TRIGGER_PRODUCTS' | 'NO_ADDON_PRODUCT' | 'EMPTY_HEADING'

/**
 * Default values for new add-on
 */
export const DEFAULT_CHECKBOX_CONTENT: CheckboxContent = {
  contentType: 'heading_only',
  heading: '',
  description: '',
  imageUrl: '',
  showPrice: false,
  showComparedPrice: false,
  preCheck: false,
  showVariantSelector: false,
  showFeaturedImage: true,
  showQuantitySelector: false,
  showPersonalizeButton: false,
}

export const DEFAULT_POPUP: Popup = {
  showPopup: false,
  heading: 'This is your popup heading.',
  description: 'This is your popup description.',
}

export const DEFAULT_FORM_STATE: CheckboxFormState = {
  title: 'Upsell campaign',
  isActive: true,
  typePlacement: EPlacementType.PRODUCT_DETAILS,
  triggerProductsType: ETriggerProductsType.ALL_PRODUCTS,
  targetProducts: [],
  excludeUpsellProducts: false,
  excludeTriggerProductsType: null,
  excludeTriggerProducts: [],
  upsellProducts: [],
  canRemoveWhenTriggersCleared: true,
  checkboxContent: DEFAULT_CHECKBOX_CONTENT,
  popup: DEFAULT_POPUP,
  hideCartDrawer: false,
}

/**
 * Convert CheckboxDocument to form state
 */
export function checkboxToFormState(checkbox: CheckboxDocument): CheckboxFormState {
  return {
    title: checkbox.title || '',
    isActive: checkbox.isActive || false,
    typePlacement: checkbox.typePlacement || EPlacementType.PRODUCT_DETAILS,
    triggerProductsType: checkbox.triggerProductsType || ETriggerProductsType.ALL_PRODUCTS,
    targetProducts: checkbox.targetProducts || [],
    excludeUpsellProducts: checkbox.excludeUpsellProducts || false,
    excludeTriggerProductsType: checkbox.excludeTriggerProductsType || null,
    excludeTriggerProducts: checkbox.excludeTriggerProducts || [],
    upsellProducts: checkbox.upsellProducts || [],
    canRemoveWhenTriggersCleared: checkbox.canRemoveWhenTriggersCleared || false,
    checkboxContent: {
      contentType: checkbox.checkboxContent?.contentType || 'heading_only',
      heading: checkbox.checkboxContent?.heading || '',
      description: checkbox.checkboxContent?.description || '',
      imageUrl: checkbox.checkboxContent?.imageUrl || '',
      showPrice: checkbox.checkboxContent?.showPrice ?? true,
      showComparedPrice: checkbox.checkboxContent?.showComparedPrice ?? false,
      preCheck: checkbox.checkboxContent?.preCheck ?? false,
      showVariantSelector: checkbox.checkboxContent?.showVariantSelector ?? false,
      showFeaturedImage: checkbox.checkboxContent?.showFeaturedImage ?? true,
      showQuantitySelector: checkbox.checkboxContent?.showQuantitySelector ?? false,
      showPersonalizeButton: checkbox.checkboxContent?.showPersonalizeButton ?? false,
    },
    popup: {
      showPopup: checkbox.popup?.showPopup ?? false,
      heading: checkbox.popup?.heading || '',
      description: checkbox.popup?.description || '',
    },
    hideCartDrawer: checkbox.hideCartDrawer || false,
  }
}

/**
 * Convert form state to data for API submission
 */
export function formStateToCheckboxData(formState: CheckboxFormState) {
  return {
    title: formState.title,
    isActive: formState.isActive,
    typePlacement: formState.typePlacement,
    triggerProductsType: formState.triggerProductsType,
    targetProducts: formState.targetProducts,
    excludeUpsellProducts: formState.excludeUpsellProducts,
    excludeTriggerProductsType: formState.excludeTriggerProductsType,
    excludeTriggerProducts: formState.excludeTriggerProducts,
    upsellProducts: formState.upsellProducts,
    canRemoveWhenTriggersCleared: formState.canRemoveWhenTriggersCleared,
    checkboxContent: formState.checkboxContent,
    popup: formState.popup,
    hideCartDrawer: formState.hideCartDrawer,
  }
}

/**
 * Validate form state and return errors
 */
export function validateFormState(formState: CheckboxFormState): CheckboxValidationError[] {
  const errors: CheckboxValidationError[] = []

  // Title is required
  if (!formState.title.trim()) {
    errors.push('BLANK_TITLE')
  }

  // Trigger products required if not ALL_PRODUCTS
  if (formState.triggerProductsType !== ETriggerProductsType.ALL_PRODUCTS && formState.targetProducts.length === 0) {
    errors.push('NO_TRIGGER_PRODUCTS')
  }

  // At least one addon product required
  if (formState.upsellProducts.length === 0) {
    errors.push('NO_ADDON_PRODUCT')
  }

  return errors
}

/**
 * Options for trigger product type selector
 */
export const TRIGGER_TYPE_OPTIONS = [
  { label: 'All products', value: ETriggerProductsType.ALL_PRODUCTS },
  { label: 'Specific products', value: ETriggerProductsType.SPECIFIC_PRODUCTS },
]

/**
 * Options for "by products" / "by variants" selector
 */
export const TRIGGER_BY_OPTIONS = [
  { label: 'By products', value: ETriggerProductsType.SPECIFIC_PRODUCTS },
  { label: 'By variants', value: ETriggerProductsType.SPECIFIC_VARIANTS },
]

/**
 * Options for placement selector
 */
export const PLACEMENT_OPTIONS = [
  {
    label: 'Product details',
    value: EPlacementType.PRODUCT_DETAILS,
    helpText: 'Add add-on inside product details on any page.',
  },
  {
    label: 'Cart',
    value: EPlacementType.CART,
    helpText: 'Add add-on in both cart drawer and/or cart page.',
  },
]

/**
 * Options for status selector
 */
export const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
]
