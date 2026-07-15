/**
 * Cross-mechanism claim guard for the hidden pricing cart line.
 *
 * `main` currently runs FOUR separate hidden-pricing mechanisms on every ATC
 * submission: the storefront-copied (upstream-mirrored) fetch interceptor +
 * submit-listener fallback, and this tree's own fetch interceptor + native
 * submit handler (installTailorKitHiddenPricingFetchInterceptor /
 * installTailorKitHiddenPricingNativeSubmit). All four can end up trying to
 * add the same pricing line for one submission.
 *
 * This intentionally duplicates apps/tailorkit/src/storefront-copied/assets/
 * utils/pricing-claim.ts rather than importing across trees — storefront-
 * copied mirrors upstream TailorKit and gets overwritten wholesale on sync
 * (see the "Preserved PageFly deltas" list in the sync commit that landed
 * this file's siblings), so a cross-tree import here would be fragile.
 * Coordination instead happens through the DOM: both trees read/write the
 * SAME `form.dataset.tlkPricingFiredAt` key on the SAME `<form>` element, so
 * whichever of the four mechanisms claims it first — from either tree —
 * blocks the rest, regardless of which JS module the claim call lives in.
 *
 * TTL-based rather than reset in a capture-phase listener: `event.
 * defaultPrevented` can't tell "fetch will handle it" apart from "nothing
 * will" (XHR-based themes call preventDefault() too), and a capture-phase
 * reset assumes our capture listener always runs before the theme's own ATC
 * handling — which breaks for themes (e.g. Shopify Horizon's product-form.js)
 * that ALSO delegate their submit handling through a capture-phase document
 * listener, with no guaranteed registration order vs ours. A claim older
 * than CLAIM_TTL_MS is treated as stale and can be re-claimed; a real ATC
 * submission's pricing decision resolves in well under a second in practice.
 */

const CLAIM_TTL_MS = 5000

export function findAtcFormForVariant(variantId: string | number | undefined): HTMLFormElement | null {
  if (typeof document === 'undefined') return null

  const forms = document.querySelectorAll<HTMLFormElement>('form[action*="/cart/add"]')
  for (const form of forms) {
    if (variantId === undefined) return form
    const idInput = form.querySelector<HTMLInputElement>('input[name="id"]')
    if (idInput && idInput.value === String(variantId)) return form
  }

  return null
}

/**
 * Global (window-level) backstop claim keyed by variant id. Coordinates the
 * mechanisms that resolve to a NULL or DIFFERENT `<form>` for the same ATC —
 * the documented escape that let a second mechanism double-add the pricing
 * line (with a mismatched refId → orphan pricing line): the fetch interceptor
 * whose variant→form lookup misses (customizer modal, quick-add widget, or
 * multiple matching forms) hit `if (!form) return true` and fired anyway while
 * the submit-listener already claimed the real form. Keyed by variant so two
 * genuinely different products added in quick succession each still fire.
 */
function claimGlobalPricingFire(variantId: string | undefined, now: number): boolean {
  if (typeof window === 'undefined' || !variantId) return true
  const store = ((window as unknown as { __tlkPricingClaims?: Record<string, number> }).__tlkPricingClaims ??= {})
  if (store[variantId] && now - store[variantId] < CLAIM_TTL_MS) return false
  store[variantId] = now
  return true
}

/**
 * Returns true if this call claimed the fire (proceed to add the pricing
 * line). Returns false if already claimed, within CLAIM_TTL_MS, by another
 * mechanism — via the shared `<form>` node OR the variant-keyed global
 * backstop (so a null/different form no longer bypasses coordination).
 * Pass `variantId` explicitly when the caller knows it but the form may be
 * null (e.g. the fetch interceptor); otherwise it is read from the form.
 */
export function claimPricingFire(form: HTMLFormElement | null, variantId?: string | number): boolean {
  const now = Date.now()
  const variantKey =
    variantId != null
      ? String(variantId)
      : form?.querySelector<HTMLInputElement>('input[name="id"]')?.value || undefined

  if (form) {
    const existing = form.dataset.tlkPricingFiredAt
    if (existing && now - Number(existing) < CLAIM_TTL_MS) return false
    form.dataset.tlkPricingFiredAt = String(now)
  }

  return claimGlobalPricingFire(variantKey, now)
}
