import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { PRICING_ACTION } from './constants'
import { authenticate } from '~/shopify/app.server'
import { getAllPricingPlans } from '~/models/PricingPlan.server'
import { createSubscription } from '~/models/Subscription.server'
import { applyCouponToShop, getCurrentCouponByShopDomain, validateCoupon } from '~/models/Coupon.server'
import { INVALID_REQUEST, INVALID_SHOP_ERROR, PricingErrors } from '~/constants/errors'
import { getSubscriptionBillingCycle } from './utils/fns.server'
import { getShopData } from '~/models/Shop.server'
import type { SubscriptionDocument } from '~/models/Subscription'
import { catchAsync } from '~/utils/catchAsync'
import { applyPromotionIfQualified } from '~/models/Promotion.server'
import { findEarliestTrialStartDate } from '~/models/helpers/subscription-helpers.server'
import { BillingStateManager } from '~/models/helpers/BillingStateManager.server'
import { getPurchasedCreditsInCycle } from '~/models/helpers/ai-credit-helpers.server'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  return json(await getAllPricingPlans(shop))
})

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  try {
    const {
      admin,
      session: { shop },
    } = await authenticate.admin(request)

    const payload = (await request.json()) || {}
    const { action, ...rest } = payload

    // Apply promotion if has
    const shopData = await getShopData(shop)

    await applyPromotionIfQualified(shopData)

    switch (action) {
      case PRICING_ACTION.SUBSCRIBE: {
        // Get planId from either 'plan' or 'planId' field (backward compatibility)
        const planId = rest.plan || rest.planId

        if (!planId) {
          throw new Error('Missing plan ID')
        }

        // Use unified subscription creation (automatically detects billing type)
        const subscriptionPayload = {
          planId,
          couponCode: rest.coupon,
        }

        const res = await createSubscription(admin, shop, subscriptionPayload)

        return json({ success: true, confirmationUrl: res === true ? null : res.confirmationUrl })
      }

      case PRICING_ACTION.REDEEM_COUPON: {
        if (await applyCouponToShop(rest.coupon, shop)) {
          return json({ success: true })
        }

        return json({ success: false, message: `The coupon code ${rest.coupon} is either invalid or has been expired` })
      }

      case PRICING_ACTION.VALIDATE_COUPON: {
        const validatedCoupon = await validateCoupon(rest.coupon, shop)

        return json({ success: true, validatedCoupon })
      }

      case PRICING_ACTION.GET_CURRENT_COUPON_BY_SHOP_DOMAIN: {
        const coupons = await getCurrentCouponByShopDomain(shop)

        return json({ success: true, coupons })
      }

      case PRICING_ACTION.GET_CURRENT_SUBSCRIPTION_CYCLE: {
        if (!shopData) {
          throw new Error(INVALID_SHOP_ERROR)
        }

        const subscription = shopData.subscription as SubscriptionDocument

        const { shopifyCharge, plan } = subscription

        if (!shopifyCharge || !plan) {
          throw new Error(PricingErrors.INVALID_PLAN)
        }

        const { activated_on, trial_ends_on } = shopifyCharge || {}

        const billingCycle = await getSubscriptionBillingCycle(shop, trial_ends_on || activated_on)

        return json({ success: true, billingCycle })
      }

      case PRICING_ACTION.GET_REMAINING_TRIAL_DAYS: {
        // Check V2 active-days trial tracking
        // For V1 pricing, trial eligibility is managed by Shopify when creating subscription
        const earliestTrialStart = await findEarliestTrialStartDate(shop)

        if (earliestTrialStart) {
          return json({
            success: true,
            hasUsedTrial: true,
            trialStartDate: earliestTrialStart.toISOString(),
          })
        }

        // Return install date so client can compute dynamic trial days for pre-trial users
        return json({ success: true, hasUsedTrial: false, installDate: shopData?.createdAt })
      }

      case PRICING_ACTION.GET_BILLING_STATE: {
        const billingState = await BillingStateManager.getCurrentState(shop)

        return json({
          success: true,
          billingState,
          billingCycleBaseline: billingState?.cycle?.orderCount?.initial || 0,
        })
      }

      case PRICING_ACTION.GET_BILLING_CYCLES: {
        const daysBack = rest.daysBack || 30 // Default to 30 days (1 billing cycle)
        const history = await BillingStateManager.getBillingHistory(shop, daysBack)

        return json({
          success: true,
          billingCycles: history.cycles || [],
        })
      }

      case PRICING_ACTION.GET_COUPON: {
        const { couponCode } = rest

        if (!couponCode) {
          return json({ success: false, message: 'Missing coupon code' })
        }

        const coupon = await validateCoupon(couponCode, shop)

        if (!coupon) {
          return json({ success: false, message: 'Invalid or expired coupon' })
        }

        return json({
          success: true,
          coupon,
        })
      }

      case PRICING_ACTION.GET_PURCHASED_CREDITS_IN_CYCLE: {
        if (!shopData?.usages?.aiCredit) {
          return json({
            success: true,
            total: 0,
            used: 0,
            remaining: 0,
          })
        }

        const { startMonth, purchasedCredits } = shopData.usages.aiCredit
        const cycleStartDate = new Date(startMonth)
        const currentRemaining = purchasedCredits || 0

        const purchasedInfo = await getPurchasedCreditsInCycle(shop, cycleStartDate, currentRemaining)

        return json({
          success: true,
          ...purchasedInfo,
        })
      }

      default: {
        return json({ success: false, message: INVALID_REQUEST })
      }
    }
  } catch (e: any) {
    return json({ success: false, message: e.message || e })
  }
})
