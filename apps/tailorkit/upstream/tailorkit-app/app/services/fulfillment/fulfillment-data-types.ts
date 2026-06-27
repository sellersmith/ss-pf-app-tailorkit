/**
 * Discriminated union types for fulfillment_order_data stored on Order line items.
 * Each provider stores a different shape. The `provider` discriminant enables type narrowing.
 *
 * These types are parallel to IFulfillmentOrderData (Order.d.ts) and do NOT replace it.
 * They are intended for use in adapter code and new fulfillment pipeline logic.
 *
 * @see app/services/fulfillment/adapters/ - Adapters that produce these shapes
 * @see app/models/Order.d.ts - Legacy IFulfillmentOrderData (Printify-only, kept for backward compat)
 */
import type { ShineOnMapping } from '~/modules/Fulfillments/ShineOn/types'
import { EPROVIDER } from '~/constants/fulfillment-providers'

/** Printify fulfillment data shape stored in fulfillment_order_data */
export interface PrintifyFulfillmentData {
  provider: typeof EPROVIDER.PRINTIFY
  provider_id: number
  product_id: number
  variant_id: number
  print_areas: Array<Record<string, { src: string; width: number; height: number; placeholder?: unknown }>>
}

/** ShineOn fulfillment data shape stored in fulfillment_order_data */
export interface ShineOnFulfillmentData {
  provider: typeof EPROVIDER.SHINEON
  sku: string
  properties: Record<string, string>
  shineOnMapping?: ShineOnMapping
}

/** PrintWay fulfillment data shape stored in fulfillment_order_data */
export interface PrintWayFulfillmentData {
  provider: typeof EPROVIDER.PRINTWAY
  item_sku: string
  variant_id: string
  product_location?: string
  made_in_location?: string
  /** Artwork URLs keyed by PrintWay position (e.g. artwork_front, artwork_back) */
  artworks: Record<string, string>
}

/** Discriminated union of all provider fulfillment data shapes */
export type FulfillmentOrderData = PrintifyFulfillmentData | ShineOnFulfillmentData | PrintWayFulfillmentData

// -- Type Guards --

/**
 * Check if fulfillment data is Printify.
 * Supports legacy data without `provider` field (detected by presence of `product_id`).
 */
export function isPrintifyData(data: FulfillmentOrderData | Record<string, unknown>): data is PrintifyFulfillmentData {
  const d = data as Record<string, unknown>
  return d.provider === EPROVIDER.PRINTIFY || (!('provider' in d) && 'product_id' in d)
}

/**
 * Check if fulfillment data is ShineOn.
 * Supports legacy data without `provider` field (detected by presence of `sku`).
 */
export function isShineOnData(data: FulfillmentOrderData | Record<string, unknown>): data is ShineOnFulfillmentData {
  const d = data as Record<string, unknown>
  return d.provider === EPROVIDER.SHINEON || (!('provider' in d) && 'sku' in d)
}

/** Check if fulfillment data is PrintWay. */
export function isPrintWayData(data: FulfillmentOrderData | Record<string, unknown>): data is PrintWayFulfillmentData {
  return (data as Record<string, unknown>).provider === EPROVIDER.PRINTWAY
}
