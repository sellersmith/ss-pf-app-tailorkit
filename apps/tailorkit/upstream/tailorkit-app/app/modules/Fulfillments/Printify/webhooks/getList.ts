import type { FetchDataFunc } from '..'

export interface Webhook {
  topic: string
  url: string
  shop_id: string
  id: string
}

export type GetListWebhooksFunc = () => Promise<Webhook[]>

/**
 * Retrieve a list of webhooks
 *
 * @returns {Promise<Webhook[]>} The list of webhooks
 *
 * @example
 * const webhooks = await printify.webhooks.list();
 * // Expected response:
 * // [
 * //   { "topic": "order:created", "url": "https://example.com/webhooks/order/created", "shop_id": "1", "id": "5cb87a8cd490a2ccb256cec4" },
 * //   { "topic": "order:updated", "url": "https://example.com/webhooks/order/updated", "shop_id": "1", "id": "5cb87a8cd490a2ccb256cec5" }
 * // ]
 */
const getList = (fetchData: FetchDataFunc, shopId: string) => async (): Promise<Webhook[]> => {
  const response = await fetchData(`/shops/${shopId}/webhooks.json`, {
    method: 'GET',
  })
  return response
}

export default getList
