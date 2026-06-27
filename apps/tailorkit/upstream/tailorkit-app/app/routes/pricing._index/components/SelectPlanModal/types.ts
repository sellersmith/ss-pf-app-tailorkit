/**
 * SelectPlanModal Type Definitions
 */

import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { CalculatedPrice } from '../PricingCalculator/types'

/**
 * Props for the SelectPlanModal component
 */
export interface SelectPlanModalProps {
  /**
   * Translation function
   */
  t: TFunction

  /**
   * Whether the modal is open
   */
  open: boolean

  /**
   * Callback to close the modal
   */
  onClose: () => void

  /**
   * The selected plan to display
   */
  plan: PricingPlanDocument | null

  /**
   * Calculated price breakdown
   */
  calculatedPrice: CalculatedPrice | null

  /**
   * Callback when user confirms plan selection
   * @param discountCode - Optional discount code entered by the user
   */
  onConfirm: (discountCode?: string) => void

  /**
   * Whether the confirmation is in progress
   */
  isLoading?: boolean

  /**
   * Whether this is an old pricing migration user
   */
  isOldPricingMigration?: boolean

  /**
   * Current billing cycle order count (for migration warning banner)
   */
  currentOrderUsage?: number

  /**
   * Current billing cycle AI credit usage (for migration warning banner)
   */
  currentAiCreditUsage?: number

  /**
   * Pre-seeded coupon code to auto-apply for migration users
   */
  migrationCouponCode?: string

  /**
   * Actual remaining trial days based on server calculation.
   * null = new user (show plan.trialDays), number = actual remaining days.
   */
  remainingTrialDays?: number | null

  /** Whether the $1 deal promotion window is open */
  isDealActive?: boolean

  /** Whether this shop has never paid and is eligible for the $1 deal */
  isDealEligible?: boolean
}
