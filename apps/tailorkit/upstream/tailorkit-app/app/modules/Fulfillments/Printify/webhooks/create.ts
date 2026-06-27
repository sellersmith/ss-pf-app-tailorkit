import type { FetchDataFunc } from '..'

export interface Data {
  topic: // Shop events
  | 'shop:disconnected'
    // Product events
    | 'product:deleted'
    | 'product:publish:started'
    // Order events
    | 'order:created'
    | 'order:updated'
    | 'order:shipment:created'
    | 'order:shipment:delivered'
    | 'order:sent-to-production'
  url: string
}

export interface CreateWebhookResponse {
  topic: string
  url: string
  shop_id: string
  id: string
}

export type CreateWebhookFunc = (data: Data) => Promise<CreateWebhookResponse>

/**
 * Create a new webhook
 *
 * @param {Data} data - The webhook data to be sent in the request body
 * @returns {Promise<CreateWebhookResponse>} The created webhook response
 *
 * @example
 * const data = { topic: "order:created", url: "https://example.com/webhooks/order/created" };
 * const response = await printify.webhooks.create(data);
 * // Expected response:
 * // {
 * //   "topic": "order:created",
 * //   "url": "https://example.com/webhooks/order/created",
 * //   "shop_id": "1",
 * //   "id": "5cb87a8cd490a2ccb256cec4"
 * // }
 */
const create
  = (fetchData: FetchDataFunc, shopId: string) =>
  async (data: Data): Promise<CreateWebhookResponse> => {
    const response = await fetchData(`/shops/${shopId}/webhooks.json`, {
      method: 'POST',
      body: JSON.stringify({ ...data, secret: process.env.PRINTIFY_WEBHOOK_SECRET }),
    })

    return response
  }

export default create
