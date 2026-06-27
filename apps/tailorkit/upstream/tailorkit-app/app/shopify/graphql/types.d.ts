export type ConnectionArguments = {
  after?: string
  before?: string
  first?: number
  last?: number
  query?: string
  reverse?: boolean
  sortKey?: string
}

export type MediaImageQuerySchema = {
  id: string
  url: string
  altText: string
  width: number
  height: number
}

export type MediaNodeQuerySchema = {
  id: string
  media: {
    edges: {
      node: {
        id: string
        alt: string
        image: MediaImageQuerySchema
      }
    }[]
  }
}

export type ProductVariantQuerySchema = {
  node: MediaNodeQuerySchema
}

export type ProductOptionsInputSchema = {
  name: string
  values: { name: string }[]
}

type ProductMediaInputSchema = {
  mediaContentType: 'VIDEO' | 'EXTERNAL_VIDEO' | 'MODEL_3D' | 'IMAGE'
  originalSource: string
}

export type ProductInputMutationSchema = {
  title: string
  descriptionHtml: string
  vendor: string
  status: 'DRAFT' | 'ACTIVE' | 'UNLISTED'
  productOptions: ProductOptionsInputSchema[]
}

export type VariantInputSchema = {
  optionValues: {
    name: string
    optionName: string
  }[]
  price: number
  inventoryItem: {
    cost: number
  }
  metafields?: MetafieldInputSchema[]
}

type MetafieldInputSchema = {
  namespace: string
  key: string
  value: any
  type: string
}

/**
 * Shopify metafield structure for simple scalar metafields
 */
export interface ShopifyMetafield {
  id: string
  key: string
  value: string
  namespace: string
}

/**
 * Basic shop information returned from Admin GraphQL API
 */
export interface ShopInfo {
  name: string
  description?: string | null
  metafield?: ShopifyMetafield | null
}

/**
 * @example 
 * {
    "name": "Pre-orders free shipping1",
    "locationGroupsToCreate": {
    "locations": ["gid://shopify/Location/79612379381"],
    "zonesToCreate": {
        "name": "All Countries",
        "countries": { "restOfWorld": true },
        "methodDefinitionsToCreate": {
        "name": "TailorKit Shipping",
        "rateDefinition": {
            "price": { "amount": 20, "currencyCode": "USD" }
        }
        }
    }
    }
  }
 */
export type DeliveryProfile = {
  name: string
  locationGroupsToCreate?: {
    locations: string[]
    zonesToCreate: [
      {
        name: string
        countries: any
        methodDefinitionsToCreate: {
          name: string
          rateDefinition: {
            price: { amount: number; currentCode: string }
          }
        }
      },
    ]
  }
}

/**
 * Parameters for getTopSellingProducts method
 */
export interface GetTopSellingProductsParams {
  /** Number of products to return (default: 1) */
  limit?: number
  /** Whether to return only top selling products (default: false) */
  onlyTopSelling?: boolean
  /** Optional number of days to look back (default: 30) */
  daysAgo?: number
}

/**
 * Shopify Product structure from GraphQL API
 */
export interface ShopifyProduct {
  id: string
  title: string
  description: string
  handle: string
  featuredImage?: {
    url: string
    width?: number
    height?: number
    altText?: string
  }
  priceRangeV2?: {
    minVariantPrice: {
      amount: string
      currencyCode: string
    }
    maxVariantPrice?: {
      amount: string
      currencyCode: string
    }
  }
  variants: {
    nodes: ShopifyVariant[]
  }
}

/**
 * Shopify Product Variant structure from GraphQL API
 */
export interface ShopifyVariant {
  id: string
  title?: string
}

/**
 * Shopify Order structure from GraphQL API
 */
export interface ShopifyOrder {
  id: string
  name?: string
  createdAt: string
  lineItems: ShopifyLineItem[]
}

/**
 * Shopify Line Item structure from GraphQL API
 */
export interface ShopifyLineItem {
  id: string
  quantity: number
  title: string
  description: string
  product: ShopifyProduct
  variant?: ShopifyVariant
}

/**
 * Top selling product with sales data
 */
export interface TopSellingProduct extends ShopifyProduct {
  /** Total quantity sold */
  totalQuantitySold?: number
  /** Array of non-integrated variant IDs */
  nonIntegratedVariants?: string[]
}

/**
 * Product sales data used internally for calculations
 */
export interface ProductSalesData {
  product: ShopifyProduct
  quantity: number
  variants: Set<string>
  nonIntegratedVariants: Set<string>
}
