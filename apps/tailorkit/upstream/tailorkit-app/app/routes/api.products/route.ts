/* eslint-disable max-len */
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import Mockup from '~/models/Mockup.server'
import { ITEM_GRID_LIMITATION, PRODUCT_LIST_LIMITATION, SHOPIFY_ITEMS_LIMITATION } from '~/constants'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'
import { catchAsync } from '~/utils/catchAsync'
import type { ITopSellingProductsResult } from './constants'
import { PRODUCT_MUTATION_ACTIONS, PRODUCT_QUERY_ACTIONS } from './constants'
import {
  getPrintifyImageUrl,
  queryProductsFromPrintify,
  // getPrintifyParamsForRecommendation,
  getProductTitleClassification,
} from './fns.server'
import { AssistantService } from '~/libs/openai/assistant.service'
import { getProductVariantsIntegrated } from '~/models/VariantIntegration.server'
import { getExcludedVendors, getOptionPricingProductHandle } from '../api.option-pricing/fns'
import Integration from '~/models/Integration.server'
import Provider from '~/models/Provider.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { getOnboardingProducts } from '~/utils/supabase-client.server'

// Constants
const DEFAULT_CURRENCY = 'USD'
const DEFAULT_PRINTIFY_PRICE = '25.00'
const AI_MODEL_CONFIG = {
  model: 'gpt-4.1-nano',
  temperature: 0.1,
  maxTokens: 2000,
} as const

// Types
interface ProductFormatters {
  shopify: (products: any[]) => Promise<ITopSellingProductsResult[]>
  printify: (products: any[], printifyProviderId: string) => Promise<ITopSellingProductsResult[]>
}

