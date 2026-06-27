import type { BillingCycleDocument, UsageFeeRecord } from './BillingCycle'
import mongoose from '~/bootstrap/db/connect-db.server'

/**
 * Billing Cycle Schema
 *
 * Dedicated collection for complete 30-day billing cycle tracking.
 * Each cycle is an immutable record after completion.
 *
 * Key Features:
 * - Self-contained: All billing context in one document
 * - Immutable: Completed cycles never change
 * - Complete history: All cycles preserved forever
 * - Easy analytics: Cycle-based aggregation queries
 *
 * Lifecycle:
 * 1. Created: When subscription starts or cycle rolls over
 * 2. Updated: Daily with order counts and usage charges
 * 3. Completed: When cycle ends or plan changes
 *
 * Query Examples:
 * ```typescript
 * // Get active cycle
 * const cycle = await BillingCycle.findOne({ shopDomain, status: 'active' })
 *
 * // Get last 3 months history
 * const cycles = await BillingCycle.find({
 *   shopDomain,
 *   cycleStartDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
 * }).sort({ cycleStartDate: -1 })
 * ```
 */
const billingCycleSchema = new mongoose.Schema<BillingCycleDocument>(
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PricingPlan',
      required: true,
      index: true,
    },

    // Cycle boundaries
    cycleStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    cycleEndDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      required: true,
      index: true,
    },

    // Order tracking (snapshot at cycle boundaries)
    orderCount: {
      initial: {
        type: Number,
        default: 0,
        required: true,
      },
      current: {
        type: Number,
        default: 0,
        required: true,
      },
      final: {
        type: Number,
        default: null,
      },
    },

    // Plan limits (snapshot for historical accuracy)
    planLimits: {
      includedOrders: {
        type: Number,
        required: true,
      },
      overageFeePerOrder: {
        type: Number,
        required: true,
      },
      monthlyFee: {
        type: Number,
        required: true,
      },
    },

    // Charges accumulated in this cycle
    charges: {
      subscriptionFee: {
        type: Number,
        default: 0,
        required: true,
      },
      usageFees: {
        type: [
          {
            chargedAt: {
              type: Date,
              required: true,
            },
            orderCount: {
              type: Number,
              required: true,
            },
            extraOrders: {
              type: Number,
              required: true,
            },
            amount: {
              type: Number,
              required: true,
            },
            shopifyChargeId: {
              type: String,
            },
          },
        ],
        default: [],
      },
      totalUsageFees: {
        type: Number,
        default: 0,
        required: true,
      },
      totalCharges: {
        type: Number,
        default: 0,
        required: true,
      },
    },

    // Metadata
    metadata: {
      isFirstCycle: {
        type: Boolean,
        default: false,
      },
      isTrialCycle: {
        type: Boolean,
        default: false,
      },
      planChangeInCycle: {
        type: Boolean,
        default: false,
      },
      previousCycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BillingCycle',
      },
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient queries
billingCycleSchema.index({ shopDomain: 1, cycleStartDate: -1 })
billingCycleSchema.index({ shopDomain: 1, status: 1 })
billingCycleSchema.index({ subscriptionId: 1, cycleStartDate: -1 })
billingCycleSchema.index({ status: 1, cycleEndDate: 1 })

const BillingCycle
  = mongoose.models.BillingCycle || mongoose.model<BillingCycleDocument>('BillingCycle', billingCycleSchema)

export default BillingCycle

/**
 * Get active billing cycle for a shop
 * Returns the current active cycle, or null if none exists
 *
 * @param shopDomain - Shopify store domain
 * @returns Active billing cycle or null
 */
export async function getActiveCycle(shopDomain: string): Promise<BillingCycleDocument | null> {
  return (await BillingCycle.findOne({ shopDomain, status: 'active' }).lean()) as unknown as BillingCycleDocument | null
}

/**
 * Get billing cycles for a shop
 * Returns cycles sorted by start date (newest first)
 *
 * @param shopDomain - Shopify store domain
 * @param daysBack - Number of days to look back (default: 90 days)
 * @returns Array of billing cycles
 */
export async function getBillingCycles(shopDomain: string, daysBack: number = 90): Promise<BillingCycleDocument[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  return (await BillingCycle.find({
    shopDomain,
    cycleStartDate: { $gte: startDate },
  })
    .populate('planId', 'name alias') // Populate plan name for UI display
    .sort({ cycleStartDate: -1 })
    .lean()) as unknown as BillingCycleDocument[]
}

/**
 * Get billing cycles for a subscription
 * Returns all cycles for a specific subscription
 *
 * @param subscriptionId - Subscription ObjectId or string
 * @returns Array of billing cycles sorted by start date (newest first)
 */
