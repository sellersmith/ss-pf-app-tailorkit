import type { GroupedPricingPlanDocument, PricingPlanDocument, PricingPlanInput } from './PricingPlan'
import mongoose from '~/bootstrap/db/connect-db.server'
import Subscription from './Subscription.server'
import Shop from './Shop.server'
import { validateCoupon } from './Coupon.server'
import { serverInitiator } from '~/bootstrap/fns/initiator'
import pricingPlans from './PricingPlan.define.sever'
import { getFreeOrdersCount, getOverageFeePerOrder } from './helpers/subscription-helpers.server'
import { getRemainingTrialDays } from './helpers/trial-tracking.server'
import { getDaysSinceInstall } from '~/bootstrap/fns/lifecycle-stage'

const pricingPlanSchema = new mongoose.Schema<PricingPlanDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    alias: {
      type: String,
      index: true,
    },
    /**
     * `optionName` will be used as an option when listing plans that share
     * the same `name`. E.g. If there are several plans sharing the same name
     * of `Pro` then in the pricing table, all plans having the `Pro` name will
     * be grouped into one single plan. In this case, `optionName` will be used
     * to display a list of options available for the `Pro` plan.
     */
    optionName: {
      type: String,
      index: true,
    },
    description: String,
    price: {
      type: Number,
      index: true,
      required: true,
    },
    /**
     * If `price` is $0 and `chargeApprovalRequired` is false, the app should ask merchants to
     * approve usage charges only when merchants run out of free resources.
     */
    chargeApprovalRequired: {
      type: Boolean,
      index: true,
      default: true,
    },
    periodical: {
      type: String,
      index: true,
      default: 'monthly',
      enum: ['monthly', 'annually', 'one-time'],
    },
    trialDays: {
      type: Number,
      index: true,
      default: 0,
    },
    status: {
      type: String,
      index: true,
      default: 'active',
      enum: ['active', 'inactive'],
    },
    /**
     * `couponCode` is the `code` of a document in the `coupons` collection. If `couponCode`
     * is defined, the affected coupon will be used to calculate the final price of the plan.
     */
    couponCode: {
      type: String,
      index: true,
    },
    /**
     * Pricing version: 1 = legacy (revenue-based), 2 = new (order-based)
     * Defaults to 1 for backward compatibility with existing plans.
     */
    pricingVersion: {
      type: Number,
      index: true,
      default: 1,
      enum: [1, 2],
    },
    /**
     * Whether users can manually select this plan (shown in pricing UI)
     * Set to false for internal plans like trial that are auto-assigned only
     * Defaults to true (selectable) for backward compatibility
     */
    userSelectable: {
      type: Boolean,
      index: true,
      default: true,
    },
    /**
     * Monthly AI credits included in plan
     * Resets at the start of each billing cycle
     */
    aiCreditsPerMonth: {
      type: Number,
    },
    /**
     * `features` is an object that defines the limitation of app features for a pricing plan.
     * Below is an example of `features` object definition:
     *
     * {
     *   assets: 100,
     *   templates: 100,
     * }
     *
     * The example above means that every shop subscribed to the plan can create 100 assets and
     * 100 templates at max.
     *
     * If `features` is not defined, all shops subscribed to the plan can create as many assets
     * and templates as they want.
     *
     * For Version 2 plans, features also includes boolean flags for hard feature gating:
     * - highResPngExport: High-resolution PNG export capability
     * - fulfillment3rdPartyApi: 3rd party fulfillment API access
     * - upsellCheckbox: Upsell checkbox feature
     * - losslessSvgExport: Lossless SVG export (Growth+ only)
     * - autoFulfillment: Automatic fulfillment (Growth+ only)
     * - bulkAssignedProducts: Bulk product assignment (Enterprise only)
     * - priorityFeatureRequests: Priority feature request queue (Enterprise only)
     * - dedicatedSuccessManager: Dedicated success manager (Enterprise only)
     */
    features: mongoose.Schema.Types.Mixed,
    /**
     * `usages` is an object that defines additional costs based on the usage of the app. Below
     * is an example of `usages` object definition:
     *
     * {
     *   revenue: [
     *     {
     *       totalFee: 4.99,
     *       from: 0,
     *       to: 200,
     *     },
     *     {
     *       totalFee: 11.99,
     *       additionalFee: 8,
     *       from: 200.01,
     *       to: 500,
     *     },
     *     {
     *       totalFee: 22.99,
     *       additionalFee: 12,
     *       from: 500.01,
     *       to: 1000,
     *     },
     *     {
     *       totalFee: 49.99,
     *       additionalFee: 24,
     *       from: 1000.01,
     *       to: 2000,
     *     },
     *     {
     *       totalFee: 95.99,
     *       additionalFee: 46,
     *       from: 2000.01,
     *       to: 4000,
     *     },
     *     {
     *       totalFee: 159.99,
     *       additionalFee: 88,
     *       from: 4000.01,
     *       to: 8000,
     *     },
     *     {
     *       totalFee: 284.99,
     *       additionalFee: 146,
     *       from: 8000.01,
     *       to: 15000,
     *     },
     *     {
     *       totalFee: 539.99,
     *       additionalFee: 270,
     *       from: 15000.01,
     *       to: 30000,
     *     },
     *     {
     *       totalFee: 1019.99,
     *       additionalFee: 450,
     *       from: 30000.01,
     *       to: 60000,
     *     },
     *     {
     *       totalFee: 1599.99,
     *       additionalFee: 450,
     *       from: 60000.01,
     *       to: 100000,
     *     },
     *     {
     *       totalFee: 1500,
     *       additionalFee: 0.01,
     *       from: 100000.01,
     *       to: Infinity,
     *     }
     *   ]
     * }
     *
     * The example above means that every shop subscribed to the plan will be charged usage
     * fees besides the monthly subscription fee as follows:
     *
     * - A fixed $4.99 fee for app-generated revenue from $0 to $200 a month.
     * - A fixed $11.99 fee for app-generated revenue from $200.01 to $500 a month.
     * - A fixed $22.99 fee for app-generated revenue from $500.01 to $1000 a month.
     * - A fixed $49.99 fee for app-generated revenue from $1000.01 to $2000 a month.
     * - A fixed $95.99 fee for app-generated revenue from $2000.01 to $4000 a month.
     * - A fixed $159.99 fee for app-generated revenue from $4000.01 to $8000 a month.
     * - A fixed $284.99 fee for app-generated revenue from $8000.01 to $15000 a month.
     * - A fixed $539.99 fee for app-generated revenue from $15000.01 to $30000 a month.
     * - A fixed $1,019.99 fee for app-generated revenue from $30000.01 to $60000 a month.
     * - A fixed $1,599.99 fee for app-generated revenue from $60000.01 to $100000 a month.
     * - A fixed $1,500 fee for app-generated revenue from $100000.01 and above a month.
     *
     * If `usages` is not defined, all shops subscribed to the plan will never be charged
     * usage fees regardless of how much they use the app.
     */
    usages: mongoose.Schema.Types.Mixed,
    cappedAmount: Number,
    /**
     * `applyTo` is a list of shop domains that allowed to use a plan. If `applyTo`
     * is not defined then the plan will be available for all shops.
     */
    applyTo: [
      {
        type: String,
        index: true,
      },
    ],
    /**
     *  `highlighted` is flag for suggesting customer a highlight plan.
     */
    highlighted: { type: Boolean, default: false },
    test: Boolean,
    expiredAt: Date,
  },
  { timestamps: true }
)