interface ProductSources {
  topSelling: ITopSellingProductsResult[]
  remaining: ITopSellingProductsResult[]
  additional: ITopSellingProductsResult[]
  printify: ITopSellingProductsResult[]
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request)
    const apiClient = new ShopifyApiClient(admin)

    // Get source and category from query params
    const url = new URL(request.url)
    const after = url.searchParams.get('after')
    const search = url.searchParams.get('search')
    const productId = url.searchParams.get('productId')
    const templateId = url.searchParams.get('templateId')
    const source = url.searchParams.get('source') || 'existing'
    const category = url.searchParams.get('category')?.split(',')?.filter(Boolean)
    const limit = Number(url.searchParams.get('limit')) || PRODUCT_LIST_LIMITATION
    // Parse status filter from query params (e.g., "ACTIVE" or "ACTIVE,DRAFT")
    const statusParam = url.searchParams.get('status')
    let statusFilter: string[]
    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim().toUpperCase())
      statusFilter = statuses
        .filter(s => s in PRODUCT_STATUS_TYPE_FORMATTED)
        .map(s => PRODUCT_STATUS_TYPE_FORMATTED[s as keyof typeof PRODUCT_STATUS_TYPE_FORMATTED])
    } else {
      statusFilter = [
        PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE,
        PRODUCT_STATUS_TYPE_FORMATTED.DRAFT,
        PRODUCT_STATUS_TYPE_FORMATTED.UNLISTED,
      ]
    }

    switch (source) {
      case 'existing': {
        // Filter by template
        let productIds

        if (templateId) {
          productIds = (await Mockup.find({ 'denormalizedData.templates._id': templateId })).reduce(
            (acc: any[], mockup: any) => acc.concat(mockup.denormalizedData.variants.map((v: any) => v.productId)),
            []
          )
        }

        // Fetch Shopify products - filter by status from query params
        const res = await apiClient.getProducts({
          first: limit,
          after,
          search,
          category,
          productId,
          productIds,
          status: statusFilter,
        })

        // Flatten the product variants
        const items = res.productsList.map((product: any) => ({
          ...product,
          hasOnlyDefaultVariant: product.hasOnlyDefaultVariant ?? false,
          variants: product.variants.nodes.map((variant: any) => ({
            ...variant,
            product: {
              ...product,
              variants: undefined,
            },
          })),
        }))

        // Get integration status
        const mockups = await Mockup.find({
          'denormalizedData.variants.id': {
            $in: items.reduce((acc: string[], item: any) => acc.concat(item.variants.map((v: any) => v.id)), []),
          },
        })

        const mockupVariants = mockups?.reduce(
          (acc: any[], mockup: any) => acc.concat(mockup.denormalizedData.variants.map((v: any) => v.id)),
          []
        )

        if (mockupVariants.length) {
          // Fetch all integrations at once
          const integrationIds = mockups.map(m => m?.denormalizedData.integration._id).filter(Boolean)
          const integrations = await Integration.find({ _id: { $in: integrationIds } })
          const integrationsMap = new Map(integrations.map(i => [i._id, i]))

          for (let i = 0; i < items.length; i++) {
            const item = items[i]

            const mockup = mockups.find((mockup: any) =>
              mockup.denormalizedData.variants.find((v: any) =>
                item.variants.find((variant: any) => variant.id === v.id)
              )
            )

            const integration = integrationsMap.get(mockup?.denormalizedData.integration._id)

            Object.assign(items[i], {
              variants: item.variants.map((variant: any) => ({
                ...variant,
                integrated: mockupVariants.includes(variant.id) ? true : false,
              })),
              mockupId: mockup?._id,
              integrationId: integration?._id,
              publishedAt: integration?.publishedAt,
            })
          }
        }

        return json({
          success: true,
          items,
          hasMore: res.pageInfo.hasNextPage && res.pageInfo.endCursor,
          pageInfo: res.pageInfo,
        })
      }
      case 'dummy': {
        const dummyProducts = await getOnboardingProducts()
        return json({ success: true, items: dummyProducts })
      }

      default: {
        // Fetch Printify products
        const params: string[] = []
        if (category?.length) {
          ;(category instanceof Array ? category : [category]).forEach(cat => {
            const decodedTag = decodeURIComponent(cat)
            params.push(`filters[category][]=${encodeURIComponent(decodedTag)}`)
          })
        }

        if (search) {
          params.push(`searchKey=${search}`)
        }

        if (after) {
          params.push(`offset=${after}`)
        }

        const res: any = await queryProductsFromPrintify({
          limit: ITEM_GRID_LIMITATION,
          params,
        })

        return json({ success: true, items: res.data, hasMore: res.total > res.to && res.to })
      }
    }
  } catch (e: any) {
    console.error(e)
    return json({ success: false, message: e.message || e })
  }
}

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop, accessToken },
    admin,
  } = await authenticate.admin(request)
  const apiClient = new ShopifyApiClient(admin, {
    shopDomain: shop,
    accessToken: accessToken || '',
  })

  const payload = await request.json()
  const { action, limit = 5 } = payload

  switch (action) {
    case PRODUCT_QUERY_ACTIONS.GET_TOP_SELLING_PRODUCTS: {
      const res = await getTopSellingProductsOptimized(limit, apiClient, shop)
      return res
    }

    case PRODUCT_MUTATION_ACTIONS.DUPLICATE_EXISTING_PRODUCT: {
      const { productId, newTitle, options = {} } = payload
      const res = await apiClient.duplicateProduct(productId, newTitle, options)
      return {
        ...res,
        success: true,
      }
    }

    default:
      throw new Error('Invalid action')
  }
})

// Product formatters
const createProductFormatters = (): ProductFormatters => ({
  shopify: (products: any[]): Promise<ITopSellingProductsResult[]> =>
    Promise.resolve(
      products.map(product => ({
        productId: product.id,
        title: product.title,
        handle: product.handle || String(product.id),
        featuredImageUrl: product.featuredImage?.url || '',
        productSource: 'upsell',
        source: 'existing',
        minPrice: product.priceRangeV2?.minVariantPrice || {
          amount: 0,
          currencyCode: DEFAULT_CURRENCY,
        },
      }))
    ),

  printify: async (products: any[], printifyProviderId?: string): Promise<ITopSellingProductsResult[]> => {
    return products.map(product => {
      const imageUrl = getPrintifyImageUrl(product)
      const priceInDollars = product.minPrice ? (product.minPrice / 100).toFixed(2) : DEFAULT_PRINTIFY_PRICE

      return {
        productId: product.blueprintId,
        title: product.name,
        handle: product.handle || String(product.blueprintId),
        featuredImageUrl: imageUrl,
        minPrice: {
          amount: priceInDollars,
          currencyCode: DEFAULT_CURRENCY,
        },
        productSource: 'printify',
        source: printifyProviderId,
        productDetails: product,
      }
    })
  },
})

