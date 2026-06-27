import type mongoose from 'mongoose'

/**
 * PlanChangeRecord - Plan change event tracking
 *
 * Tracks ONLY plan change events (upgrade, downgrade, cancellation).
 * Usage charges are tracked in BillingCycle.charges.usageFees, NOT here.
 *
 * Single Source of Truth:
 * - Plan changes: PlanChangeRecord (this model)
 * - Usage charges: BillingCycle.charges.usageFees[]
 */
export interface PlanChangeRecordDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  shopDomain: string
  subscriptionId: mongoose.Types.ObjectId

  /**
   * Plan transition:
   * - For upgrade: fromPlan (lower tier) → toPlan (higher tier)
   * - For downgrade: fromPlan (higher tier) → toPlan (lower tier)
   * - For cancellation: fromPlan → 'cancelled'
   */
  fromPlan: mongoose.Types.ObjectId | string
  toPlan: mongoose.Types.ObjectId | string

  /**
   * Total order count at time of this plan change
   */
  orderCountAtEvent: number

  /**
   * Event type (ONLY plan changes):
   * - 'upgrade': User upgraded to higher plan
   * - 'downgrade': User downgraded to lower plan
   * - 'cancellation': User cancelled subscription
   *
   * NOTE: 'usage-charge' removed - usage charges tracked in BillingCycle
   */
  eventType: 'upgrade' | 'downgrade' | 'cancellation'

  /**
   * When this plan change occurred
   */
  eventDate: Date

  /**
   * Charge breakdown for UI display
   * Shows charges owed from OLD plan at time of switch
   */
  chargeDetails: {
    timeline: Date
    planName: string
    feePerOrder: number
    extraOrders: number
    subtotal: number
  }

  createdAt: Date
  updatedAt: Date
}

/**
 * Plan change event types (usage-charge removed)
 */
export type PlanChangeEventType = 'upgrade' | 'downgrade' | 'cancellation'
