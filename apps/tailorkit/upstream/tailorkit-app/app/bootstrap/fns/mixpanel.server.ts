import type { ShopDocument } from '~/models/Shop'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import fetch from 'node-fetch'
import { uuid } from '~/utils/uuid'
import { getMerchantVertical } from './misc'
import { getLifecycleStage, getDaysSinceInstall } from './lifecycle-stage'
import { USAGE_FEE_TYPES } from '~/bootstrap/constants/eventsTracking'

/**
 * Extract discounted price from Shopify charge line item
 * Shopify may provide discount in different structures:
 * - plan.pricingDetails.discount (percentage or fixed amount)
 * - cappedAmount for usage charges
 * - discountedRecurringApplicationCharge
 *
 * @param lineItem - Shopify subscription line item
 * @param basePrice - Base price before discount
 * @returns Price after applying discount, or basePrice if no discount found
 */
export function extractDiscountedPrice(lineItem: any, basePrice: number): number {
  if (!lineItem) return basePrice

  // Check for discount in pricing details
  const discount = lineItem.plan?.pricingDetails?.discount
  if (discount) {
    // Percentage discount: { value: { percentage: 10 } }
    if (discount.value?.percentage) {
      const percentageOff = parseFloat(discount.value.percentage)
      return basePrice * (1 - percentageOff / 100)
    }

    // Fixed amount discount: { value: { amount: "5.00" } }
    if (discount.value?.amount) {
      const amountOff = parseFloat(discount.value.amount)
      return Math.max(0, basePrice - amountOff)
    }
  }

  // Check for capped amount (usage charges)
  if (lineItem.cappedAmount?.amount) {
    return parseFloat(lineItem.cappedAmount.amount)
  }

  // No discount found, return base price
  return basePrice
}

function getUserProperties(shopData: ShopDocument) {
  // Extract necessary data
  const {
    shopDomain,
    lastAccess,
    subscription,
    createdAt: installedAt,
    metadata: rawMetadata,
    shopConfig: {
      timezone,
      domain: metadataDomain,
      name: storeName,
      plan_display_name: shopifyPlan,
      country_code: countryCode,
      country_name: countryName,
    } = {},
    usages: {
      tierUsageFee = 0,
      discountedUsageFee = 0,
      appGeneratedRevenue = 0,
      usedAIAssistant = false,
      usedGenerativeAI = false,
      aiCredit: { monthlyUsage = 0 } = {},
    } = {},
  } = shopData
  const { shopCategories = [], shopDescription = '', personalizationCompatibilityScore = 0 } = rawMetadata ?? {}

  // Define user properties
  const userProperties = {
    timezone,
    storeName,
    lastAccess,
    shopDomain,
    installedAt,
    countryCode,
    shopifyPlan,
    countryName,
    tierUsageFee,
    metadataDomain,
    shopDescription,
    usedAIAssistant,
    usedGenerativeAI,
    discountedUsageFee,
    appGeneratedRevenue,
    usedAICredits: monthlyUsage,
    shopCategories: shopCategories.join(','),
    shopVertical: getMerchantVertical(shopCategories, personalizationCompatibilityScore),
    pricingPlan: ((subscription as SubscriptionDocument)?.plan as PricingPlanDocument)?.name || 'Pay as you grow',
    lifecycleStage: getLifecycleStage(installedAt, shopData?.usages?.firstIntegrationPublishedAt, appGeneratedRevenue),
    daysSinceInstall: getDaysSinceInstall(installedAt),
  }

  return userProperties
}

export async function identifyUser(shopData: ShopDocument) {
  try {
    // Identify user
    const userId = shopData?.shopConfig?.id

    if (!process.env.MIXPANEL_ACCESS_TOKEN || !userId) {
      return
    }

    // Send API request to MixPanel
    await fetch('https://api.mixpanel.com/engage#profile-set', {
      method: 'POST',
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          $distinct_id: `${userId}`,
          $set: getUserProperties(shopData),
          $token: process.env.MIXPANEL_ACCESS_TOKEN,
        },
      ]),
    }).then(res => res.text())

    return userId
  } catch (e: unknown) {
    console.error(e)
  }
}

