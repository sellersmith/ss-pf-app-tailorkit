export interface TemporaryVariant {
  id: string | number
  title: string
  cost: number
  price: number
  profitMargin: number
  active?: boolean
  options: {
    [key: string]: string
  }
  placeholders?: {
    position: string
    width: number
    height: number
  }[]
  [key: string]: any
}

export interface TemporaryProduct {
  shopDomain?: string
  providerId: string
  productId: string
  productProviderId: string
  variants: TemporaryVariant[]
  description: string
  title: string
  images: string[]
  baseProfitMargin: number
  providerDetails?: any
  providerList?: {
    id: string
    title: string
  }[]
}

export interface TemporaryData {
  products: string[]
  confirmChoosePrintifyChoice?: boolean
  showUnderstandAboutProviderModal?: boolean
}

export interface TemporaryFulfillmentProductsDocument {
  _id: string
  providerId: string
  shopDomain: string
  data: TemporaryData
  createdAt: Date | string
  updatedAt: Date | string
}
