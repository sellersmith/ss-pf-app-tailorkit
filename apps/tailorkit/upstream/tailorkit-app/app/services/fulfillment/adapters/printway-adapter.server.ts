/**
 * PrintWay fulfillment adapter implementing IFulfillmentProvider.
 * Wraps the @sellersmith/printway-sdk and PrintWay service functions, normalizing
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
  PrepareFulfillmentDataArgs,
  PrepareVariantMetafieldArgs,
  TransformForSubmissionArgs,
  ShippingCalcParams,
  ShippingRate,
} from '~/services/fulfillment/types'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { Printway } from '@sellersmith/printway-sdk'
import { checkPrintWayConnection } from '~/services/printway/connection-health.server'
import { fulfillPrintWayOrder } from '~/services/printway/fulfill-printway-order.server'
import { parsePrintWayTokens } from '~/services/printway/token-manager.server'
import {
  mapPrintWayProduct,
  mapPrintWayProductDetails,
  mapPrintWayOrder,
  mapPrintWayErrorToProviderError,
} from './printway-mappers.server'

/** Maps TailorKit print area names to PrintWay artwork field keys. */
const ARTWORK_POSITION_MAP: Record<string, string> = {
  front: 'artwork_front',
  back: 'artwork_back',
  left: 'artwork_left',
  right: 'artwork_right',
  hood: 'artwork_hood',
  sleeve_left: 'artwork_sleeve_left',
  sleeve_right: 'artwork_sleeve_right',
}

export class PrintWayAdapter implements IFulfillmentProvider {
  readonly name = EPROVIDER.PRINTWAY

  readonly capabilities: ProviderCapabilities = {
    hasBlueprintCatalog: false,
    hasPrintProviderSelection: false,
    hasEngravingMapping: false,
    hasVariantSelection: true,
    hasOrderTracking: true,
    hasWebhookSupport: true,
    hasRenderPreview: false,
    hasShippingCalculation: true,
    hasMultipleArtworkPositions: true,
    hasLocationBasedRouting: true,
  }

  async validateConnection(apiToken: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const result = await checkPrintWayConnection(apiToken)
      return { valid: result.healthy, error: result.error }
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async listProducts(apiToken: string, params?: ListProductsParams): Promise<NormalizedProduct[]> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.products.list({ page: params?.page, limit: params?.limit })
      return (response.data || []).map(mapPrintWayProduct)
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async getProductDetails(productId: string, apiToken: string): Promise<NormalizedProductDetails> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.products.detail(productId)
      return mapPrintWayProductDetails(response.data)
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async submitOrder(args: SubmitOrderArgs): Promise<{ externalOrderId: string }> {
    try {
      const sdk = this.createSdk(args.apiToken)
      const orderItems = args.lineItems.map(item => ({
        item_sku: item.variantExternalId,
        quantity: item.quantity,
        product_name: '',
        ...item.printFiles,
      }))

      const response = await sdk.orders.create({
        order_id: args.externalId,
        firstName: args.shippingAddress.firstName,
        lastName: args.shippingAddress.lastName,
        shipping_email: args.shippingAddress.email || '',
        shipping_phone: args.shippingAddress.phone || '',
        shipping_address1: args.shippingAddress.address1,
        shipping_city: args.shippingAddress.city,
        shipping_province: args.shippingAddress.region || '',
        shipping_province_code: '',
        shipping_zip: args.shippingAddress.zip,
        shipping_country: args.shippingAddress.country,
        shipping_country_code: args.shippingAddress.country,
        shipping_service: 'standard',
        order_items: orderItems,
      })
      const responseData = response as { data?: { pw_order_id?: string; order_name?: string } }
      const externalOrderId = responseData?.data?.pw_order_id || responseData?.data?.order_name || args.externalId
      if (!externalOrderId) throw new Error('PrintWay order creation returned no order ID')
      return { externalOrderId: String(externalOrderId) }
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async getOrder(externalOrderId: string, apiToken: string): Promise<NormalizedOrder> {
    try {
      const sdk = this.createSdk(apiToken)
      const response = await sdk.orders.detail({ pw_order_id: externalOrderId })
      return mapPrintWayOrder(response.data)
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async cancelOrder(externalOrderId: string, apiToken: string): Promise<boolean> {
    try {
      const sdk = this.createSdk(apiToken)
      await sdk.orders.cancel({ pw_order_id: externalOrderId })
      return true
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async fulfillOrder(args: FulfillOrderArgs): Promise<void> {
    try {
      await fulfillPrintWayOrder({
        fulfillmentOrder: args.fulfillmentOrder,
        shopDomain: args.shopDomain,
        fulfillmentProvider: args.fulfillmentProvider,
      })
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  async calculateShipping(params: ShippingCalcParams, apiToken: string): Promise<ShippingRate[]> {
    try {
      const sdk = this.createSdk(apiToken)
      const skus = params.lineItems.map(li => li.variantExternalId)
      interface ShippingMethod {
        name?: string
        cost?: number
      }
      const response: ShippingMethod[] = await (sdk.products as unknown as Record<string, Function>).getShippingMethods(
        { sku: skus }
      )
      return (response || []).map(method => ({
        type: method.name || 'standard',
        cost: method.cost || 0,
        currency: 'USD',
      }))
    } catch (error) {
      throw mapPrintWayErrorToProviderError(error)
    }
  }

  /**
   * Prepare the PrintWay-shaped variant metafield value written at product import time.
   * Stores provider name, SKU, and location metadata for fulfillment routing.
   */
  prepareVariantMetafield(args: PrepareVariantMetafieldArgs): Record<string, unknown> {
    const meta = (args.variant.metadata ?? {}) as Record<string, unknown>
    const locations = meta.locations as Array<{ productLocations?: string[]; madeInLocation?: string }> | undefined
    const firstLocation = locations?.[0]
    return {
      provider: EPROVIDER.PRINTWAY,
      item_sku: args.variant.id,
      variant_id: args.variant.id,
      product_location: firstLocation?.productLocations?.[0],
      made_in_location: firstLocation?.madeInLocation,
    }
  }

  /**
   * Collects artwork URLs from rendered images, mapping print area names to PrintWay keys.
   * Called at webhook order import time. Output stored as fulfillment_order_data.
   */
  prepareFulfillmentData(args: PrepareFulfillmentDataArgs): Record<string, unknown> {
    const { item_sku, variant_id, product_location, made_in_location } = args.variantMeta as Record<string, string>

    const artworks: Record<string, string> = {}
    for (const { printAreaName, image } of args.printImages) {
      if (!image?.src) continue
      const artworkKey = ARTWORK_POSITION_MAP[printAreaName.toLowerCase()] || `artwork_${printAreaName.toLowerCase()}`
      artworks[artworkKey] = image.src
    }

    return {
      provider: EPROVIDER.PRINTWAY,
      item_sku,
      variant_id,
      product_location,
      made_in_location,
      artworks,
    }
  }

  /**
   * Transforms stored fulfillment_order_data into PrintWay order item submission payload.
   * Spreads artwork keys directly onto the order item object.
   * Called at order submission time.
   */
  transformForSubmission(args: TransformForSubmissionArgs): Record<string, unknown> {
    const data = args.fulfillmentData
    return {
      item_sku: data.item_sku as string,
      variant_id: data.variant_id as string,
      quantity: args.quantity,
      product_location: data.product_location as string,
      made_in_location: data.made_in_location as string,
      ...((data.artworks as Record<string, string>) || {}),
    }
  }

  private createSdk(apiToken: string): Printway {
    const tokens = parsePrintWayTokens(apiToken)
    return new Printway({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  }
}
