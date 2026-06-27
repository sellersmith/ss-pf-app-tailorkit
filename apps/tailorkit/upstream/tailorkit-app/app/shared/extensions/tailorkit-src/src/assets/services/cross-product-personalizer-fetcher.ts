/**
 * Fetches the upsell product's TailorKit WC element via full product page fetch + DOMParser.
 * Caches elements in-memory; returns clones so each modal gets its own DOM node.
 */

const _fetchCache = new Map<string, HTMLElement>()

/**
 * Fetch and extract the TailorKit WC element for the given product.
 * Returns null on 404, network failure, or if the product has no TailorKit block.
 */
export async function fetchPersonalizerElement(
  handle: string,
  variantId: string,
  productId: string
): Promise<HTMLElement | null> {
  const cacheKey = `${handle}::${variantId}`

  if (_fetchCache.has(cacheKey)) {
    const clone = _fetchCache.get(cacheKey)!.cloneNode(true) as HTMLElement
    applyModalAttributes(clone, productId, variantId)
    return clone
  }

  // Full page fetch instead of Section Rendering API because section IDs vary per product template.
  const url = `/products/${encodeURIComponent(handle)}?variant=${encodeURIComponent(variantId)}`

  let html: string
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'text/html' },
    })

    if (resp.status === 404) {
      console.warn(`[TailorKit] Product "${handle}" not found (404) — skipping modal`)
      return null
    }

    if (!resp.ok) {
      console.error(`[TailorKit] Fetch error ${resp.status} for product "${handle}"`)
      return null
    }

    html = await resp.text()
  } catch (err) {
    console.error('[TailorKit] Network failure fetching cross-product page:', err)
    return null
  }

  // DOMParser creates an inert document — custom elements are NOT upgraded
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const customizer = doc.querySelector('tailorkit-product-personalizer-customizer') as HTMLElement | null

  if (!customizer) {
    console.warn(
      `[TailorKit] No tailorkit-product-personalizer-customizer found for product "${handle}".`,
      'Ensure the TailorKit app block is enabled for this product.'
    )
    return null
  }

  _fetchCache.set(cacheKey, customizer.cloneNode(true) as HTMLElement)
  applyModalAttributes(customizer, productId, variantId)

  return customizer
}

/**
 * - `data-cross-product="true"` → WC creates its own internal ATC form
 * - `data-tlk-instance-id` → prevents registry collision with main page instance
 */
function applyModalAttributes(element: HTMLElement, productId: string, variantId: string): void {
  element.setAttribute('data-cross-product', 'true')
  element.setAttribute('data-tlk-instance-id', `${productId}::modal`)
  if (variantId) {
    element.setAttribute('data-variant-id', variantId)
  }
}

/** Clear cache when buyer navigates away or product list changes. */
export function clearPersonalizerFetchCache(): void {
  _fetchCache.clear()
}
