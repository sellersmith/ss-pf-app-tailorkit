/**
 * SS Admin Console — Referral Tracking
 *
 * Tracks cross-sell conversions within the SellerSmith ecosystem.
 * Server-side only — the API token is never exposed to the browser.
 *
 * All public functions are non-blocking and non-throwing.
 * Referral tracking failures are logged but never surface to merchants.
 *
 * Required env vars (if absent, all tracking is silently skipped):
 *   SS_ADMIN_CONSOLE_URL  or  SS_ADMIN_API_BASE_URL  — base URL
 *   SS_ADMIN_API_TOKEN    or  SS_REFERRAL_API_TOKEN   — bearer token
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 * TailorKit as SOURCE (merchant clicks a cross-sell link/banner):
 *   import { recordReferralClick } from '~/services/ss-referral/index.server'
 *   recordReferralClick({ request, targetApp: 'pagefly', shopDomain, crossSellPosition: 'dashboard-banner' })
 *
 * TailorKit as TARGET (new install — check + convert):
 *   import { checkAndConfirmReferral } from '~/services/ss-referral/index.server'
 *   void checkAndConfirmReferral({ request, convertedShopDomain: shop, convertedEmail: email })
 */

import type { RecordReferralParams, LookupReferralParams, ConfirmConversionParams, SSReferral } from './types.server'
import { extractClientIP, extractUserAgent } from './extract.server'
import { putReferral, getReferral, patchReferral } from './client.server'

// ── SOURCE side ───────────────────────────────────────────────────────────

/**
 * Record a cross-sell click — TailorKit as SOURCE.
 *
 * Fire-and-forget: returns immediately; API call runs in the background.
 * Any error is caught and logged — never rethrows, never blocks.
 *
 * @example
 *   recordReferralClick({ request, targetApp: 'vibe', shopDomain, crossSellPosition: 'apps-promo-card' })
 */
export function recordReferralClick(params: RecordReferralParams): void {
  const { request, targetApp, shopDomain, email, shopDescription, landingPage, crossSellPosition } = params
  const clientIPAddress = extractClientIP(request)
  const clientUserAgent = extractUserAgent(request)

  void putReferral({
    sourceApp: 'tailorkit',
    targetApp,
    clientIPAddress,
    clientUserAgent,
    ...(shopDomain ? { shopDomain: shopDomain.slice(0, 256) } : {}),
    ...(email ? { email: email.slice(0, 320) } : {}),
    ...(shopDescription ? { shopDescription: shopDescription.slice(0, 500) } : {}),
    ...(landingPage ? { landingPage: landingPage.slice(0, 2000) } : {}),
    ...(crossSellPosition ? { crossSellPosition: crossSellPosition.slice(0, 500) } : {}),
  })
    .then(result => {
      if (!result.ok) {
        console.error('[SSReferral] recordReferralClick failed:', result.status, result.error)
      }
    })
    .catch(err => {
      console.error('[SSReferral] recordReferralClick error:', err)
    })
}

// ── TARGET side ───────────────────────────────────────────────────────────

/**
 * Look up whether the current visitor arrived via a referral — TailorKit as TARGET.
 *
 * Returns the referral record, or null when not referred / on any error.
 * Called before confirmReferralConversion to avoid a PATCH round-trip on organic installs.
 */
export async function lookupReferral(params: LookupReferralParams): Promise<SSReferral | null> {
  try {
    const clientIPAddress = extractClientIP(params.request)
    const clientUserAgent = extractUserAgent(params.request)

    if (!clientIPAddress || !clientUserAgent) return null

    const result = await getReferral({ targetApp: 'tailorkit', clientIPAddress, clientUserAgent })

    if (!result.ok) {
      console.error('[SSReferral] lookupReferral failed:', result.status, result.error)
      return null
    }

    return result.data.referral
  } catch (err) {
    console.error('[SSReferral] lookupReferral error:', err)
    return null
  }
}

/**
 * Confirm a referral conversion — TailorKit as TARGET.
 *
 * Call only after lookupReferral returned a non-null referral.
 * Safe to call unconditionally — 404 means organic install (not an error).
 * Returns true when the conversion was recorded, false otherwise.
 */
export async function confirmReferralConversion(params: ConfirmConversionParams): Promise<boolean> {
  try {
    const clientIPAddress = extractClientIP(params.request)
    const clientUserAgent = extractUserAgent(params.request)

    if (!clientIPAddress || !clientUserAgent) return false

    const result = await patchReferral({
      targetApp: 'tailorkit',
      clientIPAddress,
      clientUserAgent,
      ...(params.convertedShopDomain ? { convertedShopDomain: params.convertedShopDomain } : {}),
      ...(params.convertedEmail ? { convertedEmail: params.convertedEmail } : {}),
      ...(params.convertedShopDescription ? { convertedShopDescription: params.convertedShopDescription } : {}),
    })

    if (!result.ok) {
      if (result.status === 404) {
        // Organic install — no pending referral found. Expected, not an error.
        return false
      }
      console.error('[SSReferral] confirmReferralConversion failed:', result.status, result.error)
      return false
    }

    return true
  } catch (err) {
    console.error('[SSReferral] confirmReferralConversion error:', err)
    return false
  }
}

/**
 * Combined check-and-confirm — call on new install.
 *
 * 1. GET to find a pending referral by IP + UA fingerprint
 * 2. If found: PATCH to confirm conversion
 * 3. If not found (or any error): silent no-op
 *
 * Fully non-blocking — returns void and runs async in the background.
 * Wrap the call in `void` to make the fire-and-forget intent explicit.
 *
 * @example
 *   // In install hook, after shop is created:
 *   void checkAndConfirmReferral({ request, convertedShopDomain: session.shop, convertedEmail: email })
 */
export async function checkAndConfirmReferral(params: ConfirmConversionParams): Promise<void> {
  try {
    const referral = await lookupReferral({ request: params.request })
    if (!referral) return // organic install

    const converted = await confirmReferralConversion(params)
    if (converted) {
      console.log('[SSReferral] Referral conversion recorded for shop:', params.convertedShopDomain)
    }
  } catch (err) {
    console.error('[SSReferral] checkAndConfirmReferral error:', err)
  }
}

// Re-export types for consumers
export type {
  SSProduct,
  SSTargetApp,
  SSReferral,
  RecordReferralParams,
  LookupReferralParams,
  ConfirmConversionParams,
} from './types.server'
