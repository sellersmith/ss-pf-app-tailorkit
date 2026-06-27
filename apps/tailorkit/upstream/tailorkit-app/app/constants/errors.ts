export const CommonError = 'Something went wrong!'
export const UncommonError = 'Something unexpected happened'

export const ShopErrors = {
  INVALID_SHOP_DATA: 'Invalid shop data',
}

export const CanvasErrors = {
  INVALID_FILE: 'Invalid file type',
  CAN_NOT_FIND_STAGE_CONTAINER: 'Can not find stage container',
  CAN_NOT_FIND_TEMPLATE_CONTAINER: 'Can not find template container',
}

export const OptionSetErrors = {
  INVALID_IMAGE: 'Invalid image type',
  MISSING_OPTION_NAME: 'An option is missing name',
  MISSING_STORE_FRONT_LABEL: 'Storefront label is required',
  TEXT_VALUE_IS_REQUIRED: 'Item value is required',
  MISSING_OPTION_ADDED: 'The option set must have at least one option',
}

export const TemplateErrors = {
  ERROR_STORING_PSD_FILE: 'Error while storing photoshop file',
  INVALID_IMAGE_TYPE: 'Invalid image type',
  ERROR_RETRIEVING_FILE: 'Error while retrieving file',
  REQUIRE_TEMPLATE_TITLE: 'Template title is required',
  INVALID_DIMENSION: 'Invalid dimension',
  WIDTH_MUST_GREATER_THAN_ZERO: 'Width must greater than 0',
  WIDTH_MUST_BE_A_DECIMAL: 'Width must be a decimal number',
  HEIGHT_MUST_GREATER_THAN_ZERO: 'Height must greater than 0',
  HEIGHT_MUST_BE_A_DECIMAL: 'Height must be a decimal number',
  MISSING_TEMPLATE_ID: 'Missing template id',
  MISSING_SHOP_DOMAIN: 'Missing shop domain',
  SOMETHING_WENT_WRONG_WITH_OPTION_SET: 'Something went wrong with option set',
}

export const PreviewEditorErrors = {
  FAILED_TO_LOAD_PRINT_AREA: 'Failed to load print area',
  FAILED_TO_LOAD_PREVIEW_TEMPLATE_IMAGE: 'Failed to load preview template image',
  MISSING_PRODUCT_MEDIA_OR_TEMPLATE: 'each area must have a specific template and product media',
  MISSING_TITLE: 'each area must have a title',
}

export const EMediaErrors = {
  FILE_SIZE_ERROR: 'Exceeds maximum file size of 20 MB.',
  FILE_FORMAT_NOT_ACCEPTED: 'File format is not supported.',
  FILE_LIMITED: 'There is a limit of 50 files per upload. Try again with fewer than 50 files.',
  FILE_RATIO_ERROR: 'Aspect ratio must be between 100:1 and 1:100.',
  FILE_RESOLUTION_ERROR: 'Exceeds maximum file resolution of 20 MP.',
  NETWORK_ERROR: 'Check your network and try again.',
}

export const PricingErrors = {
  INVALID_PLAN: 'Invalid plan',
  INVALID_COUPON: 'Invalid coupon',
}

export const TourErrors = {
  INVALID_TOUR_TYPE: 'Invalid tour type',
}

export const FULFILLMENT_ERRORS = {
  INVALID_SHOP: 'Invalid shop',
  FULFILLMENT_HAS_ISSUES: 'Fulfillment has issues',
  'payment-not-received': 'Payment not received',
  'has-issues': 'Has issues',
}

export const AssistantErrors = {
  FAILED_TO_PROCESS_IMAGE: 'failed-to-process-image',
  FAILED_TO_GENERATE_IMAGES: 'failed-to-generate-images',
}

// Shopify
export const INVALID_SHOPIFY_CONFIG = 'Invalid Shopify Config'

export const INVALID_REQUEST = 'Invalid request'
export const OVER_LIMIT_ERROR = 'Over plan limit'
export const INVALID_SHOP_ERROR = 'Shop not found'
export const MISSING_MODEL_ERROR = 'Missing asset model'
