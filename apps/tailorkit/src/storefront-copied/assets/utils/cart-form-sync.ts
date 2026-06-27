/**
 * Cart form sync & pricing product injection for native-POST themes.
 *
 * CAPTURE phase: copy missing TK inputs + ensure pricing input.
 * BUBBLE phase: if theme did NOT prevent default (native POST),
 *   fire the pricing product fetch with keepalive before page navigates.
 */

import { CLASS_TAILORKIT_INPUT, CLASS_TAILORKIT_TRACKING } from './dom-constants'

const TLK_INPUT_SELECTOR = `.${CLASS_TAILORKIT_INPUT}, .${CLASS_TAILORKIT_TRACKING}`

export function installCartFormSync(): void {
  // Guard: prevent duplicate listeners from hot-reload or multiple TK instances
  if ((window as any).__tlk_cart_sync_installed) return
  ;(window as any).__tlk_cart_sync_installed = true

  document.addEventListener('submit', handleInputSync, true)
  document.addEventListener('submit', handlePricingProduct, false)
}

// ─── Capture phase: sync inputs ──────────────────────────────────────────────

function handleInputSync(e: Event): void {
  const form = e.target as HTMLFormElement
  if (!form?.action?.includes('/cart/add')) return

  // Copy TK inputs from sibling form if this form has none
  if (form.querySelectorAll(TLK_INPUT_SELECTOR).length === 0) {
    for (const other of document.querySelectorAll('form[action*="/cart/add"]')) {
      if (other === form) continue
      const inputs = other.querySelectorAll(TLK_INPUT_SELECTOR)
      if (inputs.length === 0) continue
      for (const inp of inputs) form.appendChild(inp.cloneNode(true))
      break
    }
  }
}

// ─── Bubble phase: fire pricing product for native-POST themes ───────────────

function handlePricingProduct(e: Event): void {
  const form = e.target as HTMLFormElement
  if (!form?.action?.includes('/cart/add')) return

  // If theme prevented default → it uses fetch → TK interceptor handles pricing
  if (e.defaultPrevented) return
  if (form.dataset.tlkPricingFired) return

  const costInput = form.querySelector('input[name*="Total_Additional_Cost"]') as HTMLInputElement | null
  const additionalCost = parseFloat(costInput?.value || '0')
  if (additionalCost <= 0) return

  form.dataset.tlkPricingFired = 'true'

  // Read context from form inputs
  const refId = (form.querySelector('input[name*="_ref_id"]') as HTMLInputElement)?.value || ''
  const productName = (form.querySelector('input[name*="_product_name"]') as HTMLInputElement)?.value || ''
  const mainQty = parseInt((form.querySelector('input[name="quantity"]') as HTMLInputElement)?.value || '1', 10) || 1

  // Read the cached hidden pricing product from the global cache
  // (initialized at page load by initializeHiddenPricingProductCache)
  const cache = (window as any).__tlk_pricing_cache
  if (!cache?.product) {
    console.warn('[TailorKit] No cached pricing product — cannot add pricing item')
    return
  }

  const hiddenProduct = cache.product
  const unitPrice = hiddenProduct.variants[0]?.price
  if (!unitPrice || unitPrice <= 0) return

  const baseQty = Math.round(additionalCost / unitPrice)
  const totalQty = baseQty * mainQty
  if (totalQty <= 0) return

  const variant = hiddenProduct.variants.find((v: { available: boolean }) => v.available)
  if (!variant) return

  // Detect property prefix from form
  const prefixMatch = (form.querySelector('input[name*="_ref_id"]') as HTMLInputElement)?.name.match(
    /^properties\[(.+?)_ref_id\]$/
  )
  const prefix = prefixMatch ? prefixMatch[1] : '_PF'

  const item = {
    id: variant.id,
    quantity: totalQty,
    properties: {
      'For Product': productName,
      [prefix]: prefix,
      [`_TLK Option Cost - Amount`]: additionalCost.toFixed(2),
      [`${prefix}_ref_id`]: refId,
      [`${prefix}_hidden`]: 'true',
    },
  }

  // Fire with keepalive — survives page navigation
  try {
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TailorKit-Internal': '1' },
      body: JSON.stringify({ items: [item] }),
      keepalive: true,
    })
    console.log(`[TailorKit] Fired pricing product (keepalive) — $${additionalCost} qty:${totalQty}`)
  } catch (err) {
    console.error('[TailorKit] Failed to fire pricing product:', err)
  }
}
