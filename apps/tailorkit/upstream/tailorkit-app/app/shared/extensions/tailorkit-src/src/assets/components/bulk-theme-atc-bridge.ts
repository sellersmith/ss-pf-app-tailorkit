/**
 * Bulk personalization ↔ theme button bridge.
 *
 * When bulk mode is active the bulk drawer is the source of truth for the
 * cart payload: a single click should submit N personalized line items, not
 * trigger the theme's single-item ATC. To avoid showing the customer two
 * "Add to cart" affordances (one inside the drawer panel, one provided by
 * the theme), this bridge hijacks the theme's existing Add-to-Cart button:
 *
 *   - Replace its label with `Add {N} to cart` so the customer sees the
 *     correct total reflected on the button they already know.
 *   - Capture click events ahead of any theme handler and route them to
 *     the drawer's bulk submit instead.
 *   - Hide every express-checkout button (Buy It Now, Shop Pay, Apple Pay,
 *     PayPal, etc.) because those flows checkout a single quantity-N line
 *     item rather than N distinct personalized items, and silently lose
 *     all per-unit customization data.
 *
 * On detach() the original label, click behavior, and express-checkout
 * visibility are restored. The bridge is idempotent — re-attaching while
 * already attached is a no-op.
 */

import { ATC_BUTTON_SELECTORS, EXPRESS_CHECKOUT_SELECTORS } from '../constants/selectors'
import { findAddToCartButton, findAddToCartForm } from '../utils/selectors/addToCartSelectors'

export interface BulkAtcBridgeOptions {
  /** Called when the customer clicks the hijacked theme ATC. */
  onAtcClick: () => void
  /** Builds the new ATC label, e.g. `qty => 'Add 12 to cart'`. */
  bulkLabel: (qty: number) => string
}

interface HiddenButton {
  el: HTMLElement
  originalDisplay: string
}

interface LabelTarget {
  node: Node
  originalText: string
}

export class BulkAtcBridge {
  private opts: BulkAtcBridgeOptions
  private atcButton: HTMLElement | null = null
  private atcForm: HTMLFormElement | null = null
  private labelTarget: LabelTarget | null = null
  private clickHandler: ((e: Event) => void) | null = null
  private submitHandler: ((e: Event) => void) | null = null
  private hiddenButtons: HiddenButton[] = []
  /** Original `on:click` attribute (Alpine.js themes — Prestige, Impulse). Stripped
   * on attach and restored on detach so Alpine cannot re-init the theme's
   * native ATC handler alongside ours. Mirrors `form-manager.ts`'s pattern. */
  private originalAlpineOnClick: string | null = null

  constructor(opts: BulkAtcBridgeOptions) {
    this.opts = opts
  }

  /** Attach interceptor + label override. Idempotent. */
  attach(qty: number): boolean {
    if (this.atcButton) return true
    const form = findAddToCartForm()
    const atc = findAddToCartButton(form)
    if (!atc) {
      console.warn('[TailorKit Bulk] Theme Add-to-Cart button not found; bulk drawer will keep its own submit button.')
      return false
    }
    this.atcButton = atc as HTMLElement
    // Defeat Alpine.js `on:click` directives — capture-phase only beats
    // bubble-phase listeners, but Alpine wires `on:click` via its own
    // lifecycle and re-attaches on every section render. Stripping the
    // attribute prevents Alpine from ever firing the theme's single-item
    // ATC alongside our bulk submit.
    const alpineAttr = this.atcButton.getAttribute('on:click')
    if (alpineAttr !== null) {
      this.originalAlpineOnClick = alpineAttr
      this.atcButton.removeAttribute('on:click')
    }
    this.captureLabel(this.atcButton)
    this.applyLabel(qty)
    this.clickHandler = (e: Event) => {
      // Capture-phase + stopImmediatePropagation so the theme's own click
      // handler (which posts a single-item /cart/add.js) never runs.
      e.preventDefault()
      e.stopImmediatePropagation()
      e.stopPropagation()
      this.opts.onAtcClick()
    }
    this.atcButton.addEventListener('click', this.clickHandler, { capture: true })
    // Also intercept the form `submit` event. Click-only listeners miss two
    // paths: (1) keyboard Enter on a focused ATC button — browsers dispatch
    // a `submit` directly to the form, not a click; (2) theme JS that calls
    // `form.requestSubmit()` programmatically (some bundled product-form
    // sections do this on Alpine `@submit` or Stimulus). Both would race
    // the bulk submit otherwise.
    if (form) {
      this.atcForm = form
      this.submitHandler = (e: Event) => {
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        this.opts.onAtcClick()
      }
      form.addEventListener('submit', this.submitHandler, { capture: true })
    }
    this.hideExpressCheckouts(form ?? null)
    return true
  }

