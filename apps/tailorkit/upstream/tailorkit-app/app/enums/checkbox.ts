export enum ETriggerProductsType {
  ALL_PRODUCTS = 'all-products',
  PRODUCT_COLLECTIONS = 'product-collections',
  PRODUCT_TAGS = 'product-tags',
  PRODUCT_VENDORS = 'product-vendors',
  PRODUCT_TYPES = 'product-types',
  SPECIFIC_PRODUCTS = 'specific-products',
  SPECIFIC_VARIANTS = 'specific-variants',
}

export enum ECheckboxStyle {
  SQUARE = '0px',
  SQUARE_WITH_BORDER_RADIUS = '4px',
  CIRCLE = '50%',
}

export enum EPlacementType {
  CART = 'cart',
  PRODUCT_DETAILS = 'product_details',
  PRODUCT_PAGE = 'product_page',
}

export enum ECheckboxSortOptions {
  LAST_CREATED_ASC = 'LAST_CREATED_ASC',
  LAST_CREATED_DESC = 'LAST_CREATED_DESC',
  UPSELL_PRODUCT_PRICE_ASC = 'UPSELL_PRODUCT_PRICE_ASC',
  UPSELL_PRODUCT_PRICE_DESC = 'UPSELL_PRODUCT_PRICE_DESC',
  MANUALLY = 'MANUALLY',
}

export enum EContentType {
  HEADING_ONLY = 'heading-only',
  DESCRIPTION_ONLY = 'description-only',
  HEADING_AND_DESCRIPTION = 'heading-and-description',
}

export enum EAddOnProductQuantityType {
  DEFAULT_QUANTITY = 'defaultQuantity',
  ONE_PER_TRIGGER = 'onePerTrigger',
  INITIAL_QUANTITY = 'initialQuantity',
}
