export enum EFetcherKeys {
  ALL_SHOPIFY_PRODUCTS = 'all-shopify-products',
  UPLOAD_IMAGE_OPTION = 'upload-image-option',
  ALL_GOOGLE_FONTS = 'all-google-fonts',
  CUSTOM_FONTS = 'custom-fonts',
}

export enum EQueryProducts {
  ENABLE_FETCH_VARIANTS = 'enable-fetch-variants',
  SEARCH_VARIANTS = 'search-variants',
  ENABLE_FETCH_VARIANTS_BY_PRODUCT_IDS = 'enable-fetch-variants-by-product-ids',
  SEARCH_VARIANTS_BY_PRODUCT_IDS = 'search-variants-by-product-ids',
}

export enum EActionType {
  'DISCARD_INTEGRATION' = 'discard-integration',
  'SAVE_PRODUCT' = 'save-product',
  'PUBLISH_PRODUCT' = 'publish-product',
  'UNPUBLISH_PRODUCT' = 'unpublish-product',
  'SAVED_PRODUCT' = 'saved-product',
  'PUBLISHED_PRODUCT' = 'published-product',
  'UNPUBLISHED_PRODUCT' = 'unpublished-product',
  'ABORT_ACTION' = 'abort-action',
  'NAVIGATE_MAX_MODAL' = 'navigate-max-modal',
  'GET_PRODUCT_MEDIAS' = 'get-product-medias',
  'GET_AREA_BY_ID' = 'get-area-by-id',
  'GET_PRINT_AREA_BY_SHOP_DOMAIN' = 'get-print-area-by-shop-domain',
  'GET_PRINT_AREA_BY_ID' = 'get-print-area-by-id',
  'UNINSTALL_APP' = 'uninstall-app',
  'CLOSE_TOUR' = 'close-tour',
  'LOADED_TEMPLATE' = 'loaded-template',
  'SAVED_TEMPLATE' = 'saved-template',
}

export enum EQueryMediaList {
  ENABLE_FETCH_MEDIA_LIST = 'enable-fetch-media-list',
  SEARCH_MEDIA = 'search-media',
}