  /** Restore label, click behavior, and express-checkout visibility. */
  detach(): void {
    if (!this.atcButton) return
    this.restoreLabel()
    if (this.clickHandler) {
      this.atcButton.removeEventListener('click', this.clickHandler, { capture: true })
    }
    if (this.atcForm && this.submitHandler) {
      this.atcForm.removeEventListener('submit', this.submitHandler, { capture: true })
    }
    if (this.originalAlpineOnClick !== null) {
      this.atcButton.setAttribute('on:click', this.originalAlpineOnClick)
      this.originalAlpineOnClick = null
    }
    this.clickHandler = null
    this.submitHandler = null
    this.atcButton = null
    this.atcForm = null
    this.restoreExpressCheckouts()
  }

  /** Update label text on quantity change without re-running attach(). */
  setQuantity(qty: number): void {
    if (this.atcButton) this.applyLabel(qty)
  }

  isAttached(): boolean {
    return this.atcButton !== null
  }

  /**
   * Pick the best text-bearing node inside the ATC button. Many themes wrap
   * the label in a `<span>` alongside loading-spinner/icon siblings; setting
   * textContent on the button itself would wipe those decorations. We prefer
   * an explicit span child if present, falling back to the button itself.
   */
  private captureLabel(atc: HTMLElement): void {
    const candidates = atc.querySelectorAll<HTMLElement>(
      'span, .btn-text, [class*="btn__text"], [class*="button__text"]'
    )
    for (const candidate of candidates) {
      const text = candidate.textContent?.trim() ?? ''
      // Skip empty wrappers (icon-only spans) and hidden loading labels.
      if (text.length > 0 && candidate.offsetParent !== null) {
        this.labelTarget = { node: candidate, originalText: candidate.textContent ?? '' }
        return
      }
    }
    // Fallback: the button is the label container itself (no nested icons).
    this.labelTarget = { node: atc, originalText: atc.textContent ?? '' }
  }

  private applyLabel(qty: number): void {
    if (!this.labelTarget) return
    this.labelTarget.node.textContent = this.opts.bulkLabel(qty)
  }

  private restoreLabel(): void {
    if (this.labelTarget) {
      this.labelTarget.node.textContent = this.labelTarget.originalText
      this.labelTarget = null
    }
  }

  /**
   * Hide every express-checkout (Buy It Now, Shop Pay, PayPal, Apple/Google
   * Pay, etc.) so the customer cannot accidentally bypass bulk submit. The
   * search scope is the main product form when available — that avoids
   * hiding upsell or cart-drawer payment buttons rendered elsewhere on the
   * page. We also probe the document globally for express checkouts that
   * render outside the form (modern accelerated-checkout web components).
   *
   * TODO: Shopify's `<shopify-accelerated-checkout>` web component can render
   * its inner buttons asynchronously after `connectedCallback` resolves.
   * On Dawn 12+ / Refresh themes those buttons may not yet exist when
   * `attach()` runs, so the customer briefly sees Shop Pay / Apple Pay
   * alongside the hijacked ATC. Follow-up: add a short-lived
   * MutationObserver on document.body that hides late-arriving matches
   * during the open session.
   */
  private hideExpressCheckouts(form: HTMLFormElement | null): void {
    const scopes: ParentNode[] = []
    if (form) scopes.push(form)
    scopes.push(document)
    const seen = new Set<HTMLElement>()
    for (const scope of scopes) {
      for (const selector of EXPRESS_CHECKOUT_SELECTORS) {
        const matches = scope.querySelectorAll<HTMLElement>(selector)
        matches.forEach(el => {
          if (seen.has(el)) return
          // Skip the ATC itself in case a selector overlap matches it (the
          // ATC list and express-checkout list are disjoint by design but
          // some custom themes reuse classes).
          if (this.isAtcButton(el)) return
          seen.add(el)
          this.hiddenButtons.push({ el, originalDisplay: el.style.display })
          el.style.display = 'none'
        })
      }
    }
  }

  private restoreExpressCheckouts(): void {
    for (const { el, originalDisplay } of this.hiddenButtons) {
      el.style.display = originalDisplay
    }
    this.hiddenButtons = []
  }

  private isAtcButton(el: HTMLElement): boolean {
    for (const selector of ATC_BUTTON_SELECTORS) {
      if (el.matches(selector)) return true
    }
    return false
  }
}