/**
 * Event properties for Mixpanel tracking.
 */
interface EventProperties extends Record<string, unknown> {}

/**
 * Options for tracking events.
 */
interface TrackEventOptions {
  noDuplicate?: boolean
}

/**
 * Track subscribe_plan event for pricing analytics
 * Used to track subscription creation and plan changes (upgrades/downgrades)
 *
 * @param shopData - Shop document
 * @param planName - Current plan name (e.g., "starter_v2", "growth_v2")
 * @param planPrice - Current plan base price
 * @param planPriceAfterDiscount - Price after applying any discounts
 * @param isNewSubscription - True for first-time approval, false for upgrades/downgrades
 * @param changeDetails - Optional details for plan changes (required if isNewSubscription = false)
 */
export async function trackSubscribePlan(
  shopData: ShopDocument,
  planName: string,
  planPrice: number,
  planPriceAfterDiscount: number,
  isNewSubscription: boolean,
  changeDetails?: {
    lastPlanName: string
    lastPlanPrice: number
    daysWithLastPlan: number
    priceDifference: number
    priceDifferenceAfterDiscount: number
  }
) {
  // Intent attribution + time-to-subscribe — enriched on every subscribe_plan
  // event so a single Mixpanel query can answer "which install-time intent
  // converts to subscribe most / fastest" without cross-event funnels. The
  // intent fields fall back to null on shops that pre-date the intent router.
  const intent = shopData.appConfig?.onboardingIntent
  const installAt = shopData.createdAt ? new Date(shopData.createdAt).getTime() : null
  // Clamp to non-negative (clock skew on shopify side could yield negatives).
  // Upper bound at ~5 years to fail-safe against corrupted createdAt fields
  // that would otherwise pollute Mixpanel aggregates.
  const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 60 * 60
  const timeToSubscribeSeconds = installAt
    ? Math.max(0, Math.min(Math.round((Date.now() - installAt) / 1000), FIVE_YEARS_SECONDS))
    : null

  const attribution = {
    first_install_intent: intent?.selected ?? null,
    last_create_flow: shopData.appConfig?.lastCreateFlow ?? null,
    is_reinstall: Boolean(shopData.lastReinstalledAt),
    time_to_subscribe_seconds: timeToSubscribeSeconds,
  }

  const baseProps = {
    planName,
    planPrice,
    planPriceAfterDiscount,
    newSubscription: isNewSubscription,
    ...attribution,
  }

  // Add change details for upgrades/downgrades
  const eventProps = isNewSubscription
    ? baseProps
    : {
        ...baseProps,
        lastPlanName: changeDetails?.lastPlanName || '',
        lastPlanPrice: changeDetails?.lastPlanPrice || 0,
        daysWithLastPlan: changeDetails?.daysWithLastPlan || 0,
        priceDifference: changeDetails?.priceDifference || 0,
        priceDifferenceAfterDiscount: changeDetails?.priceDifferenceAfterDiscount || 0,
      }

  await trackEvent(shopData, 'subscribe_plan', eventProps)
}

/**
 * Track plan_upgraded event for conversion analytics
 * Used to identify upgrade triggers and optimize tier limits
 *
 * @param shopData - Shop document
 * @param fromPlan - Previous plan name
 * @param toPlan - New plan name
 * @param orderCountAtUpgrade - Order count when upgrade happened
 * @param upgradeReason - Reason for upgrade
 * @param overageAmountBeforeUpgrade - Optional overage amount before upgrade
 */
export async function trackPlanUpgraded(
  shopData: ShopDocument,
  fromPlan: string,
  toPlan: string,
  orderCountAtUpgrade: number,
  upgradeReason: 'overage' | 'features' | 'manual' | 'support_recommended',
  overageAmountBeforeUpgrade?: number
) {
  await trackEvent(shopData, 'plan_upgraded', {
    from_plan: fromPlan.toLowerCase(),
    to_plan: toPlan.toLowerCase(),
    order_count_at_upgrade: orderCountAtUpgrade,
    upgrade_reason: upgradeReason,
    overage_amount_before_upgrade: overageAmountBeforeUpgrade || 0,
  })
}

