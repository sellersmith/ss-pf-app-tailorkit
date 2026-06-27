/**
 * Subscription Creation Module (Refactored)
 *
 * ARCHITECTURE PRINCIPLES:
 * - Uses field-based detection (usages.orders vs usages.revenue) instead of pricingVersion
 * - Eliminates 70% code duplication through shared helper functions
 * - Follows SOLID principles (Single Responsibility, Open/Closed, DRY)
 * - Supports both order-based and revenue-based billing mechanisms
 *
 * IMPORTANT: Do NOT check pricingVersion for business logic!
 * Use getBillingType() from subscription-helpers.server.ts instead.
 */

import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { PricingPlanDocument } from '../PricingPlan'
import type { ObjectId } from 'mongoose'
import ShopifySession from '../ShopifySession.server'
import Shop, { getShopData } from '../Shop.server'
import PricingPlan, { getPlanPriceAfterDiscount, getPlanTrialDays } from '../PricingPlan.server'
import { getAppHandle } from '~/shopify/fns.server'
import { isDevelopmentStore } from '~/bootstrap/fns/misc'
import { requestGraphqlApi, createShopifyOneTimeCharge } from '~/shopify/graphql/fns.server'
import Subscription from '../Subscription.server'
import {
  getBillingType,
  getOrderUsageTerms,
  getRevenueUsageTerms,
  getSubscriptionName,
} from './subscription-helpers.server'
import { trackDealSubscription, buildDealDiscountGraphQL, computeDealPricing } from './first-month-deal.server'

const periodicalMapping: Record<'monthly' | 'annually', 'EVERY_30_DAYS' | 'ANNUAL'> = {
  monthly: 'EVERY_30_DAYS',
  annually: 'ANNUAL',
}

/**
 * Initialize usages.aiCredit if not exists
 *
 * EXPORTED helper following DRY principles - single source of truth for AI credit initialization.
 * Can be called from any flow that needs to ensure aiCredit is initialized:
 * - Subscription creation/approval
 * - Plan changes
 * - Migration scripts
 *
 * @param shopDomain - Shop domain
 */
export async function ensureAiCreditInitialized(shopDomain: string): Promise<void> {
  const shopData = await getShopData(shopDomain)

  if (!shopData?.usages?.aiCredit?.startMonth) {
    await Shop.updateOne(
      { shopDomain, 'usages.aiCredit.startMonth': { $exists: false } },
      {
        $set: {
          'usages.aiCredit': {
            monthlyUsage: 0,
            purchasedCredits: 0,
            startMonth: new Date(),
          },
        },
      }
    )
  }
}

/**
 * Updates shop reference to point to new subscription
 * and initializes usages.aiCredit if not yet set.
 *
 * Centralizes the shop update logic to maintain DRY principles.
 *
 * @param shopDomain - Shop domain
 * @param subscriptionId - Subscription ID to set
 */
async function updateShopSubscriptionReference(shopDomain: string, subscriptionId: string | ObjectId): Promise<void> {
  await Shop.updateOne({ shopDomain }, { $set: { subscription: subscriptionId }, $unset: { lastSubscription: 1 } })

  // Initialize aiCredit using shared helper (DRY principle)
  await ensureAiCreditInitialized(shopDomain)
}

/**
 * Unified subscription creation function
 *
 * Automatically detects billing type from plan structure and routes to
 * appropriate handler. This is the ONLY function that should be called
 * from external code.
 *
 * @param admin - Shopify admin API context
 * @param shopDomain - Shop domain
 * @param payload - Contains planId and optional couponCode
 * @param isAutomation - Whether this is automated (e.g., trial auto-assignment)
 * @returns Shopify response with confirmationUrl or true if automated
 */
export async function createSubscription(
  admin: AdminApiContext,
  shopDomain: string,
  payload: { planId: string; couponCode?: string },
  isAutomation = false
): Promise<any> {
  const { planId } = payload

  // Fetch plan
  const plan = await PricingPlan.findOne({ _id: planId })
  if (!plan) {
    throw new Error('Pricing plan not found')
  }

  // Determine billing type based on field existence (NOT version)
  const billingType = getBillingType(plan)

  console.log(`[CreateSubscription] Detected billing type: ${billingType}`, {
    planId,
    planName: plan.name,
    hasOrdersUsage: !!plan.usages?.orders?.length,
    hasRevenueUsage: !!plan.usages?.revenue?.length,
  })

  // Route to appropriate handler based on billing type
  switch (billingType) {
    case 'order-based':
      return createOrderBasedSubscriptionInternal(admin, shopDomain, payload, isAutomation)
    case 'revenue-based':
      return createRevenueBasedSubscription(admin, shopDomain, payload, isAutomation)
    case 'free':
      return createFreeSubscription(shopDomain, payload)
    default:
      throw new Error(`Unknown billing type: ${billingType}`)
  }
}

