import type { OrderStatus } from '@sellersmith/shineon-sdk'

// ShineOn shipment notification payload (POST body)
export interface ShineOnWebhookPayload {
  order: {
    id: string // ShineOn order ID
    external_id: string // Our format: TLKT-{orderId}-{uuid}
    status: OrderStatus
    line_items: ShineOnWebhookLineItem[]
    shipments: ShineOnWebhookShipment[]
  }
}

export interface ShineOnWebhookLineItem {
  sku: string
  quantity: number
  tracking_company?: string
  tracking_number?: string
  tracking_url?: string
}

export interface ShineOnWebhookShipment {
  carrier: string
  tracking_number: string
  tracking_url: string
}
