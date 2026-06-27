/* eslint-disable max-len */
/**
 * Provider name constants.
 *
 * IMPORTANT: Do NOT use these for conditional logic in UI/route layer.
 * Use `ProviderCapabilities` from `~/services/fulfillment/types` instead.
 *
 * Bad:  if (providerName === EPROVIDER.PRINTIFY) { showBlueprintCatalog() }
 * Good: if (capabilities.hasBlueprintCatalog) { showBlueprintCatalog() }
 *
 * Valid uses:
 * - Server-side adapter registration (bootstrap.server.ts)
 * - Database queries filtering by provider name
 * - Logging/analytics provider identification
 */
export enum EPROVIDER {
  PRINTIFY = 'Printify',
  SHINEON = 'ShineOn',
  PRINTWAY = 'PrintWay',
  TAILORKIT_DEMO_PRODUCT = 'TailorKit Demo Product',
}

export const FULFILLMENT_PROVIDERS: string[] = [EPROVIDER.PRINTIFY, EPROVIDER.SHINEON, EPROVIDER.PRINTWAY]

/**
 * @author LongPC
 * Set default product available to 999 when a product is in stock
 * We don't exactly number of product. When we import products to Shopify, we need to grant tracking quantity for false
 */
export const DEFAULT_PRODUCT_AVAILABLE = 999

// List order status
export const UNFULFILLED = 'unfulfilled'
export const FULFILLED = 'fulfilled'
export const FULFILLING = 'fulfilling'
export const SENT_TO_PRODUCTION = 'sent-to-production'
export const ON_HOLD = 'on-hold'
export const CANCELED = 'canceled'
export const PARTIAL = 'partial'

export type FulfillmentOrderStatus =
  | typeof UNFULFILLED
  | typeof FULFILLING
  | typeof SENT_TO_PRODUCTION
  | typeof FULFILLED
  | typeof ON_HOLD
  | typeof CANCELED

export const fulfillmentOrderStatuses: FulfillmentOrderStatus[] = [
  UNFULFILLED,
  FULFILLING,
  SENT_TO_PRODUCTION,
  FULFILLED,
  ON_HOLD,
  CANCELED,
]

export enum FulfillmentOrderAssignmentStatus {
  FULFILLMENT_REQUESTED = 'FULFILLMENT_REQUESTED',
  FULFILLMENT_ACCEPTED = 'FULFILLMENT_ACCEPTED',
  CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED',
}

export enum FulfillmentRequestKind {
  FULFILLMENT_REQUEST = 'FULFILLMENT_REQUEST',
  CANCELLATION_REQUEST = 'CANCELLATION_REQUEST',
}

export const PREFIX_FULFILLMENT_ORDER_ID = 'TailorKit-order'

// By default, we will not accept the cancellation request from merchant once it is submitted
// Because we can't cancel the order on Printify or other fulfillment services if it has any problems.
// This constant is used when user proactive cancel the order from fullfillment service. At this time, we will properly cancel the order on Shopify.
export const FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST = 'TK-fulfillment-cancellation-request'

export const PROVIDER_API_URL = {
  [EPROVIDER.PRINTIFY]: {
    baseUrl: 'https://api.printify.com',
    shopsPath: '/v1/shops.json',
    allBlueprintsPath: '/v1/catalog/blueprints.json',
    blueprintByIdPath: '/v1/catalog/blueprints/{blueprint_id}.json',
    allProvidersOfBlueprintPath: '/v1/catalog/blueprints/{blueprint_id}/print_providers.json',
    variantsOfBlueprintProviderPath:
      '/v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json?show-out-of-stock=0',
    providerByIdPath: '/v1/catalog/print_providers/{print_provider_id}.json',

    // WARNING: The following urls are used for trick only, they can be removed at any time
    blueprintProviderByIdTrickUrl:
      'https://printify.com/product-catalog-service/api/v2/blueprints/{blueprint_id}/print-providers/{provider_id}',
  },
  [EPROVIDER.SHINEON]: {
    baseUrl: 'https://api.shineon.com',
    whoamiPath: '/v1/whoami',
    productTemplatesPath: '/v1/product_templates',
    skusPath: '/v1/skus',
    ordersPath: '/v1/orders',
    orderByIdPath: '/v1/orders/{order_id}',
    rendersPath: '/v1/renders',
  },
  [EPROVIDER.PRINTWAY]: {
    baseUrl: 'https://apis.printway.io/v3',
  },
}
