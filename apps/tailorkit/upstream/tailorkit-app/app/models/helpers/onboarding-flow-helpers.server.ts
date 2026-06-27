/**
 * Helpers for the onboarding flow router feature.
 *
 * - shouldShowIntentPage(): gate read for the install intent page loader.
 * - markIntentPageShown(): sets shownAt on first render so the page never re-appears.
 * - recordIntentSelection(): persists the merchant's flow pick + timing telemetry.
 * - recordDemoClicked(): sets the demoClickedFirst flag (idempotent).
 * - setLastCreateFlow(): updates the per-shop dropdown default.
 *
 * All setters use $set on targeted paths so they don't clobber sibling appConfig fields
 * under concurrent writes.
 */

import Shop from '../Shop.server'
import type { CreateFlow, ShopDocument } from '../Shop'

/** True if the install intent page should render for this shop.
 *  Primary gate is `selected` — a bouncer who closed the page without picking
 *  gets re-engaged on next visit; once a CreateFlow value or 'skipped' is
 *  recorded, the page never re-shows. Existing shops are backfilled with
 *  selected = 'skipped' so they bypass entirely.
 *
 *  Defense-in-depth: returning merchants who have already completed onboarding
 *  must never see this page, even if their `selected` field gets accidentally
 *  cleared by a future code path. The intent page is for fresh installers
 *  picking their first flow — a merchant who has already published their first
 *  integration has nothing to discover here. */
export function shouldShowIntentPage(shop: ShopDocument | null | undefined): boolean {
  // No shop record = race during install; show the page (loader will revalidate).
  if (!shop) return true
  if (shop.appConfig?.onboardingIntent?.selected) return false
  if (shop.appConfig?.occurredEvents?.completed_onboarding) return false
  return true
}

/** Idempotently mark the intent page as shown. Only writes if shownAt is still unset
 *  — re-renders/refreshes don't reset selected/timeToSelectSeconds.
 *  Uses a dot-path $set so any pre-existing sibling fields (e.g. selected written
 *  out-of-band by the API route) are preserved. */
export async function markIntentPageShown(shopDomain: string): Promise<void> {
  await Shop.updateOne(
    { shopDomain, 'appConfig.onboardingIntent.shownAt': { $exists: false } },
    { $set: { 'appConfig.onboardingIntent.shownAt': new Date() } }
  )
}

/** Persist the merchant's flow selection from the install intent page. */
export async function recordIntentSelection(
  shopDomain: string,
  selected: CreateFlow,
  timeToSelectSeconds: number,
  demoClickedFirst: boolean
): Promise<void> {
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'appConfig.onboardingIntent.selected': selected,
        'appConfig.onboardingIntent.timeToSelectSeconds': timeToSelectSeconds,
        'appConfig.onboardingIntent.demoClickedFirst': demoClickedFirst,
      },
    }
  )
}

/** Set demoClickedFirst = true. Idempotent flag flip. Called when the merchant
 *  clicks the demo card on the install intent page. */
export async function recordDemoClicked(shopDomain: string): Promise<void> {
  await Shop.updateOne({ shopDomain }, { $set: { 'appConfig.onboardingIntent.demoClickedFirst': true } })
}

/** Update the per-shop dropdown default. Called whenever the merchant picks a
 *  flow from the create-flow dropdown. */
export async function setLastCreateFlow(shopDomain: string, flow: CreateFlow): Promise<void> {
  await Shop.updateOne({ shopDomain }, { $set: { 'appConfig.lastCreateFlow': flow } })
}
