import type { PlanChangeRecordDocument } from './PlanChangeRecord'
import mongoose from '~/bootstrap/db/connect-db.server'

/**
 * PlanChangeRecord Model
 *
 * Tracks plan change events (upgrades, downgrades, cancellations) for analytics and timeline display.
 *
 * IMPORTANT: Usage charges are tracked in BillingCycle.charges.usageFees, NOT here.
 * This model only tracks PLAN CHANGE events for event-level timeline and analytics.
 *
 * Single Source of Truth:
 * - Plan changes (upgrade/downgrade/cancel): PlanChangeRecord (this model)
 * - Usage charges: BillingCycle.charges.usageFees[]
 *
 * Event Types:
 * 1. 'upgrade': User upgraded to higher-tier plan
 *    - fromPlan < toPlan (by price)
 *    - Created when user switches to more expensive plan
 *    - Shows charges owed from OLD plan at time of switch
 *
 * 2. 'downgrade': User downgraded to lower-tier plan
 *    - fromPlan > toPlan (by price)
 *    - Created when user switches to less expensive plan
 *    - Shows charges owed from OLD plan at time of switch
 *
 * 3. 'cancellation': User cancelled subscription
 *    - toPlan = 'cancelled'
 *    - Shows final charges before cancellation
 *
 * Use cases:
 * - Analytics: Track upgrade/downgrade patterns
 * - Timeline: Show plan change history
 * - Audit trail: Complete plan change record
 */
const planChangeRecordSchema = new mongoose.Schema<PlanChangeRecordDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    fromPlan: {
      type: mongoose.Schema.Types.Mixed, // ObjectId or string
      required: true,
    },
    toPlan: {
      type: mongoose.Schema.Types.Mixed, // ObjectId, string, or 'cancelled'
      required: true,
    },
    orderCountAtEvent: {
      type: Number,
      required: true,
    },
    eventType: {
      type: String,
      enum: ['upgrade', 'downgrade', 'cancellation'], // Only plan change events
      required: true,
      index: true,
    },
    eventDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    chargeDetails: {
      timeline: {
        type: Date,
        required: true,
      },
      planName: {
        type: String,
        required: true,
      },
      feePerOrder: {
        type: Number,
        required: true,
      },
      extraOrders: {
        type: Number,
        required: true,
      },
      subtotal: {
        type: Number,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient queries
planChangeRecordSchema.index({ shopDomain: 1, eventDate: -1 })
planChangeRecordSchema.index({ subscriptionId: 1, eventDate: -1 })
planChangeRecordSchema.index({ eventType: 1, eventDate: -1 })

const PlanChangeRecord
  = mongoose.models.PlanChangeRecord
  || mongoose.model<PlanChangeRecordDocument>('PlanChangeRecord', planChangeRecordSchema)

export default PlanChangeRecord

/**
 * Get plan change records for a subscription
 * Returns only plan changes (upgrade/downgrade/cancellation), NOT usage charges
 */
export async function getPlanChangeRecordsBySubscription(subscriptionId: string): Promise<PlanChangeRecordDocument[]> {
  const {
    Types: { ObjectId },
  } = mongoose

  const subscriptionObjectId = ObjectId.isValid(subscriptionId) ? new ObjectId(subscriptionId) : subscriptionId

  return (await PlanChangeRecord.find({ subscriptionId: subscriptionObjectId })
    .sort({ eventDate: -1 })
    .lean()) as unknown as PlanChangeRecordDocument[]
}

/**
 * Get plan change records for a shop
 */
export async function getPlanChangeRecordsByShop(shopDomain: string): Promise<PlanChangeRecordDocument[]> {
  return (await PlanChangeRecord.find({ shopDomain })
    .sort({ eventDate: -1 })
    .lean()) as unknown as PlanChangeRecordDocument[]
}

/**
 * Create a plan change record (upgrade, downgrade, or cancellation)
 *
 * NOTE: Do NOT use this for usage charges - those go in BillingCycle.charges.usageFees
 */
export async function createPlanChangeRecord(record: {
  shopDomain: string
  subscriptionId: mongoose.Types.ObjectId
  fromPlan: any
  toPlan: any
  orderCountAtEvent: number
  eventType: 'upgrade' | 'downgrade' | 'cancellation'
  eventDate: Date
  chargeDetails: {
    timeline: Date
    planName: string
    feePerOrder: number
    extraOrders: number
    subtotal: number
  }
}): Promise<PlanChangeRecordDocument> {
  return (await PlanChangeRecord.create(record)) as unknown as PlanChangeRecordDocument
}
