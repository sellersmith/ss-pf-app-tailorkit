import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from './PricingPlan'
import type { ShopDocument } from './Shop'
import { getObjectPaths, getObjectValueByKeyPath } from '~/bootstrap/fns/misc'
import type { SubscriptionDocument } from './Subscription'
import { isInstalledBeforeReleasingV1PricingPlan } from '~/bootstrap/constants/releaseStages'
import { getActiveTrialDays } from './helpers/trial-utils'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'

/**
 * Check if a shop has a populated subscription with a plan.
 * Handles Mongoose population edge cases (unpopulated = string ObjectId).
 */
export function hasActivePlan(
  shopData: ShopDocument | null | undefined
): shopData is ShopDocument & { subscription: SubscriptionDocument & { plan: PricingPlanDocument } } {
  if (!shopData?.subscription || typeof shopData.subscription === 'string') return false
  const sub = shopData.subscription as SubscriptionDocument
  return !!sub.plan && typeof sub.plan !== 'string'
}

/**
 * Helper function to check whether a shop can use a feature.
 *
 * @param params
 *
 * @return {boolean|number}
 */
export function canUse(params: {
  // A `ShopDocument` object
  shopData: ShopDocument
  // The feature to check. Either of the following keys:
  // - `*`: Use `*` as feature key to check all declared features.
  // - `assets`: Number of assets. Remember to check this feature before saving
  // an asset to ensure shops cannot have assets more than the limit.
  // - `templates`: Number of templates. Remember to check this feature before
  // saving a template to ensure shops cannot have templates more than the limit.
  feature?: string
  // A plan object. If not provided then the active plan of the specified shop will be used.
  plan?: PricingPlanDocument
  // Whether to allow current uses equal to the max. allowed uses
  allowEqual?: boolean
  // Function to translate text strings
  t?: TFunction
}): boolean | number {
  // Extract parameters
  const { shopData, feature = '*', allowEqual = false } = params
  let { plan = null } = params

  if (
    !shopData.subscription
    || typeof shopData.subscription === 'string'
    || (!plan && (!shopData.subscription.plan || typeof shopData.subscription.plan === 'string'))
  ) {
    return true
  }

  // Get plan data
  const isCurrent = !plan
  plan = plan || (shopData.subscription.plan as PricingPlanDocument)

  // Get plan limit
  /**
   * @description Because all features are preserved => there is not limitation
   * @see PricingPlan.server.ts
   *
   */
  const limit = plan.features

  if (!limit) {
    return true
  }

  // Prepare translate function
  const t
    = params.t
    || function (text: string, params?: any) {
      return params ? { text, params } : text
    }

  // Check feature usages
  const features = feature === '*' ? getObjectPaths(limit) : [feature]

  for (let i = 0; i < features.length; i++) {
    let valid = true

    // Get feature definition
    const allowed = getObjectValueByKeyPath(limit, features[i])

    // Get current feature usage
    const current = (getObjectValueByKeyPath(shopData.usages as Record<string, unknown>, features[i]) as number) || 0

    // Check the current usage against the plan limit
    if (current) {
      if (typeof allowed === 'number' && ((allowEqual && current > allowed) || (!allowEqual && current >= allowed))) {
        valid = false
      } else if (typeof allowed === 'boolean' && !allowed) {
        valid = false
      }
    }

    if (!valid) {
      const name = plan && `${plan.name + (plan.optionName ? ` (${plan.optionName})` : '')}`

      const feature = features[i]
        .split('.')
        .reverse()
        .join(' ')
        .replace(/[A-Z]/g, (c: string) => ` ${c.toLowerCase()}`)

      throw {
        [feature]: {
          [typeof allowed === 'boolean' ? 'in use' : 'current use']: current,
          [typeof allowed === 'boolean' ? 'usable' : 'maximum use']: allowed,
        },
        message:
          typeof allowed === 'boolean'
            ? isCurrent
              ? t('your-name-plan-is-not-allowed-to-use-feature', { name, feature })
              : t('the-name-plan-is-not-allowed-to-use-feature', { name, feature })
            : isCurrent
              ? t('you-have-reached-the-maximum-of-allowed-feature-allowed-by-your-name-plan', {
                  allowed,
                  feature,
                  name,
                })
              : t('you-have-reached-the-maximum-of-allowed-feature-allowed-by-the-name-plan', {
                  allowed,
                  feature,
                  name,
                }),
      }
    }

    if (feature !== '*') {
      return valid
    }
  }

  return true
}

/**
 * Helper function to check whether a shop can use the app without accepting a charge.
 *
 * @param params
 *
 * @return {boolean|number}
 */
