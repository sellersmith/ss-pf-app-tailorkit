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
 * Returns true if this call claimed the form (proceed to add the pricing
 * line). Returns false if already claimed, within CLAIM_TTL_MS, by another
 * mechanism. A null form always claims true — nothing to coordinate through.
 */
export function claimPricingFire(form: HTMLFormElement | null): boolean {
  if (!form) return true

  const existing = form.dataset.tlkPricingFiredAt
  if (existing && Date.now() - Number(existing) < CLAIM_TTL_MS) return false

  form.dataset.tlkPricingFiredAt = String(Date.now())
  return true
}
