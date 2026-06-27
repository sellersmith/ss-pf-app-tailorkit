import type { FetchDataFunc } from '..'
import type { CreateProductFunc } from './create'
import create from './create'
import type { GetProductFunc } from './getOne'
import getOne from './getOne'
import type { GetListProductsFunc } from './getList'
import getList from './getList'
import type { UpdateProductFunc } from './updateOne'
import updateOne from './updateOne'
import type { DeleteProductFunc } from './deleteOne'
import deleteOne from './deleteOne'
import type { PublishProductFunc } from './publishOne'
import publishOne from './publishOne'
import type { SetPublishSucceededFunc } from './setPublishSucceeded'
import setPublishSucceeded from './setPublishSucceeded'
import type { SetPublishFailedFunc } from './setPublishFailed'
import setPublishFailed from './setPublishFailed'
import type { NotifyUnpublishedFunc } from './notifyUnpublished'
import notifyUnpublished from './notifyUnpublished'

export interface ProductsMethods {
  create: CreateProductFunc
  getOne: GetProductFunc
  getList: GetListProductsFunc
  updateOne: UpdateProductFunc
  deleteOne: DeleteProductFunc
  publishOne: PublishProductFunc
  setPublishSucceeded: SetPublishSucceededFunc
  setPublishFailed: SetPublishFailedFunc
  notifyUnpublished: NotifyUnpublishedFunc
}

/**
 * @see https://developers.printify.com/#products
 * @description
 * The Product resource lets you list, create, update, delete and publish products to a store.
 */

class Products implements ProductsMethods {
  /** Create a new product */
  create: CreateProductFunc
  /** Retrieve a product */
  getOne: GetProductFunc
  /** Retrieve a list of all products */
  getList: GetListProductsFunc
  /** Update a product */
  updateOne: UpdateProductFunc
  /** Delete a product */
  deleteOne: DeleteProductFunc
  /** Publish a product */
  publishOne: PublishProductFunc
  /** Set product publish status to succeeded */
  setPublishSucceeded: SetPublishSucceededFunc
  /** Set product publish status to failed */
  setPublishFailed: SetPublishFailedFunc
  /** Notify that a product has been unpublished */
  notifyUnpublished: NotifyUnpublishedFunc

  constructor(fetchData: FetchDataFunc, shopId: string) {
    this.create = create(fetchData, shopId)
    this.getOne = getOne(fetchData, shopId)
    this.getList = getList(fetchData, shopId)
    this.updateOne = updateOne(fetchData, shopId)
    this.deleteOne = deleteOne(fetchData, shopId)
    this.publishOne = publishOne(fetchData, shopId)
    this.setPublishSucceeded = setPublishSucceeded(fetchData, shopId)
    this.setPublishFailed = setPublishFailed(fetchData, shopId)
    this.notifyUnpublished = notifyUnpublished(fetchData, shopId)
  }
}

export default Products
