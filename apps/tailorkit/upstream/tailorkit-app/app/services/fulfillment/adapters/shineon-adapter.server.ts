/**
 * ShineOn fulfillment adapter implementing IFulfillmentProvider.
 * Wraps the @sellersmith/shineon-sdk and existing service functions, normalizing
 * all inputs/outputs to the shared fulfillment types.
 */
import type {
  IFulfillmentProvider,
  ProviderCapabilities,
  NormalizedProduct,
  NormalizedProductDetails,
  NormalizedOrder,
  ListProductsParams,
  SubmitOrderArgs,
  FulfillOrderArgs,
  EngravingConfig,
  RenderParams,
  PrepareFulfillmentDataArgs,
  PrepareVariantMetafieldArgs,
  TransformForSubmissionArgs,
} from '~/services/fulfillment/types'
import type { ShineOnMapping } from '~/modules/Fulfillments/ShineOn/types'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { ShineOn } from '@sellersmith/shineon-sdk'
import { checkShineOnConnection } from '~/services/shineon/connection-health.server'
import { fulfillShineOnOrder } from '~/services/shineon/fulfill-shineon-order.server'
import { buildPersonalizationPayload } from '~/services/shineon/build-personalization-payload.server'
import {
  mapShineOnProduct,
  mapShineOnProductDetails,
  mapShineOnOrder,
  mapShineOnErrorToProviderError,
} from './shineon-mappers.server'

export class ShineOnAdapter implements IFulfillmentProvider {
  readonly name = EPROVIDER.SHINEON

  readonly capabilities: ProviderCapabilities = {
    hasBlueprintCatalog: false,
    hasPrintProviderSelection: false,
    hasEngravingMapping: true,
    hasVariantSelection: true,
    hasOrderTracking: true,
    hasWebhookSupport: true,
    hasRenderPreview: true,
    hasShippingCalculation: false,
    hasMultipleArtworkPositions: false,
    hasLocationBasedRouting: false,
  }

