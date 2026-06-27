import Shop from '~/models/Shop.server'
import Subscription from '~/models/Subscription.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { getActiveTrialDays, isOnActiveDaysTrial, getRemainingTrialDays } from './trial-utils'

// Re-export for backward compatibility
export { getActiveTrialDays, isOnActiveDaysTrial, getRemainingTrialDays }

/**
 * Check if trial just reached trial period active days (trigger charge)
 * Called by daily cron to detect expiration
 */
export async function checkTrialExpiration(shopDomain: string): Promise<boolean> {
  const shop = await Shop.findOne({ shopDomain })
  if (!shop) return false

  // Skip if already marked as completed
  if (shop.trialCompletedAt) return false

  // Get current plan to check trial period
  const subscription = await Subscription.findOne({ shopDomain, status: 'active' }).populate('plan')
  const plan = subscription?.plan as PricingPlanDocument | undefined
  const trialPeriod = plan?.trialDays || 0

  // Check if reached trial period active days
  const activeDays = getActiveTrialDays(shop)

  return activeDays >= trialPeriod
}

/**
 * Handle uninstall: Mark uninstall timestamp (pauses trial automatically)
 */
export async function handleTrialUninstall(shopDomain: string): Promise<void> {
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        uninstalledAt: new Date(), // This pauses trial automatically
      },
    }
  )
}

/**
 * Handle reinstall: Accumulate paused duration and resume trial
 * Keep uninstalledAt for reinstall detection (don't clear it)
 */
export async function handleTrialReinstall(shopDomain: string): Promise<void> {
  const shop = await Shop.findOne({ shopDomain })

  if (!shop?.uninstalledAt) {
    // Not actually a reinstall
    return
  }

  // Calculate paused duration
  const pausedMs = Date.now() - new Date(shop.uninstalledAt).getTime()

  // Accumulate paused duration but KEEP uninstalledAt for reinstall detection
  await Shop.updateOne(
    { shopDomain },
    {
      $inc: {
        trialPausedDuration: pausedMs, // Add to total paused time
      },
      // NOTE: We keep uninstalledAt set so we can detect reinstall scenarios later
      // (e.g., in subscribe/route.ts when selecting a plan after reinstall)
    }
  )
}

/**
 * Initialize trial tracking for a new shop
 * Called when a shop first installs the app and selects a plan with trial
 */
export async function initializeTrialTracking(shopDomain: string): Promise<void> {
  const shop = await Shop.findOne({ shopDomain })

  // Skip if trial already initialized
  if (shop?.trialStartedAt) {
    return
  }

  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        trialStartedAt: new Date(),
        trialPausedDuration: 0,
        trialDebt: {
          orderOverage: 0,
          aiCreditOverage: 0,
          lastCalculatedAt: new Date(),
          chargedOrders: 0,
        },
      },
    }
  )

  // Track analytics event
  const updatedShop = await Shop.findOne({ shopDomain })
  if (updatedShop) {
    // Get plan to track trial days
    const subscription = await Subscription.findOne({ shopDomain, status: 'active' }).populate('plan')
    const plan = subscription?.plan as PricingPlanDocument | undefined

    await trackEvent(updatedShop, EVENTS_TRACKING.START_TRIAL, {
      trialStartedAt: new Date(),
      trialDays: plan?.trialDays || 0,
    })
  }
}

/**
 * Mark trial as completed (called when trial period active days reached)
 */
export async function completeTrialTracking(shopDomain: string): Promise<void> {
  const shop = await Shop.findOne({ shopDomain })

  if (!shop) {
    return
  }

  // Skip if already completed
  if (shop.trialCompletedAt) {
    return
  }

  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        trialCompletedAt: new Date(),
      },
    }
  )

  // Track analytics event
  const updatedShop = await Shop.findOne({ shopDomain })
  if (updatedShop) {
    await trackEvent(updatedShop, EVENTS_TRACKING.TRIAL_ENDED, {
      trialCompletedAt: new Date(),
      activeDays: getActiveTrialDays(updatedShop),
    })
  }
}
