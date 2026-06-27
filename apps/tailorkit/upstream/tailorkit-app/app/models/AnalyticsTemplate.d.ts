export interface AnalyticsTemplateDocument {
  _id: string
  shopDomain: string
  populateDate: Date | string
  numOrders: number
  templates: {
    templateId: string
    quantity: number
    totalPrice: number
  }[]
  createdAt: Date | string
  updatedAt: Date | string
}
