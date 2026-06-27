export interface CalculatedPrice {
  subscriptionFee: number
  extraOrderFee: number
  subtotal: number
  discount: number
  total: number
  includedOrders: number
  overageFeePerOrder: number
}

export const planRecommendationAdapterMarker = 'app-platform-pruned-route-ui-adapter'
