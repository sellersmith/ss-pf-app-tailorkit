import type { ETriggerProductsType, EPlacementType, ECheckboxSortOptions } from '~/enums/checkbox'

// Content type enum
type EContentType = 'heading_only' | 'description_only' | 'heading_and_description'

// Product/Variant types for display (fetched from Shopify)
type ProductData = {
  id: string
  title: string
  featuredImage?: { url: string }
  status?: string
}

type VariantData = {
  id: string
  title: string
  price?: string
  compareAtPrice?: string
  product: {
    id: string
    title: string
    featuredImage?: { url: string }
  }
}

// Embedded types
type CheckboxContent = {
  contentType: EContentType
  heading: string
  description: string
  imageUrl: string
  showPrice: boolean
  showComparedPrice: boolean
  preCheck: boolean
  showVariantSelector: boolean
  showFeaturedImage: boolean
  showQuantitySelector: boolean
  showPersonalizeButton: boolean
}

type UpsellProduct = {
  productId: string
  variantId: string
}

type Popup = {
  showPopup: boolean
  heading: string
  description: string
}

type CheckboxStyle = {
  checkboxType: string
  tickIcon: string
  defaultBackground: string
  activeBackground: string
  defaultBorder: string
  activeBorder: string
}

type CheckboxItemStyling = {
  defaultBackground: string
  defaultBorder: string
}

// Main document types
type CheckboxDocument = {
  _id: string
  shopDomain: string
  checkboxMetafieldId?: string | null
  title: string
  isActive: boolean
  checkboxContent: CheckboxContent
  targetProducts: string[]
  triggerProductsType: ETriggerProductsType | null
  upsellProducts: UpsellProduct[]
  excludeUpsellProducts: boolean
  excludeTriggerProductsType: ETriggerProductsType | null
  excludeTriggerProducts: string[]
  checkboxStyle?: CheckboxStyle | null
  sortOrder: number
  popup: Popup
  typePlacement: EPlacementType
  hideCartDrawer: boolean
  canRemoveWhenTriggersCleared: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type CheckboxGlobalStylingDocument = {
  _id: string
  shopDomain: string
  checkboxType: string
  tickIcon: string
  defaultBackground: string
  activeBackground: string
  defaultBorder: string
  activeBorder: string
  checkboxItem: CheckboxItemStyling
  imageSize: number
  createdAt: Date
  updatedAt: Date
}

type CheckboxOrderSettingDocument = {
  _id: string
  shopDomain: string
  defaultSortOption: ECheckboxSortOptions
  manualCheckboxesOrder: string[]
  defaultCartSortOption: ECheckboxSortOptions
  manualCheckboxesCartOrder: string[]
  customSelector?: string | null
  createdAt: Date
  updatedAt: Date
}

// Extended checkbox document with full product/variant data (for edit UI)
type CheckboxWithFullData = CheckboxDocument & {
  // Full product/variant data for UI display (fetched from Shopify)
  targetProductsData: ProductData[] | VariantData[] | string[]
  upsellProductsData: VariantData[]
  excludeTriggerProductsData?: ProductData[] | VariantData[] | string[]
}

export type {
  EContentType,
  CheckboxContent,
  UpsellProduct,
  Popup,
  CheckboxStyle,
  CheckboxItemStyling,
  CheckboxDocument,
  CheckboxGlobalStylingDocument,
  CheckboxOrderSettingDocument,
  ProductData,
  VariantData,
  CheckboxWithFullData,
}
