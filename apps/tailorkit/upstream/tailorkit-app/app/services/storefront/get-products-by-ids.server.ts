import uniqBy from 'lodash/uniqBy'

const SHOPIFY_PRODUCT_ID_PREFIX = 'gid://shopify/Product/'
const SHOPIFY_VARIANT_ID_PREFIX = 'gid://shopify/ProductVariant/'
const SHOPIFY_COLLECTION_ID_PREFIX = 'gid://shopify/Collection/'

type PageInfo = {
  hasNextPage: boolean
  endCursor: string
  hasPreviousPage: boolean
  startCursor: string
}

type StorefrontGraphql = (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>

const defaultPageInfo: PageInfo = {
  hasNextPage: false,
  endCursor: '',
  hasPreviousPage: false,
  startCursor: '',
}

/**
 * Build query string for fetching products by IDs
 */
function buildProductQuery(ids: string[]): string {
  return ids.map(id => `id:${id}`).join(' OR ') || ''
}

/**
 * Product data returned from the Storefront API
 */
export type ProductData = {
  id: string
  title: string
  featuredImage: {
    url: string
    altText: string | null
    width: number
  } | null
  tags: string[]
  vendor: string
  productType: string
  availableForSale: boolean
  requiresSellingPlan: boolean
  collections: string[]
  variants: {
    id: string
    title: string
    availableForSale: boolean
    /** Null when inventory is not tracked or store hides quantities */
    quantityAvailable: number | null
    price: {
      amount: string
      currencyCode: string
    }
    compareAtPrice: {
      amount: string
      currencyCode: string
    } | null
    image: {
      url: string
    } | null
  }[]
}

/** Storefront API ImageContentType enum — JPG | PNG | WEBP */
export type PreferredContentType = 'JPG' | 'PNG' | 'WEBP'

/**
 * Build the `url` field for an Image. When `preferredContentType` is set,
 * Shopify CDN transcodes the source image to that format — used for charm
 * builder (HEIC source images that browsers cannot render). Default omits
 * the transform argument so existing callers (OneTick offer cards, etc.)
 * keep their current behavior and avoid unnecessary PNG inflation.
 */
function buildImageUrlField(preferredContentType?: PreferredContentType): string {
  return preferredContentType ? `url(transform: { preferredContentType: ${preferredContentType} })` : 'url'
}

/**
 * Fetch products by IDs from Storefront API with pagination
 */
async function getProductsByIds(
  query: string,
  graphql: StorefrontGraphql,
  country: string,
  limit: number = 250,
  pageInfo?: PageInfo,
  preferredContentType?: PreferredContentType
): Promise<{ products: ProductData[]; pageInfo: PageInfo }> {
  try {
    const endCursor = pageInfo?.endCursor ? `after: "${pageInfo.endCursor}"` : ''
    const imageUrlField = buildImageUrlField(preferredContentType)

    const response = await graphql(
      `
      query getProducts($first: Int, $country: CountryCode!) @inContext(country: $country) {
        products(
          query: "${query} status:active",
          first: $first
          ${endCursor}
        ) {
          edges {
            node {
              id
              title
              featuredImage {
                ${imageUrlField}
                altText
                width
              }
              tags
              vendor
              productType
              availableForSale
              requiresSellingPlan
              collections(first: 250) {
                nodes {
                  id
                }
              }
              variants(first: 250) {
                nodes {
                  availableForSale
                  quantityAvailable
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                  id
                  title
                  image {
                    ${imageUrlField}
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
          }
        }
      }
      `,
      {
        variables: {
          first: limit,
          country,
        },
      }
    )

    const data = await response.json()
    const products = data.data?.products?.edges?.map((edge: any) => edge.node) || []

    return {
      products: products.map((product: any) => ({
        ...product,
        id: product.id.split(SHOPIFY_PRODUCT_ID_PREFIX)[1],
        variants: (product.variants?.nodes || []).map((variant: any) => ({
          ...variant,
          id: variant.id.split(SHOPIFY_VARIANT_ID_PREFIX)[1],
        })),
        collections: (product?.collections?.nodes || []).map(
          (collection: any) => collection.id.split(SHOPIFY_COLLECTION_ID_PREFIX)[1]
        ),
      })),
      pageInfo: data.data?.products?.pageInfo || defaultPageInfo,
    }
  } catch (error) {
    console.error('[Storefront] Error fetching products by IDs:', error)
    return { products: [], pageInfo: defaultPageInfo }
  }
}

/**
 * Fetch all products by IDs with full product data including variants, collections, etc.
 * Used by OneTick product offers feature and the charm builder picker fallback.
 *
 * @param ids - Array of product IDs (numeric strings)
 * @param graphql - Storefront GraphQL client
 * @param country - Country code for pricing context (e.g., 'US')
 * @param limit - Optional limit on number of products to return
 * @param preferredContentType - When set, asks Shopify CDN to transcode image
 *   URLs to this format. Required for charm builder ('PNG') because charm
 *   assets are often uploaded as HEIC (from iPhone) which browsers and Konva
 *   cannot render. Omit for OneTick to keep payload size minimal.
 */
export async function getAllProductsByIds(
  ids: string[],
  graphql: StorefrontGraphql,
  country: string,
  limit?: number,
  preferredContentType?: PreferredContentType
): Promise<ProductData[]> {
  if (!ids.length) return []

  const query = buildProductQuery(ids)

  let { products, pageInfo } = await getProductsByIds(query, graphql, country, limit, undefined, preferredContentType)

  // Handle pagination
  while (pageInfo.hasNextPage && (!limit || products.length < limit)) {
    const result = await getProductsByIds(query, graphql, country, limit, pageInfo, preferredContentType)
    products = [...products, ...result.products]
    pageInfo = result.pageInfo
  }

  // Remove duplicates
  const uniqueProducts = uniqBy(products, 'id')

  return limit ? uniqueProducts.slice(0, limit) : uniqueProducts
}
