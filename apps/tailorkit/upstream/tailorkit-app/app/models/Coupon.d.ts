export interface ICouponDiscount {
  type: 'fixed' | 'percent'
  amount: number
}

export interface ICouponLimit {
  usage?: number
  expiresAt?: Date | string
  discountEndsAfter?: number
}

export interface CouponDocument {
  _id: string
  name: string
  code: string
  discount: ICouponDiscount
  limit?: ICouponLimit
  status: 'active' | 'inactive'
  promotionId?: string
  applyTo?: string[]
  /**
   * Defines where the coupon can be applied:
   * - 'subscription': Applies to subscription price only
   * - 'ai_credits': Applies to AI credit purchases only
   * - 'both': Applies to both subscription and AI credit purchases
   * Defaults to 'subscription' for backward compatibility
   */
  applicableFor?: 'subscription' | 'ai_credits' | 'both'
  /**
   * AI credit package discount settings (when applicableFor includes 'ai_credits')
   * If defined, the coupon can be used for AI credit purchases
   */
  aiCreditSettings?: {
    minCredits?: number // Minimum credits required to use coupon
    maxCredits?: number // Maximum credits the coupon applies to
  }
  /**
   * Analytics tracking for coupon performance
   * Used to measure coupon effectiveness and ROI
   */
  analytics?: {
    totalRedemptions: number // Total number of times coupon was used
    successfulRedemptions: number // Number of successful redemptions (applied to subscription)
    failedAttempts: number // Number of failed redemption attempts
    convertedShops: string[] // shopDomains that went trial→paid with this coupon
    totalRevenue: number // Sum of all charges from shops using this coupon
    lastUpdated: Date | string // Last time analytics were updated
  }
  createdAt: Date | string
  updatedAt: Date | string
}