export function canUseFreeResources(params: {
  // A `ShopDocument` object
  shopData: ShopDocument
  // A plan object. If not provided then the active plan of the specified shop will be used.
  plan?: PricingPlanDocument
}): boolean | number {
  // Extract parameters
  const { shopData } = params
  let { plan = null } = params
  plan = plan || ((shopData.subscription as SubscriptionDocument)?.plan as PricingPlanDocument)

  // Get appInstalled date
  const installedAt = shopData.createdAt

  // Check if customer installed app before releasing v1 pricing plan
  const installBeforeReleasingV1PricingPlan = isInstalledBeforeReleasingV1PricingPlan(installedAt)

  // Check if customer approved charge or not
  const approvedCharge = isApprovedCharge(shopData)

  if (
    // Once customers approve charge, there are no limitation for them
    approvedCharge
    // No limitation for customers installing app before releasing v1 pricing plan
    || installBeforeReleasingV1PricingPlan
  ) {
    return true
  }

  // First-product-free: allow shops to use the app freely until they either:
  // 1. Publish a 2nd product (gated at publish time in UnifiedHeader via pricing modal)
  // 2. Receive their first order (achievedFirstSale flag set by webhook)
  const publishedCount = shopData.usages?.totalPublishedIntegrations || 0
  const hasFirstOrder = shopData.usages?.achievedFirstSale || false
  if (publishedCount < 2 && !hasFirstOrder) {
    return true
  }

  // Shops without a populated subscription must select a plan from the pricing page
  // (Pre-v1 shops are already handled above by installBeforeReleasingV1PricingPlan)
  if (
    !shopData.subscription
    || typeof shopData.subscription === 'string'
    || (!plan && (!shopData.subscription.plan || typeof shopData.subscription.plan === 'string'))
  ) {
    return false
  }

  // Check for expired trial (V1 or V2) - only block if NO approved charge
  // This check comes AFTER approved charge check because:
  // - Users with expired trial but approved charge should NOT be blocked (handled above)
  // - Only users with expired trial AND no charge should be blocked (checked here)
  const subscription = shopData.subscription as SubscriptionDocument
  if (subscription) {
    const trialStatus = getTrialStatus(subscription)
    if (trialStatus?.isExpired) {
      return false // BLOCK: Trial expired and no approved charge
    }
  }

  // Check plan rules
  if (!plan.usages) {
    return true
  }

  if (plan.price && !shopData.subscription.shopifyCharge) {
    return false
  }

  // Get monthly free orders
  const monthlyFreeOrders
    = plan.usages.orders?.find(rule => !rule.transactionFee)?.to
    || plan.usages.revenue?.find(rule => rule.freeOrders)?.freeOrders
    || 0

  return (shopData.usages?.orders || 0) < monthlyFreeOrders
}

/**
 * Get complete trial usage info including AI credits for dashboard UI
 * This combines trial status with AI credit usage from shopData
 *
 * @param shopData ShopDocument with subscription and aiCredit info
 * @returns Complete trial usage info or null if not on trial
 */
export function getTrialUsageInfo(shopData: ShopDocument): {
  pricingVersion: number
  // Trial days
  isOnTrial: boolean
  isExpired: boolean
  daysRemaining: number
  daysPassed: number
  totalDays: number
  trialEndDate: Date
  trialStartDate: Date
  // Orders
  freeOrdersUsed: number
  freeOrdersTotal: number
  // AI credits
  aiCreditsUsed: number
  aiCreditsTotal: number
  aiCreditsRemaining: number
  // Accumulated debt (V2+ active-days trial)
  accumulatedDebt?: number
  trialPausedDuration?: number
} | null {
  const subscription = shopData.subscription as SubscriptionDocument
  const trialStatus = getTrialStatus(subscription, shopData)
  if (!trialStatus) return null

  const plan = subscription.plan as PricingPlanDocument

  // Calculate days passed (0-indexed: 0, 1, 2, ...)
  // NOTE: This represents "completed days", not "current day number"
  // UI components should add +1 to display as "Day 1, Day 2, Day 3" instead of "Day 0, Day 1, Day 2"
  const totalDays = plan.trialDays || 14
  const daysPassed = totalDays - trialStatus.daysRemaining

  // Get order usage (inline getFreeOrdersCount logic to avoid circular import)
  const freeOrdersUsed = shopData.usages?.orders || 0
  const freeOrdersTotal = plan.usages?.orders?.find(rule => !rule.transactionFee || rule.transactionFee === 0)?.to || 0

  // Get AI credit usage
  const aiCredit = shopData.usages?.aiCredit
  const monthlyUsage = aiCredit?.monthlyUsage || 0
  const monthlyAllocation = plan.aiCreditsPerMonth || 0
  const purchasedCredits = aiCredit?.purchasedCredits || 0

  // Intentionally uses total pool (allocation + purchased) for progress bar display, not remaining balance
  const aiCreditsTotal = monthlyAllocation + purchasedCredits
  const aiCreditsUsed = monthlyUsage
  const aiCreditsRemaining = Math.max(0, aiCreditsTotal - aiCreditsUsed)

  // Calculate accumulated debt for active-days trial (V2+)
  const trialDebt = shopData.trialDebt
  const accumulatedDebt = trialDebt ? (trialDebt.orderOverage || 0) + (trialDebt.aiCreditOverage || 0) : undefined

  return {
    pricingVersion: plan.pricingVersion || 1,
    // Trial days
    isOnTrial: trialStatus.isOnTrial,
    isExpired: trialStatus.isExpired,
    daysRemaining: trialStatus.daysRemaining,
    daysPassed,
    totalDays,
    trialEndDate: trialStatus.trialEndDate!,
    trialStartDate: trialStatus.trialStartDate!,
    // Orders
    freeOrdersUsed,
    freeOrdersTotal,
    // AI credits
    aiCreditsUsed,
    aiCreditsTotal,
    aiCreditsRemaining,
    // Accumulated debt (V2+ active-days trial)
    accumulatedDebt,
    trialPausedDuration: shopData.trialPausedDuration,
  }
}

