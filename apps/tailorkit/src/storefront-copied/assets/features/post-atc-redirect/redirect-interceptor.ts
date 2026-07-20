/**
 * One-shot fetch + form-submit interceptor that redirects the buyer to
 * Shopify's checkout after the next add-to-cart triggered by the
 * personalization modal. Bypasses the theme's cart-page redirect when
 * the merchant opts in to "Direct to checkout after personalization".
 *
 * Ownership check: redirects ONLY when the cart-add request body carries
 * the `properties[_tlkPostAtcRedirect]` line-item marker that we inject
 * into the theme's ATC form just before clicking. This prevents
 * third-party widgets (cart-drawer upsells, sticky cart recommendations,
 * subscription apps) from accidentally tripping the redirect during the
 * armed window.
 *
 * Self-disarms after firing once, on any non-ok response, on error, or
 * after a short safety timeout. URL match restricted to canonical
 * Shopify cart-add pathnames.
 */

const CART_ADD_PATHNAMES = new Set(['/cart/add', '/cart/add.js', '/cart/add.json'])

// 4 s is enough for the cart-add round trip on slow mobile after the modal
// close animation (~850 ms in customizer-modal.tsx) but tight enough that a
// stale arm cannot linger across unrelated user interactions.
const SAFETY_TIMEOUT_MS = 4000

// Short delay so the host theme's own cart-state plumbing (cart drawer
// counter, server session) settles before we navigate. Empirically 100 ms is
// enough on fast networks; 150 ms gives slow mobile a bit of headroom while
// staying below the threshold a buyer would notice as a pause.
const REDIRECT_DELAY_MS = 150

// The personalization add is multi-step (main line + hidden pricing line, via
// separate /cart/add requests). Navigating to /checkout before those persist
// aborts the in-flight adds, so checkout loads an EMPTY cart and Shopify bounces
// the buyer to the homepage. Before navigating, poll the cart and only leave
// once it is non-empty (or the deadline passes as a safety valve).
const CART_READY_POLL_INTERVAL_MS = 150
const CART_READY_MAX_WAIT_MS = 4000

export const TLK_REDIRECT_MARKER = '_tlkPostAtcRedirect'
const MARKER_FIELD = `properties[${TLK_REDIRECT_MARKER}]`

let armed = false

// Tracks marker inputs injected during the current armed window so disarm can
// remove orphans (e.g., theme rejected the submission and the cart-add fetch
// never fired). Cleared on every disarm.
let trackedMarkers: HTMLInputElement[] = []

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isCartAddUrl(url: string): boolean {
  try {
    const pathname = new URL(url, window.location.origin).pathname
    return CART_ADD_PATHNAMES.has(pathname)
  } catch {
    return false
  }
}

function bodyHasMarker(body: BodyInit | null | undefined): boolean {
  if (!body) return false
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return body.has(MARKER_FIELD)
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body.has(MARKER_FIELD)
  }
  if (typeof body === 'string') {
    return body.includes(MARKER_FIELD) || body.includes(`"${TLK_REDIRECT_MARKER}"`)
  }
  return false
}

function formHasMarker(form: HTMLFormElement): boolean {
  const input = form.querySelector(`input[name="${MARKER_FIELD}"]`) as HTMLInputElement | null
  return !!input && input.value !== ''
}

function resolveCheckoutUrl(): string {
  const shopifyRoot = (window as unknown as { Shopify?: { routes?: { root?: string } } }).Shopify?.routes?.root
  if (typeof shopifyRoot === 'string' && shopifyRoot.length > 0) {
    const trimmed = shopifyRoot.endsWith('/') ? shopifyRoot : `${shopifyRoot}/`
    return `${trimmed}checkout`
  }
  return '/checkout'
}

/**
 * Tag the theme's add-to-cart form with a hidden line-item property so the
 * interceptor can distinguish our submission from unrelated cart adds.
 * Returns the input element so it can be removed if the click is aborted.
 */
