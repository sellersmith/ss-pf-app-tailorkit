/**
 * Plan Display Mapper
 *
 * Converts database PricingPlanDocument to UI display format.
 * This ensures Single Source of Truth - all data comes from database,
 * eliminating hardcoded duplication in PLAN_DISPLAY_DATA.
 */

import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { TFunction } from 'i18next'
import { getFreeOrdersCount, getOverageFeePerOrder, isOrderBasedPlan } from '~/models/helpers/pricing-utils'

export interface PlanFeature {
  text: string
  multiline?: boolean // For features that wrap to multiple lines
  /** Bold the feature text and show a lightning icon */
  highlight?: boolean
}

export interface PlanDisplayData {
  tier: string
  alias: string
  price: number // Base subscription fee
  includedOrders: number
  overageFeePerOrder: number
  aiCreditsPerMonth: number
  trialDays?: number
  /** Promotional badge text (e.g. "Most Popular") — shown on plan card */
  badge?: string
  features: PlanFeature[]
  // Projected pricing based on current usage
  projectedTotal?: number // Total price including extra order fees
  projectedExtraOrderFee?: number // Extra order fees only
  projectedExtraOrders?: number // Number of extra orders
}

/**
 * Maps database PricingPlanDocument to UI display format
 * @param plan - Pricing plan document
 * @param t - Translation function
 * @param subscription - Optional current subscription for calculating projected pricing
 * @param currentOrderCount - Optional current order count in billing cycle
 * @param billingCycleBaseline - Optional billing cycle baseline (orderCount.initial from BillingCycle)
 */
export function mapPlanToDisplayData(
  plan: PricingPlanDocument,
  t: TFunction,
  subscription?: SubscriptionDocument | null,
  currentOrderCount?: number,
  billingCycleBaseline?: number
): PlanDisplayData {
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)
  const aiCreditsPerMonth = plan.aiCreditsPerMonth || 0

  // Build features array based on plan capabilities
  const features = buildPlanFeatures(plan, includedOrders, aiCreditsPerMonth, t)

  // Calculate projected pricing ONLY for current plan
  // Other plans should show base price for easy comparison
  let projectedTotal: number | undefined
  let projectedExtraOrderFee: number | undefined
  let projectedExtraOrders: number | undefined

  if (subscription && typeof currentOrderCount === 'number') {
    // Check if this is the current plan
    const currentPlanId = typeof subscription.plan === 'string' ? subscription.plan : subscription.plan?._id?.toString()
    const isCurrentPlan = currentPlanId === plan._id.toString()

    // Only calculate projected pricing for current plan
    if (isCurrentPlan) {
      // Baseline from BillingCycle.orderCount.initial via BillingStateManager
      const baseline = billingCycleBaseline ?? 0
      const ordersSinceBillingCycle = currentOrderCount - baseline

      // Calculate projected charges for this plan
      if (ordersSinceBillingCycle > includedOrders) {
        projectedExtraOrders = ordersSinceBillingCycle - includedOrders
        projectedExtraOrderFee = projectedExtraOrders * overageFeePerOrder
      } else {
        projectedExtraOrders = 0
        projectedExtraOrderFee = 0
      }

      projectedTotal = (plan.price || 0) + projectedExtraOrderFee
    }
  }

  // Growth plan gets the "Most Popular" badge
  const isGrowthPlan = plan.name.toLowerCase().includes('growth')
  const badge = isGrowthPlan ? t('most-popular') : undefined

  return {
    tier: plan.name, // e.g., "Starter", "Growth", "Enterprise"
    alias: plan.alias || '',
    price: plan.price || 0,
    badge,
    includedOrders,
    overageFeePerOrder,
    aiCreditsPerMonth,
    trialDays: plan.trialDays || 0,
    features,
    projectedTotal,
    projectedExtraOrderFee,
    projectedExtraOrders,
  }
}

/**
 * Builds feature list based on plan capabilities (not hardcoded values)
 * Follows capability-based design pattern from CLAUDE.md
 */
function buildPlanFeatures(
  plan: PricingPlanDocument,
  _includedOrders: number,
  aiCreditsPerMonth: number,
  t: TFunction
): PlanFeature[] {
  const features: PlanFeature[] = []

  // Determine tier for feature inheritance
  const tier = plan.name.toLowerCase()
  const isGrowth = tier.includes('growth')
  const isEnterprise = tier.includes('enterprise')

  if (isEnterprise) {
    // Enterprise: inherits all Growth features plus extras
    features.push({ text: t('all-growth-features') })
    if (plan.features?.dedicatedSuccessManager) {
      features.push({ text: t('dedicated-success-manager') })
    }
  } else if (isGrowth) {
    // Growth: inherits Starter features plus Growth-specific ones
    features.push({ text: t('all-starters-features-plus') })
    features.push({ text: t('count-ai-credits-per-month', { count: aiCreditsPerMonth }) })
    if (plan.features?.losslessSvgExport) {
      features.push({ text: t('lossless-print-files-svg-png'), highlight: true })
    }
    if (plan.features?.autoFulfillment) {
      features.push({ text: t('auto-send-files-to-print-provider'), highlight: true })
    }

    if (plan.features?.charmBuilder) {
      features.push({ text: t('charm-builder') })
    }
    if (plan.features?.upsellCheckbox && plan.features?.upsellProductLimit === null) {
      features.push({ text: t('unlimited-upsell-products') })
    }
    if (plan.features?.dedicatedSuccessManager) {
      features.push({ text: t('dedicated-success-manager') })
    }
  } else {
    // Starter: base feature set
    features.push({ text: t('unlimited-personalized-products') })
    features.push({ text: t('unlimited-customization-options') })
    features.push({ text: t('live-product-preview-on-storefront') })
    features.push({ text: t('ai-powered-design-tools-included') })
    features.push({ text: t('high-quality-print-ready-files-per-order') })
    if (plan.features?.upsellCheckbox) {
      if (typeof plan.features?.upsellProductLimit === 'number') {
        features.push({ text: t('upsell-product-at-checkout') })
      }
      features.push({ text: t('custom-upsell-pricing') })
    }
    features.push({ text: t('analytics-dashboard') })
  }

  return features
}

/**
 * Converts array of database plans to display data array
 * Filters only user-selectable V2 plans (order-based)
 * @param plans - Array of pricing plans
 * @param t - Translation function
 * @param subscription - Optional current subscription for calculating projected pricing
 * @param currentOrderCount - Optional current order count in billing cycle
 * @param billingCycleBaseline - Optional billing cycle baseline (orderCount.initial from BillingCycle)
 */
export function mapPlansToDisplayData(
  plans: PricingPlanDocument[],
  t: TFunction,
  subscription?: SubscriptionDocument | null,
  currentOrderCount?: number,
  billingCycleBaseline?: number
): PlanDisplayData[] {
  return plans
    .filter(plan => {
      // Only show user-selectable plans
      if (plan.userSelectable === false) return false

      // Only show order-based plans (V2+)
      return isOrderBasedPlan(plan)
    })
    .map(plan => mapPlanToDisplayData(plan, t, subscription, currentOrderCount, billingCycleBaseline))
}
