import {
  FULFILLING,
  SENT_TO_PRODUCTION,
  FULFILLED,
  CANCELED,
  type FulfillmentOrderStatus,
} from '~/constants/fulfillment-providers'
import { PRINTWAY_STATUS_ORDER } from '~/routes/api.public.printway.webhooks/constants'

/**
 * Determines if a status transition is allowed based on idempotency rules.
 * - Cannot transition from higher to lower status (forward-only progression)
 * - shipped/delivered cannot transition to cancelled (already fulfilled)
 * - Cannot transition from a terminal status
 * - Same status transitions are no-ops (already processed)
 */
export function canTransition(currentStatus: string, newStatus: string): boolean {
  const current = currentStatus?.toLowerCase()
  const next = newStatus?.toLowerCase()

  if (current === next) {
    return false
  }

  const currentOrder = PRINTWAY_STATUS_ORDER[current]
  const newOrder = PRINTWAY_STATUS_ORDER[next]

  // If either status is unknown, allow transition to avoid blocking
  if (currentOrder === undefined || newOrder === undefined) {
    return true
  }

  // Cancellation / failure cannot happen after shipped or delivered
  if ((next === 'cancelled' || next === 'failed') && (current === 'shipped' || current === 'delivered')) {
    return false
  }

  // Cannot transition from a terminal status (cancelled/failed) to another
  if (current === 'cancelled' || current === 'failed') {
    return false
  }

  // Cannot downgrade to a lower status order
  if (newOrder < currentOrder) {
    return false
  }

  return true
}

/**
 * Maps a PrintWay order status string to TailorKit fulfillment order status.
 */
export function mapPrintWayStatusToFulfillmentStatus(status: string): FulfillmentOrderStatus {
  switch (status?.toLowerCase()) {
    case 'pending':
    case 'processing':
      return FULFILLING
    case 'in_production':
    case 'producing':
      return SENT_TO_PRODUCTION
    case 'shipped':
    case 'delivered':
      return FULFILLED
    case 'cancelled':
    case 'canceled':
    case 'failed':
      return CANCELED
    default:
      return FULFILLING
  }
}

/**
 * Checks if a PrintWay status is terminal (no further transitions expected).
 */
export function isTerminalStatus(status: string): boolean {
  const s = status?.toLowerCase()
  return s === 'shipped' || s === 'delivered' || s === 'cancelled' || s === 'canceled' || s === 'failed'
}
