import type { AiCreditPackageDocument } from './AiCreditPackage'

export interface AiCreditPurchaseDocument {
  _id: string
  shopDomain: string
  package: string | AiCreditPackageDocument
  credits: number
  price: number
  couponCode?: string
  finalPrice: number
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  shopifyCharge?: any
  appliedToShop: boolean
  createdAt: Date | string
  updatedAt: Date | string
}
