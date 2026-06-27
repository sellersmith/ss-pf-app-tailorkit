import type { FetchDataFunc } from '..'
import type { DeleteShopFunc } from './deleteOne'
import deleteOne from './deleteOne'
import type { GetListShopsFunc } from './getList'
import getList from './getList'

export interface ShopsMethods {
  deleteOne: DeleteShopFunc
  getList: GetListShopsFunc
}

/**
 * @see https://developers.printify.com/#shops
 * @description
 * All product creation and order submission in a Printify Merchant's account happens through a shop.
 * Merchant's can have multiple shops in one Printify account.
 * Each of these shops can be connected to different sales channels and each has independent products, orders, and analytics.
 */

class Shops implements ShopsMethods {
  /** Retrieve a list of existing shops in a Printify account */
  getList: GetListShopsFunc
  /** Disconnect a shop from a Printify account */
  deleteOne: DeleteShopFunc

  constructor(fetchData: FetchDataFunc, shopId: string) {
    this.deleteOne = deleteOne(fetchData, shopId)
    this.getList = getList(fetchData)
  }
}

export default Shops
