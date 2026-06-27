export const PRINTWAY_WEBHOOK_TOPIC = 'printway/webhook'

export const PRINTWAY_STATUS_ORDER: Record<string, number> = {
  pending: 0,
  processing: 1,
  in_production: 2,
  producing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
  failed: 5,
}
