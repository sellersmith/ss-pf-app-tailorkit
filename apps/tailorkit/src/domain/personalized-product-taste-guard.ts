// Server-authoritative taste enforcement for TailorKit personalized products.
//
// Policy (quota per tier) is host-owned and surfaced via ctx safe-context (app.meterQuotas).
// Counting is app-owned: this guard reads the active personalized-product count and blocks the
// (quota+1)th create. -1 = unlimited. Guard ONLY runs on create (new id) — updates never gated.
import type { AppBackendRegisterContext, AppContext, MeterCeilingEvent } from '../../../../web/server/src/app-platform/contracts'
import { createTailorKitProductPersonalizerRepository } from '../backend/product-personalizer-repository'

/** Manifest meter key for personalized products — must match apps/tailorkit/manifest.ts entitlement.meters. */
export const TAILORKIT_PERSONALIZED_PRODUCTS_METER = 'personalizedProducts'

/** Free allowance when on a taste tier — mirrors the manifest freeLimit (display fallback only). */
const TASTE_FREE_LIMIT = 3

/** Tier the merchant must reach to lift the cap (display only; real policy lives in host TIER_GRANTS). */
const TASTE_UPGRADE_TIER = 'optimize'

const UNLIMITED = -1

export interface TasteCeilingResult {
  blocked: boolean
  event?: MeterCeilingEvent
}

/**
 * Returns a ceiling result for a NEW personalized product create. When quota is exhausted, blocked=true
 * and a MeterCeilingEvent is supplied for the FE upgrade CTA. Fails OPEN (never blocks) when quota is
 * absent (flag off / ungated) or unlimited.
 */
export async function checkPersonalizedProductTaste(
  app: AppBackendRegisterContext,
  ctx: AppContext,
  quota: number | undefined
): Promise<TasteCeilingResult> {
  // No quota surfaced (flag off / app unlocked / unknown tier) or unlimited → never gate.
  if (quota === undefined || quota === UNLIMITED) return { blocked: false }

  const repo = createTailorKitProductPersonalizerRepository(app.ports, ctx)
  // total counts active (non-deleted) integrations — the authoritative server-side count.
  //
  // NOTE: count-then-create is not transactional (ScopedAppDataPort exposes no atomic $inc). Two
  // concurrent creates at the boundary can both pass → a bounded over-grant of 1-2 products. Accepted:
  // taste is a soft upgrade nudge (flag-gated, default OFF), NOT the security boundary — that is the
  // port-level binary deny. If taste ever becomes a hard limit, add an atomic count-and-create to the
  // data port and gate at the repository chokepoint (covers every create path, closes the race).
  const { total } = await repo.list({ limit: 1 })

  if (total < quota) return { blocked: false }

  return {
    blocked: true,
    event: {
      appId: ctx.appId,
      meterKey: TAILORKIT_PERSONALIZED_PRODUCTS_METER,
      used: total,
      freeLimit: quota || TASTE_FREE_LIMIT,
      upgradeTier: TASTE_UPGRADE_TIER,
    },
  }
}
