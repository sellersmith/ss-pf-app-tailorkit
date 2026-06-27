/* eslint-disable max-len */
import type { FetchDataFunc } from '..'
import type { GetListWebhooksFunc } from './getList'
import getList from './getList'
import type { CreateWebhookFunc } from './create'
import create from './create'
import type { UpdateWebhookFunc } from './updateOne'
import updateOne from './updateOne'
import type { DeleteWebhookFunc } from './deleteOne'
import deleteOne from './deleteOne'

export interface WebhookMethods {
  getList: GetListWebhooksFunc
  create: CreateWebhookFunc
  updateOne: UpdateWebhookFunc
  deleteOne: DeleteWebhookFunc
}

/**
 * @see https://developers.printify.com/#webhooks
 * @description
 * You can use webhook subscriptions to receive notifications about particular events in a shop.
 * After you've subscribed to a webhook, you can let your app execute code immediately after specific events occur in shops that have your app connected,
 * instead of having to make API calls periodically to check their status.
 * For example, you can rely on webhooks to trigger an action in your app when a merchant creates a new product in a store.
 * By using webhooks subscriptions you can make fewer API calls overall, which makes sure that your apps are more efficient and update quickly.
 * For more information what actually gets sent by a webhook check Event properties and Resource data examples.
 */

class Webhooks implements WebhookMethods {
  /** Retrieve a list of webhooks */
  getList: GetListWebhooksFunc
  /** Create a new webhook */
  create: CreateWebhookFunc
  /** Modify a webhook */
  updateOne: UpdateWebhookFunc
  /** Delete a webhook */
  deleteOne: DeleteWebhookFunc

  constructor(fetchData: FetchDataFunc, shopId: string) {
    this.getList = getList(fetchData, shopId)
    this.create = create(fetchData, shopId)
    this.updateOne = updateOne(fetchData, shopId)
    this.deleteOne = deleteOne(fetchData, shopId)
  }
}

export default Webhooks
