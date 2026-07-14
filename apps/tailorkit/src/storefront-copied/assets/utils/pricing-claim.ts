/**
 * Cross-mechanism claim guard for the hidden pricing cart line.
 *
 * Both the fetch interceptor (addProductToCartMiddleware.ts) and the
 * submit-listener fallback (cart-form-sync.ts) can end up trying to add the
 * pricing line for the same ATC submission. Signals tried and rejected before
 * this one:
 *   - `event.defaultPrevented`: themes using XHR (not fetch) also call
 *     preventDefault() to stop page navigation, so this can't distinguish
 *     "fetch will handle it" from "nothing will".
 *   - a per-submission refId: observed to differ between the two mechanisms'
 *     reads on the same click, so it isn't a stable shared identifier.
 *   - a boolean claim on the `<form>` element, reset in a capture-phase
 *     'submit' listener before the theme's own handler runs: this assumed our
 *     capture listener always runs before the theme's own ATC handling, but
 *     some themes (e.g. Shopify Horizon's product-form.js) ALSO delegate
 *     their submit handling through a capture-phase `document` listener.
 *     Listener order between two capture-phase listeners on the same target
 *     is registration order, not something we control — if the theme's
 *     listener happens to be registered first, it fires (and triggers our
 *     fetch interceptor) BEFORE our own capture listener resets the claim,
 *     so the reset wipes out a claim that was just legitimately made,
 *     re-opening the window for the fallback to also fire. Confirmed live via
 *     stack trace: interceptor claimed inside `product-form.js`'s
 *     `#processAddToCart` (itself invoked from a capture-phase document
 *     listener), then our own capture listener's reset ran straight after.
 *
 * This claims against the actual `<form>` DOM element (both mechanisms locate
 * the SAME node — the fallback via `event.target`, the interceptor by
 * matching the submitted variant id against `input[name="id"]` inside
 * `form[action*="/cart/add"]`) but with a TTL instead of an explicit capture-
 * phase reset: a claim older than CLAIM_TTL_MS is treated as stale and can be
 * re-claimed. This sidesteps event-ordering entirely — correctness no longer
 * depends on which capture-phase listener a theme happens to register first.
 * A real ATC submission's pricing decision (both mechanisms combined)
 * resolves in well under a second in practice; the TTL only needs to be
 * longer than that, not longer than the time between two genuinely separate
 * user clicks.
 *
 * Known limitation: if a page has MULTIPLE forms targeting the same variant
 * (e.g. a real sticky/quick-add `<form>` alongside the main product form,
 * both with matching `input[name="id"]`), the interceptor's variant-id match
 * could resolve to a different form node than the one that actually
 * dispatched the submit event the fallback saw — defeating this guard. Not
 * currently known to occur on any theme this has been tested against (the
 * page tested had exactly one matching form), but worth checking first if a
 * double-add ever resurfaces after this fix ships.
 */

const CLAIM_TTL_MS = 5000

export function findAtcFormForVariant(variantId: string | undefined): HTMLFormElement | null {
  const forms = document.querySelectorAll('form[action*="/cart/add"]')

  for (const form of forms) {
    if (variantId === undefined) return form as HTMLFormElement
    const idInput = form.querySelector('input[name="id"]') as HTMLInputElement | null
    if (idInput && idInput.value === String(variantId)) return form as HTMLFormElement
  }

  return null
}

/**
 * Attempt to claim the pricing-fire right for a submission.
 *
 * Returns true if this call claimed it (proceed to add the pricing line).
 * Returns false if already claimed (within CLAIM_TTL_MS) by the other
 * mechanism — skip, it's already being handled. A null form (no matching DOM
 * form found, e.g. a theme-built quick-add widget with no real <form>) always
 * claims true, since there's no shared node to coordinate through and so no
 * double-add risk from this guard's perspective.
 */
export function claimPricingFire(form: HTMLFormElement | null): boolean {
  if (!form) return true

  const existing = form.dataset.tlkPricingFiredAt
  if (existing && Date.now() - Number(existing) < CLAIM_TTL_MS) return false

  form.dataset.tlkPricingFiredAt = String(Date.now())
  return true
}
