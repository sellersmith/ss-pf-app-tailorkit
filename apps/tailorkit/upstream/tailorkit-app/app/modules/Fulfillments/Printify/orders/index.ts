/* eslint-disable max-len */
import type { FetchDataFunc } from '..'
import type { GetListOrdersFunc } from './getList'
import getList from './getList'
import type { GetOrderFunc } from './getOne'
import getOne from './getOne'
import type { SubmitOrderFunc } from './submit'
import submit from './submit'
import type { SubmitExpressFunc } from './submitExpress'
import submitExpress from './submitExpress'
import type { SendToProductionFunc } from './sendToProduction'
import sendToProduction from './sendToProduction'
import type { CalculateShippingFunc } from './calculateShipping'
import calculateShipping from './calculateShipping'
import type { CancelUnpaidFunc } from './cancelUnpaid'
import cancelUnpaid from './cancelUnpaid'

export interface OrdersMethods {
  getList: GetListOrdersFunc
  getOne: GetOrderFunc
  submit: SubmitOrderFunc
  submitExpress: SubmitExpressFunc
  sendToProduction: SendToProductionFunc
  calculateShipping: CalculateShippingFunc
  cancelUnpaid: CancelUnpaidFunc
}

/**
 * @see https://developers.printify.com/#order 
 * @description 
 * Printify API lets your application manage orders in a Merchants shop. You can submit orders for existing products in a merchant's shop or you can create new products with every order as in the case with merchandise created with customizable user-generated content.
  Ordering existing products or creating products with orders will require different line item entries so that should be kept in mind.
 */

class Orders implements OrdersMethods {
  /** Retrieve a list of orders */
  getList: GetListOrdersFunc
  /** Get order details by id */
  getOne: GetOrderFunc
  /** Submit an order */
  submit: SubmitOrderFunc
  /** Submit a Printify Express order */
  submitExpress: SubmitExpressFunc
  /** Send an existing order to production */
  sendToProduction: SendToProductionFunc
  /** Calculate shipping */
  calculateShipping: CalculateShippingFunc
  /** Cancel an unpaid order */
  cancelUnpaid: CancelUnpaidFunc

  constructor(fetchData: FetchDataFunc, shopId: string) {
    this.getList = getList(fetchData, shopId)
    this.getOne = getOne(fetchData, shopId)
    this.submit = submit(fetchData, shopId)
    this.submitExpress = submitExpress(fetchData, shopId)
    this.sendToProduction = sendToProduction(fetchData, shopId)
    this.calculateShipping = calculateShipping(fetchData, shopId)
    this.cancelUnpaid = cancelUnpaid(fetchData, shopId)
  }
}

export default Orders
