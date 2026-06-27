/* eslint-disable max-lines */
import type {
  ConnectionArguments,
  ProductInputMutationSchema,
  ProductMediaInputSchema,
  VariantInputSchema,
  ProductVariantQuerySchema,
  DeliveryProfile,
  GetTopSellingProductsParams,
  ShopifyProduct,
  ShopifyOrder,
  ShopifyLineItem,
  TopSellingProduct,
  ProductSalesData,
  ShopInfo,
} from './types'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type {
  GraphQLQueryOptions,
  GraphQLResponse,
} from 'node_modules/@shopify/shopify-app-remix/dist/ts/server/clients/types'
import { flattenGraphQLConnectionResults } from '../fns'
import { queryForWebhooks, WEBHOOK_SUBSCRIPTION_BY_ID } from './webhooks/query.server'
import { getObjectValueByKeyPath } from '~/bootstrap/fns/misc'
import type { WebhookSubscriptionInput } from './webhooks/mutation.server'
import {
  deleteWebhookMutation,
  WEBHOOK_SUBSCRIPTION_CREATE,
  WEBHOOK_SUBSCRIPTION_UPDATE,
} from './webhooks/mutation.server'
import { queryForFileByIds, queryForMediaImages } from './files/query.server'
import { mutationFileCreate, mutationStagedUploadsCreate } from './files/mutation.server'
import { queryForAppId, queryForAppMetafield, queryForAppInfo } from './app/query.server'
import { mutationMetafieldDelete, mutationCreateAppDataMetafield } from './app/mutation.server'
import {
  QUERY_FOR_PRODUCT_ON_PRODUCT_PAGE,
  QUERY_FOR_PRODUCT_VARIANT_BY_ID,
  queryForCheckUserHasProduct,
  queryForProductMedia,
  queryForProducts,
  queryForProductVariantMetafields,
  queryForProductImages,
  queryForProductVariants,
} from '~/shopify/graphql/products/query.server'
import { queryForCollections, queryForCollectionProducts } from './collections/query.server'
import {
  deleteMediaMutation,
  productCreateMediaMutation,
  productCreateMutation,
  productDeleteMutation,
  productReorderMediaMutation,
  productStatusMutation,
  productUpdateMediaMutation,
  productVariantsBulkCreateMutation,
  productVariantUpdateMutation,
  tagsAddMutation,
  tagsRemoveMutation,
} from './products/mutation.server'
import { publishablePublishMutation } from './store-properties/mutation.server'
import { getStorePublicationsQuery } from './store-properties/query.server'
import type { RejectFulfillmentResponse } from './fulfillment-services/mutation.server'
import {
  ACCEPT_CANCELLATION_REQUEST,
  ACCEPT_FULFILLMENT_REQUEST,
  FULFILLMENT_SERVICE_CREATE,
  REJECT_CANCELLATION_REQUEST,
  REJECT_FULFILLMENT_REQUEST,
} from './fulfillment-services/mutation.server'
import type { FulfillmentOrderRequest } from './fulfillment-services/query.server'
import {
  RECEIVE_A_LIST_OF_ALL_FULFILLMENT_SERVICES,
  RETRIEVE_ASSIGNED_FULFILLMENT_ORDER_REQUESTS,
} from './fulfillment-services/query.server'
import { deliveryProfileCreate, deliveryProfileRemove, deliveryProfileUpdate } from './delivery-profile/mutation.server'
import { GET_FULFILLMENT_ORDER, getFulfillmentOrderIdByOrderId } from './fulfillment-order/query.server'
import { fulfillmentCreate } from './fulfillment/mutation.server'
import type { FulfillmentOrderAssignmentStatus, FulfillmentRequestKind } from '~/constants/fulfillment-providers'
import { requestGraphqlApi } from './fns.server'
import { getBulkQueryOrders, GET_ORDER_BY_ID_QUERY, queryForOrders } from './order/query.server'
import type { AdminOperations } from '@shopify/admin-api-client'
import type { FulfillmentOrderHoldRequest, FulfillmentOrderHoldResponse } from './fulfillment-order/mutation.server'
import { type WEBHOOK_TOPICS } from '~/constants/shopify'
import {
  FULFILLMENT_ORDER_CANCEL,
  FULFILLMENT_ORDER_HOLD,
  FULFILLMENT_ORDER_OPEN,
  FULFILLMENT_ORDER_SUBMIT_CANCELLATION_REQUEST,
  FULFILLMENT_ORDER_SUBMIT_FULFILLMENT_REQUEST,
} from './fulfillment-order/mutation.server'
import ShopifySession from '~/models/ShopifySession.server'
import { USER_ERROR_SELECTION } from './constants'
import { ITEM_LIST_LIMITATION } from '~/constants'
import type { TFileToUpload } from './files/types'
import { sleep } from '~/utils/sleep'
import { pollOperationStatus, processBatchedJsonLines } from './order/fns.server'
import { parseJsonl } from '~/utils/jsonl-parser'
import { serverCacheStorage } from '~/bootstrap/fns/serverCacheStorage'
import { getProductVariantsIntegrated } from '~/models/VariantIntegration.server'
import { getExcludedVendors, getOptionPricingProductHandle } from '~/routes/api.option-pricing/fns'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'

/**
 * Shopify Flow user error interface
 */
export interface FlowUserError {
  field: string[] | null
  message: string
}

/**
 * Shopify Flow trigger response interface
 */
export interface FlowTriggerResponse {
  userErrors?: FlowUserError[]
}

export class ShopifyApiClient {
  admin?: AdminApiContext
  opts?: { shopDomain: string; accessToken: string }

  constructor(admin?: AdminApiContext, opts?: { shopDomain: string; accessToken: string }) {
    this.admin = admin
    this.opts = opts
  }

  /**
   * The GraphQL function
   * This function will call the Shopify Admin API if the admin context is available or via access token
   *
   * @param query
   * @param opts
   * @returns
   */
  async graphql(query: string, opts?: GraphQLQueryOptions<string, AdminOperations>): Promise<any> {
    try {
      if (this.admin) {
        return await Promise.resolve(this.admin.graphql(query, opts) as any)
      }

      if (this.opts) {
        return await requestGraphqlApi({
          query,
          variables: opts?.variables,
          shopDomain: this.opts.shopDomain,
          accessToken: this.opts.accessToken,
        })
      }

      return Promise.resolve({ data: null })
    } catch (error) {
      // Enhanced error logging for graphql method
      const errorDetails = {
        type: 'GRAPHQL_METHOD_ERROR',
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : String(error),
        query: query.substring(0, 200),
        variables: opts?.variables ? JSON.stringify(opts.variables).substring(0, 200) : undefined,
        hasAdmin: !!this.admin,
        hasOpts: !!this.opts,
        shopDomain: this.opts?.shopDomain,
      }
      console.error('[ShopifyApiClient.graphql] Error:', JSON.stringify(errorDetails, null, 2))
      throw error
    }
  }

