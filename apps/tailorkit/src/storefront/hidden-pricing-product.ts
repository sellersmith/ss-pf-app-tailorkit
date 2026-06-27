export const DEFAULT_TAILORKIT_HIDDEN_PRICING_PRODUCT_HANDLE = 'tailorkit-item-personalization'
export const TAILORKIT_OPTION_COST_AMOUNT_PROPERTY = '_TLK Option Cost - Amount'

export interface TailorKitHiddenPricingVariant {
  id: number | string
  title?: string
  price: number
  available: boolean
}

export interface TailorKitHiddenPricingProduct {
  id: number | string
  handle: string
  title: string
  variants: TailorKitHiddenPricingVariant[]
}

export interface TailorKitHiddenPricingCartItem {
  id: number | string
  quantity: number
  properties: Record<string, string>
}

export interface TailorKitHiddenPricingCartItemInput {
  hiddenProduct: TailorKitHiddenPricingProduct
  additionalCost: number
  mainProductQuantity: number
  productName: string
  propertyPrefix: string
  refId: string
}

export interface TailorKitHiddenPricingFetchResponse {
  ok: boolean
  status: number
  statusText?: string
  json: () => Promise<TailorKitHiddenPricingProduct>
}

export type TailorKitHiddenPricingFetcher = (url: string) => Promise<TailorKitHiddenPricingFetchResponse>

export interface TailorKitHiddenPricingProductCacheOptions {
  fetcher?: TailorKitHiddenPricingFetcher
  handle?: string
  ttlMs?: number
}

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000

function defaultFetcher(): TailorKitHiddenPricingFetcher {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[TailorKit] Hidden pricing product cache requires a fetch implementation.')
  }

  return globalThis.fetch as TailorKitHiddenPricingFetcher
}

function normalizeStorefrontProduct(product: TailorKitHiddenPricingProduct): TailorKitHiddenPricingProduct {
  return {
    ...product,
    variants: (product.variants || []).map(variant => ({
      ...variant,
      price: variant.price / 100,
    })),
  }
}

export function calculateTailorKitHiddenPricingQuantity(
  additionalCost: number,
  hiddenProductUnitPrice: number,
  mainProductQuantity = 1
): number {
  if (additionalCost <= 0 || hiddenProductUnitPrice <= 0 || mainProductQuantity <= 0) return 0

  return Math.round(additionalCost / hiddenProductUnitPrice) * mainProductQuantity
}

export function buildTailorKitHiddenPricingCartItem(
  input: TailorKitHiddenPricingCartItemInput
): TailorKitHiddenPricingCartItem | null {
  const variant = input.hiddenProduct.variants.find(item => item.available)
  if (!variant) return null

  const quantity = calculateTailorKitHiddenPricingQuantity(
    input.additionalCost,
    variant.price,
    input.mainProductQuantity
  )
  if (quantity <= 0) return null

  return {
    id: variant.id,
    quantity,
    properties: {
      'For Product': input.productName,
      [input.propertyPrefix]: input.propertyPrefix,
      [TAILORKIT_OPTION_COST_AMOUNT_PROPERTY]: input.additionalCost.toFixed(2),
      [`${input.propertyPrefix}_ref_id`]: input.refId,
      [`${input.propertyPrefix}_hidden`]: 'true',
    },
  }
}

export function createTailorKitHiddenPricingProductCache(
  options: TailorKitHiddenPricingProductCacheOptions = {}
) {
  const fetcher = options.fetcher || defaultFetcher()
  const handle = options.handle || DEFAULT_TAILORKIT_HIDDEN_PRICING_PRODUCT_HANDLE
  const ttlMs = options.ttlMs || DEFAULT_CACHE_TTL_MS
  let product: TailorKitHiddenPricingProduct | null = null
  let fetchedAt = 0

  async function fetchProduct(): Promise<TailorKitHiddenPricingProduct | null> {
    const response = await fetcher(`/products/${handle}.js`)
    if (!response.ok) {
      throw new Error(`[TailorKit] Hidden pricing product fetch failed: ${response.status} ${response.statusText || ''}`)
    }

    const nextProduct = normalizeStorefrontProduct(await response.json())
    product = nextProduct
    fetchedAt = Date.now()

    return product
  }

  return {
    async get(): Promise<TailorKitHiddenPricingProduct | null> {
      if (!product || Date.now() - fetchedAt > ttlMs) {
        return fetchProduct()
      }

      return product
    },
    clear() {
      product = null
      fetchedAt = 0
    },
  }
}