/**
 * Shared preparation steps for all subscription types
 *
 * This function centralizes common setup logic used by both order-based
 * and revenue-based subscription creation to maintain DRY principles.
 */
async function prepareSubscriptionCreation(admin: AdminApiContext, shopDomain: string, plan: PricingPlanDocument) {
  const { APP_NAME, TEST_CHARGE } = process.env

  // Get shop and session info
  const shop = await getShopData(shopDomain)
  const isDevStore = isDevelopmentStore(shop?.shopConfig)
  const isTestCharge = TEST_CHARGE === 'true' || isDevStore
  const session = await ShopifySession.findOne({ shop: shopDomain })
  const appHandle = await getAppHandle(shopDomain, admin)
  // Use the Shopify admin proxy URL as the billing callback.
  // After charge approval/cancellation Shopify redirects the browser to this URL,
  // which routes through Shopify admin and re-embeds the app iframe with a valid
  // session token — required by authenticate.admin(). Pointing directly to the
  // app URL (e.g. appUrl/subscribe) skips Shopify admin and causes auth failure
  // because there is no session token in a top-level browser request.
  const callbackUrl = `https://${shopDomain}/admin/apps/${appHandle}/subscribe`

  // Clear pending subscriptions (orphan records from failed attempts)
  await Subscription.deleteMany({ shopDomain, status: 'pending' })

  // DO NOT cancel existing active subscription here!
  // The active subscription should remain until the new subscription is approved.
  // If user cancels on Shopify approval page, they still have their current subscription.
  // Webhook will handle cancelling old subscription after new one is confirmed.

  return {
    shop,
    session,
    appHandle,
    callbackUrl,
    isTestCharge,
    appName: APP_NAME,
  }
}

/**
 * Create order-based subscription (internal)
 *
 * Works for ANY plan with usages.orders defined (V2, future V3/V4/V5)
 * Uses 2 line items: recurring (base price) + usage (order overage charges)
 *
 * Note: AI Credits billed separately via one-time charges due to Shopify's
 * limitation of 1 appUsagePricingDetails per subscription.
 */