/**
 * Track plan_downgraded event for churn analytics
 * Used to analyze churn patterns
 *
 * @param shopData - Shop document
 * @param fromPlan - Previous plan name
 * @param toPlan - New plan name (or 'free' if cancelled)
 * @param orderCountAtDowngrade - Order count when downgrade happened
 */
export async function trackPlanDowngraded(
  shopData: ShopDocument,
  fromPlan: string,
  toPlan: string,
  orderCountAtDowngrade: number
) {
  await trackEvent(shopData, 'plan_downgraded', {
    from_plan: fromPlan.toLowerCase(),
    to_plan: toPlan.toLowerCase(),
    order_count_at_downgrade: orderCountAtDowngrade,
  })
}

/**
 * Track charge_usage_fees event for order overage or AI credit charges
 * Used to monitor usage revenue patterns
 *
 * @param shopData - Shop document
 * @param planName - Current plan name (e.g., "starter_v2", "growth_v2")
 * @param planPrice - Current plan base price
 * @param planPriceAfterDiscount - Plan price after discount
 * @param type - Type of usage fee from USAGE_FEE_TYPES constant
 * @param usageFees - Usage fee amount charged
 * @param usageFeesAfterDiscount - Usage fees after applying discount
 * @param orderDetails - Optional order overage details
 * @param aiCreditDetails - Optional AI credit details
 */
export async function trackChargeUsageFees(
  shopData: ShopDocument,
  planName: string,
  planPrice: number,
  planPriceAfterDiscount: number,
  type: (typeof USAGE_FEE_TYPES)[keyof typeof USAGE_FEE_TYPES],
  usageFees: number,
  usageFeesAfterDiscount: number,
  orderDetails?: {
    numIncludedOrders: number
    numOverageOrders: number
  },
  aiCreditDetails?: {
    numIncludedAICredits: number
    numAdditionalAICredits: number
  }
) {
  const baseProps = {
    planName,
    planPrice,
    planPriceAfterDiscount,
    type,
    usageFees,
    usageFeesAfterDiscount,
  }

  // Add specific details based on type
  const eventProps
    = type === USAGE_FEE_TYPES.ORDER_OVERAGE
      ? {
          ...baseProps,
          numIncludedOrders: orderDetails?.numIncludedOrders || 0,
          numOverageOrders: orderDetails?.numOverageOrders || 0,
        }
      : {
          ...baseProps,
          numIncludedAICredits: aiCreditDetails?.numIncludedAICredits || 0,
          numAdditionalAICredits: aiCreditDetails?.numAdditionalAICredits || 0,
        }

  await trackEvent(shopData, 'charge_usage_fees', eventProps)
}

export async function trackEvent(
  shopData: ShopDocument,
  eventName: string,
  eventProperties: EventProperties,
  opts: TrackEventOptions = {}
) {
  try {
    // Prevent sending duplicated events
    const { noDuplicate } = opts
    const occurredEvents = shopData?.appConfig?.occurredEvents || {}

    if (noDuplicate && occurredEvents[eventName]) {
      return
    }

    // Identify user
    const userId = await identifyUser(shopData)

    if (!process.env.MIXPANEL_ACCESS_TOKEN || !userId) {
      return
    }

    // Get current Unix timestamp
    const now = Date.now()

    // Send API request to MixPanel
    await fetch('https://api.mixpanel.com/import?strict=1', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${process.env.MIXPANEL_ACCESS_TOKEN}:`).toString('base64')}`,
      },
      body: JSON.stringify([
        {
          event: eventName,
          properties: {
            ...eventProperties,
            ...getUserProperties(shopData),
            time: now,
            $insert_id: uuid(),
            distinct_id: `${userId}`,
          },
        },
      ]),
    }).then(res => res.json())

    return true
  } catch (e: unknown) {
    console.error(e)
  }
}
