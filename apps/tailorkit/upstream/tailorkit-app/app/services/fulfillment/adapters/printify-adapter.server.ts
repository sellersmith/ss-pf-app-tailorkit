/**
 * Printify fulfillment adapter implementing IFulfillmentProvider.
 * Wraps the existing Printify SDK with normalized types and error handling.
 *
 * @see app/services/fulfillment/types.d.ts - Shared interface
 * @see app/modules/Fulfillments/Printify/ - Underlying SDK
 */

import Printify from '~/modules/Fulfillments/Printify'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { fulfillPrintifyOrder } from '~/routes/api.public.printify.webhooks/fns.server'
import type {
  FulfillOrderArgs,
  IFulfillmentProvider,
  ListProductsParams,
  NormalizedBlueprint,
  NormalizedOrder,
  NormalizedPrintProvider,
  NormalizedProduct,
  NormalizedProductDetails,
  PrepareFulfillmentDataArgs,
  PrepareVariantMetafieldArgs,
  ProviderCapabilities,
  ShippingCalcParams,
  ShippingRate,
  SubmitOrderArgs,
  TransformForSubmissionArgs,
} from '~/services/fulfillment/types'
import {
  mapPrintifyBlueprint,
  mapPrintifyBlueprintDetails,
  mapPrintifyBlueprintToNormalized,
  mapPrintifyErrorToProviderError,
  mapPrintifyOrder,
} from './printify-mappers.server'
import { formatPrintifyPrintAreas } from '~/routes/api.providers/printify/print-areas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Printify SDK instance for catalog-only calls (no shopId needed). */
function createCatalogClient(accessToken: string): Printify {
  return new Printify({ shopId: '', accessToken })
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class PrintifyAdapter implements IFulfillmentProvider {
  readonly name = EPROVIDER.PRINTIFY

  readonly capabilities: ProviderCapabilities = {
    hasBlueprintCatalog: true,
    hasPrintProviderSelection: true,
    hasEngravingMapping: false,
    hasVariantSelection: true,
    hasOrderTracking: true,
    hasWebhookSupport: true,
    hasRenderPreview: false,
    hasShippingCalculation: true,
    hasMultipleArtworkPositions: false,
    hasLocationBasedRouting: false,
  }

  // -- Connection -----------------------------------------------------------

  async validateConnection(apiToken: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = createCatalogClient(apiToken)
      const shops = await client.shops.getList()
      return { valid: Array.isArray(shops) && shops.length > 0 }
    } catch (err) {
      const mapped = mapPrintifyErrorToProviderError(err)
      return { valid: false, error: mapped.message }
    }
  }

  // -- Catalog --------------------------------------------------------------

  async listProducts(apiToken: string, _params?: ListProductsParams): Promise<NormalizedProduct[]> {
    try {
      const client = createCatalogClient(apiToken)
      const blueprints = await client.catalog.getBluePrints()
      return blueprints.map(mapPrintifyBlueprint)
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  async getProductDetails(productId: string, apiToken: string): Promise<NormalizedProductDetails> {
    try {
      const client = createCatalogClient(apiToken)
      const [blueprint, providers] = await Promise.all([
        client.catalog.getBlueprint(productId),
        client.catalog.getBlueprintProviders(productId),
      ])
      return mapPrintifyBlueprintDetails(blueprint, undefined, providers)
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  // -- Blueprints (capability-guarded) --------------------------------------

  async listBlueprints(apiToken: string): Promise<NormalizedBlueprint[]> {
    try {
      const client = createCatalogClient(apiToken)
      const blueprints = await client.catalog.getBluePrints()
      return blueprints.map(mapPrintifyBlueprintToNormalized)
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  async listPrintProviders(blueprintId: string, apiToken: string): Promise<NormalizedPrintProvider[]> {
    try {
      const client = createCatalogClient(apiToken)
      const providers = await client.catalog.getBlueprintProviders(blueprintId)
      return providers.map(p => ({ id: p.id, title: p.title }))
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  // -- Orders ---------------------------------------------------------------

  async submitOrder(args: SubmitOrderArgs): Promise<{ externalOrderId: string }> {
    try {
      const client = createCatalogClient(args.apiToken)
      const result = await client.orders.submit({
        external_id: args.externalId,
        label: args.externalId,
        line_items: args.lineItems.map(li => ({
          variant_id: Number(li.variantExternalId),
          quantity: li.quantity,
        })),
        shipping_method: 1,
        is_printify_express: false,
        is_economy_shipping: false,
        send_shipping_notification: false,
        address_to: {
          first_name: args.shippingAddress.firstName,
          last_name: args.shippingAddress.lastName,
          email: args.shippingAddress.email ?? '',
          phone: args.shippingAddress.phone ?? '',
          country: args.shippingAddress.country,
          region: args.shippingAddress.region ?? '',
          address1: args.shippingAddress.address1,
          address2: args.shippingAddress.address2,
          city: args.shippingAddress.city,
          zip: args.shippingAddress.zip,
        },
      })
      return { externalOrderId: result.id }
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  async getOrder(externalOrderId: string, apiToken: string): Promise<NormalizedOrder> {
    try {
      const client = createCatalogClient(apiToken)
      const order = await client.orders.getOne(externalOrderId)
      return mapPrintifyOrder(order)
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  async cancelOrder(externalOrderId: string, apiToken: string): Promise<boolean> {
    try {
      const client = createCatalogClient(apiToken)
      const result = await client.orders.cancelUnpaid(externalOrderId)
      return result.status === 'canceled'
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  // -- Fulfillment dispatch -------------------------------------------------

  async fulfillOrder(args: FulfillOrderArgs): Promise<void> {
    try {
      await fulfillPrintifyOrder({
        fulfillmentOrder: args.fulfillmentOrder,
        shopDomain: args.shopDomain,
        fulfillmentProvider: args.fulfillmentProvider,
      })
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }

  // -- Fulfillment data pipeline --------------------------------------------

  /**
   * Prepare the Printify-shaped variant metafield value written at product import time.
   * Stores blueprint ID, print provider ID, variant ID, and placeholders.
   */
  prepareVariantMetafield(args: PrepareVariantMetafieldArgs): Record<string, unknown> {
    return {
      provider: EPROVIDER.PRINTIFY,
      product_id: args.productId,
      provider_id: args.productProviderId,
      variant_id: args.variant.id,
      placeholders: args.variant.placeholders || [],
    }
  }

  /**
   * Prepare fulfillment order data from variant metafield + rendered artwork.
   * Called at webhook order import time; output is stored as `fulfillment_order_data`
   * on the Order line item and later passed to `transformForSubmission`.
   *
   * @param args.variantMeta  - Parsed variant metafield: `{ product_id, provider_id, variant_id, placeholders }`
   * @param args.printImages  - Rendered artwork per print area
   * @returns Provider-specific payload `{ provider_id, product_id, variant_id, print_areas }`
   */
  prepareFulfillmentData(args: PrepareFulfillmentDataArgs): Record<string, unknown> {
    const { variantMeta, printImages } = args
    const { product_id, provider_id, variant_id } = variantMeta as {
      product_id: string | number
      provider_id: string | number
      variant_id: string | number
      placeholders?: Array<{ position: string; width: number; height: number }>
    }
    const placeholders = (variantMeta.placeholders as Array<{ position: string; width: number; height: number }>) ?? []

    const print_areas = placeholders
      .map(placeholder => {
        const printSide = placeholder.position
        const printImage = printImages.find(pi => pi.printAreaName === printSide)?.image
        if (!printImage) return null
        return {
          [printSide]: {
            src: printImage.src,
            width: printImage.width,
            height: printImage.height,
            placeholder,
          },
        }
      })
      .filter(Boolean)

    return {
      provider: EPROVIDER.PRINTIFY,
      provider_id: Number(provider_id),
      product_id: Number(product_id),
      variant_id: Number(variant_id),
      print_areas,
    }
  }

  /**
   * Transform stored fulfillment_order_data into a Printify line-item submission payload.
   * Called at order submission time.
   *
   * @param args.fulfillmentData - Output of `prepareFulfillmentData` stored on the Order line item
   * @param args.quantity        - Line item quantity
   * @returns Printify-ready line item `{ blueprint_id, variant_id, print_provider_id, print_areas, quantity }`
   */
  transformForSubmission(args: TransformForSubmissionArgs): Record<string, unknown> {
    const { fulfillmentData, quantity } = args
    const { product_id, provider_id, variant_id, print_areas } = fulfillmentData as {
      product_id: number
      provider_id: number
      variant_id: number
      print_areas: Parameters<typeof formatPrintifyPrintAreas>[0]
    }

    const preparedPrintAreas = formatPrintifyPrintAreas(print_areas)

    return {
      blueprint_id: product_id,
      variant_id,
      print_provider_id: provider_id,
      print_areas: preparedPrintAreas,
      quantity,
    }
  }

  // -- Shipping (capability-guarded) ----------------------------------------

  async calculateShipping(params: ShippingCalcParams, apiToken: string): Promise<ShippingRate[]> {
    try {
      const client = createCatalogClient(apiToken)
      const result = await client.orders.calculateShipping({
        line_items: params.lineItems.map(li => ({
          variant_id: Number(li.variantExternalId),
          quantity: li.quantity,
        })),
        address_to: {
          first_name: params.addressTo.firstName,
          last_name: params.addressTo.lastName,
          email: params.addressTo.email ?? '',
          phone: params.addressTo.phone ?? '',
          country: params.addressTo.country,
          region: params.addressTo.region ?? '',
          address1: params.addressTo.address1,
          address2: params.addressTo.address2 ?? '',
          city: params.addressTo.city,
          zip: params.addressTo.zip,
        },
      })

      return [
        { type: 'standard', cost: result.standard, currency: 'USD' },
        { type: 'express', cost: result.express, currency: 'USD' },
        { type: 'priority', cost: result.priority, currency: 'USD' },
        { type: 'economy', cost: result.economy, currency: 'USD' },
      ].filter(r => r.cost > 0)
    } catch (err) {
      throw mapPrintifyErrorToProviderError(err)
    }
  }
}
