export const PROVIDER_INTEGRATION_ACTION = {
  IMPORT_PRODUCT: 'import-product',
  UPDATE_BASE_PROFIT_MARGIN: 'update-base-profit-margin',
  UPDATE_PRODUCTS_SELECTED: 'update-products-selected',
  // Provider's products
  IMPORT_PRODUCTS_TO_SHOPIFY: 'import-products-to-shopify',
  // Dummy products
  IMPORT_DUMMY_PRODUCTS_TO_SHOPIFY: 'import-dummy-products-to-shopify',
  CONFIRM_CHOOSE_PRINTIFY_CHOICE: 'confirm-choose-printify-choice',
  DELETE_SELECTED_PRODUCTS: 'delete-selected-products',
  HIDE_UNDERSTAND_ABOUT_PROVIDER_MODAL: 'hide-understand-about-provider-modal',
  CHECK_UNFINISHED_IMPORTED_PRODUCTS: 'checkUnfinishedImportedProducts',
}

export type TProductToImport = {
  productId: string
  title: string
  description: string
  images: string[]
  baseProfitMargin: number
}

export const PRINTIFY_CHOICE_NAME_ID = {
  id: 99,
  title: 'Printify Choice',
}
