/**
 * PricingCalculator Type Definitions
 */

import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { CalculatedPrice, DiscountStatus } from '../../utils/planRecommendation'

export type { CalculatedPrice, DiscountStatus }

/**
 * Props for the PricingCalculator component
 */
export interface PricingCalculatorProps {
  /** Translation function */
  t: TFunction

  /** Available pricing plans (Version 2 order-based plans) */
  plans: PricingPlanDocument[]

  /** Initial order count value (optional) */
  initialOrderCount?: number

  /**
   * Subscriber-mode flag. When true, the calculator reframes its copy
   * ("Project your next month" instead of "Calculate your potential ROI").
   * Defaults to false to preserve prospect behavior.
   */
  subscriberMode?: boolean
}
