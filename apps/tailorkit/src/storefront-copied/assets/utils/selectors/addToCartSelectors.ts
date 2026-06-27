/**
 * Robust discovery for Add to Cart buttons/forms across Shopify themes
 *
 * Strategy:
 * - Prefer forms with action containing /cart/add
 * - Prefer submit buttons within those forms
 * - Try multiple common selector patterns
 * - As a final fallback, trigger the first matching form.submit()
 */

import { ATC_BUTTON_SELECTORS } from '../../constants/selectors'
import { CLASS_TAILORKIT_INPUT } from '../dom-constants'

const ATC_FORM_SELECTORS: string[] = [
  'form[action*="/cart/add"]',
  'product-form form[action*="/cart/add"]',
  'form.shopify-product-form[action*="/cart/add"]',
  'form[action="/cart/add"]',
]

export function findAddToCartForm(): HTMLFormElement | null {
  // First, try to find a form with TailorKit inputs (main product form)
  // This handles themes with multiple add-to-cart forms (e.g., cart drawer upsells)
  for (const selector of ATC_FORM_SELECTORS) {
    const forms = document.querySelectorAll(selector) as NodeListOf<HTMLFormElement>
    for (const form of forms) {
      if (form.querySelector(`.${CLASS_TAILORKIT_INPUT}`)) {
        return form
      }
    }
  }

  // Fallback: original behavior - return first matching form
  for (const selector of ATC_FORM_SELECTORS) {
    const form = document.querySelector(selector) as HTMLFormElement | null
    if (form) return form
  }

  return null
}

export function findAddToCartButton(form?: HTMLFormElement | null): HTMLButtonElement | HTMLInputElement | null {
  // Search within provided form first
  if (form) {
    for (const selector of ATC_BUTTON_SELECTORS) {
      const btn = form.querySelector(selector) as HTMLButtonElement | HTMLInputElement | null
      if (btn) return btn
    }
  }

  // Fallback: search globally (some themes render button outside form but wired via JS)
  for (const selector of ATC_BUTTON_SELECTORS) {
    const btn = document.querySelector(selector) as HTMLButtonElement | HTMLInputElement | null
    if (btn) return btn
  }

  return null
}

export function clickAddToCart(): boolean {
  try {
    const form = findAddToCartForm()
    const button = findAddToCartButton(form)

    if (button) {
      ;(button as HTMLElement).click()
      return true
    }

    if (form) {
      // As a last resort, submit the form programmatically
      form.requestSubmit ? form.requestSubmit() : form.submit()
      return true
    }

    return false
  } catch (error) {
    console.warn('[TailorKit] clickAddToCart failed:', error)
    return false
  }
}

/**
 * Find an express checkout button, preferring buttons within the main product form
 * (the one containing TailorKit inputs) to avoid triggering buttons in upsell widgets.
 */
export function findExpressCheckoutButton(selectors: string[]): HTMLElement | null {
  const mainForm = findAddToCartForm()

  // First, try to find express checkout button within the main product form
  if (mainForm) {
    for (const selector of selectors) {
      const btn = mainForm.querySelector(selector) as HTMLElement | null
      if (btn) return btn

      // Also check shadow DOM within the form
      const host = mainForm.querySelector(selector) as HTMLElement | null
      if (host) {
        const root = (host as any).shadowRoot as ShadowRoot | undefined
        const shadowButton = root?.querySelector('button') as HTMLElement | undefined
        if (shadowButton) return shadowButton
      }
    }
  }

  // Fallback: search globally
  for (const selector of selectors) {
    const btn = document.querySelector(selector) as HTMLElement | null
    if (btn) return btn

    // Check shadow DOM globally
    const hosts = document.querySelectorAll(selector)
    for (const host of Array.from(hosts)) {
      const root = (host as any).shadowRoot as ShadowRoot | undefined
      const shadowButton = root?.querySelector('button') as HTMLElement | undefined
      if (shadowButton) return shadowButton
    }
  }

  return null
}