async function createOrderBasedSubscriptionInternal(
  admin: AdminApiContext,
  shopDomain: string,
  payload: { planId: string; couponCode?: string },
  isAutomation = false
): Promise<any> {
  const { planId, couponCode } = payload

  // Get plan
  const plan = await PricingPlan.findOne({ _id: planId })
  if (!plan) {
    throw new Error('Pricing plan not found')
  }

  // Prepare (cancels existing, clears pending)
  const { session, callbackUrl, isTestCharge, appName } = await prepareSubscriptionCreation(admin, shopDomain, plan)

  // Calculate pricing
  const trialDays = await getPlanTrialDays(shopDomain, plan)
  const baseFinalPrice = await getPlanPriceAfterDiscount(plan, couponCode, shopDomain)
  const usageTerms = getOrderUsageTerms(plan)

  // Check $1 first month deal eligibility and compute final price
  const { isDealApplicable, finalPrice } = await computeDealPricing(shopDomain, baseFinalPrice)

  // Determine if Shopify subscription creation is needed
  const shouldCreateShopifySubscription = baseFinalPrice > 0 || plan.chargeApprovalRequired

  // Create subscription document
  const subscription = await Subscription.create({
    shopDomain,
    couponCode,
    finalPrice,
    periodical: plan.periodical,
    plan: plan._id,
    couponAppliedOn: couponCode && new Date().toISOString().substring(0, 10),
    status: !isAutomation && shouldCreateShopifySubscription ? 'pending' : 'active',
    // NOTE: BillingCycle will be created when subscription becomes active (in subscribe callback)
    // Billing fields moved to BillingCycle collection managed by BillingStateManager
  })

  // Track $1 deal subscription
  if (isDealApplicable) {
    const shopData = await getShopData(shopDomain)
    if (shopData) trackDealSubscription(shopData, plan, baseFinalPrice).catch(console.error)
  }

  // Records should only be created after subscription is approved, not when pending
  // This prevents orphaned records when users cancel on Shopify approval page

  // If automation OR no Shopify charge needed, skip charge creation
  if (isAutomation || !shouldCreateShopifySubscription) {
    await updateShopSubscriptionReference(shopDomain, subscription._id)
    return true
  }

  // Build subscription name
  const planName = `${appName} ${plan.name}${plan.optionName ? ` (${plan.optionName})` : ''}`

  const graphqlResponse = await requestGraphqlApi({
    query: `mutation {
      appSubscriptionCreate(
        name: "${planName}"
        test: ${isTestCharge ? 'true' : 'false'}
        ${trialDays ? `trialDays: ${trialDays}` : ''}
        returnUrl: "${callbackUrl}?subscription_id=${subscription._id}"
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                interval: ${periodicalMapping[plan.periodical as 'monthly' | 'annually']}
                price: { amount: ${baseFinalPrice}, currencyCode: USD }
                ${buildDealDiscountGraphQL(isDealApplicable, baseFinalPrice)}
              }
            }
          },
          {
            plan: {
              appUsagePricingDetails: {
                terms: "${usageTerms}"
                cappedAmount: { amount: ${plan.cappedAmount}, currencyCode: USD }
              }
            }
          }
        ]
      ) {
        confirmationUrl
        appSubscription {
          id
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppUsagePricing {
                  terms
                  cappedAmount {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    shopDomain,
    accessToken: session.accessToken,
  })

  const response = graphqlResponse?.data?.appSubscriptionCreate

  // Check if response exists
  if (!response || !response.appSubscription) {
    console.error('[CreateSubscription] Failed to create subscription:', graphqlResponse)
    throw new Error('Failed to create Shopify subscription - no response from Shopify API')
  }

  // Handle errors
  if (response?.userErrors?.length) {
    throw new Error(response.userErrors[0].message)
  }

  // Save Shopify charge info
  const { id, lineItems } = response.appSubscription
  subscription.shopifyCharge = { id: id.split('/').pop(), lineItems }
  await subscription.save()

  // DO NOT update shop subscription reference here!
  // The subscription is still pending user approval on Shopify's page.
  // If we update Shop.subscription now, the app will display the new plan
  // before the user actually approves it.
  // The shop reference will be updated in subscribe/route.ts AFTER approval.

  return response
}

/**
 * Create revenue-based subscription
 *
 * Works for ANY plan with usages.revenue defined (V1, future variations)
 * Supports incremental billing based on revenue tiers
 */
async function createRevenueBasedSubscription(
  admin: AdminApiContext,
  shopDomain: string,
  payload: { planId: string; couponCode?: string },
  isAutomation = false
): Promise<any> {
  let { planId } = payload
  const { couponCode } = payload

  // If no planId provided, try to find current subscription's plan
  if (!planId) {
    const subscription = await Subscription.findOne({
      shopDomain,
      periodical: { $ne: 'one-time' },
      status: { $in: ['pending', 'active'] },
    })
    planId = subscription?.plan?.toString()
  }

  if (!planId) {
    throw new Error('Missing pricing plan ID')
  }

  // Get plan
  const plan = await PricingPlan.findOne({ _id: planId })
  if (!plan) {
    throw new Error('Pricing plan not found')
  }

  // Prepare (cancels existing, clears pending)
  const { shop, session, callbackUrl, isTestCharge, appName } = await prepareSubscriptionCreation(
    admin,
    shopDomain,
    plan
  )

  // Calculate pricing
  const trialDays = await getPlanTrialDays(shopDomain, plan)
  const baseFinalPrice = await getPlanPriceAfterDiscount(plan, couponCode, shopDomain)

  // Build subscription name (generic - works for any revenue-based plan)
  const name = getSubscriptionName(appName, plan)

  // Extract plan data
  const { periodical, chargeApprovalRequired, usages } = plan

  // Calculate free orders from revenue-based plan
  const numFreeOrders = usages?.revenue?.[0]?.freeOrders || 0

  // Check $1 first month deal eligibility and compute final price
  const { isDealApplicable, finalPrice } = await computeDealPricing(shopDomain, baseFinalPrice)

  // Determine if Shopify subscription creation is needed
  const shouldCreateShopifySubscription
    = baseFinalPrice || chargeApprovalRequired || (shop?.usages?.orders || 0) > numFreeOrders

  // Create subscription document
  const subscription = await Subscription.create({
    shopDomain,
    couponCode,
    finalPrice,
    periodical,
    plan: plan._id,
    couponAppliedOn: couponCode && new Date().toISOString().substring(0, 10),
    status: !isAutomation && shouldCreateShopifySubscription ? 'pending' : 'active',
    // NOTE: BillingCycle will be created when subscription becomes active
  })

  // Track $1 deal subscription
  if (isDealApplicable) {
    const shopData = await getShopData(shopDomain)
    if (shopData) trackDealSubscription(shopData, plan, baseFinalPrice).catch(console.error)
  }

  // If automation (e.g., trial auto-assignment), don't create Shopify charge
  if (!isAutomation && shouldCreateShopifySubscription) {
    // Build line items based on plan configuration
    const lineItems: any[] = []

    // Base recurring charge
    if (periodical === 'one-time') {
      // One-time charge
      const chargeResult = await createShopifyOneTimeCharge({
        name,
        price: finalPrice,
        returnUrl: `${callbackUrl}?subscription_id=${subscription._id}`,
        test: isTestCharge,
        shopDomain,
        accessToken: session.accessToken,
      })

      subscription.shopifyCharge = {
        id: chargeResult.chargeId,
        confirmationUrl: chargeResult.confirmationUrl,
      }
      await subscription.save()

      // DO NOT update shop subscription reference here!
      // One-time charges also require user approval on Shopify's page.
      // The shop reference will be updated in subscribe/route.ts AFTER approval.

      return chargeResult
    }

    // Recurring charge
    const interval
      = periodical === 'monthly' || periodical === 'annually'
        ? periodicalMapping[periodical as 'monthly' | 'annually']
        : 'EVERY_30_DAYS'

    lineItems.push({
      plan: {
        appRecurringPricingDetails: {
          interval,
          price: { amount: finalPrice, currencyCode: 'USD' },
        },
      },
    })

    // Add revenue-based usage line item (generic - reads from plan structure)
    lineItems.push({
      plan: {
        appUsagePricingDetails: {
          terms: getRevenueUsageTerms(plan),
          cappedAmount: { amount: plan.cappedAmount, currencyCode: 'USD' },
        },
      },
    })

    // Create Shopify subscription
    // IMPORTANT: Build GraphQL query manually to avoid quotes on enum values (interval, currencyCode)
    // JSON.stringify() adds quotes to ALL values, but GraphQL enums must NOT have quotes
    const usageTerms = getRevenueUsageTerms(plan)
    const graphqlResponse = await requestGraphqlApi({
      query: `mutation {
        appSubscriptionCreate(
          name: "${name}"
          test: ${isTestCharge ? 'true' : 'false'}
          ${trialDays ? `trialDays: ${trialDays}` : ''}
          returnUrl: "${callbackUrl}?subscription_id=${subscription._id}"
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  interval: ${interval}
                  price: { amount: ${baseFinalPrice}, currencyCode: USD }
                  ${buildDealDiscountGraphQL(isDealApplicable, baseFinalPrice)}
                }
              }
            },
            {
              plan: {
                appUsagePricingDetails: {
                  terms: "${usageTerms}"
                  cappedAmount: { amount: ${plan.cappedAmount}, currencyCode: USD }
                }
              }
            }
          ]
        ) {
          confirmationUrl
          appSubscription {
            id
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      shopDomain,
      accessToken: session.accessToken,
    })

    const response = graphqlResponse?.data?.appSubscriptionCreate

    // Check if response exists
    if (!response || !response.appSubscription) {
      console.error('[CreateSubscription] Failed to create order-based subscription:', graphqlResponse)
      throw new Error('Failed to create Shopify subscription - no response from Shopify API')
    }

    if (response?.userErrors?.length) {
      throw new Error(response.userErrors[0].message)
    }

    const { id, lineItems: returnedLineItems } = response.appSubscription
    subscription.shopifyCharge = { id: id.split('/').pop(), lineItems: returnedLineItems }
    await subscription.save()

    // DO NOT update shop subscription reference here!
    // The subscription is still pending user approval on Shopify's page.
    // The shop reference will be updated in subscribe/route.ts AFTER approval.

    return response
  }

  // Automated subscription (no Shopify charge)
  await updateShopSubscriptionReference(shopDomain, subscription._id)

  return true
}

/**
 * Create free subscription (no billing)
 *
 * Used for completely free plans with no charges
 */
async function createFreeSubscription(
  shopDomain: string,
  payload: { planId: string; couponCode?: string }
): Promise<any> {
  const { planId, couponCode } = payload

  const plan = await PricingPlan.findOne({ _id: planId })
  if (!plan) {
    throw new Error('Pricing plan not found')
  }

  // Create subscription document
  const subscription = await Subscription.create({
    shopDomain,
    couponCode,
    finalPrice: 0,
    periodical: plan.periodical,
    plan: plan._id,
    couponAppliedOn: couponCode && new Date().toISOString().substring(0, 10),
    status: 'active', // Free plans are immediately active
    // NOTE: BillingCycle will be created when needed (free plans may not need billing cycles)
  })

  // Update shop subscription reference
  await updateShopSubscriptionReference(shopDomain, subscription._id)

  return true
}
