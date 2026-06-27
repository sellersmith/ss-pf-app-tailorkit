export interface PrintWayTrackingPayload {
  order_id: string
  tracking_number: string
  tracking_url: string
}

export interface PrintWayOrderStatusItem {
  item_sku: string
  order_status: string
  message_error?: string
}

export interface PrintWayOrderStatusPayload {
  order_id: string
  order_items: PrintWayOrderStatusItem[]
}

export type PrintWayWebhookPayload = PrintWayTrackingPayload | PrintWayOrderStatusPayload

export type PrintWayWebhookType = 'tracking' | 'order'
