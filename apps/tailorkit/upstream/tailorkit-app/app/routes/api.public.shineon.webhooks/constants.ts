import type { OrderStatus } from '@sellersmith/shineon-sdk'

// Numeric order for status hierarchy (higher = more progressed, -1 = terminal)
export const SHINEON_STATUS_ORDER: Record<OrderStatus, number> = {
  on_hold: 0,
  awaiting_payment: 1,
  in_production: 2,
  shipped: 3,
  cancelled: -1,
}

// Webhook topics for WebhookLog
export const SHINEON_WEBHOOK_TOPIC = 'shineon:shipment'
