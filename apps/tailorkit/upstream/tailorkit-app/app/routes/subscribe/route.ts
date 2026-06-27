import type { LoaderFunctionArgs } from '@remix-run/node'
import Shop, { getShopData } from '~/models/Shop.server'
import Subscription from '~/models/Subscription.server'
import { NavMenuItems, rootPage } from '~/bootstrap/app-config'
import { authenticate } from '~/shopify/app.server'
import { requestRestApi } from '~/shopify/graphql/fns.server'
import { catchAsync } from '~/utils/catchAsync'
import { trackEvent, trackSubscribePlan } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { saveUserJourney } from '~/models/UserJourney.server'
import { NEW_USER_JOURNEY_STEPS, USER_JOURNEY_TYPE } from '../api.user-journey/constants'
import {
  isTrialPlan,
  cancelAllOldSubscriptions,
  resetSubscriptionUsage,
  getBillingType,
  getSubscriptionChangeType,
  createSinglePlanChangeRecord,
  getPlanName,
} from '~/models/helpers/subscription-analytics.server'
import { isOrderBasedPlan } from '~/models/helpers/subscription-helpers.server'
import { isOnActiveDaysTrial, initializeTrialTracking } from '~/models/helpers/trial-tracking.server'
import { recalculateTrialDebtForPlanChange } from '~/models/helpers/trial-debt.server'
import { ensureAiCreditInitialized } from '~/models/helpers/subscription-creation.server'

import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import PlanChangeRecord from '~/models/PlanChangeRecord.server'
import BillingStateManager from '~/models/helpers/BillingStateManager.server'
import mongoose from 'mongoose'

/**
 * Helper to build subscription query with ObjectId handling
 */
function findBySubscriptionId(subscriptionId: string) {
  return { $or: [{ _id: subscriptionId }, { _id: new mongoose.Types.ObjectId(subscriptionId) }] }
}

/**
 * Handle subscription cancellation - user clicked "Cancel" on Shopify approval page
 */
async function handleCancellation(shopDomain: string, subscriptionId: string, redirect: any) {
  const subscriptionQuery = findBySubscriptionId(subscriptionId)

  // Delete pending subscription
  await Subscription.deleteOne({
    ...subscriptionQuery,
    status: 'pending',
  })

  // Delete orphaned plan change records
  await PlanChangeRecord.deleteMany(subscriptionQuery)

  // Clear shop's subscription reference
  await Shop.updateOne(
    {
      shopDomain,
      $or: [{ subscription: subscriptionId }, { subscription: new mongoose.Types.ObjectId(subscriptionId) }],
    },
    { $unset: { subscription: 1 } }
  )

  return redirect(`${NavMenuItems.PRICING}?subscription_id=${subscriptionId}`)
}

/**
 * Track plan changes (upgrade/downgrade) and create PlanChangeRecord
 */
/**
 * Handle migrations (Trial→Paid, V1→V2) and reset usage counters
 */
