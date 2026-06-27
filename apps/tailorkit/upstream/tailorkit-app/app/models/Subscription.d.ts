import type { CouponDocument } from './Coupon'
import type { PricingPlanDocument } from './PricingPlan'
import type { BillingCycleDocument } from './BillingCycle'

export interface SubscriptionDocument {
  _id: string
  shopDomain: string
  plan: string | PricingPlanDocument
  couponCode?: string
  couponAppliedOn?: string
  finalPrice: number
  periodical: 'monthly' | 'annually' | 'one-time'
  from: Date | string | null
  to: Date | string | null
  status: 'pending' | 'active' | 'inactive' | 'cancelled'
  coupon?: CouponDocument
  usageStats: {
    fromOrderNumber: number
    toOrderNumber: number
  }
  shopifyCharge?: any
  userCappedAmount?: number
  reachedUserCappedAmount?: boolean
  /**
   * Reference to active billing cycle
   * Points to current 30-day billing cycle managed by BillingStateManager
   */
  activeBillingCycle?: string | BillingCycleDocument
  createdAt: Date | string
  updatedAt: Date | string
}
