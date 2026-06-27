import { APP_PROXY_PATH, ONE_MINUTE_IN_MILLISECONDS } from '../constants'

export type LiveDataSource = 'liquid' | 'ajax' | 'storefront'

export type LiveProductSnapshot = {
  productId: string
  title: string
  available: boolean
  priceCents: number
  currencyCode: string
  imageUrl?: string
  variantId?: string
  source: LiveDataSource
}

export type LiveDataResult = {
  dataByProductId: Record<string, LiveProductSnapshot>
  sourcesByProductId: Record<string, Partial<Record<LiveDataSource, LiveProductSnapshot>>>
  fetchedAt: number
}

export type LiveDataAdapterConfig = {
  storefrontAccessToken?: string
  shopDomain?: string
  ttlMs?: number
  liquidProduct?: any
  appProxyPath?: string
}

export class LiveDataAdapter {
  private storefrontAccessToken?: string
  private shopDomain?: string
  private ttlMs: number
  private liquidProduct?: any
  private appProxyPath: string
  private abortController: AbortController | null = null

  lastUpdatedAt: number = 0
  updating: boolean = false

  constructor(config: LiveDataAdapterConfig) {
    this.storefrontAccessToken = config.storefrontAccessToken
    this.shopDomain = config.shopDomain
    this.ttlMs = config.ttlMs ?? ONE_MINUTE_IN_MILLISECONDS
    this.liquidProduct = config.liquidProduct
    this.appProxyPath = config.appProxyPath || APP_PROXY_PATH
  }

  setLiquidProduct(product: any) {
    this.liquidProduct = product
  }

  getTtlMs(): number {
    return this.ttlMs
  }

  isStale(): boolean {
    if (!this.lastUpdatedAt) return true
    return Date.now() - this.lastUpdatedAt > this.ttlMs
  }

  async refresh(params: {
    productIds: string[]
    handlesById?: Record<string, string>
    variantIdByProductId?: Record<string, string | undefined>
  }): Promise<LiveDataResult> {
    const { productIds, handlesById = {}, variantIdByProductId = {} } = params

    if (this.abortController) {
      this.abortController.abort()
    }

    this.abortController = new AbortController()
    const signal = this.abortController.signal

    this.updating = true

    try {
      const [liquidSnapshots, ajaxSnapshots, storefrontSnapshots] = await Promise.all([
        Promise.resolve(this.buildLiquidSnapshots(productIds, variantIdByProductId)),
        this.fetchAjaxSnapshots(handlesById, variantIdByProductId, signal),
        this.fetchStorefrontSnapshots(productIds, variantIdByProductId, signal),
      ])

      const sourcesByProductId: LiveDataResult['sourcesByProductId'] = {}
      const dataByProductId: LiveDataResult['dataByProductId'] = {}

      productIds.forEach(productId => {
        const sources: Partial<Record<LiveDataSource, LiveProductSnapshot>> = {}
        if (liquidSnapshots[productId]) sources.liquid = liquidSnapshots[productId]
        if (ajaxSnapshots[productId]) sources.ajax = ajaxSnapshots[productId]
        if (storefrontSnapshots[productId]) sources.storefront = storefrontSnapshots[productId]

        sourcesByProductId[productId] = sources
        const chosen = this.pickSourceSnapshot(sources)
        if (chosen) {
          dataByProductId[productId] = chosen
        }
      })

      this.detectMismatches(sourcesByProductId)

      this.lastUpdatedAt = Date.now()

      return {
        dataByProductId,
        sourcesByProductId,
        fetchedAt: this.lastUpdatedAt,
      }
    } finally {
      this.updating = false
    }
  }

  private pickSourceSnapshot(sources: Partial<Record<LiveDataSource, LiveProductSnapshot>>) {
    return sources.liquid || sources.ajax || sources.storefront || null
  }

  private buildLiquidSnapshots(productIds: string[], variantIdByProductId: Record<string, string | undefined>) {
    const snapshots: Record<string, LiveProductSnapshot> = {}
    if (!this.liquidProduct) return snapshots

    const productId = String(this.liquidProduct.id || '')
    if (!productId || !productIds.includes(productId)) return snapshots

    const selectedVariantId = variantIdByProductId[productId]
    const variant = this.pickVariantFromLiquid(this.liquidProduct, selectedVariantId)
    const priceCents = variant?.price || this.liquidProduct.price || 0

    snapshots[productId] = {
      productId,
      title: this.liquidProduct.title || 'Charm',
      available: Boolean(variant?.available ?? this.liquidProduct.available),
      priceCents: Number(priceCents) || 0,
      currencyCode: this.liquidProduct.currency || this.liquidProduct.currencyCode || 'USD',
      imageUrl: variant?.featured_image?.src || this.liquidProduct.featured_image || undefined,
      variantId: variant?.id ? String(variant.id) : undefined,
      source: 'liquid',
    }

    return snapshots
  }

  private pickVariantFromLiquid(product: any, selectedVariantId?: string) {
    if (!product?.variants?.length) return null

    if (selectedVariantId) {
      const match = product.variants.find((variant: any) => String(variant.id) === String(selectedVariantId))
      if (match) return match
    }

    return product.variants.find((variant: any) => variant.available) || product.variants[0]
  }