// Helper functions
function createAIAssistant(): AssistantService {
  return new AssistantService({
    apiKey: process.env.OPENAI_API_KEY!,
    ...AI_MODEL_CONFIG,
  })
}

function checkIfAllVariantsIntegrated(product: any, productVariantsIntegrated: Record<string, string[]>): boolean {
  const productId = product.id
  const variantIds = product?.variants?.nodes?.map((v: any) => v.id) || []
  const integratedVariants = productVariantsIntegrated[productId] || []
  return (
    integratedVariants.length > 0
    && (!variantIds.length || integratedVariants.every((v: string) => variantIds.includes(v)))
  )
}

async function fetchRemainingShopifyProducts(
  sources: ProductSources,
  remainingLimit: number,
  searchTitles: string[],
  formatters: ProductFormatters,
  apiClient: ShopifyApiClient,
  shopDomain: string
): Promise<void> {
  const productVariantsIntegrated = await getProductVariantsIntegrated(shopDomain)
  const productFields
    = 'id, title, handle, featuredImage{url}, priceRangeV2 { minVariantPrice { amount, currencyCode } } variants(first: 100) { nodes { id } }'

  // Get excluded handle
  let excludedHandle: string | undefined
  let excludedVendors: string[] = []
  const appHandle = await apiClient.getAppHandle()
  try {
    excludedHandle = getOptionPricingProductHandle(appHandle)
    excludedVendors = getExcludedVendors()
  } catch {
    // Fallback to no exclusion if appHandle not available
  }

  const allCurrentIds = [...sources.topSelling].map(p => p.productId)

  // Step 1: Get products with search filter
  const queries = []
  if (searchTitles.length) {
    const queryTitles = searchTitles.map(title => `*${title}*`)
    queries.push(`(${queryTitles.join(' OR ')})`)
  }

  if (excludedHandle) {
    queries.push(`(-handle:${excludedHandle})`)
  }

  if (excludedVendors.length) {
    queries.push(`(-vendor:${excludedVendors.map(v => `'${v.replace(/'/g, "\\'")}'`).join(' OR ')})`)
  }

  if (allCurrentIds.length) {
    const queryIds = allCurrentIds.map(id => `-id:${id.toString().split('/').pop()}`)
    queries.push(`(${queryIds.join(' AND ')})`)
  }

  const remainingProducts
    = (
      await apiClient.getProducts(
        {
          first: allCurrentIds.length ? remainingLimit : SHOPIFY_ITEMS_LIMITATION,
          moreConditions: queries.join(' AND '),
          status: [PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE, PRODUCT_STATUS_TYPE_FORMATTED.DRAFT],
        },
        productFields
      )
    )?.productsList || []

  const remainingProductsFiltered = remainingProducts
    .filter((p: any) => !checkIfAllVariantsIntegrated(p, productVariantsIntegrated))
    .slice(0, remainingLimit) // Limit the number of products to fetch

  sources.remaining = await formatters.shopify(remainingProductsFiltered || [])
}

