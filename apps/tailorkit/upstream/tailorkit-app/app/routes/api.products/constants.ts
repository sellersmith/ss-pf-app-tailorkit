const PRODUCT_QUERY_ACTIONS = {
  GET_TOP_SELLING_PRODUCTS: 'get_top_selling_products',
  GET_PRODUCT_CATEGORIES: 'get_product_categories',
}

const PRODUCT_MUTATION_ACTIONS = {
  DUPLICATE_EXISTING_PRODUCT: 'duplicate_existing_product',
}

interface ITopSellingProductsResult {
  productId: string
  title: string
  handle: string
  featuredImageUrl: string
  productSource: string
  minPrice: {
    amount: string | number
    currencyCode: string
  }
  source?: 'existing' | string
  productDetails?: any
}

interface IPrintifyCategory {
  promotional: boolean
  topLevel: {
    defaultImage: string
    heroImage: string
    tag: string
    subLevel: {
      defaultImage: string
      tag: string
    }[]
  }
}

export type { IPrintifyCategory, ITopSellingProductsResult }
export { PRODUCT_QUERY_ACTIONS, PRODUCT_MUTATION_ACTIONS }
