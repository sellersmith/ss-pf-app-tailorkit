/**
 * Global capture-phase click listener that arms the post-ATC checkout
 * redirect whenever the buyer clicks an add-to-cart button on the
 * TailorKit-managed product form. Covers the INLINE personalization
 * flow where the buyer customizes on the product page and then clicks
 * the theme's native ATC button directly — without going through the
 * personalization modal.
 *
 * The modal flow has its own arm-before-click in customizer-modal.tsx;
 * both call paths converge on the same `armCheckoutRedirectOnce` /
 * `tagAddToCartForm` helpers, which are idempotent so double-arming
 * during a modal-driven flow is a safe no-op.
 *
 * Activation gates (ALL must hold):
 *   1. `redirectToCheckoutAfterAtc.enabled === true` in app settings
 *   2. The clicked element is inside a form whose action targets
 *      `/cart/add[.js|.json]`
 *   3. That form is TailorKit-owned — i.e., it carries at least one
 *      `.emtlkit--input` injected by FormManager. This excludes
 *      third-party Quick Add forms in cart-drawer upsells, featured
 *      product sections on collection pages, and any other `/cart/add`
 *      form that does not belong to the personalized product.
 *
 * Without all three, the click is left alone and the theme's default
 * cart-page redirect runs as usual.
 */

import { getPostAtcRedirectSettings } from './settings'
import { armCheckoutRedirectOnce, tagAddToCartForm } from './redirect-interceptor'
import { CLASS_TAILORKIT_INPUT } from '../../utils/dom-constants'

const CART_ADD_PATHNAMES = new Set(['/cart/add', '/cart/add.js', '/cart/add.json'])

let installed = false

function isCartAddAction(action: string | null): boolean {
  if (!action) return false
  try {
    const pathname = new URL(action, window.location.origin).pathname
    return CART_ADD_PATHNAMES.has(pathname)
  } catch {
    return false
  }
}

function isTailorKitOwnedForm(form: HTMLFormElement): boolean {
  // FormManager injects .emtlkit--input hidden inputs into the main TailorKit
  // product form. Cart-drawer upsells and unrelated Quick Add forms never get
  // these inputs, so this is a reliable ownership signal.
  return form.querySelector(`.${CLASS_TAILORKIT_INPUT}`) !== null
}

function findEnclosingAtcForm(target: EventTarget | null): HTMLFormElement | null {
  if (!(target instanceof Element)) return null
  // The click can land on the button, its icon, or a child span — walk up to
  // the nearest submit-capable control and then to the form.
  const control = target.closest('button, input[type="submit"], [type="submit"]') as HTMLElement | null
  const form
    = (control?.closest('form') as HTMLFormElement | null) ?? (target.closest('form') as HTMLFormElement | null)
  if (!form) return null
  if (!isCartAddAction(form.getAttribute('action'))) return null
  return form
}

function handleClick(event: MouseEvent): void {
  if (!getPostAtcRedirectSettings().enabled) return
  const form = findEnclosingAtcForm(event.target)
  if (!form) return
  if (!isTailorKitOwnedForm(form)) return
  tagAddToCartForm(form)
  armCheckoutRedirectOnce()
}

/**
 * Install the global listener once per page lifetime. Subsequent calls are
 * no-ops so this can be invoked safely from multiple entry points.
 */
export function installInlineCheckoutRedirect(): void {
  if (installed) return
  installed = true
  document.addEventListener('click', handleClick, true)
}

/**
 * Test-only: reset the install guard and remove the listener so each test
 * exercises a freshly-installed listener. Never call from production code.
 */
export function _resetInlineCheckoutRedirectForTesting(): void {
  if (installed) {
    document.removeEventListener('click', handleClick, true)
  }
  installed = false
}