async function fetchPrintifyProducts(
  sources: ProductSources,
  limit: number,
  printifyParams: any,
  formatters: ProductFormatters
): Promise<void> {
  const queryParams = [
    `tags[]=${encodeURIComponent(printifyParams.topLevelTag || 'Bestsellers')}`,
    ...(printifyParams.subLevelTag ? [`tags[]=${encodeURIComponent(printifyParams.subLevelTag)}`] : []),
    'show_other_target_markets=true',
    'show_other_sales_channels=true',
    'target_market=USA',
    'sort[popularity]=desc',
    'offset=0',
  ]

  const printifyProducts = await queryProductsFromPrintify({
    limit,
    params: queryParams,
  })

  const printifyProviderInformation = await Provider.findOne({ name: EPROVIDER.PRINTIFY })
  const printifyProviderId = printifyProviderInformation?._id
  sources.printify = await formatters.printify(printifyProducts.data || [], printifyProviderId)
}

// function getTotalShopifyProducts(sources: ProductSources): number {
//   return sources.topSelling.length + sources.remaining.length + sources.additional.length
// }

function combineProductSources(sources: ProductSources): ITopSellingProductsResult[] {
  return [...sources.topSelling, ...sources.remaining, ...sources.additional, ...sources.printify]
}

function createSuccessResponse(items: ITopSellingProductsResult[], metadata?: any) {
  return json({
    success: true,
    items,
    meta: {
      total: items.length,
      ...(metadata || {}),
    },
  })
}

function createErrorResponse(error: any, status: number = 500) {
  return json(
    {
      success: false,
      error: 'Failed to fetch products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    },
    { status }
  )
}

// Optimized top selling products function
async function getTopSellingProductsOptimized(
  limit: number,
  apiClient: ShopifyApiClient,
  shopDomain: string
): Promise<Response> {
  try {
    const formatters = await createProductFormatters()

    // Step 1: Get initial top selling products
    const productSources: ProductSources = {
      topSelling: [],
      remaining: [],
      additional: [],
      printify: [],
    }

    // Get top selling products first
    const topSellingProducts = await apiClient.getTopSellingProducts({ limit, onlyTopSelling: true })
    productSources.topSelling = await formatters.shopify(topSellingProducts)

    // Early return if we have enough products
    if (productSources.topSelling.length >= limit) {
      return createSuccessResponse(productSources.topSelling.slice(0, limit))
    }

    // Step 2: Initialize AI assistant and get suggestions in parallel
    const assistant = createAIAssistant()
    const remainingLimit = limit - productSources.topSelling.length

    // Step 3: Get AI suggestions in parallel
    const [productSuggestion, printifyParams] = await Promise.all([
      getProductTitleClassification(assistant, productSources.topSelling),
      // TODO: Temporarily disable Printify products
      Promise.resolve({ topLevelTag: '', subLevelTag: '' }), // getPrintifyParamsForRecommendation(productSources.topSelling, assistant),
    ])

    // Step 4: Fetch remaining Shopify products with multiple strategies
    // - First: search with AI suggestion
    // - Second: search with NOT condition to avoid duplicates
    // - Third: final attempt with empty search (original logic fallback)
    await fetchRemainingShopifyProducts(
      productSources,
      remainingLimit,
      productSuggestion.suggestedTitles,
      formatters,
      apiClient,
      shopDomain
    )

    // Step 5: Get Printify products if still needed
    // TODO: Temporarily disable Printify products
    const finalRemainingLimit = 0 // limit - getTotalShopifyProducts(productSources)

    if (finalRemainingLimit > 0) {
      await fetchPrintifyProducts(productSources, finalRemainingLimit, printifyParams, formatters)
    }

    // Step 6: Combine and return results
    const allProducts = combineProductSources(productSources)
    return createSuccessResponse(allProducts.slice(0, limit), {
      topSelling: {
        items: productSources.topSelling,
      },
      ...(productSources.remaining.length
        ? {
            remaining: {
              items: productSources.remaining,
              productSuggestion,
            },
          }
        : {}),
      ...(productSources.printify.length
        ? {
            printify: {
              items: productSources.printify,
              reasoning: `Printify products suggested: ${printifyParams.topLevelTag} ${printifyParams.subLevelTag}`,
            },
          }
        : {}),
    })
  } catch (error) {
    console.error('Error fetching top selling products:', error)
    return createErrorResponse(error)
  }
}
