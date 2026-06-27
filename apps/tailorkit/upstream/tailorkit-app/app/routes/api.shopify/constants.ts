export const SHOPIFY_API_ACTIONS = {
  GET_PRODUCTS: 'getProducts',
  GET_PRODUCTS_BY_IDS: 'getProductsByIds',
  CHECK_USER_HAS_PRODUCT: 'checkUserHasProduct',
  GET_PRODUCT_MEDIA: 'getProductMedia',
  GET_APP_HANDLE: 'getAppHandle',
  DELETE_PRODUCT: 'deleteProduct',
}

export const PRODUCT_SORT_KEYS = {
  /**
   * Sort by the best_selling value.
   */
  BEST_SELLING: 'BEST_SELLING',
  /**
   * Sort by the created_at value.
   */
  CREATED_AT: 'CREATED_AT',
  /**
   * Sort by the id value.
   */
  ID: 'ID',
  /**
   * Sort by the price value. */
  PRICE: 'PRICE',
  /**
   * Sort by the product_type value.
   */
  PRODUCT_TYPE: 'PRODUCT_TYPE',
  /**
   * Sort by relevance to the search terms when the query parameter is specified on the connection.
   * Don't use this sort key when no search query is specified.
   */
  RELEVANCE: 'RELEVANCE',
  /**
   * Sort by the title value.
   */
  TITLE: 'TITLE',
  /**
   * Sort by the updated_at value.
   */
  UPDATED_AT: 'UPDATED_AT',
  /**
   * Sort by the vendor value.
   */
  VENDOR: 'VENDOR',
}
