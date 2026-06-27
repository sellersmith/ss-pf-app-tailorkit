import { EPROVIDER } from '~/constants/fulfillment-providers'
import type { ProviderDocument } from '~/models/Provider'
import type { ShopifyProduct } from '~/shopify/graphql/types'
import { formatOptionDisplayPricing } from '~/utils/exchange-rates/client'

/* eslint-disable max-len */
export interface ProductAnalysisData {
  shopDomain: string
  caseType: 1 | 2
  hasTopProduct: boolean
  topProduct: {
    title: string
    price: string
    variants: string[]
    /** GraphQL global product ID */
    productId?: string
    /** Up to three variant GraphQL IDs for the product */
    variantIds?: string[]
    source?: 'shopify' | EPROVIDER
  } | null
  analysisContext: 'existing_products' | 'new_store'
}

export interface ProductCardData {
  cardId: string
  rawProduct: ProductCardData
  title: string
  provider?: ProviderDocument | null
  badge?: {
    text: string
    type?: 'info' | 'success' | 'warning'
  }
  price: string
  variants: string[]
  /** GraphQL global product ID */
  productId?: string
  /** Up to three variant GraphQL IDs for the product */
  variantIds?: string[]
  personalizationStyle: string
  mockupImage: {
    url: string
    alt: string
  }
  ctaButton: {
    text: string
    enabled: boolean
  }
  case: 1 | 2
  clipart?: {
    templateId?: string
    url: string
    alt: string
    position: {
      x: number
      y: number
    }
    dimensions: {
      width: number
      height: number
    }
    rotation: number
    reasoning?: string
    /** True when recommendation fell back to a random library clipart */
    isFallback?: boolean
  }
  printifyProduct?: any
  callToActions?: {
    id: string
    text: string
    action: string
    enabled: boolean
  }[]
}

/**
 * Service responsible for building context and formatting data for AI responses
 */
export class ContextBuilder {
  /**
   * Generate product analysis data
   */
  generateProductAnalysis(
    shopData: any,
    caseType: 1 | 2,
    topProduct?: any,
    productSource: 'shopify' | EPROVIDER = 'shopify'
  ): ProductAnalysisData {
    return {
      shopDomain: shopData?.shopDomain || 'your store',
      caseType,
      hasTopProduct: !!topProduct,
      topProduct: topProduct
        ? {
            title: topProduct.title,
            price: this.getProductPrice(topProduct),
            variants: this.extractVariantsFromProduct(topProduct),
            productId: topProduct?.id,
            variantIds: this.extractVariantIdsFromProduct(topProduct),
            source: productSource,
          }
        : null,
      analysisContext: caseType === 1 ? 'existing_products' : 'new_store',
    }
  }