export async function getCyclesBySubscription(subscriptionId: string): Promise<BillingCycleDocument[]> {
  const {
    Types: { ObjectId },
  } = mongoose

  const subscriptionObjectId = ObjectId.isValid(subscriptionId) ? new ObjectId(subscriptionId) : subscriptionId

  return (await BillingCycle.find({ subscriptionId: subscriptionObjectId })
    .sort({ cycleStartDate: -1 })
    .lean()) as unknown as BillingCycleDocument[]
}

/**
 * Create a new billing cycle
 *
 * @param params - Cycle creation parameters
 * @returns Newly created billing cycle
 */
export async function createBillingCycle(params: {
  shopDomain: string
  subscriptionId: string | mongoose.Types.ObjectId
  planId: string | mongoose.Types.ObjectId
  cycleStartDate: Date
  cycleEndDate: Date
  initialOrderCount: number
  planLimits: {
    includedOrders: number
    overageFeePerOrder: number
    monthlyFee: number
  }
  metadata?: {
    isFirstCycle?: boolean
    isTrialCycle?: boolean
    previousCycleId?: string | mongoose.Types.ObjectId
  }
}): Promise<BillingCycleDocument> {
  const {
    Types: { ObjectId },
  } = mongoose

  // Defensive: Handle both string and ObjectId formats
  const subscriptionObjectId
    = params.subscriptionId instanceof ObjectId ? params.subscriptionId : new ObjectId(params.subscriptionId)
  const planObjectId = params.planId instanceof ObjectId ? params.planId : new ObjectId(params.planId)
  const previousCycleObjectId = params.metadata?.previousCycleId
    ? params.metadata.previousCycleId instanceof ObjectId
      ? params.metadata.previousCycleId
      : new ObjectId(params.metadata.previousCycleId)
    : undefined

  const cycle = await BillingCycle.create({
    shopDomain: params.shopDomain,
    subscriptionId: subscriptionObjectId,
    planId: planObjectId,
    cycleStartDate: params.cycleStartDate,
    cycleEndDate: params.cycleEndDate,
    status: 'active',
    orderCount: {
      initial: params.initialOrderCount,
      current: params.initialOrderCount,
      final: null,
    },
    planLimits: params.planLimits,
    charges: {
      subscriptionFee: 0,
      usageFees: [],
      totalUsageFees: 0,
      totalCharges: 0,
    },
    metadata: {
      isFirstCycle: params.metadata?.isFirstCycle || false,
      isTrialCycle: params.metadata?.isTrialCycle || false,
      planChangeInCycle: false,
      previousCycleId: previousCycleObjectId,
    },
  })

  return cycle.toObject() as unknown as BillingCycleDocument
}

/**
 * Update order count in active cycle
 *
 * @param shopDomain - Shopify store domain
 * @param orderCount - New order count
 */
export async function updateCycleOrderCount(shopDomain: string, orderCount: number): Promise<void> {
  await BillingCycle.updateOne({ shopDomain, status: 'active' }, { $set: { 'orderCount.current': orderCount } })
}

/**
 * Add usage fee to active cycle
 *
 * @param shopDomain - Shopify store domain
 * @param usageFee - Usage fee record to add
 */
export async function addUsageFee(shopDomain: string, usageFee: UsageFeeRecord): Promise<void> {
  await BillingCycle.updateOne(
    { shopDomain, status: 'active' },
    {
      $push: { 'charges.usageFees': usageFee },
      $inc: {
        'charges.totalUsageFees': usageFee.amount,
        'charges.totalCharges': usageFee.amount,
      },
    }
  )
}

/**
 * Complete a billing cycle
 * Sets status to 'completed' and records final order count
 *
 * @param shopDomain - Shopify store domain
 * @param finalOrderCount - Final order count at completion
 */
export async function completeCycle(shopDomain: string, finalOrderCount: number): Promise<void> {
  await BillingCycle.updateOne(
    { shopDomain, status: 'active' },
    {
      $set: {
        status: 'completed',
        'orderCount.final': finalOrderCount,
      },
    }
  )
}

/**
 * Mark plan change in current cycle
 * Sets planChangeInCycle flag to true
 *
 * @param shopDomain - Shopify store domain
 */
export async function markPlanChange(shopDomain: string): Promise<void> {
  await BillingCycle.updateOne({ shopDomain, status: 'active' }, { $set: { 'metadata.planChangeInCycle': true } })
}

/**
 * Cancel active cycle
 * Sets status to 'cancelled'
 *
 * @param shopDomain - Shopify store domain
 */
export async function cancelCycle(shopDomain: string): Promise<void> {
  await BillingCycle.updateOne({ shopDomain, status: 'active' }, { $set: { status: 'cancelled' } })
}