const PricingPlan
  = mongoose.models.PricingPlan || mongoose.model<PricingPlanDocument>('PricingPlan', pricingPlanSchema, 'pricing_plans')

export default PricingPlan

/**
 * Method to get all available plans available for a shop.
 *
 * @param shopDomain This is the domain end with `.myshopify.com`.
 * @param userSelectableOnly If true (default), excludes internal plans (userSelectable: false) like trial plans. Set to false to get all plans.
 *
 * @return {Promise<GroupedPricingPlanDocument[]>}
 */
export async function getAllPricingPlans(
  shopDomain: string,
  userSelectableOnly: boolean = true
): Promise<GroupedPricingPlanDocument[]> {
  // Build match conditions
  const matchConditions: any[] = [
    { status: 'active' },
    {
      $or: [{ expiredAt: null }, { expiredAt: { $exists: false } }, { expiredAt: { $gt: new Date() } }],
    },
    {
      $or: [
        { applyTo: null },
        { applyTo: shopDomain },
        { applyTo: { $exists: false } },
        { 'applyTo.0': { $exists: false } },
      ],
    },
  ]

  // Filter out internal plans (trial, etc.) by default
  // Keeps plans that are explicitly selectable OR don't have the field (backward compatible)
  if (userSelectableOnly) {
    matchConditions.push({
      $or: [{ userSelectable: { $ne: false } }, { userSelectable: { $exists: false } }],
    })
  }

  const plans = await PricingPlan.aggregate([
    {
      $match: {
        $and: matchConditions,
      },
    },
    {
      $group: {
        _id: '$name',
        lowestPrice: { $first: '$price' },
        highestPrice: { $last: '$price' },
        variants: {
          $push: {
            _id: '$_id',
            name: '$name',
            alias: '$alias',
            description: '$description',
            test: '$test',
            price: '$price',
            usages: '$usages',
            features: '$features',
            createdAt: '$createdAt',
            trialDays: '$trialDays',
            optionName: '$optionName',
            periodical: '$periodical',
            highlighted: '$highlighted',
            cappedAmount: '$cappedAmount',
            chargeApprovalRequired: '$chargeApprovalRequired',
            // Order-based pricing fields
            pricingVersion: '$pricingVersion',
            userSelectable: '$userSelectable',
            aiCreditsPerMonth: '$aiCreditsPerMonth',
          },
        },
      },
    },
    {
      $sort: {
        'variants.test': 1,
        'variants.price': 1,
        'variants.cappedAmount': 1,
        'usages.revenue.totalFee': 1,
        'variants.createdAt': -1,
      },
    },
  ]).exec()

  for (let i = 0; i < plans.length; i++) {
    plans[i].trialDays = await getPlanTrialDays(shopDomain, plans[i].variants[0])
  }

  return plans
}