  /**
   * Build product context for AI
   */
  buildProductContext(
    analysisData: ProductAnalysisData,
    cardId: string,
    includeCardId: boolean,
    searchQuery?: string,
    productSource: 'shopify' | EPROVIDER = 'shopify',
    matchedSearch?: boolean
  ): string {
    const searchContext = searchQuery ? `\nUser Search Intent: "${searchQuery}"` : ''
    const sourceContext
      = productSource === EPROVIDER.PRINTIFY
        ? '\nProduct Source: Recommended from Printify catalog (ideal for print-on-demand)'
        : '\nProduct Source: From your existing Shopify store'

    return `STORE ANALYSIS DATA:
Shop Domain: ${analysisData.shopDomain}
Case Type: ${analysisData.caseType} (${analysisData.analysisContext})
Has Products: ${analysisData.hasTopProduct}
${analysisData.topProduct ? `Selected Product: "${analysisData.topProduct.title}" - ${analysisData.topProduct.price}` : 'No existing products'}${searchContext}${sourceContext}

Based on this data, generate a natural analysis response${includeCardId ? ', then create a product recommendation using: [PRODUCT_CARD:unique_id] (Product Name)' : `, then create a product recommendation using format: [PRODUCT_CARD:${cardId}] (${analysisData.topProduct?.title || 'Personalized Product'})`}

${
  productSource === EPROVIDER.PRINTIFY
    ? searchQuery
      ? `I couldn't find "${searchQuery}" in the Shopify catalog, so I'm suggesting a suitable print-on-demand option from our catalog that matches the store's focus.`
      : `I'm suggesting a suitable print-on-demand option from our catalog that matches the store's focus.`
    : matchedSearch === false && searchQuery
      ? `I couldn't find "${searchQuery}" in the Shopify catalog, so I used a closely related product as a base for the recommendation.`
      : ''
}

Do NOT include any PRODUCT_DATA or JSON in your response. Just natural text + the product card marker.`
  }

  /**
   * Build a standardized, concise notice to inform users that a fallback clipart was used.
   * Keeps messaging consistent and centralized.
   */
  buildClipartFallbackNotice(args: { requestedStyle?: string | null; userQuery?: string }): string {
    const { requestedStyle, userQuery } = args
    const target = (requestedStyle && requestedStyle.trim()) || (userQuery && userQuery.trim()) || 'your request'
    return `\nI couldn't find a clipart that exactly matches ${target}, so I selected a suitable alternative from our library to get you started.`
  }

  /**
   * Build a standardized notice when the requested product wasn't found in the Shopify catalog
   * and we fell back to another source or a related product.
   */
  buildProductFallbackNotice(args: {
    searchQuery?: string
    productSource: 'shopify' | EPROVIDER
    fallbackTitle?: string
  }): string {
    const { searchQuery, productSource, fallbackTitle } = args
    const wanted = searchQuery && searchQuery.trim() ? `"${searchQuery.trim()}"` : 'your requested product'

    if (productSource === EPROVIDER.PRINTIFY) {
      return `\nI couldn't find ${wanted} in your Shopify catalog, so I've suggested a Printify option that fits your brand.`
    }

    return `\nI couldn't find ${wanted} in your Shopify catalog, so I used ${fallbackTitle ? `"${fallbackTitle}"` : 'a related top product'} as a starting point.`
  }

  /**
   * Build product card data
   */
  buildProductCardData(
    cardId: string,
    analysisData: ProductAnalysisData,
    topProduct: any,
    caseType: 1 | 2,
    provider?: ProviderDocument | null,
    userStyle?: string | null
  ): ProductCardData {
    const isPrintifyProduct = analysisData.topProduct?.source === EPROVIDER.PRINTIFY

    return {
      cardId,
      rawProduct: topProduct,
      ...(analysisData.topProduct?.source && analysisData.topProduct?.source !== 'shopify'
        ? {
            provider: analysisData.topProduct?.source,
            badge: {
              text: analysisData.topProduct?.source,
              type: 'info',
            },
          }
        : undefined),
      title: analysisData.topProduct?.title || 'Personalized Product',
      price: analysisData.topProduct?.price || '$29.99',
      variants: analysisData.topProduct?.variants || ['Custom Text', 'Custom Colors', 'Custom Design'],
      productId: analysisData.topProduct?.productId,
      variantIds: analysisData.topProduct?.variantIds,
      personalizationStyle:
        userStyle
        || (isPrintifyProduct
          ? `This print-on-demand product from our catalog is perfect for your store. Customers can add custom text, images, or designs to create personalized items.`
          : analysisData.topProduct
            ? `Based on your popular "${analysisData.topProduct.title}" product, this personalized version allows customers to add custom text, images, or designs.`
            : 'Create your first personalized product with custom text, images, or designs.'),
      mockupImage: {
        url: topProduct?.featuredImage?.url || '/assets/product-placeholder.jpg',
        alt: analysisData.topProduct?.title || 'Product',
      },
      ctaButton: {
        text: 'edit-product',
        enabled: true,
      },
      case: caseType,
      provider: provider,
      callToActions: isPrintifyProduct
        ? undefined
        : [
            {
              id: 'publish-product',
              text: 'publish-as-new-product',
              action: 'publish_as_new_product',
              enabled: true,
            },
            {
              id: 'edit-product',
              text: 'edit-as-new-product',
              action: 'edit_as_new_product',
              enabled: true,
            },
          ],
    }
  }

  /**
   * Extract price from product with personalization markup
   */
  private getProductPrice(product: ShopifyProduct): string {
    if (product.priceRangeV2?.minVariantPrice?.amount) {
      const basePrice = parseFloat(product.priceRangeV2.minVariantPrice.amount)
      const personalizedPrice = formatOptionDisplayPricing(
        { value: basePrice, flatRate: basePrice },
        product.priceRangeV2.minVariantPrice.currencyCode,
        false
      )

      return personalizedPrice
    }

    const variants = product.variants as any
    // In case is temporary for Printify product
    if (variants?.edges?.[0]?.node?.price) {
      const basePrice = parseFloat(variants.edges[0].node.price)
      const personalizedPrice = basePrice.toFixed(2)
      return `$${personalizedPrice}`
    }

    // Fallback to default price
    return '$29.99'
  }

  /**
   * Extract variant information from product
   */
  private extractVariantsFromProduct(product: any): string[] {
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

  /**
   * Extract variant IDs from product (first 3 for brevity)
   */
  private extractVariantIdsFromProduct(product: any): string[] {
    const variantIds: string[] = []

    if (product.variants?.edges && product.variants.edges.length > 0) {
      const ids = product.variants.edges.map((edge: any) => edge.node?.id).filter((id: string) => !!id)

      variantIds.push(...ids)
    }

    return variantIds
  }
}
