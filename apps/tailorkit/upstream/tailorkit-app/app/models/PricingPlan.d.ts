export interface OrderUsages {
  from: number
  to: number
  transactionFee: number
}

export interface RevenueUsages {
  label?: string
  from: number
  to: number
  totalFee: number
  additionalFee?: number
  revenueShare?: string // e.g. '0.9%'
  freeOrders?: number
  cappedAmount?: number
}

export interface PricingPlanDocument {
  _id: string
  name: string
  price: number
  alias?: string
  test?: boolean
  trialDays: number
  applyTo?: string[]
  couponCode?: string
  description: string
  optionName?: string
  cappedAmount: number
  highlighted?: boolean
  createdAt: Date | string
  updatedAt: Date | string
  expiredAt?: Date | string | null
  status: 'active' | 'inactive'
  chargeApprovalRequired?: boolean
  periodical: 'monthly' | 'annually' | 'one-time'
  /**
   * Pricing version - METADATA ONLY
   *
   * ⚠️ IMPORTANT: Do NOT use this field for business logic!
   *
   * Use field existence instead:
   * - Order-based billing: Check `usages.orders && usages.orders.length > 0`
   * - Revenue-based billing: Check `usages.revenue && usages.revenue.length > 0`
   *
   * This allows V3, V4, V5 to reuse order-based or revenue-based logic
   * without modifying existing code (Open/Closed Principle).
   *
   * Defaults to 1 for backward compatibility.
   */
  pricingVersion?: 1 | 2
  /**
   * Whether users can manually select this plan (shown in pricing UI)
   * Set to false for internal plans like trial that are auto-assigned only
   * Defaults to true
   */
  userSelectable?: boolean
  /**
   * Monthly AI credits included in plan
   */
  aiCreditsPerMonth?: number
  features: {
    // Soft limits (legacy)
    assets?: number
    templates?: number
    // Feature flags (hard gating)
    highResPngExport?: boolean
    fulfillment3rdPartyApi?: boolean
    upsellCheckbox?: boolean
    upsellProductLimit?: number | null
    losslessSvgExport?: boolean
    autoFulfillment?: boolean
    bulkAssignedProducts?: boolean
    priorityFeatureRequests?: boolean
    dedicatedSuccessManager?: boolean
    charmBuilder?: boolean
  } | null
  /**
   * Primary billing structure - determines pricing mechanism
   *
   * Business logic should check field existence:
   * ```typescript
   * if (plan.usages?.orders && plan.usages.orders.length > 0) {
   *   // Handle order-based billing (V2, future V3/V4/V5)
   * } else if (plan.usages?.revenue && plan.usages.revenue.length > 0) {
   *   // Handle revenue-based billing (V1, future variations)
   * }
   * ```
   *
   * DO NOT check pricingVersion to determine logic - that violates OCP.
   */
  usages: {
    orders?: OrderUsages[]
    revenue?: RevenueUsages[]
  }
}

export interface GroupedPricingPlanDocument {
  _id: string
  lowestPrice: number
  highestPrice: number
  trialDays: number
  periodical: 'monthly' | 'annually' | 'one-time'
  variants: [PricingPlanDocument]
}

/**
 * Type for pricing plan seed data (used when creating/updating plans)
 * Omits Mongoose-generated fields (_id, createdAt, updatedAt)
 */
export type PricingPlanInput = Omit<PricingPlanDocument, '_id' | 'createdAt' | 'updatedAt'>