  async validateConnection(apiToken: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const result = await checkShineOnConnection(apiToken)
      return { valid: result.healthy, error: result.error }
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async listProducts(apiToken: string, _params?: ListProductsParams): Promise<NormalizedProduct[]> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.productTemplates.list()
      return response.product_templates.map(mapShineOnProduct)
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async getProductDetails(productId: string, apiToken: string): Promise<NormalizedProductDetails> {
    try {
      const sdk = this.createSdk(apiToken)
      const [template, skuResponse] = await Promise.all([sdk.productTemplates.get(productId), sdk.skus.list()])
      const productSkus = skuResponse.skus.filter(s => String(s.product_id) === String(productId))
      return mapShineOnProductDetails(template, productSkus)
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async submitOrder(args: SubmitOrderArgs): Promise<{ externalOrderId: string }> {
    try {
      const sdk = this.createSdk(args.apiToken)
      const shineOnLineItems = args.lineItems.map(item => ({
        store_line_item_id: item.variantExternalId,
        sku: item.variantExternalId,
        quantity: item.quantity,
        properties: item.personalization || {},
      }))
      const response = await sdk.orders.create({
        order: {
          source_id: args.externalId,
          shipment_notification_url: '',
          shipping_address: {
            name: `${args.shippingAddress.firstName} ${args.shippingAddress.lastName}`.trim(),
            country_code: args.shippingAddress.country,
            address1: args.shippingAddress.address1,
            address2: args.shippingAddress.address2 || '',
            city: args.shippingAddress.city,
            zip: args.shippingAddress.zip,
            phone: args.shippingAddress.phone || '',
          },
          email: args.shippingAddress.email || '',
          line_items: shineOnLineItems,
        },
      })
      return { externalOrderId: String(response.order.id) }
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async getOrder(externalOrderId: string, apiToken: string): Promise<NormalizedOrder> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.orders.get(externalOrderId)
      return mapShineOnOrder(response.order)
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async cancelOrder(externalOrderId: string, apiToken: string): Promise<boolean> {
    try {
      const sdk = this.createSdk(apiToken)
      await sdk.orders.cancel(externalOrderId)
      return true
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async fulfillOrder(args: FulfillOrderArgs): Promise<void> {
    try {
      await fulfillShineOnOrder({
        fulfillmentOrder: args.fulfillmentOrder,
        shopDomain: args.shopDomain,
        fulfillmentProvider: args.fulfillmentProvider,
      })
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async getEngravingConfig(productId: string, apiToken: string): Promise<EngravingConfig> {
    try {
      const sdk = this.createSdk(apiToken)
      const [template, skuResponse] = await Promise.all([sdk.productTemplates.get(productId), sdk.skus.list()])
      const productSkus = skuResponse.skus.filter(s => String(s.product_id) === String(productId))
      const details = mapShineOnProductDetails(template, productSkus)
      if (!details.engravingConfig) {
        return { engravingSiblingId: '', maxLines: 0, maxCharsPerLine: 0 }
      }
      return details.engravingConfig
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  async requestRender(params: RenderParams, apiToken: string): Promise<{ renderUrl: string }> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.renders.make(params.productId, {
        src: params.printFileUrl,
        ...params.options,
      })
      return { renderUrl: response.render.src }
    } catch (error) {
      throw mapShineOnErrorToProviderError(error)
    }
  }

  /**
   * Prepare the ShineOn-shaped variant metafield value written at product import time.
   * Stores provider name and SKU (ShineOn variant ID = SKU).
   */
  prepareVariantMetafield(args: PrepareVariantMetafieldArgs): Record<string, unknown> {
    return {
      provider: EPROVIDER.SHINEON,
      sku: args.variant.id, // ShineOn variant ID = SKU
    }
  }

  /**
   * Collects sku, customer properties, and print URL from rendered artwork.
   * Called at webhook order import time. Output is stored as `fulfillment_order_data`.
   */
  prepareFulfillmentData(args: PrepareFulfillmentDataArgs): Record<string, unknown> {
    const { sku, shineOnMapping } = args.variantMeta as {
      sku?: string
      shineOnMapping?: ShineOnMapping
    }
    const properties: Record<string, string> = {}

    // Collect customer properties from Shopify line item properties
    for (const [key, value] of Object.entries(args.customerProperties)) {
      if (key && value) {
        properties[key] = String(value)
      }
    }

    // Inject print URL from the first rendered artwork image
    const printImage = args.printImages[0]?.image
    if (printImage?.src) {
      properties['print_url'] = printImage.src
    }

    return { provider: EPROVIDER.SHINEON, sku, properties, shineOnMapping }
  }

  /**
   * Resolves stored fulfillment_order_data into the final ShineOn submission payload.
   * Applies ShineOnMapping to derive engraving lines, font, size, and print URL.
   * Falls back to raw properties for orders created before mapping was introduced.
   * Called at order submission time.
   */
  transformForSubmission(args: TransformForSubmissionArgs): Record<string, unknown> {
    const { sku, properties, shineOnMapping } = args.fulfillmentData as {
      sku?: string
      properties?: Record<string, string>
      shineOnMapping?: ShineOnMapping
    }

    // No mapping — pass raw properties (backward compat for orders before mapping existed)
    if (!shineOnMapping) {
      return { sku, properties: properties || {}, quantity: args.quantity }
    }

    // Resolve engraving lines, font, size, and print URL using the mapping
    const resolved = buildPersonalizationPayload(shineOnMapping, {
      layerTexts: properties || {},
      selectedFont: properties?.['_selectedFont'],
      selectedSize: properties?.['_selectedSize'],
      printUrl: properties?.['print_url'],
    })

    return { sku, properties: resolved, quantity: args.quantity }
  }

  private createSdk(apiToken: string): ShineOn {
    return new ShineOn({ token: apiToken })
  }
}