/**
 * Method to get the final price of a plan after applying coupon.
 *
 * @param plan       Either the `_id` property or a plan object.
 * @param couponCode The coupon code to apply discount.
 * @param shopDomain This is the domain end with `.myshopify.com`.
 *
 * @return {Promise<number>}
 */
export async function getPlanPriceAfterDiscount(plan: any, couponCode: any, shopDomain: string): Promise<number> {
  plan = typeof plan === 'string' ? await PricingPlan.findOne({ _id: plan }) : plan
  couponCode = couponCode || plan?.couponCode

  const coupon = couponCode && (await validateCoupon(couponCode, shopDomain))
  const { discount } = coupon || {}

  let price = plan?.price || 0

  if (price && discount) {
    price = discount.type === 'fixed' ? price - discount.amount : price * (1 - discount.amount / 100)
  }

  return price
}

/**
 * Method to get the final usage fee of a plan after applying coupon.
 *
 * @param plan       Either the `_id` property or a plan object.
 * @param usageFee   The usage fee to apply discount.
 * @param couponCode The coupon code to apply discount.
 * @param shopDomain This is the domain end with `.myshopify.com`.
 *
 * @return {Promise<number>}
 */
export async function getUsageFeeAfterDiscount(
  plan: any,
  usageFee: number,
  couponCode: any,
  shopDomain: string
): Promise<number> {
  plan = typeof plan === 'string' ? await PricingPlan.findOne({ _id: plan }) : plan
  couponCode = couponCode || plan?.couponCode

  const coupon = couponCode && (await validateCoupon(couponCode, shopDomain))
  const { discount } = coupon || {}

  let _usageFee = usageFee || 0

  if (_usageFee && discount) {
    _usageFee = discount.type === 'fixed' ? _usageFee - discount.amount : _usageFee * (1 - discount.amount / 100)
  }

  return _usageFee
}

/**
 * Calculate overage fee for order-based pricing
 * Coupons do NOT apply to overage fees (only to base subscription price)
 *
 * @param plan - Either the `_id` property or a plan object
 * @param orderCount - Total number of orders in the billing cycle
 * @returns Overage fee amount (0 if no overage)
 */
export async function calculateOverageFee(plan: any, orderCount: number): Promise<number> {
  plan = typeof plan === 'string' ? await PricingPlan.findOne({ _id: plan }) : plan

  // Only applies to order-based plans (has usages.orders)
  if (!plan?.usages?.orders || plan.usages.orders.length === 0) {
    return 0
  }

  // Use helper functions to get order pricing details
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)

  // No overage if within included orders
  if (orderCount <= includedOrders) {
    return 0
  }

  // Calculate overage: (total orders - included orders) * fee per order
  const overageOrders = orderCount - includedOrders
  const overageFee = overageOrders * overageFeePerOrder

  return overageFee
}