  async getAppId() {
    return verifyResponse(await this.graphql(queryForAppId), 'currentAppInstallation.id')
  }

  async getAppTitle() {
    return verifyResponse(await this.graphql(queryForAppInfo), 'app.title')
  }

  async getAppHandle() {
    return verifyResponse(await this.graphql(queryForAppInfo), 'app.handle')
  }

  /**
   * Returns shop basic information (name, description, metafields including SEO data)
   */
  async getShopInfo(): Promise<ShopInfo> {
    const SHOP_INFO_QUERY = `#graphql
      {
        shop {
          name
          description
          metafield(namespace: "global", key: "description_tag") {
            id
            key
            value
            namespace
          }
        }
      }
    `

    return verifyResponse<ShopInfo>(await this.graphql(SHOP_INFO_QUERY), 'shop')
  }

  /**
   * Get top selling products
   * @param limit Number of products to return (default: 1)
   * @param daysAgo Optional number of days to look back (default: 30)
   * @returns Array of top selling products sorted by sales quantity
   */
  async getTopSellingProducts(params: GetTopSellingProductsParams = {}): Promise<TopSellingProduct[]> {
    const { limit = 1, onlyTopSelling = false, daysAgo } = params

    /**
     * Filters and limits products based on exclusion criteria
     * @param products - Array of products to filter
     * @param excludedHandle - Product handle to exclude
     * @param limit - Maximum number of products to return
     * @param productVariantsIntegrated - Map of product IDs to integrated variant IDs
     */
    function filterAndLimitProducts(
      products: ShopifyProduct[],
      excludedHandle: string | undefined,
      limit: number,
      productVariantsIntegrated: Record<string, string[]>
    ): ShopifyProduct[] {
      return (
        products?.filter((p: ShopifyProduct) => {
          // Skip excluded handle
          if (excludedHandle && p.handle === excludedHandle) return false

          // Get all variants of the product
          const variants = (p.variants?.nodes || []).map(node => node?.id).filter(Boolean)
          if (!variants.length) return true // Keep products with no variants

          // Get integrated variants for this product
          const integratedVariants = productVariantsIntegrated[p.id] || []

          // Keep product if at least one variant is not integrated
          return variants.some((variantId: string) => !integratedVariants.includes(variantId))
        }) || []
      ).slice(0, limit)
    }

    // Get excluded handle
    let excludedHandle: string | undefined
    let excludedVendors: string[] = []
    const appHandle = process.env.APP_HANDLE || (await this.getAppHandle())
    try {
      excludedHandle = getOptionPricingProductHandle(appHandle)
      excludedVendors = getExcludedVendors()
    } catch {
      // Fallback to no exclusion if appHandle not available
    }

    const excluderHandleStr = excludedHandle ? `-handle:${excludedHandle}` : ''
    const excluderVendorsStr = excludedVendors.length
      ? `-vendor:${excludedVendors.map(v => `'${v.replace(/'/g, "\\'")}'`).join(' OR ')}`
      : ''
    const getProductsList = async (limit: number): Promise<ShopifyProduct[]> => {
      const { productsList } = await this.getProducts(
        {
          first: limit,
          sortKey: 'RELEVANCE',
          moreConditions: [excluderHandleStr, excluderVendorsStr].filter(Boolean).join(' AND '),
          status: [PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE, PRODUCT_STATUS_TYPE_FORMATTED.DRAFT],
        },
        `
          id,
          title,
          description,
          handle,
          featuredImage{url},
          priceRangeV2 { minVariantPrice { amount, currencyCode } }
          variants(first: 100) { nodes { id } }
        `,
        appHandle
      )
      return productsList as ShopifyProduct[]
    }

    try {
      const MAX_ORDERS_TO_FETCH = 100
      // Fetch orders and variants in parallel
      const [orders, productVariantsIntegrated]: [ShopifyOrder[], Record<string, string[]>] = await Promise.all([
        this.fallbackToRegularPagination(
          {
            sortKey: 'CREATED_AT',
            reverse: true,
            first: MAX_ORDERS_TO_FETCH,
            limit: MAX_ORDERS_TO_FETCH,
          },
          daysAgo
        ),
        getProductVariantsIntegrated(this.opts?.shopDomain),
      ])

      // If no orders, return filtered products
      if (!orders.length) {
        const productsList = await getProductsList(limit)
        return filterAndLimitProducts(productsList, excludedHandle, limit, productVariantsIntegrated)
      }

      // Process orders to get product sales data with variant tracking
      const productSales = orders.reduce((sales: Record<string, ProductSalesData>, order: ShopifyOrder) => {
        ;(order.lineItems || []).forEach((item: ShopifyLineItem) => {
          const { product, quantity, variant } = item
          if (!product || (excludedHandle && product.handle === excludedHandle)) {
            return
          }

          const productId = product.id
          const variantId = variant?.id
          if (!variantId) return // Skip if no variant ID

          // Get integrated variants for this product
          const integratedVariants = productVariantsIntegrated[productId] || []

          // If this is a new product entry
          if (!sales[productId]) {
            sales[productId] = {
              product,
              quantity,
              variants: new Set([variantId]),
              nonIntegratedVariants: new Set(integratedVariants.includes(variantId) ? [] : [variantId]),
            }
          } else {
            // Update existing product entry
            sales[productId].quantity += quantity
            sales[productId].variants.add(variantId)
            if (!integratedVariants.includes(variantId)) {
              sales[productId].nonIntegratedVariants.add(variantId)
            }
          }
        })
        return sales
      }, {})

      // Convert to array and sort by quantity
      const topProducts: TopSellingProduct[] = Object.values(productSales)
        .filter((item: ProductSalesData) => {
          // Compare the number of variants with the number of integrated variants
          const allVariants = Array.from(item.variants) as string[]
          const integratedVariants = productVariantsIntegrated[item.product.id] || []

          // If there is at least 1 variant that has not been integrated, keep the product
          return allVariants.some((variantId: string) => !integratedVariants.includes(variantId))
        })
        .sort((a: ProductSalesData, b: ProductSalesData) => b.quantity - a.quantity)
        .slice(0, limit)
        .map(
          (item: ProductSalesData): TopSellingProduct => ({
            ...item.product,
            totalQuantitySold: item.quantity,
            nonIntegratedVariants: Array.from(item.nonIntegratedVariants),
          })
        )

      if (topProducts.length || onlyTopSelling) {
        return topProducts
      }

      const productsList = await getProductsList(limit)
      return filterAndLimitProducts(productsList, excludedHandle, limit, productVariantsIntegrated)
    } catch (error) {
      console.error('Error getting top selling products:', error)
      const [productsList, productVariantsIntegrated]: [ShopifyProduct[], Record<string, string[]>] = await Promise.all(
        [getProductsList(limit), getProductVariantsIntegrated(this.opts?.shopDomain)]
      )
      return filterAndLimitProducts(productsList, excludedHandle, limit, productVariantsIntegrated)
    }
  }

  async getProductCategories() {
    return verifyResponse(
      await this.graphql(`query {
        shop {
          allProductCategoriesList {
            id
            name
          }
        }
      }`),
      'shop.allProductCategoriesList'
    )
  }

  /**
   * Get product by ID
   *
   * @param productId The ID of the product. Example: `gid://shopify/Product/1234567890`
   * @returns The product
   */
  async getProductById(productId: string) {
    return verifyResponse(
      await this.graphql(QUERY_FOR_PRODUCT_ON_PRODUCT_PAGE, { variables: { productId } }),
      'product'
    )
  }

  /**
   * Get detailed product information including variants and price range
   *
   * @param productId The ID of the product. Example: `gid://shopify/Product/1234567890`
   * @returns The detailed product information including variants and pricing
   */
  async getDetailedProductInfo(productId: string) {
    const query = `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    `

    try {
      return verifyResponse(await this.graphql(query, { variables: { id: productId } }), 'product')
    } catch (error) {
      console.error('Error fetching detailed product info:', error)
      return {}
    }
  }

  /**
   * Retrieves a list of products with pagination support
   *
   * @param {ConnectionArguments} [params={}] - Optional parameters for paginating and filtering products
   * @returns {
   * Promise<{
   *   productsList: any[],
   *   pageInfo: {
   *     hasNextPage: boolean,
   *     endCursor: string
   *   }
   * }>} A promise that resolves to product list data and pagination info
   */
  async getProducts(params: ConnectionArguments & any = {}, fieldSelection?: string, _appHandle?: string) {
    try {
      const appHandle = _appHandle || (await this.getAppHandle())
      const excludedHandle = getOptionPricingProductHandle(appHandle)
      if (excludedHandle) {
        params.moreConditions = params.moreConditions
          ? `${params.moreConditions} AND -handle:${excludedHandle}`
          : `-handle:${excludedHandle}`
      }

      const response = await verifyResponse(await this.graphql(queryForProducts(params, fieldSelection)), 'products')
      const { nodes = [], pageInfo = { hasNextPage: false, endCursor: '' } } = response || {}

      return { productsList: nodes, pageInfo }
    } catch (error) {
      console.error('Error fetching products:', error)
      return { productsList: [], pageInfo: { hasNextPage: false, endCursor: '' } }
    }
  }

  /**
   * Retrieves a paginated list of Shopify collections
   */
  async getCollections(params: ConnectionArguments = {}) {
    try {
      const response = await verifyResponse(await this.graphql(queryForCollections(params)), 'collections')
      const { nodes = [], pageInfo = { hasNextPage: false, endCursor: '' } } = response || {}
      return { collectionsList: nodes, pageInfo }
    } catch (error) {
      console.error('Error fetching collections:', error)
      return { collectionsList: [], pageInfo: { hasNextPage: false, endCursor: '' } }
    }
  }

  /**
   * Retrieves products within a specific collection
   */
  async getCollectionProducts(collectionId: string, params: ConnectionArguments = {}) {
    try {
      const response = await verifyResponse(await this.graphql(queryForCollectionProducts(collectionId, params)))
      const collection = response?.collection || {}
      const { nodes = [], pageInfo = { hasNextPage: false, endCursor: '' } } = collection?.products || {}
      return { productsList: nodes, pageInfo }
    } catch (error) {
      console.error('Error fetching collection products:', error)
      return { productsList: [], pageInfo: { hasNextPage: false, endCursor: '' } }
    }
  }

  /**
   * Handles paginated GraphQL queries with a standardized approach
   *
   * @param queryFn - Function that returns the GraphQL query with pagination params
   * @param extractDataFn - Function to extract the relevant data from the response
   * @param pageSize - Optional page size, defaults to 250
   * @returns Promise resolving to array of results
   */
  private async handlePaginatedQuery<T>(
    queryFn: (params: ConnectionArguments) => string,
    extractDataFn: (response: any) => { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string } },
    pageSize = ITEM_LIST_LIMITATION,
    limit?: number
  ): Promise<T[]> {
    const results: T[] = []
    let hasNextPage = true
    let cursor: string | undefined

    try {
      while (hasNextPage) {
        const response = await verifyResponse(
          await this.graphql(
            queryFn({
              after: cursor,
              first: pageSize,
            })
          )
        )

        const { nodes, pageInfo } = extractDataFn(response)

        if (!nodes?.length || (limit && results.length >= limit)) {
          break
        }

        results.push(...nodes)
        hasNextPage = pageInfo.hasNextPage
        cursor = pageInfo.endCursor
        await sleep(1500)
      }

      return results
    } catch (error) {
      console.error('Error in paginated query:', error)
      return []
    }
  }

  /**
   * Retrieves products by their IDs using optimized pagination
   *
   * @param productIds - Array of product IDs to fetch
   * @returns Promise resolving to array of flattened product data
   */
  async getProductsByIds(productIds: string[], fieldSelection?: string): Promise<any[]> {
    if (!productIds.length) {
      return []
    }

    const query = convertIdsToQuery(productIds)

    const products = await this.handlePaginatedQuery(
      params => queryForProducts({ ...params, query }, fieldSelection),
      response => response.products
    )

    return flattenGraphQLConnectionResults(products, ['variants'])
  }

  /**
   * Check if the user has products by querying 1 product
   *
   * @returns Promise resolving to array of products
   */
  async checkUserHasProduct() {
    return verifyResponse(await this.graphql(queryForCheckUserHasProduct), 'products.edges')
  }

  async getProductMedia(productId: string): Promise<any[]> {
    if (!productId) {
      return []
    }

    return verifyResponse(await this.graphql(queryForProductMedia, { variables: { productId } }), 'product.media.edges')
  }

  async deleteProduct(productId: string): Promise<{ success: boolean; deletedProductId?: string; errors?: any[] }> {
    if (!productId) {
      return { success: false, errors: [{ message: 'Product ID is required' }] }
    }

    const response = await this.graphql(productDeleteMutation, {
      variables: {
        input: { id: productId },
      },
    })

    const result = response.data?.productDelete

    if (result?.userErrors?.length) {
      return { success: false, errors: result.userErrors }
    }

    return {
      success: true,
      deletedProductId: result?.deletedProductId,
    }
  }

  async tagsAdd(resourceGid: string, tags: string[]) {
    try {
      return await this.graphql(tagsAddMutation, { variables: { id: resourceGid, tags } })
    } catch (error) {
      // Graceful failure — tagging is non-critical (used for webhook filtering)
      console.warn('[ShopifyApiClient.tagsAdd] Failed:', resourceGid, error instanceof Error ? error.message : error)
      return null
    }
  }

  async tagsRemove(resourceGid: string, tags: string[]) {
    try {
      return await this.graphql(tagsRemoveMutation, { variables: { id: resourceGid, tags } })
    } catch (error) {
      console.warn('[ShopifyApiClient.tagsRemove] Failed:', resourceGid, error instanceof Error ? error.message : error)
      return null
    }
  }

  async getProductImages(productGid: string) {
    return verifyResponse(await this.graphql(queryForProductImages, { variables: { id: productGid } }), 'product')
  }

  // @deprecated This function is deprecated and will be removed later
  async getProductVariantsLegacy(productId: string): Promise<ProductVariantQuerySchema[]> {
    if (!productId) {
      return []
    }

    return verifyResponse(
      await this.graphql(queryForProductMedia, { variables: { productId } }),
      'product.variants.edges'
    )
  }

  /**
   * Get product variant by ID
   *
   * @param variantId The ID of the product variant. Example: `gid://shopify/ProductVariant/1234567890`
   * @returns The product variant
   */
  async getProductVariantById(variantId: string) {
    return verifyResponse(
      await this.graphql(QUERY_FOR_PRODUCT_VARIANT_BY_ID, { variables: { variantId } }),
      'productVariant'
    )
  }

  async getProductVariants(params: ConnectionArguments = {}): Promise<any> {
    return verifyResponse(await this.graphql(queryForProductVariants(params)), 'productVariants')
  }

  /**
   * Retrieves product variants by their IDs using optimized pagination
   *
   * @param variantIds - Array of variant IDs to fetch
   * @returns Promise resolving to array of flattened product variant data
   */
  async getProductVariantsByVariantIds(variantIds: string[]): Promise<any> {
    if (!variantIds.length) {
      return []
    }

    const query = convertIdsToQuery(variantIds)

    const productVariants = await this.handlePaginatedQuery(
      params => queryForProductVariants({ ...params, query }),
      response => response.productVariants
    )

    return productVariants
  }

  /**
   * Retrieves metafields for product variants.
   *
   * This function queries the Shopify GraphQL API to fetch metafield information associated with product variants.
   * It accepts an optional ConnectionArguments object for pagination and filtering, and then extracts the metafields
   * from the 'productVariants.nodes' field in the response.
   *
   * @param {ConnectionArguments} [params={}] - Optional parameters for paginating and filtering the metafields query.
   * @returns {Promise<any>} A promise that resolves to an array of metafield objects for product variants.
   */
  async getProductVariantMetafields(params: ConnectionArguments = {}): Promise<any> {
    return verifyResponse(await this.graphql(queryForProductVariantMetafields(params)), 'productVariants.nodes')
  }

  async getFileByIds(ids: string[]): Promise<any[]> {
    if (!ids.length) {
      return []
    }

    return verifyResponse(await this.graphql(queryForFileByIds(ids)), 'nodes')
  }

  async getMediaFiles(params: ConnectionArguments = {}): Promise<any> {
    return verifyResponse(await this.graphql(queryForMediaImages(params)), 'files')
  }

  async removeMediaFiles(ids: string[], productId: string) {
    if (!ids.length) {
      return []
    }

    return verifyResponse(
      await this.graphql(deleteMediaMutation, {
        variables: {
          mediaIds: ids,
          productId,
        },
      })
    )
  }

  /**
   * Create product media (images) and return created media IDs.
   *
   * Note: Shopify's `productCreateMedia` expects `media` as an array.
   */
  async createProductMedia(
    media:
      | { alt: string; mediaContentType: string; originalSource: string }
      | { alt: string; mediaContentType: string; originalSource: string }[],
    productId: string
  ) {
    const mediaArray = Array.isArray(media) ? media : [media]
    return verifyResponse(
      await this.graphql(productCreateMediaMutation, {
        variables: {
          media: mediaArray,
          productId,
        },
      }),
      'productCreateMedia'
    )
  }

  /**
   * Copy images from one product to another by fetching image URLs and creating media.
   * Uses CDN URLs from the source product — Shopify re-hosts them on the target product.
   */
  async copyProductImages(sourceProductId: string, targetProductId: string) {
    const formattedSourceId = sourceProductId.startsWith('gid://shopify/Product/')
      ? sourceProductId
      : `gid://shopify/Product/${sourceProductId}`

    const query = `#graphql
      query getProductImages($id: ID!) {
        product(id: $id) {
          images(first: 20) {
            nodes {
              url
              altText
            }
          }
        }
      }
    `
    const result = await this.graphql(query, { variables: { id: formattedSourceId } })
    const images = (await result.json())?.data?.product?.images?.nodes || []

    if (!images.length) return

    const media = images.map((img: { url: string; altText?: string }) => ({
      alt: img.altText || '',
      mediaContentType: 'IMAGE',
      originalSource: img.url,
    }))

    return this.createProductMedia(media, targetProductId)
  }

  async updateProductStatus(id: string, status: 'DRAFT' | 'ACTIVE') {
    return verifyResponse(
      await this.graphql(productStatusMutation, {
        variables: {
          input: {
            id,
            status,
          },
        },
      })
    )
  }

  async createProduct(productData: ProductInputMutationSchema, media: ProductMediaInputSchema[]) {
    return verifyResponse(
      await this.graphql(productCreateMutation, {
        variables: {
          product: productData,
          media,
        },
      })
    )
  }

  async createBulkProductVariants(productId: string, variants: VariantInputSchema[]) {
    return verifyResponse(
      await this.graphql(productVariantsBulkCreateMutation, {
        variables: {
          productId,
          variants,
        },
      })
    )
  }

  /**
   * Polls for product featured media readiness after creation
   *
   * @param productId The ID of the product to check. Example: `gid://shopify/Product/1234567890`
   * @param maxAttempts Maximum number of polling attempts (default: 10)
   * @param delayMs Delay between polling attempts in milliseconds (default: 500)
   * @returns Promise that resolves when featured media is ready or rejects if timeout
   */
  async pollProductMediaStatus(
    productId: string,
    maxAttempts: number = 10,
    delayMs: number = 500
  ): Promise<{
    isReady: boolean
    featuredMediaStatus: string | null
  }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const product = await verifyResponse(
          await this.graphql(
            `
          query getProductMediaStatus($id: ID!) {
            product(id: $id) {
              id
              featuredMedia {
              status
              preview {
                image {
                  url
                }
              }
            }
              }
            }
          `,
            {
              variables: { id: productId },
            }
          ),
          'product'
        )

        if (!product) {
          // Product not found - might still be creating, continue polling
          if (attempt < maxAttempts - 1) {
            await sleep(delayMs)
            continue
          }
          console.warn(`Product ${productId} not found after ${maxAttempts} attempts`)
          return {
            isReady: false,
            featuredMediaStatus: null,
          }
        }

        // Check if featured media status is READY
        const featuredMediaStatus = product.featuredMedia?.status

        if (featuredMediaStatus === 'READY') {
          return {
            isReady: true,
            featuredMediaStatus,
          }
        }

        // If not ready and not the last attempt, wait before next poll
        if (attempt < maxAttempts - 1) {
          await sleep(delayMs)
        }
      } catch (error) {
        console.error(`Error polling product media status (attempt ${attempt + 1}):`, error)

        // If this is not the last attempt, continue trying
        if (attempt < maxAttempts - 1) {
          await sleep(delayMs)
          continue
        }

        // On last attempt, return not ready instead of throwing
        console.warn(`Failed to poll product ${productId} after ${maxAttempts} attempts`)
        return {
          isReady: false,
          featuredMediaStatus: null,
        }
      }
    }

    // Media not ready after all attempts
    console.warn(`Product featured media not ready after ${maxAttempts} attempts for product ${productId}`)
    return {
      isReady: false,
      featuredMediaStatus: null,
    }
  }

  /**
   * Duplicates a Shopify product
   *
   * @param productId The ID of the product to duplicate
   * @param newTitle The title for the duplicated product
   * @param options Optional parameters for duplication
   * @returns Object containing the new product ID and variant IDs
   */
  async duplicateProduct(
    productId: string,
    newTitle: string,
    options: {
      newHandle?: string
      newStatus?: 'ACTIVE' | 'DRAFT' | 'UNLISTED'
      includeImages?: boolean
      includeTranslations?: boolean
      synchronous?: boolean
    } = {}
  ) {
    const { newHandle, newStatus, includeImages = false, includeTranslations = false, synchronous = true } = options

    // Ensure productId has the correct GID format
    const formattedProductId = productId.startsWith('gid://shopify/Product/')
      ? productId
      : `gid://shopify/Product/${productId}`

    const PRODUCT_DUPLICATE_MUTATION = `#graphql
      mutation productDuplicate(
        $productId: ID!
        $newTitle: String!
        $newStatus: ProductStatus
        $includeImages: Boolean
        $includeTranslations: Boolean
        $synchronous: Boolean
      ) {
        productDuplicate(
          productId: $productId
          newTitle: $newTitle
          newStatus: $newStatus
          includeImages: $includeImages
          includeTranslations: $includeTranslations
          synchronous: $synchronous
        ) {
          newProduct {
            id
            title
            handle
            variants(first: 250) {
              nodes {
                id
                title
                inventoryItem {
                  id
                  tracked
                }
              }
            }
          }
          imageJob {
            id
          }
          productDuplicateOperation {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await verifyResponse(
      await this.graphql(PRODUCT_DUPLICATE_MUTATION, {
        variables: {
          productId: formattedProductId,
          newTitle,
          ...(newStatus && { newStatus }),
          includeImages,
          includeTranslations,
          synchronous,
        },
      }),
      'productDuplicate'
    )

    const newProduct = response.newProduct
    if (!newProduct) {
      throw new Error('Product duplication failed - no new product returned')
    }

    // If a custom handle is specified, update the product with the new handle
    if (newHandle) {
      const PRODUCT_UPDATE_MUTATION = `#graphql
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      await verifyResponse(
        await this.graphql(PRODUCT_UPDATE_MUTATION, {
          variables: {
            input: {
              id: newProduct.id,
              handle: newHandle,
            },
          },
        }),
        'productUpdate'
      )
    }

    // Collect inventory item IDs that have tracking enabled — callers can disable tracking
    // on cloned products (e.g. personalized products are made-to-order, no stock to track).
    const trackedInventoryItemIds
      = newProduct.variants?.nodes?.filter((v: any) => v.inventoryItem?.tracked).map((v: any) => v.inventoryItem.id) || []

    return {
      productId: newProduct.id,
      variantIds: newProduct.variants?.nodes?.map((variant: any) => variant.id) || [],
      trackedInventoryItemIds,
      title: newProduct.title,
      handle: newHandle || newProduct.handle,
      imageJobId: response.imageJob?.id,
      operationId: response.productDuplicateOperation?.id,
    }
  }

  async productUpdateMedia(productId: string, media: { id: string; previewImageSource: string }[]) {
    return verifyResponse(
      await this.graphql(productUpdateMediaMutation, {
        variables: {
          media,
          productId,
        },
      })
    )
  }

  /**
   * Reorder media on a product.
   *
   * Note: Shopify's Admin GraphQL expects `MoveInput.newPosition` (UnsignedInt64) encoded as a string in variables.
   */
  async productReorderMedia(productId: string, moves: { id: string; newPosition: string | number }[]) {
    return verifyResponse(
      await this.graphql(productReorderMediaMutation, {
        variables: {
          moves,
          id: productId,
        },
      })
    )
  }

  async productVariantUpdate(variantId: string, mediaId: string) {
    return verifyResponse(
      await this.graphql(productVariantUpdateMutation, {
        variables: {
          input: {
            mediaId: mediaId,
            id: variantId,
          },
        },
      })
    )
  }

  async createStagedUploads(
    input: {
      filename: string
      fileSize: string
      mimeType: string
      resource: string
      httpMethod: string
    }[]
  ): Promise<any> {
    return verifyResponse(
      await this.graphql(mutationStagedUploadsCreate, { variables: { input } }),
      'stagedUploadsCreate'
    )
  }

  async createFile(files: TFileToUpload[]): Promise<any[]> {
    return verifyResponse(await this.graphql(mutationFileCreate, { variables: { files } }), 'fileCreate')
  }

  /**
   * Get app metafields
   *
   * @param ownerId
   * @returns
   */
  async getAppMetafields(ownerId?: string) {
    const appId = await this.getAppId()
    if (!ownerId) {
      ownerId = appId
    }

    const allMetafields = []
    let hasNextPage = true
    let cursor = null

    while (hasNextPage) {
      const response = await this.graphql(queryForAppMetafield, {
        variables: {
          ownerId,
          cursor,
        },
      })

      const data = await verifyResponse(response)
      const { nodes, pageInfo } = data.appInstallation.metafields

      allMetafields.push(...nodes)
      hasNextPage = pageInfo.hasNextPage
      cursor = pageInfo.endCursor
    }

    return { appInstallation: { metafields: { nodes: allMetafields } } }
  }

  async upsertAppMetafields(
    metafieldsSetInput: {
      key: string
      type: string
      value: string
      ownerId?: string
      namespace: string
    }[]
  ) {
    // Prepare input objects
    let appId

    for (let i = 0; i < metafieldsSetInput.length; i++) {
      if (!metafieldsSetInput[i].ownerId) {
        appId = appId || (await this.getAppId())
        metafieldsSetInput[i].ownerId = appId
      }
    }

    return verifyResponse(
      await this.graphql(mutationCreateAppDataMetafield, { variables: { metafieldsSetInput } }),
      'metafieldsSet'
    )
  }

  async deleteAppMetafield(metafields: { key: string; namespace: string; ownerId: string }[]) {
    return verifyResponse(
      await this.graphql(mutationMetafieldDelete, { variables: { metafields } }),
      'metafieldsDelete'
    )
  }

  /** Store properties */

  /** Get store's publication */
  async getStorePublications() {
    return verifyResponse(await this.graphql(getStorePublicationsQuery), 'publications.edges')
  }

  /** Publishes a resource to a channel */
  async publishablePublish(productId: string, publicationId: string) {
    return verifyResponse(
      await this.graphql(publishablePublishMutation, {
        variables: {
          id: productId,
          input: {
            publicationId,
          },
        },
      })
    )
  }

  /** Delivery profile */

  /** Get all delivery profiles */
  async getAllDeliveryProfiles() {
    const profiles = []
    let hasNextPage = true
    let cursor = null

    while (hasNextPage) {
      const deliveryProfilesQuery: string = `
      query {
        deliveryProfiles(first: 100${cursor ? `, after: "${cursor}"` : ''}) {
          edges {
            node {
              id
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `

      type DeliveryProfilesQueryResponse = {
        deliveryProfiles: {
          edges: { node: { id: string; name: string } }[]
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
        }
      }

      const data = await verifyResponse<DeliveryProfilesQueryResponse>(await this.graphql(deliveryProfilesQuery))

      const deliveryProfiles = data.deliveryProfiles.edges.map((edge: any) => edge.node)
      profiles.push(...deliveryProfiles)

      hasNextPage = data.deliveryProfiles.pageInfo.hasNextPage
      cursor = data.deliveryProfiles.pageInfo.endCursor
    }

    return profiles
  }

  /** Create delivery profile */
  async createDeliveryProfile(profile: DeliveryProfile) {
    return verifyResponse(
      await this.graphql(deliveryProfileCreate, {
        variables: { profile },
      }),
      'deliveryProfileCreate'
    )
  }

  /** Update delivery profile */
  async updateDeliveryProfile(profileId: string, variantsToAssociate: string[]) {
    return verifyResponse(
      await this.graphql(deliveryProfileUpdate, {
        variables: {
          id: profileId,
          profile: {
            variantsToAssociate,
          },
        },
      }),
      'deliveryProfileUpdate'
    )
  }

  /** Remove delivery profile */
  async deliveryProfileRemove(profileId: string) {
    return verifyResponse(
      await this.graphql(deliveryProfileRemove, { variables: { id: profileId } }),
      'deliveryProfileRemove'
    )
  }

  /** Order */
  async getOrderById(orderId: string) {
    return verifyResponse(await this.graphql(GET_ORDER_BY_ID_QUERY, { variables: { id: orderId } }), 'order')
  }

  /** Fulfillment order */
  async getFulfillmentOrderByOrderId(orderId: string) {
    return verifyResponse(
      await this.graphql(getFulfillmentOrderIdByOrderId, {
        variables: {
          orderId,
        },
      }),
      'order.fulfillmentOrders.edges'
    )
  }

  /** Get fulfillment order by fulfillment order id */
  async getFulfillmentOrderById(fulfillmentOrderId: string) {
    return verifyResponse(
      await this.graphql(GET_FULFILLMENT_ORDER, {
        variables: {
          fulfillmentOrderId,
        },
      }),
      'fulfillmentOrder'
    )
  }

  /** Fulfill fulfillment order */
  async createFulfillment(fulfillmentOrderId: string, trackingInfo?: { urls: string[]; numbers: string[] }) {
    return verifyResponse(
      await this.graphql(fulfillmentCreate, {
        variables: {
          fulfillment: {
            lineItemsByFulfillmentOrder: [
              {
                fulfillmentOrderId,
              },
            ],
            ...(trackingInfo ? { trackingInfo } : {}),
            notifyCustomer: true,
          },
        },
      }),
      'fulfillmentCreate'
    )
  }

  /** Marks a scheduled fulfillment order as open. */
  async openFulfillmentOrder(fulfillmentOrderId: string) {
    return verifyResponse(
      await this.graphql(FULFILLMENT_ORDER_OPEN, { variables: { id: fulfillmentOrderId } }),
      'fulfillmentOrderOpen'
    )
  }

  /** Sends a fulfillment request to the fulfillment service of a fulfillment order. */
  async fulfillmentOrderSubmitFulfillmentRequest(fulfillmentOrderId: string) {
    return verifyResponse(
      await this.graphql(FULFILLMENT_ORDER_SUBMIT_FULFILLMENT_REQUEST, { variables: { id: fulfillmentOrderId } }),
      'fulfillmentOrderSubmitFulfillmentRequest'
    )
  }

  /** Cancel fulfillment order */
  async cancelFulfillmentOrder(fulfillmentOrderId: string) {
    return verifyResponse(
      await this.graphql(FULFILLMENT_ORDER_CANCEL, {
        variables: {
          id: fulfillmentOrderId,
        },
      }),
      'fulfillmentOrderCancel'
    )
  }

  /** Fulfillment Services */

  /** Subscribe fulfillment service app */
  async createFulfillmentService(variables: {
    name: string
    callbackUrl: string
    inventoryManagement: boolean
    trackingSupport: boolean
  }) {
    return verifyResponse(
      await this.graphql(FULFILLMENT_SERVICE_CREATE, {
        variables,
      }),
      'fulfillmentServiceCreate'
    )
  }

  /** Receive a list of all FulfillmentServices */
  async receiveAListOfAllFulfillmentService() {
    return verifyResponse(await this.graphql(RECEIVE_A_LIST_OF_ALL_FULFILLMENT_SERVICES), 'shop.fulfillmentServices')
  }

  /** Retrieve Assigned Fulfillment Order Requests */
  async retrieveAssignedFulfillmentOrderRequests(
    assignmentStatus: FulfillmentOrderAssignmentStatus,
    kind: FulfillmentRequestKind
  ): Promise<FulfillmentOrderRequest['shop']['assignedFulfillmentOrders']['edges']> {
    return verifyResponse(
      await this.graphql(RETRIEVE_ASSIGNED_FULFILLMENT_ORDER_REQUESTS, {
        variables: {
          assignmentStatus,
          kind,
        },
      }),
      'shop.assignedFulfillmentOrders.edges'
    )
  }

  /** Hold fulfillment order */
  async holdFulfillmentOrder(
    fulfillmentHold: FulfillmentOrderHoldRequest['fulfillmentHold'],
    fulfillmentOrderId: FulfillmentOrderHoldRequest['id']
  ): Promise<FulfillmentOrderHoldResponse['fulfillmentOrderHold']> {
    return verifyResponse(
      await this.graphql(FULFILLMENT_ORDER_HOLD, {
        variables: {
          fulfillmentHold,
          id: fulfillmentOrderId,
        },
      }),
      'fulfillmentOrderHold'
    )
  }

  /** Request cancellation fulfillment order */
  async fulfillmentOrderSubmitCancellationRequest(fulfillmentOrderId: string, message: string) {
    return verifyResponse(
      await this.graphql(FULFILLMENT_ORDER_SUBMIT_CANCELLATION_REQUEST, {
        variables: {
          id: fulfillmentOrderId,
          message,
        },
      }),
      'fulfillmentOrderSubmitCancellationRequest'
    )
  }

  /** Accept fulfillment requests */
  async acceptFulfillmentRequest(id: string, message: string) {
    return verifyResponse(
      await this.graphql(ACCEPT_FULFILLMENT_REQUEST, {
        variables: {
          id,
          message,
        },
      }),
      'fulfillmentOrderAcceptFulfillmentRequest'
    )
  }

  /** Reject fulfillment requests */
  async rejectFulfillmentRequest(id: string, message: string): Promise<RejectFulfillmentResponse> {
    return verifyResponse(
      await this.graphql(REJECT_FULFILLMENT_REQUEST, { variables: { id, message } }),
      'fulfillmentOrderRejectFulfillmentRequest'
    )
  }

  /** Accept cancellation requests */
  async acceptCancellationRequest(id: string, message: string) {
    return verifyResponse(
      await this.graphql(ACCEPT_CANCELLATION_REQUEST, {
        variables: {
          id,
          message,
        },
      }),
      'fulfillmentOrderAcceptCancellationRequest'
    )
  }

  /** Reject cancellation requests */
  async rejectCancellationRequest(id: string, message: string) {
    return verifyResponse(
      await this.graphql(REJECT_CANCELLATION_REQUEST, {
        variables: {
          id,
          message,
        },
      }),
      'fulfillmentOrderRejectCancellationRequest'
    )
  }

  /** WEBHOOKS */
  async getWebhooks() {
    return verifyResponse(await this.graphql(queryForWebhooks))
  }

  /** Get webhook by ID */
  async getWebhookById(webhookId: string) {
    return verifyResponse(
      await this.graphql(WEBHOOK_SUBSCRIPTION_BY_ID, { variables: { id: webhookId } }),
      'webhookSubscription'
    )
  }

  /** Creates a new webhook subscription. */
  async webhookSubscriptionCreate(topic: WEBHOOK_TOPICS, webhookSubscription: WebhookSubscriptionInput) {
    return verifyResponse(
      await this.graphql(WEBHOOK_SUBSCRIPTION_CREATE, { variables: { topic, webhookSubscription } }),
      'webhookSubscriptionCreate'
    )
  }

  /** Updates a webhook subscription. */
  async webhookSubscriptionUpdate(webhookId: string, webhookSubscriptionInput: WebhookSubscriptionInput) {
    return verifyResponse(
      await this.graphql(WEBHOOK_SUBSCRIPTION_UPDATE, {
        variables: { id: webhookId, webhookSubscription: webhookSubscriptionInput },
      }),
      'webhookSubscriptionUpdate'
    )
  }

  async deleteWebhook(webhookId: string) {
    const response = await this.graphql(deleteWebhookMutation, { variables: { id: webhookId } })

    return response
  }

  /**
   * Triggers a Shopify Flow using the flowTriggerReceive mutation
   *
   * @param handle - The handle of the flow to trigger
   * @param payload - The payload data to send to the flow (all values must be JSON-serializable)
   * @returns Promise resolving to the flow trigger response with userErrors
   */
  async triggerShopifyFlow(handle: string, payload: Record<string, unknown>): Promise<FlowTriggerResponse> {
    const FLOW_TRIGGER_MUTATION = `mutation flowTriggerReceive($handle: String!, $payload: JSON!) {
      flowTriggerReceive(handle: $handle, payload: $payload) {
        ${USER_ERROR_SELECTION}
      }
    }`

    try {
      const response = await this.graphql(FLOW_TRIGGER_MUTATION, {
        variables: { handle, payload },
      })

      // Normalize response structure - handle both admin context and direct API responses
      const normalizedResponse = typeof response?.json === 'function' ? await response.json() : response

      const data = normalizedResponse?.data?.flowTriggerReceive
        || normalizedResponse?.flowTriggerReceive || { userErrors: [] }

      // Log user errors but don't throw - flow trigger may succeed even with warnings
      if (data.userErrors?.length > 0) {
        console.error('[Flow Trigger] User errors:', {
          handle,
          userErrors: data.userErrors,
        })
      }

      return data
    } catch (error) {
      const errorDetails = {
        type: 'FLOW_TRIGGER_ERROR',
        handle,
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : String(error),
      }
      console.error('[Flow Trigger] GraphQL ERROR:', JSON.stringify(errorDetails, null, 2))
      throw error
    }
  }

  /**
   * Retrieves orders using bulk operations API for better performance with large datasets
   * @param params Additional query parameters
   * @param daysAgo Optional number of days to look back (default: 30)
   * @returns Promise resolving to array of order data
   */
  private async pollOperationStatus(retryCount = 0, maxRetries = 100): Promise<string> {
    return pollOperationStatus(this.graphql.bind(this), retryCount, maxRetries)
  }

  private async fallbackToRegularPagination(
    params: ConnectionArguments & { limit?: number },
    daysAgo?: number
  ): Promise<ShopifyOrder[]> {
    const retryCount = 3
    for (let i = 0; i < retryCount; i++) {
      try {
        const _params = {
          ...params,
          limit: undefined,
        }
        const ordersResponse = await this.handlePaginatedQuery(
          params => queryForOrders({ ...params, ..._params }, daysAgo),
          response => response.orders,
          params.first,
          params.limit
        )
        const orders = flattenGraphQLConnectionResults(ordersResponse, ['orders.edges'])
        const ordersWithLineItemsFormatted: ShopifyOrder[] = orders.map(
          (order: any): ShopifyOrder => ({
            ...order,
            lineItems: (order?.lineItems?.edges || []).map((lineItem: any) => lineItem.node || []),
          })
        )

        return ordersWithLineItemsFormatted
      } catch (error) {
        if (i === retryCount - 1) throw error
        await sleep(1000 * Math.pow(2, i)) // Exponential backoff
      }
    }
    throw new Error('Failed to fetch orders after multiple retries')
  }

  async getOrdersUsingBulkOperation(params: ConnectionArguments & any = {}, daysAgo?: number): Promise<any[]> {
    const shopDomain = this.opts?.shopDomain || 'default'
    const cacheKey = `orders_${shopDomain}_${daysAgo}_${JSON.stringify(params)}`

    // Check cache first
    const cached = await serverCacheStorage.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Step 1: Start bulk operation
      await this.graphql(getBulkQueryOrders(params, daysAgo))

      // Step 2: Get URL with improved polling
      const url = await this.pollOperationStatus()

      // Step 3: Parse JSONL results
      const jsonLines = (await parseJsonl(url, { asArray: true })) as any[]

      // Process data in batches
      const orders = await processBatchedJsonLines(jsonLines, daysAgo)

      // Cache results before returning (5 minutes TTL)
      await serverCacheStorage.set(cacheKey, orders, 5 * 60 * 1000)

      return orders
    } catch (error) {
      console.error('Error in bulk operation:', error)
      return this.fallbackToRegularPagination(params, daysAgo)
    }
  }
}