/**
 * Get trial status - supports both new active-days trial (V2+) and old pricing system (V1)
 *
 * NEW PRICING (V2+): Uses timestamp-based active-days trial with pause/resume
 * OLD PRICING (V1): Falls back to Shopify-managed trial or manual calculation
 *
 * @param subscription SubscriptionDocument
 * @param shop ShopDocument (required for active-days trial tracking)
 * @returns Trial status object or null if not on trial
 */
export function getTrialStatus(
  subscription: SubscriptionDocument | null | undefined,
  shop?: ShopDocument
): {
  isOnTrial: boolean
  isExpired: boolean
  daysRemaining: number
  trialEndDate: Date | null
  trialStartDate: Date | null
  pricingVersion: number
  activeDays?: number
} | null {
  if (!subscription) return null

  const plan = subscription.plan as PricingPlanDocument
  if (!plan) return null

  // PRIORITY 1: V1 (Revenue-based) with Shopify-managed trial
  // Check revenue-based plans FIRST to ensure V1 users are identified correctly
  if (plan.usages?.revenue && plan.usages.revenue.length > 0 && subscription.shopifyCharge?.trial_ends_on) {
    const trialEndsOn = new Date(subscription.shopifyCharge.trial_ends_on)
    const now = new Date()
    const isOnTrial = now < trialEndsOn
    const daysRemaining = isOnTrial ? Math.ceil((trialEndsOn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0

    return {
      isOnTrial,
      isExpired: !isOnTrial,
      daysRemaining,
      trialEndDate: trialEndsOn,
      trialStartDate: null, // Shopify doesn't provide trial start date
      pricingVersion: 1, // V1 pricing
    }
  }

  // PRIORITY 2: V2 (Order-based) with Active-days trial
  if (shop?.trialStartedAt) {
    const trialPeriod = plan.trialDays || 0
    const activeDays = getActiveTrialDays(shop)
    // NOTE: Don't check !shop.uninstalledAt - it's preserved for reinstall detection
    const isOnTrial = activeDays < trialPeriod && !shop.trialCompletedAt

    // Return trial info if trial exists (ongoing or completed)
    if (isOnTrial || activeDays > 0 || shop.trialCompletedAt) {
      const trialStartDate = shop.trialStartedAt instanceof Date ? shop.trialStartedAt : new Date(shop.trialStartedAt)

      // Calculate trialEndDate:
      // - If trial is completed: use shop.trialCompletedAt
      // - If trial is active: calculate estimated end date accounting for paused time
      let trialEndDate: Date | null = null
      if (shop.trialCompletedAt) {
        trialEndDate = shop.trialCompletedAt instanceof Date ? shop.trialCompletedAt : new Date(shop.trialCompletedAt)
      } else if (isOnTrial) {
        // Estimated end date = start + trial period + paused duration
        const estimatedEndMs
          = trialStartDate.getTime() + trialPeriod * ONE_DAY_IN_MILLISECONDS + (shop.trialPausedDuration || 0)
        trialEndDate = new Date(estimatedEndMs)
      }

      return {
        isOnTrial,
        isExpired: activeDays >= trialPeriod || !!shop.trialCompletedAt,
        daysRemaining: Math.max(0, trialPeriod - activeDays),
        trialStartDate,
        trialEndDate,
        pricingVersion: 2, // V2 pricing
        activeDays,
      }
    }
  }

  // No trial found
  return null
}

/**
 * Check if shop approved charge or not
 *
 * @param shopData ShopDocument
 * @returns
 */
export function isApprovedCharge(shopData: ShopDocument) {
  const subscription = shopData.subscription as SubscriptionDocument | undefined

  if (!subscription) {
    return false
  }

  const { shopifyCharge, status } = subscription

  // Approved charge is true only the subscription has been charged and the status is active
  const isApproved = status === 'active' && shopifyCharge?.status === 'active'

  return isApproved
}
