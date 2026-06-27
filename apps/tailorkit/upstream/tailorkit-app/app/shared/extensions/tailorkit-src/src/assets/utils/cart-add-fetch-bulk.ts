import type { BulkCartPayload } from './build-bulk-cart-payload'

/**
 * POST a bulk add-to-cart payload to Shopify's `/cart/add.js` endpoint.
 *
 * Sets `X-Tailorkit-Bulk: 1` so the existing fetch interceptor short-circuits
 * (otherwise it would re-inject DOM-read properties into items[0] only and
 * corrupt items[1..N]; see handlerATCInterceptor.ts).
 *
 * Atomicity: Shopify processes `items[]` atomically. Either all N items are
 * added or none. We surface the error to the caller for UI handling.
 */
export async function postBulkCartAdd(payload: BulkCartPayload): Promise<Response> {
  const response = await fetch('/cart/add.js', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Tailorkit-Bulk': '1',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Bulk cart add failed (${response.status}): ${text || response.statusText}`)
  }

  return response
}

/**
 * Pre-validate cart capacity before attempting bulk add. Shopify caps cart at
 * ~500 line items; adding N to a cart with too many existing items fails atomically.
 *
 * Returns { ok: true } when the cart can absorb N more items, or { ok: false, ... }
 * with a user-friendly reason. Reads cart via `GET /cart.js`.
 */
export async function canFitBulkInCart(
  addCount: number,
  hardCap = 500
): Promise<{ ok: true } | { ok: false; reason: string; currentCount: number }> {
  try {
    const res = await fetch('/cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) {
      // Fail open: if cart fetch fails, let the bulk add try anyway.
      return { ok: true }
    }
    const cart = (await res.json()) as { item_count?: number }
    const current = typeof cart.item_count === 'number' ? cart.item_count : 0
    if (current + addCount > hardCap) {
      return {
        ok: false,
        reason: `Cart already has ${current} items. Adding ${addCount} would exceed Shopify's ${hardCap}-item cap.`,
        currentCount: current,
      }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

/**
 * After a successful bulk add, themes vary in how their cart drawer/mini-cart
 * picks up the change. Dispatch a small set of well-known events so popular
 * themes refresh without a full page reload.
 *
 * Theme matrix (best-effort; falls back gracefully if a theme listens for none):
 * - Dawn / Refresh / Studio: `cart:refresh`
 * - Sense / Origin / Crave: `cart:build`
 * - Many premium themes: `cart:updated` or generic `cart` document event
 */
export function dispatchCartRefreshEvents(): void {
  const eventNames = ['cart:refresh', 'cart:build', 'cart:updated', 'cart-update']
  for (const name of eventNames) {
    document.dispatchEvent(new CustomEvent(name, { bubbles: true }))
  }
}