export async function getShopifySession(shopDomain: string) {
  const session = await ShopifySession.findOne({ shop: shopDomain })

  if (!session) throw new Error('Shopify session not found')

  return session
}

/**
 * Get Shopify API client
 *
 * @param shopDomain string
 * @param admin AdminApiContext
 * @returns
 */
export async function getShopifyApiClient(shopDomain: string, admin?: AdminApiContext): Promise<ShopifyApiClient> {
  // Return ShopifyApiClient instance if admin context is available
  if (admin) return new ShopifyApiClient(admin)

  // Get Shopify session to get access token
  const session = await ShopifySession.findOne({ shop: shopDomain })

  if (!session) throw new Error('Shopify session not found')

  const { accessToken } = session

  return new ShopifyApiClient(undefined, { accessToken, shopDomain })
}

export function convertIdsToQuery(ids: string[]): string {
  try {
    // Extract the numeric ID from each GID and format them into the desired query format
    return (ids || [])
      .filter(i => !!i)
      .map(id => `(id:${id.toString().split('/').pop()})`)
      .join(' OR ')
  } catch (e) {
    console.error(e)
    return ''
  }
}

export async function verifyResponse<T = any>(
  result: GraphQLResponse<any, any> | { data?: unknown } | any,
  dataKeyPath?: string
): Promise<T> {
  try {
    const _result = typeof result?.json === 'function' ? await result.json() : result

    // Check for GraphQL errors at root level
    if (_result?.errors && Array.isArray(_result.errors) && _result.errors.length > 0) {
      const errorDetails = {
        type: 'GRAPHQL_RESPONSE_ERROR',
        errors: _result.errors,
        dataKeyPath,
        result: JSON.stringify(_result).substring(0, 500),
      }
      console.error('[verifyResponse] GraphQL errors found:', JSON.stringify(errorDetails, null, 2))
      throw new Error(_result.errors[0]?.message || 'GraphQL error occurred')
    }

    const data: unknown = dataKeyPath ? getObjectValueByKeyPath(_result, `data.${dataKeyPath}`) : (_result as any)?.data

    if (!data || (data as any)?.userErrors?.length) {
      const errorDetails = {
        type: 'USER_ERROR',
        userErrors: (data as any)?.userErrors,
        dataKeyPath,
        hasData: !!data,
      }
      console.error('[verifyResponse] User errors found:', JSON.stringify(errorDetails, null, 2))
      throw new Error((data as any)?.userErrors?.[0]?.message || 'UNKNOWN')
    }

    return data as T
  } catch (error) {
    // If it's already our error, re-throw it
    if (error instanceof Error && (error.message.includes('GraphQL') || error.message.includes('UNKNOWN'))) {
      throw error
    }

    // Log unexpected errors
    const errorDetails = {
      type: 'VERIFY_RESPONSE_ERROR',
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : String(error),
      dataKeyPath,
    }
    console.error('[verifyResponse] Unexpected error:', JSON.stringify(errorDetails, null, 2))
    throw error
  }
}
