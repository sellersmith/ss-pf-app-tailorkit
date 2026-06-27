export interface AnalyticsProductDocument {
  _id: string
  shopDomain: string
  populateDate: Date | string
  numOrders: number
  products: {
    productId: string
    productTitle: string
    quantity: number
    totalPrice: number
  }[]
  createdAt: Date | string
  updatedAt: Date | string
}
