import {
  FULFILLING,
  SENT_TO_PRODUCTION,
  FULFILLED,
  CANCELED,
  type FulfillmentOrderStatus,
} from '~/constants/fulfillment-providers'
import type { OrderStatus } from '@sellersmith/shineon-sdk'
import { SHINEON_STATUS_ORDER } from '~/routes/api.public.shineon.webhooks/constants'

/**
 * Determines if a status transition is allowed based on idempotency rules
 * - Cannot transition from higher to lower status (except cancelled from non-terminal states)
 * - shipped cannot transition to cancelled (already shipped)
 * - Same status transitions are rejected (already processed)
 */
export function canTransition(currentShineOnStatus: OrderStatus, newShineOnStatus: OrderStatus): boolean {
  // No-op: same status
  if (currentShineOnStatus === newShineOnStatus) {
    return false
  }

  const currentOrder = SHINEON_STATUS_ORDER[currentShineOnStatus]
  const newOrder = SHINEON_STATUS_ORDER[newShineOnStatus]

  // Cancelled can only happen from non-shipped states
  if (newShineOnStatus === 'cancelled') {
    return currentShineOnStatus !== 'shipped'
  }

  // Cannot transition from cancelled to any other status
  if (currentShineOnStatus === 'cancelled') {
    return false
  }

  // Cannot downgrade from higher to lower status
  if (newOrder < currentOrder) {
    return false
  }

  return true
}

/**
 * Maps ShineOn order status to TailorKit fulfillment order status
 */
export function mapShineOnStatusToFulfillmentStatus(status: OrderStatus): FulfillmentOrderStatus {
  switch (status) {
    case 'on_hold':
    case 'awaiting_payment':
      return FULFILLING
    case 'in_production':
      return SENT_TO_PRODUCTION
    case 'shipped':
      return FULFILLED
    case 'cancelled':
      return CANCELED
  }
}

/**
 * Checks if a status is terminal (no further transitions expected)
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'shipped' || status === 'cancelled'
}

/**
 * Parses external_id in format "TLKT-{orderId}-{uuid}"
 * @returns { orderId: number } or null if invalid
 */
export function parseExternalId(externalId: string): { orderId: number } | null {
  const match = externalId.match(/^TLKT-(\d+)-[a-f0-9-]+$/i)
  if (!match) {
    return null
  }

  const orderId = parseInt(match[1], 10)
  if (isNaN(orderId)) {
    return null
  }

  return { orderId }
}