async function handleMigrations(
  shopDomain: string,
  subscriptionId: string,
  oldPlan: PricingPlanDocument | undefined,
  newPlan: PricingPlanDocument | undefined,
  charge: any
) {
  // Detect migration types
  const isTrialToPaid = oldPlan && newPlan && isTrialPlan(oldPlan) && newPlan.price > 0 && isOrderBasedPlan(newPlan)

  const oldBillingType = oldPlan ? getBillingType(oldPlan) : 'unknown'
  const newBillingType = newPlan ? getBillingType(newPlan) : 'unknown'
  const isBillingTypeMigration = oldBillingType !== newBillingType && newBillingType === 'order-based'

  const billingStartDate = charge.trial_ends_on ? new Date(charge.trial_ends_on) : new Date(charge.activated_on)

  // NEW: Handle plan changes during active-days trial
  const shop = await Shop.findOne({ shopDomain })
  if (newPlan && isOnActiveDaysTrial(shop, newPlan)) {
    // Detect reinstall by checking lastReinstalledAt (set in afterAuth when shop reinstalls)
    const isReinstall = !!shop.lastReinstalledAt

    // Check if this is selecting the SAME plan after reinstall (not a plan change)
    const isSamePlan = !oldPlan || oldPlan._id.toString() === newPlan._id.toString()

    if (isReinstall && isSamePlan) {
      // Clear lastReinstalledAt now that we've detected and handled reinstall
      await Shop.updateOne({ shopDomain }, { $set: { lastReinstalledAt: null } })
    } else if (!isSamePlan) {
      // PLAN CHANGE DURING TRIAL: Forgive old debt, start fresh with new plan free quota
      // Trial days continue (NOT reset)
      // User benefits from new plan's larger free quota
      await recalculateTrialDebtForPlanChange(shopDomain, newPlan)
    }

    return
  }

  // Handle Trial→Paid (takes precedence)
  if (isTrialToPaid) {
    // Trial orders DON'T count towards paid plan limits
    // Fresh billing cycle starts from paid activation
    // Only charge orders AFTER paid activation

    // Get subscription and plan for BillingStateManager
    const subscriptionQuery = findBySubscriptionId(subscriptionId)
    const newSubscriptionDoc = await Subscription.findOne(subscriptionQuery).populate('plan')

    if (newSubscriptionDoc && newPlan) {
      // Reset for trial→paid transition using BillingStateManager
      // This:
      // - Cancels old trial cycle
      // - Resets Shop.usages.orders to 0
      // - Resets AI credits
      // - Creates fresh billing cycle with 0 baseline
      await BillingStateManager.resetForTrialToPaid(shopDomain, newSubscriptionDoc, newPlan)
    }

    return
  }

  // Handle billing type migration
  if (isBillingTypeMigration) {
    await resetSubscriptionUsage(shopDomain, subscriptionId, newPlan, billingStartDate)
    return
  }

  // Handle Paid→Paid upgrades (Order→Order, e.g., Starter→Growth)
  // Update baseline WITHOUT resetting billing cycle
  const isPaidToPaidUpgrade
    = oldPlan
    && newPlan
    && isOrderBasedPlan(oldPlan)
    && isOrderBasedPlan(newPlan)
    && oldBillingType === 'order-based'
    && newBillingType === 'order-based'

  if (isPaidToPaidUpgrade) {
    // Query OLD active subscription (not the new one, which hasn't been saved yet)
    const oldSubscriptions = await Subscription.find({
      shopDomain,
      status: 'active',
      _id: {
        $nin: [
          subscriptionId, // Exclude new subscription (string)
          new mongoose.Types.ObjectId(subscriptionId), // Exclude new subscription (ObjectId)
        ],
      },
    })
      .populate('plan')
      .lean()

    const oldSubscription = oldSubscriptions[0] as any

    if (oldSubscription) {
      // Get new subscription document
      const subscriptionQuery = findBySubscriptionId(subscriptionId)
      const newSubscriptionDoc = await Subscription.findOne(subscriptionQuery).populate('plan')

      if (newSubscriptionDoc && oldPlan && newPlan) {
        // Handle plan change using BillingStateManager
        // This:
        // - Completes old billing cycle
        // - Creates new cycle with conditional baseline (upgrade: reset, downgrade: preserve)
        // - Inherits billing cycle start date (same 30-day period)
        // - Tracks analytics
        const changeType = getSubscriptionChangeType(oldPlan, newPlan)
        const isUpgrade = changeType === 'upgrade'
        const shopData = await getShopData(shopDomain)

        await BillingStateManager.handlePlanChange(
          shopDomain,
          oldSubscription as SubscriptionDocument,
          newSubscriptionDoc,
          oldPlan,
          newPlan,
          isUpgrade,
          shopData || undefined
        )
      }
    }
    return
  }

  // Handle first-time paid subscription (no old subscription, but has charge)
  // This includes:
  // - First-time install with paid plan
  // - Development stores with test charges (for QA testing)
  // - Re-install after uninstall
  if (!oldPlan && newPlan && isOrderBasedPlan(newPlan) && charge) {
    const subscriptionQuery = findBySubscriptionId(subscriptionId)
    const newSubscriptionDoc = await Subscription.findOne(subscriptionQuery).populate('plan')

    if (newSubscriptionDoc) {
      // Create initial billing cycle
      await BillingStateManager.createCycle(newSubscriptionDoc, newPlan, {
        isFirstCycle: true,
        cycleStartDate: billingStartDate,
        initialOrderCount: 0, // Start from 0 for new subscriptions
      })
    }
    return
  }
}

