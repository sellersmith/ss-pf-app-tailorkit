/**
 * Trial Utilities (Client-Safe)
 *
 * Pure calculation functions and constants for trial tracking.
 * NO database calls, NO server-only imports.
 * Safe to use in both client and server code.
 */

import type { ShopDocument } from '~/models/Shop'
import type { PricingPlanDocument } from '~/models/PricingPlan'

const ONE_DAY_MS = 24 * 60 * 60 * 1000 // 86,400,000 milliseconds

/**
 * Calculate active trial days from timestamps (REAL-TIME)
 * This is the SINGLE SOURCE OF TRUTH for trial progress
 *
 * Pure function - no side effects, no database calls
 *
 * @returns Number of ACTIVE days (raw, not clamped), NOT including paused time
 */
export function getActiveTrialDays(shop: ShopDocument | null | undefined): number {
  // Guard: No shop data
  if (!shop) {
    return 0
  }

  // Guard: Trial not started
  if (!shop.trialStartedAt) {
    return 0
  }

  const startTime = new Date(shop.trialStartedAt).getTime()
  const now = Date.now()

  // Calculate total elapsed time
  let activeMs = now - startTime

  // Subtract accumulated paused duration (from ALL previous uninstall/reinstall cycles)
  // NOTE: We no longer check shop.uninstalledAt because:
  // 1. uninstalledAt is preserved (not cleared) to enable reinstall detection
  // 2. All paused time is accumulated in trialPausedDuration by handleTrialReinstall()
  // 3. This function assumes app is currently installed (being called from within the app)
  activeMs -= shop.trialPausedDuration || 0

  // Convert to days (floor)
  const activeDays = Math.floor(activeMs / ONE_DAY_MS)

  return Math.max(0, activeDays) // Return raw days (not clamped to trial period)
}

/**
 * Check if shop is currently on active-days trial
 * Pure function - safe for client and server
 *
 * @param shop Shop document
 * @param plan Plan document (to get trial period)
 */
export function isOnActiveDaysTrial(shop: ShopDocument | null | undefined, plan?: PricingPlanDocument | null): boolean {
  if (!shop) return false

  const trialPeriod = plan?.trialDays || 0
  const activeDays = getActiveTrialDays(shop)
  // NOTE: We don't check !shop.uninstalledAt anymore because uninstalledAt is preserved for reinstall detection
  // If the app is currently running (this function is called), it's installed
  return activeDays < trialPeriod && !shop.trialCompletedAt
}

/**
 * Get remaining trial days
 * Pure function - safe for client and server
 *
 * @param shop Shop document
 * @param plan Plan document (to get trial period)
 */
export function getRemainingTrialDays(
  shop: ShopDocument | null | undefined,
  plan?: PricingPlanDocument | null
): number {
  if (!shop) return 0

  const totalTrialDays = plan?.trialDays || 0
  const activeDays = getActiveTrialDays(shop)
  return Math.max(0, totalTrialDays - activeDays)
}