  private async fetchAjaxSnapshots(
    handlesById: Record<string, string>,
    variantIdByProductId: Record<string, string | undefined>,
    signal: AbortSignal
  ): Promise<Record<string, LiveProductSnapshot>> {
    const entries = Object.entries(handlesById).filter(([, handle]) => Boolean(handle))
    if (!entries.length) return {}

    const snapshots: Record<string, LiveProductSnapshot> = {}

    await Promise.all(
      entries.map(async ([productId, handle]) => {
        try {
          const response = await fetch(`/products/${handle}.js`, { signal })
          if (!response.ok) return
          const product = await response.json()
          const selectedVariantId = variantIdByProductId[productId]
          const variant = this.pickVariantFromAjax(product, selectedVariantId)
          const priceCents = Number(variant?.price || product.price || 0)

          snapshots[String(productId)] = {
            productId: String(productId),
            title: product.title || 'Charm',
            available: Boolean(variant?.available ?? product.available),
            priceCents,
            currencyCode: product.currency || 'USD',
            imageUrl: variant?.featured_image?.src || product.featured_image || undefined,
            variantId: variant?.id ? String(variant.id) : undefined,
            source: 'ajax',
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.warn('[TailorKit] Failed to fetch product via AJAX', error)
          }
        }
      })
    )

    return snapshots
  }

  private pickVariantFromAjax(product: any, selectedVariantId?: string) {
    if (!product?.variants?.length) return null

    if (selectedVariantId) {
      const match = product.variants.find((variant: any) => String(variant.id) === String(selectedVariantId))
      if (match) return match
    }

    return product.variants.find((variant: any) => variant.available) || product.variants[0]
  }

  private normalizeProductGid(productId: string) {
    if (!productId) return productId
    if (productId.startsWith('gid://')) return productId
    return `gid://shopify/Product/${productId}`
  }

  private async fetchStorefrontSnapshots(
    productIds: string[],
    variantIdByProductId: Record<string, string | undefined>,
    signal: AbortSignal
  ): Promise<Record<string, LiveProductSnapshot>> {
    if (!this.storefrontAccessToken || !productIds.length) return {}

    const shopDomain
      = this.shopDomain || window?.Shopify?.shop || window?.Shopify?.shop_domain || window.location.hostname
    const originalIdByGid: Record<string, string> = {}
    const normalizedIds = productIds.reduce<string[]>((acc, originalId) => {
      const gid = this.normalizeProductGid(originalId)
      if (gid) {
        acc.push(gid)
        originalIdByGid[gid] = originalId
      }
      return acc
    }, [])

    try {
      const response = await fetch(`https://${shopDomain}/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.storefrontAccessToken,
        },
        body: JSON.stringify({
          // eslint-disable-next-line max-len
          query: `query TailorKitCharmProducts($ids: [ID!]!) {\n  nodes(ids: $ids) {\n    ... on Product {\n      id\n      title\n      handle\n      availableForSale\n      featuredImage { url }\n      variants(first: 50) {\n        nodes {\n          id\n          availableForSale\n          price { amount currencyCode }\n        }\n      }\n      priceRange {\n        minVariantPrice { amount currencyCode }\n      }\n    }\n  }\n}`,
          variables: { ids: normalizedIds },
        }),
        signal,
      })

      if (!response.ok) return {}

      const payload = await response.json()
      const nodes = payload?.data?.nodes || []
      const snapshots: Record<string, LiveProductSnapshot> = {}

      nodes.forEach((node: any) => {
        if (!node?.id) return
        const originalId = originalIdByGid[node.id] || node.id
        const selectedVariantId = variantIdByProductId[originalId]
        const variant = this.pickVariantFromStorefront(node, selectedVariantId)
        const priceAmount = variant?.price?.amount || node?.priceRange?.minVariantPrice?.amount || '0'
        const currencyCode = variant?.price?.currencyCode || node?.priceRange?.minVariantPrice?.currencyCode || 'USD'

        snapshots[String(originalId)] = {
          productId: String(originalId),
          title: node.title || 'Charm',
          available: Boolean(variant?.availableForSale ?? node.availableForSale),
          priceCents: Math.round(parseFloat(priceAmount) * 100),
          currencyCode,
          imageUrl: node?.featuredImage?.url || undefined,
          variantId: variant?.id ? String(variant.id) : undefined,
          source: 'storefront',
        }
      })

      return snapshots
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('[TailorKit] Failed to fetch product via Storefront API', error)
      }
      return {}
    }
  }

  private pickVariantFromStorefront(product: any, selectedVariantId?: string) {
    const variants = product?.variants?.nodes || []
    if (!variants.length) return null

    if (selectedVariantId) {
      const match = variants.find((variant: any) => String(variant.id) === String(selectedVariantId))
      if (match) return match
    }

    return variants.find((variant: any) => variant.availableForSale) || variants[0]
  }

  private detectMismatches(sourcesByProductId: LiveDataResult['sourcesByProductId']) {
    Object.entries(sourcesByProductId).forEach(([productId, sources]) => {
      const values = Object.values(sources).filter(Boolean)
      if (values.length < 2) return

      const [base, ...rest] = values
      const mismatch = rest.some(next => {
        return base?.available !== next?.available || Math.abs(base.priceCents - next.priceCents) > 1
      })

      if (mismatch) {
        this.logIncident('mismatch', {
          productId,
          sources: values.map(entry => ({
            source: entry.source,
            available: entry.available,
            priceCents: entry.priceCents,
          })),
        })
      }
    })
  }

  logIncident(type: 'mismatch' | 'stale', payload: Record<string, any>) {
    const endpoint = `${this.appProxyPath}/app_proxy/storefront/charm-live-metrics`

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, occurredAt: new Date().toISOString() }),
    }).catch(error => {
      console.warn('[TailorKit] Failed to log charm incident', error)
    })
  }
}
