/**
 * @description Represents the order's aggregated fulfillment status for display purposes.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/enums/OrderDisplayFulfillmentStatus
 */
enum DisplayFulfillmentStatus {
  FULFILLED = 'FULFILLED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  OPEN = 'OPEN',
  PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
  PENDING_FULFILLMENT = 'PENDING_FULFILLMENT',
  REQUEST_DECLINED = 'REQUEST_DECLINED',
  RESTOCKED = 'RESTOCKED',
  SCHEDULED = 'SCHEDULED',
  UNFULFILLED = 'UNFULFILLED',
}

/**
 * @description The status of a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/enums/FulfillmentOrderStatus
 */
enum FulfillmentOrderStatus {
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED',
  INCOMPLETE = 'INCOMPLETE',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  OPEN = 'OPEN',
  SCHEDULED = 'SCHEDULED',
}

/**
 * @description The request status of a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/enums/FulfillmentOrderRequestStatus
 */
enum FulfillmentOrderRequestStatus {
  ACCEPTED = 'ACCEPTED',
  CANCELLATION_ACCEPTED = 'CANCELLATION_ACCEPTED',
  CANCELLATION_REJECTED = 'CANCELLATION_REJECTED',
  CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
  SUBMITTED = 'SUBMITTED',
  UNSUBMITTED = 'UNSUBMITTED',
}

interface PrintArea {
  src: string
  width: number
  height: number
  placeholder: Omit<IPlaceholder, 'variantName'>
}

type LegacyPrintAreas = { [position: string]: string }[]
type ModernPrintAreas = { [position: string]: PrintArea }[]

interface IFulfillmentOrderData {
  provider_id: string
  product_id: string
  variant_id: string
  /**
   * Print areas can be in two formats:
   * 1. Legacy format: Array of objects mapping positions to image URLs
   * 2. Modern format: Array of objects mapping positions to print area data
   */
  print_areas: LegacyPrintAreas | ModernPrintAreas
}

export { DisplayFulfillmentStatus, FulfillmentOrderStatus, FulfillmentOrderRequestStatus, IFulfillmentOrderData }