export function tagAddToCartForm(form: HTMLFormElement): HTMLInputElement {
  const existing = form.querySelector(`input[name="${MARKER_FIELD}"]`) as HTMLInputElement | null
  if (existing) {
    if (!trackedMarkers.includes(existing)) trackedMarkers.push(existing)
    return existing
  }
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = MARKER_FIELD
  input.value = '1'
  form.appendChild(input)
  trackedMarkers.push(input)
  return input
}

/**
 * Arm a single redirect-to-checkout intercept. Must be called immediately
 * before triggering the theme's add-to-cart so the next matching cart-add
 * is the one captured.
 */
export function armCheckoutRedirectOnce(): void {
  if (armed) return
  armed = true

  const originalFetch = window.fetch.bind(window)
  let disarmed = false
  let redirectScheduled = false
  let redirectHandle: ReturnType<typeof setTimeout> | null = null
  let safetyHandle: ReturnType<typeof setTimeout> | null = null

  const scheduleRedirect = () => {
    if (redirectScheduled) return
    redirectScheduled = true
    const target = resolveCheckoutUrl()
    const deadline = Date.now() + CART_READY_MAX_WAIT_MS

    // Navigate only once the cart actually holds items. Use the unpatched
    // fetch with credentials so we read the buyer's real cart session. Waiting
    // instead of navigating early is what lets the in-flight personalization
    // adds finish (navigation would otherwise cancel them → empty checkout →
    // homepage bounce).
    const navigateWhenCartReady = async () => {
      let hasItems = false
      try {
        const cart = await originalFetch('/cart.js', { credentials: 'same-origin' }).then(response => response.json())
        hasItems = typeof cart?.item_count === 'number' && cart.item_count > 0
      } catch {
        // Ignore transient cart.js errors; the deadline check still applies.
      }
      if (hasItems || Date.now() >= deadline) {
        window.location.href = target
        return
      }
      redirectHandle = setTimeout(navigateWhenCartReady, CART_READY_POLL_INTERVAL_MS)
    }

    redirectHandle = setTimeout(navigateWhenCartReady, REDIRECT_DELAY_MS)
  }

  const disarm = () => {
    if (disarmed) return
    disarmed = true
    try {
      window.fetch = originalFetch
      document.removeEventListener('submit', onSubmit, true)
      if (safetyHandle !== null) {
        clearTimeout(safetyHandle)
        safetyHandle = null
      }
      if (!redirectScheduled && redirectHandle !== null) {
        clearTimeout(redirectHandle)
        redirectHandle = null
      }
      // Cleanup markers asynchronously so we never strip a form mid-submit.
      // When a redirect is queued the page is about to navigate anyway; the
      // cleanup is mainly for the safety-timeout / non-ok response paths.
      const pending = trackedMarkers
      trackedMarkers = []
      setTimeout(() => {
        pending.forEach(input => input.remove())
      }, 0)
    } finally {
      armed = false
    }
  }

  function onSubmit(event: Event) {
    const form = event.target as HTMLFormElement | null
    if (!form || form.tagName !== 'FORM') return
    const action = form.getAttribute('action') || ''
    if (!isCartAddUrl(action)) return
    if (!formHasMarker(form)) return
    scheduleRedirect()
    disarm()
  }

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = getUrl(input)
    if (!isCartAddUrl(url)) {
      return originalFetch(input, init)
    }
    const ours = bodyHasMarker(init?.body)
    try {
      const response = await originalFetch(input, init)
      if (ours && response.ok) {
        scheduleRedirect()
      }
      if (ours) {
        disarm()
      }
      return response
    } catch (error) {
      if (ours) disarm()
      throw error
    }
  }

  document.addEventListener('submit', onSubmit, true)

  // Safety net: if the theme never adds to cart (validation error, etc.),
  // restore the original fetch so the page stays usable.
  safetyHandle = setTimeout(disarm, SAFETY_TIMEOUT_MS)
}
