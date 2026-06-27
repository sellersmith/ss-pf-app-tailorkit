/**
 * PlanComparisonTable Type Definitions
 */

import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { CouponDocument } from '~/models/Coupon'
import type { CalculatedPrice, DiscountStatus } from '../../utils/planRecommendation'
import type { PlanAction } from '../PlanSelectionCards/PlanCard'

/**
 * Props for the PlanComparisonTable component
 */
export interface PlanComparisonTableProps {
  /**
   * Translation function
   */
  t: TFunction

  /**
   * Available pricing plans (Version 2 order-based plans)
   */
  plans: PricingPlanDocument[]

  /**
   * Current order count for calculations
   */
  orderCount: number

  /**
   * Current plan the shop is subscribed to (optional)
   */
  currentPlan?: PricingPlanDocument

  /**
   * Callback when order count changes
   */
  onOrderCountChange: (value: number) => void

  /**
   * Callback when user clicks "Choose plan" on a column
   */
  onSelectPlan: (plan: PricingPlanDocument, calculatedPrice: CalculatedPrice) => void

  /**
   * Current discount code input value
   */
  discountCode: string

  /**
   * Callback when discount code changes
   */
  onDiscountCodeChange: (value: string) => void

  /**
   * Callback to validate the discount code
   */
  onCheckDiscount: () => void

  /**
   * Current discount validation status
   */
  discountStatus: DiscountStatus

  /**
   * Validated coupon (if valid)
   */
  validatedCoupon: CouponDocument | null

  /**
   * Discount validation error message
   */
  discountError: string

  /**
   * Loading state for the table
   */
  isLoading?: boolean
}

/**
 * Data for a single plan column
 */
export interface PlanColumnData {
  /**
   * The pricing plan
   */
  plan: PricingPlanDocument

  /**
   * Calculated price breakdown for this plan
   */
  calculatedPrice: CalculatedPrice

  /**
   * Whether this plan has the best price
   */
  isBestPrice: boolean

  /**
   * Action relative to current plan (select/current/upgrade/downgrade)
   */
  planAction: PlanAction
}

/**
 * Props for the PlanColumn component
 */
export interface PlanColumnProps {
  /**
   * Translation function
   */
  t: TFunction

  /**
   * Column data including plan and calculated price
   */
  data: PlanColumnData

  /**
   * Callback when user clicks "Choose plan"
   */
  onSelectPlan: (plan: PricingPlanDocument, calculatedPrice: CalculatedPrice) => void

  /**
   * Whether the column is in a calculating/loading state
   */
  isCalculating?: boolean

  /**
   * Whether the column is the current plan
   */
  isCurrentPlan?: boolean
}
