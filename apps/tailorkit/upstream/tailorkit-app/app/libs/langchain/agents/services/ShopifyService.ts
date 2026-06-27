import type { EPROVIDER } from '~/constants/fulfillment-providers'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import type { ShopInfo } from '~/shopify/graphql/types'

/**
 * Service responsible for all Shopify-related operations
 */
export class ShopifyService {
  private shopifyApi: ShopifyApiClient | null = null

  constructor(shopifyAdmin?: any, shopDomain?: string, accessToken?: string) {
    if (shopifyAdmin && shopDomain && accessToken) {
      this.shopifyApi = new ShopifyApiClient(shopifyAdmin, { shopDomain, accessToken })
    }
  }

  /**
   * Check if Shopify API is available
   */
  get isAvailable(): boolean {
    return !!this.shopifyApi
  }

  /**
   * Fetch any one product from Shopify (best-effort) to use as a representative product
   */
  async getAnyProduct(): Promise<any | null> {
    try {
      if (!this.shopifyApi) {
        return null
      }

      const { productsList } = await this.shopifyApi.getProducts({ first: 1 })
      if (Array.isArray(productsList) && productsList.length > 0) {
        const first = productsList[0]
        try {
          const detailed = await this.shopifyApi.getDetailedProductInfo(first.id)
          return { ...first, ...detailed, source: 'shopify' }
        } catch (error) {
          console.log('Using basic first product data:', error)
          return { ...first, source: 'shopify' }
        }
      }
      return null
    } catch (error) {
      console.warn('Failed to fetch any product via Shopify API:', error)
      return null
    }
  }

  /**
   * Fetch products by search query
   */
  async fetchProductByQuery(
    searchQuery?: string
  ): Promise<{ topProduct: any; hasProducts: boolean; productSource: 'shopify' | EPROVIDER; matchedSearch: boolean }> {
    try {
      if (!this.shopifyApi) {
        return { topProduct: null, hasProducts: false, productSource: 'shopify', matchedSearch: false }
      }

      // First, try to find products by search query
      if (searchQuery && searchQuery.trim()) {
        console.log(`Searching Shopify for specific product: "${searchQuery}"`)

        const { productsList } = await this.shopifyApi.getProducts({
          search: searchQuery,
          first: 3,
        })

        if (productsList && productsList.length > 0) {
          const bestMatch = productsList[0]

          try {
            const detailedProduct = await this.shopifyApi.getDetailedProductInfo(bestMatch.id)
            return {
              topProduct: { ...bestMatch, ...detailedProduct, source: 'shopify' },
              hasProducts: true,
              productSource: 'shopify',
              matchedSearch: true,
            }
          } catch (error) {
            console.log('Using basic product data:', error)
            return {
              topProduct: { ...bestMatch, source: 'shopify' },
              hasProducts: true,
              productSource: 'shopify',
              matchedSearch: true,
            }
          }
        }
      }

      // Try to get top selling product from Shopify
      const [topProduct] = await this.shopifyApi.getTopSellingProducts({ limit: 1 })

      if (topProduct) {
        console.log('Found top Shopify product:', topProduct.title)

        try {
          const detailedProduct = await this.shopifyApi.getDetailedProductInfo(topProduct.id)
          return {
            topProduct: { ...topProduct, ...detailedProduct, source: 'shopify' },
            hasProducts: true,
            productSource: 'shopify',
            matchedSearch: false,
          }
        } catch (error) {
          console.log('Using basic top product data:', error)
          return {
            topProduct: { ...topProduct, source: 'shopify' },
            hasProducts: true,
            productSource: 'shopify',
            matchedSearch: false,
          }
        }
      }

      return { topProduct: null, hasProducts: false, productSource: 'shopify', matchedSearch: false }
    } catch (error) {
      console.error('Error fetching Shopify product:', error)
      return { topProduct: null, hasProducts: false, productSource: 'shopify', matchedSearch: false }
    }
  }

  /**
   * Get shop information including description
   */
  async getShopInfo(): Promise<ShopInfo | null> {
    try {
      if (!this.shopifyApi) {
        return null
      }

      return await this.shopifyApi.getShopInfo()
    } catch (error) {
      console.warn('Failed to fetch shop info from Shopify:', error)
      return null
    }
  }

  /**
   * Combine shop context from various sources
   */
  combineShopContext(shopData: any, shopInfo: ShopInfo | null): string {
    const shopDescription = shopInfo?.description || shopData?.shopDescription || ''
    const shopName = shopData?.shopName || ''

    return [shopDescription, shopName].filter(desc => desc && desc.trim().length > 0).join(' ')
  }

  /**
   * Extract price from product data
   */
  getProductPrice(product: any): string {
    if (product.priceRange?.minVariantPrice?.amount) {
      const basePrice = parseFloat(product.priceRange.minVariantPrice.amount)
      const personalizedPrice = (basePrice * 1.3).toFixed(2)
      return `$${personalizedPrice}`
    }
    if (product.variants?.edges?.[0]?.node?.price) {
      const basePrice = parseFloat(product.variants.edges[0].node.price)
      const personalizedPrice = (basePrice * 1.3).toFixed(2)
      return `$${personalizedPrice}`
    }
    return '$29.99'
  }

  /**
   * Extract variant information from product
   */
  extractVariantsFromProduct(product: any): string[] {
    const variants = []

    if (product.variants?.edges && product.variants.edges.length > 0) {
      const variantTitles = product.variants.edges
        .map((edge: any) => edge.node?.title)
        .filter((title: string) => title && title !== 'Default Title')

      if (variantTitles.length > 0) {
        variants.push(...variantTitles)
      } else {
        variants.push('Custom Text', 'Custom Colors', 'Custom Design')
      }
    } else {
      variants.push('Add Your Text', 'Upload Your Image', 'Choose Your Colors')
    }

    return variants
  }
}
