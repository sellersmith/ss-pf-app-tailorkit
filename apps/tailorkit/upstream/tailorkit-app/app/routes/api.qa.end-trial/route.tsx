import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { isWIPAndRCEnv } from '~/app-configs.server'
import Subscription from '~/models/Subscription.server'
import Shop from '~/models/Shop.server'
import PricingPlan from '~/models/PricingPlan.server'
import pricingPlans from '~/models/PricingPlan.define.sever'
import { completeTrialTracking, isOnActiveDaysTrial } from '~/models/helpers/trial-tracking.server'
import { chargeTrialDebt } from '~/models/helpers/trial-debt.server'
import { catchAsync } from '~/utils/catchAsync'
import type { PricingPlanDocument } from '~/models/PricingPlan'

async function handleSetTrialDaysToZero() {
  const result = await PricingPlan.updateMany({ status: 'active' }, { $set: { trialDays: 0 } })
  return json({
    success: true,
    message: `Set trialDays to 0 for ${result.modifiedCount} pricing plans`,
  })
}

async function handleRestoreTrialDays() {
  const updates = await Promise.all(
    pricingPlans
      .filter(plan => plan.alias && plan.status === 'active')
      .map(plan => PricingPlan.updateOne({ alias: plan.alias }, { $set: { trialDays: plan.trialDays ?? 0 } }))
  )

  const modifiedCount = updates.reduce((sum, r) => sum + r.modifiedCount, 0)
  return json({
    success: true,
    message: `Restored original trialDays for ${modifiedCount} pricing plans`,
  })
}

async function handleEndShopTrial(shopDomain: string) {
  const shop = await Shop.findOne({ shopDomain })
  if (!shop) {
    return json({ success: false, error: 'Shop not found' }, { status: 404 })
  }

  const subscription = await Subscription.findOne({ shopDomain, status: 'active' }).populate('plan')
  if (!subscription) {
    return json({ success: false, error: 'No active subscription found' }, { status: 404 })
  }

  // Check if on active-days trial
  if (!isOnActiveDaysTrial(shop, subscription.plan as PricingPlanDocument)) {
    return json(
      {
        success: false,
        error: 'Shop is not on active-days trial',
      },
      { status: 400 }
    )
  }

  // Charge accumulated trial debt before ending trial
  const chargedAmount = await chargeTrialDebt(shopDomain, subscription, 'trial_end')

  // Mark trial as completed (force expiration)
  await completeTrialTracking(shopDomain)

  return json({
    success: true,
    message: `Trial force-ended for ${shopDomain}`,
    chargedAmount,
    trialCompletedAt: new Date(),
  })
}

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  // Only available in WIP/RC/dev environments
  if (!isWIPAndRCEnv()) {
    return json({ success: false, error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const isAuthorized = searchParams.get('token') === process.env.SECRET_TOKEN
  if (!isAuthorized) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const action = searchParams.get('action')

  // Action: Set all plans' trialDays to 0
  if (action === 'set-zero') {
    return handleSetTrialDaysToZero()
  }

  // Action: Restore all plans' trialDays to original values
  if (action === 'restore') {
    return handleRestoreTrialDays()
  }

  // Default: End a specific shop's trial
  const shopDomain = searchParams.get('shopDomain')
  if (!shopDomain) {
    return json({ success: false, error: 'shopDomain is required' }, { status: 400 })
  }

  return handleEndShopTrial(shopDomain)
})