/**
 * Handle subscription approval - user clicked "Approve" on Shopify charge page
 */
async function handleApproval(
  shopDomain: string,
  accessToken: string,
  chargeId: string,
  subscriptionId: string,
  redirect: any
) {
  // Get subscription
  const subscriptionQuery = findBySubscriptionId(subscriptionId)
  let subscription = await Subscription.findOne(subscriptionQuery)

  if (!subscription) {
    throw redirect(NavMenuItems.PRICING)
  }

  subscription = subscription.toObject()
  const { periodical, shopifyCharge } = subscription

  // Verify charge ID matches
  if (shopifyCharge?.id !== chargeId) {
    throw redirect(NavMenuItems.PRICING)
  }

  // Get charge details from Shopify
  const charge
    = periodical === 'one-time'
      ? (
          await requestRestApi({
            shopDomain,
            accessToken,
            resource: `application_charges/${chargeId}`,
          })
        )?.application_charge
      : (
          await requestRestApi({
            shopDomain,
            accessToken,
            resource: `recurring_application_charges/${chargeId}`,
          })
        )?.recurring_application_charge

  // Update subscription with charge details
  subscription.shopifyCharge = { ...shopifyCharge, ...charge }

  // Only proceed if charge is active
  if (charge.status !== 'active') {
    return redirect(rootPage)
  }

  // Declare outside block to use later for tracking
  let oldSubscription: SubscriptionDocument | undefined
  let oldPlan: PricingPlanDocument | undefined

  // Handle recurring subscriptions (not one-time charges)
  if (periodical !== 'one-time') {
    // Get old subscription data BEFORE cancelling
    const shopData = await getShopData(shopDomain)
    oldSubscription = shopData?.subscription as SubscriptionDocument | undefined
    oldPlan = oldSubscription?.plan as PricingPlanDocument | undefined

    // Get new subscription data
    const newSubscription = await Subscription.findById(subscriptionId).populate('plan')
    const newPlan = newSubscription?.plan as PricingPlanDocument | undefined

    // Handle migrations (Trial→Paid, V1→V2)
    await handleMigrations(shopDomain, subscriptionId, oldPlan, newPlan, charge)

    // Create PlanChangeRecord for database tracking (UI charge details modal)
    // Note: Mixpanel event tracking moved to subscribe_plan logic below (HP requirements)
    if (oldPlan && newPlan && oldSubscription && shopData) {
      try {
        // Skip if no actual plan change
        if (oldPlan._id.toString() !== newPlan._id.toString()) {
          // Get billing state once for both values
          let currentOrderCount = 0
          let billingCycleBaseline = 0
          if (isOrderBasedPlan(oldPlan)) {
            try {
              const billingState = await BillingStateManager.getCurrentState(shopDomain)
              currentOrderCount = billingState?.cycle?.orderCount?.current || 0
              billingCycleBaseline = billingState?.cycle?.orderCount?.initial || 0
            } catch (error) {
              console.error('[Subscribe] Failed to get billing state, using 0 as baseline:', error)
            }
          }

          // Determine change type
          const changeType = (newPlan.price || 0) > (oldPlan.price || 0) ? 'upgrade' : 'downgrade'

          // Create PlanChangeRecord (for UI/database only, not Mixpanel)
          await createSinglePlanChangeRecord(
            shopDomain,
            newSubscription._id.toString(),
            oldPlan,
            newPlan,
            currentOrderCount,
            billingCycleBaseline,
            changeType
          )
        }
      } catch (err) {
        console.error('[Subscribe] ❌ Failed to create PlanChangeRecord:', err)
        // Don't block subscription activation if tracking fails
      }
    }

    // Cancel old subscriptions
    await cancelAllOldSubscriptions(shopDomain, subscriptionId, newPlan, accessToken)
  }

  // Update shop to point to new subscription
  const subscriptionIdToStore = (() => {
    try {
      return new mongoose.Types.ObjectId(subscriptionId)
    } catch {
      return subscriptionId
    }
  })()
  await Shop.updateOne({ shopDomain }, { subscription: subscriptionIdToStore })

  // Initialize aiCredit if not exists
  await ensureAiCreditInitialized(shopDomain)

  // Activate subscription
  const updateQuery = findBySubscriptionId(subscriptionId)
  await Subscription.updateOne(updateQuery, {
    $set: {
      status: 'active',
      shopifyCharge: subscription.shopifyCharge,
    },
  })

  // Safety net: Initialize trial if webhook hasn't fired yet
  // This ensures trial tracking starts even if APP_SUBSCRIPTIONS_UPDATE webhook is delayed
  const shop = await Shop.findOne({ shopDomain })
  const subscriptionDoc = await Subscription.findById(subscriptionId).populate('plan')
  const plan = subscriptionDoc?.plan as PricingPlanDocument | undefined

  if (plan && isOrderBasedPlan(plan) && charge.trial_ends_on && !shop?.trialStartedAt) {
    await initializeTrialTracking(shopDomain)
  }

  // Track subscribe_plan event (moved from webhook for reliability)
  const shopData = await getShopData(shopDomain)
  if (shopData && plan && isOrderBasedPlan(plan)) {
    // Extract pricing info from charge
    const planPrice = charge.price ? parseFloat(charge.price) : plan.price || 0
    const planName = getPlanName(plan)

    // Calculate discounted price (trial discount applied by Shopify)
    // If on trial, first charge is $0, otherwise it's the full price
    const planPriceAfterDiscount = charge.trial_ends_on ? 0 : planPrice

    // Determine if new subscription or plan change
    const isNewSubscription = !oldPlan

    if (isNewSubscription) {
      // Track NEW subscription activation
      await trackSubscribePlan(
        shopData,
        planName,
        planPrice,
        planPriceAfterDiscount,
        true // isFirstSubscription = newSubscription = true
      )
    } else if (oldPlan) {
      // Track PLAN CHANGE
      const lastPlanPrice = oldPlan.price || 0
      const lastPlanName = getPlanName(oldPlan)

      // Calculate duration on previous plan (days since oldSubscription created)
      let daysWithLastPlan = 0
      if (oldSubscription?.createdAt) {
        const subscriptionAge = Date.now() - new Date(oldSubscription.createdAt).getTime()
        daysWithLastPlan = Math.floor(subscriptionAge / (1000 * 60 * 60 * 24))
      }

      // Calculate price deltas
      const priceDifference = planPrice - lastPlanPrice
      const priceDifferenceAfterDiscount = planPriceAfterDiscount - lastPlanPrice

      await trackSubscribePlan(
        shopData,
        planName,
        planPrice,
        planPriceAfterDiscount,
        false, // isFirstSubscription = newSubscription = false
        {
          lastPlanName,
          lastPlanPrice,
          daysWithLastPlan,
          priceDifference,
          priceDifferenceAfterDiscount,
        }
      )
    }
  }

  // Track START_TRIAL event (only if plan has trial)
  if (shopData && subscription.shopifyCharge.trial_ends_on) {
    trackEvent(shopData, EVENTS_TRACKING.START_TRIAL, {
      [EVENTS_PARAMETERS_NAME.TRIAL_ENDS_ON]: subscription.shopifyCharge.trial_ends_on,
    })
  }

  // Mark onboarding as finished
  await saveUserJourney({
    type: USER_JOURNEY_TYPE.ONBOARDING,
    isFinished: true,
    shopDomain,
    currentStep: NEW_USER_JOURNEY_STEPS.APPROVE_CHARGE,
  })

  return redirect(`${NavMenuItems.DASHBOARD}?approved=true`)
}

/**
 * Main loader - routes to appropriate handler based on request params
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain, accessToken },
    redirect,
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const chargeId = searchParams.get('charge_id')
  const subscriptionId = searchParams.get('subscription_id')

  // Case 1: User cancelled subscription
  if (subscriptionId && !chargeId) {
    return handleCancellation(shopDomain, subscriptionId, redirect)
  }

  // Case 2: User approved subscription
  if (chargeId && subscriptionId) {
    return handleApproval(shopDomain, accessToken as string, chargeId, subscriptionId, redirect)
  }

  // Default: redirect to root
  return redirect(rootPage)
})