/**
 * Calculate billing cycle dates based on billing anchor date
 * Returns the current billing cycle (from/to dates) for a given anchor date
 *
 * @param billingAnchorDate - The date when billing cycle started
 * @param currentDate - Current date (defaults to now)
 * @returns Object with from/to dates for current billing cycle
 */
export function getBillingCycleDates(
  billingAnchorDate: Date | string,
  currentDate: Date | string = new Date()
): { from: Date; to: Date } {
  const anchorDate = billingAnchorDate instanceof Date ? billingAnchorDate : new Date(billingAnchorDate)
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate)

  // Calculate how many 30-day cycles have passed since anchor
  const millisInCycle = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
  const millisSinceAnchor = now.getTime() - anchorDate.getTime()
  const cyclesPassed = Math.floor(millisSinceAnchor / millisInCycle)

  // Calculate current cycle start (from)
  const from = new Date(anchorDate.getTime() + cyclesPassed * millisInCycle)

  // Calculate current cycle end (to) - 1 millisecond before next cycle starts
  const to = new Date(from.getTime() + millisInCycle - 1)

  return { from, to }
}

/**
 * Helper function to get the trial days available for a shop to try a plan.
 *
 * If a shop was already tried the given plan before then the trial days will
 * always be set to 0 regardless of whether the plan offers trial days or not.
 *
 * @param shopDomain This is the domain end with `.myshopify.com`.
 * @param plan       Either the `_id` property or a plan object.
 *
 * @return {Promise<number>}
 */
export async function getPlanTrialDays(shopDomain: string, plan: any): Promise<number> {
  plan = typeof plan === 'string' ? await PricingPlan.findOne({ _id: plan }) : plan

  // If no trial configured, return 0
  if (!plan.trialDays || plan.trialDays <= 0) {
    return 0
  }

  const shop = await Shop.findOne({ shopDomain })
  const subscription = await Subscription.findOne({ shopDomain, status: 'active' })

  // PRIORITY 1: V1 (Revenue-based) with Shopify-managed trial
  // Check revenue-based plans FIRST
  if (plan.usages?.revenue && subscription?.shopifyCharge?.trial_ends_on) {
    const trialEndsOn = new Date(subscription.shopifyCharge.trial_ends_on)
    const now = new Date()
    const remainingDays = Math.max(0, Math.ceil((trialEndsOn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    return remainingDays > 0 ? remainingDays : 0
  }

  // PRIORITY 2: V2 (Order-based) with Active-days trial
  if (shop?.trialStartedAt) {
    const remainingDays = getRemainingTrialDays(shop, plan)
    return remainingDays
  }

  // Dynamic trial: deduct days since install so merchants can't delay plan selection for free time
  const daysSinceInstall = getDaysSinceInstall(shop?.createdAt)
  return Math.max(0, plan.trialDays - daysSinceInstall)
}

export async function runCreateDefaultPricingPlans() {
  if (!process.env.DEFAULT_PRICING_PLANS_IMPORTED) {
    ;(async function () {
      // Import default pricing plans
      for (const pricingPlan of pricingPlans) {
        const { name, alias, ...rest } = pricingPlan as PricingPlanInput

        if (alias) {
          await PricingPlan.updateOne({ alias }, { ...rest, name }, { upsert: true })
        } else {
          await PricingPlan.updateOne({ name }, rest, { upsert: true })
        }
      }

      // // Cancel active subscriptions that were not approved Shopify usage charge
      // const activePlans = (await PricingPlan.find({ status: 'active' })).map(p => p._id)

      // const subscriptions = await Subscription.find({
      //   $and: [
      //     { status: 'active' },
      //     { periodical: 'monthly' },
      //     { plan: { $nin: activePlans } },
      //     {
      //       $or: [
      //         { shopifyCharge: null },
      //         { shopifyCharge: { $exists: false } },
      //         { 'shopifyCharge.activated_on': null },
      //         { 'shopifyCharge.activated_on': { $exists: false } },
      //       ],
      //     },
      //   ],
      // })

      // for (let i = 0; i < subscriptions.length; i++) {
      //   await cancelCurrentSubscription(subscriptions[i].shopDomain, true, false)
      // }
    })()

    process.env.DEFAULT_PRICING_PLANS_IMPORTED = 'yes'
  }
}

// Add runCreateDefaultPricingPlans to serverInitiator
serverInitiator.addInitiator(runCreateDefaultPricingPlans)
