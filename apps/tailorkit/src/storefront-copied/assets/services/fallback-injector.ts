/**
 * Fallback Panel Injector — Main Orchestrator
 *
 * Auto-detects when the TailorKit app block (`customizer.liquid`) is missing
 * from a product page and injects a "Personalize" CTA button above the Add-to-Cart
 * button. Clicking the CTA opens a modal with the personalization panel fetched
 * from the App Proxy endpoint.
 *
 * Entry: `initFallbackInjector()` — called from `tailorkit-helper/src/index.ts`.
 */

import { APP_PROXY_PATH } from '../constants'
import {
  isDesignMode,
  isProductPage,
  isBlockPresent,
  getCurrentProductId,
  getCurrentVariantId,
  getLocale,
  findAddToCartButton,
  createPersonalizeButton,
  injectButtonAboveATC,
  injectFallbackStyles,
} from './fallback-injector-dom'
import { getAssetBaseUrl, loadFallbackCSS, loadFallbackMainJS, loadKonvaJS } from './fallback-injector-assets'
import EmtlkitModal from '../components/commons/modal/index'
import { MODAL_SIZES } from '../components/commons/modal/constants'

const DEBUG = false
function dbg(...args: any[]) {
  if (DEBUG) console.log('[TailorKit Fallback]', ...args)
}

// ── Session cache keys ──

const CACHE_PREFIX = 'tlk-fb'

function cacheKey(productId: string, variantId: string): string {
  return `${CACHE_PREFIX}-${productId}-${variantId}`
}

function getCached(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function setCache(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// ── API fetching ──

interface FallbackPanelResponse {
  status: string
  html: string
}

/**
 * Fetch panel HTML from App Proxy.
 * Returns: html string on success, empty string '' for "no integration", null for errors.
 * Only '' (no integration) should be cached — null (error) should NOT be cached.
 */
async function fetchPanelHTML(productId: string, variantId: string, locale: string): Promise<string | null> {
  const params = new URLSearchParams({ productId, variantId, locale })
  const url = `${APP_PROXY_PATH}/app_proxy/product-variant-integration?${params}`

  dbg('Fetching panel:', url)
  dbg('APP_PROXY_PATH:', APP_PROXY_PATH)

  try {
    const resp = await fetch(url)
    dbg('Fetch response:', resp.status, resp.statusText)

    if (!resp.ok) {
      const body = await resp.text()
      console.error(`[TailorKit] Fallback fetch error: ${resp.status}`, body)
      return null // Error — do not cache
    }

    const data: FallbackPanelResponse = await resp.json()
    dbg('Response data:', { status: data.status, htmlLength: data.html?.length || 0 })
    // Only treat as valid if server reports success — transient errors must not be cached
    if (data.status !== 'success') {
      console.error('[TailorKit] Fallback: server error', data)
      return null
    }
    return data.html || '' // '' means "no integration" (cacheable)
  } catch (err) {
    console.error('[TailorKit] Fallback fetch exception:', err)
    return null // Network error — do not cache
  }
}

// ── Modal logic ──

/**
 * Open the personalization modal with the pre-fetched panel HTML.
 * Loads assets (CSS, JS, Konva) lazily when modal opens.
 */
async function openPersonalizationModal(html: string, productId: string, variantId: string): Promise<void> {
  dbg('Opening modal for product', productId, 'variant', variantId)
  dbg('HTML length:', html.length)

  const assetBase = getAssetBaseUrl()
  dbg('Asset base URL:', assetBase)
  if (!assetBase) {
    console.warn('[TailorKit] Fallback: cannot determine asset base URL')
    return
  }

  // Load CSS immediately, JS + Konva in parallel
  loadFallbackCSS(assetBase)

  const loadingContent = buildLoadingContent()

  const modal = new EmtlkitModal({
    header: 'Personalize this product',
    content: loadingContent,
    size: MODAL_SIZES.LARGE,
    closeOnBackdropClick: true,
    closeOnEsc: true,
    zIndex: 10000,
  })

  modal.open()

  try {
    // Load main JS and Konva in parallel (lazy-load to prevent blocking page perf)
    await Promise.all([loadFallbackMainJS(assetBase), loadKonvaJS(assetBase)])

    // Build the content wrapper with the panel HTML
    const wrapper = buildModalWrapper(html, productId, variantId)
    modal.update({ content: wrapper })
  } catch (err) {
    console.error('[TailorKit] Fallback: asset loading failed', err)
    modal.update({ content: buildErrorContent() })
  }
}

function buildLoadingContent(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('aria-live', 'polite')
  wrapper.setAttribute('aria-label', 'Loading personalizer')
  wrapper.style.cssText
    = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:12px;'

  const spinner = document.createElement('div')
  spinner.className = 'tlk-cross-product-modal__spinner'
  spinner.setAttribute('aria-hidden', 'true')

  const label = document.createElement('p')
  label.textContent = 'Loading personalizer...'
  label.style.cssText = 'margin:0;color:#666;'

  wrapper.appendChild(spinner)
  wrapper.appendChild(label)
  return wrapper
}

function buildErrorContent(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'padding:40px;text-align:center;color:#666;'
  wrapper.textContent = 'Unable to load the personalizer. Please try again later.'
  return wrapper
}

/**
 * Build the modal content wrapper.
 * The raw HTML from the server contains the `<tailorkit-product-personalizer-customizer>` WC.
 * When inserted into the live DOM, the custom element auto-upgrades (connectedCallback).
 */
function buildModalWrapper(html: string, productId: string, variantId: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'emtlkit-modal__customizer-content'

  // Parse the server-rendered HTML and extract the customizer element
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  const customizerEl = tempDiv.querySelector('tailorkit-product-personalizer-customizer')
  if (customizerEl) {
    // Mark as fallback instance to prevent collision with a real block
    customizerEl.setAttribute('data-tailorkit-fallback', 'true')
    customizerEl.setAttribute('data-tlk-instance-id', `${productId}::fallback`)
    if (variantId) {
      customizerEl.setAttribute('data-variant-id', variantId)
    }
  }

  // Left column: product image / canvas
  const imageContainer = document.createElement('div')
  imageContainer.className = 'emtlkit-modal__product-image-container'

  const ppEl = tempDiv.querySelector('tailorkit-product-personalizer')
  const piAttr = ppEl?.getAttribute('data-product-image')
  if (piAttr) {
    try {
      const pi = JSON.parse(piAttr.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      if (pi?.u) {
        const img = document.createElement('img')
        img.src = pi.u
        img.className = 'emtlkit-modal__product-image'
        img.alt = 'Product preview'
        imageContainer.appendChild(img)
      }
    } catch {
      // Invalid JSON — skip image
    }
  }

  wrapper.appendChild(imageContainer)

  // Right column: scrollable personalizer content
  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emtlkit-modal__scrollable-content'

  if (ppEl) {
    ppEl.setAttribute('data-modal-instance', 'true')
  }

  // Move all parsed content into the scrollable area
  while (tempDiv.firstChild) {
    scrollableContent.appendChild(tempDiv.firstChild)
  }

  wrapper.appendChild(scrollableContent)
  return wrapper
}

// ── Variant change watching ──

function watchVariantChanges(productId: string, ctaButton: HTMLButtonElement): void {
  let lastVariantId = getCurrentVariantId()

  const handler = () => {
    const newVariantId = getCurrentVariantId()
    if (newVariantId && newVariantId !== lastVariantId) {
      lastVariantId = newVariantId
      // Pre-fetch the new variant panel in the background
      prefetchVariant(productId, newVariantId)
    }
  }

  // Shopify themes trigger these on variant change
  window.addEventListener('popstate', handler)

  // Also observe URL changes for SPA-like themes (debounced)
  let lastUrl = window.location.href
  const observer = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      handler()
    }
  }, 300)

  // Cleanup when the button is removed (page navigation)
  const disconnectObserver = new MutationObserver(() => {
    if (!document.contains(ctaButton)) {
      clearInterval(observer)
      window.removeEventListener('popstate', handler)
      disconnectObserver.disconnect()
    }
  })
  disconnectObserver.observe(document.body, { childList: true, subtree: true })
}

/** Pre-fetch a variant's panel HTML and cache it for instant modal open. */
async function prefetchVariant(productId: string, variantId: string): Promise<void> {
  const key = cacheKey(productId, variantId)
  if (getCached(key) !== null) return // Already cached (including empty)

  const html = await fetchPanelHTML(productId, variantId, getLocale())
  if (html !== null) setCache(key, html) // Only cache successful responses
}

// ── Main entry ──

/**
 * Initialize the fallback injector.
 * Called once on DOMContentLoaded from tailorkit-helper.
 */
export function initFallbackInjector(): void {
  dbg('=== initFallbackInjector START ===')
  dbg('URL:', window.location.href)
  dbg('APP_PROXY_PATH:', APP_PROXY_PATH)

  // Guard: design mode, non-product page, block already present
  if (isDesignMode()) {
    dbg('EXIT: design mode')
    return
  }
  if (!isProductPage()) {
    dbg('EXIT: not a product page')
    return
  }
  if (isBlockPresent()) {
    dbg('EXIT: app block already present in DOM')
    return
  }

  dbg('Product page detected, no app block found')

  const productId = getCurrentProductId()
  dbg('productId:', productId)
  if (!productId) {
    dbg('EXIT: no productId found')
    return
  }

  const variantId = getCurrentVariantId()
  dbg('variantId:', variantId)
  if (!variantId) {
    dbg('EXIT: no variantId found')
    return
  }

  const locale = getLocale()
  dbg('locale:', locale)

  // Check sessionStorage for cached empty response (product has no integration)
  const key = cacheKey(productId, variantId)
  const cached = getCached(key)
  dbg(
    'sessionStorage cache:',
    key,
    '→',
    cached === null ? '<null>' : cached === '' ? '<empty string>' : `${cached.length} chars`
  )
  if (cached === '') {
    dbg('EXIT: cached empty response (no integration)')
    return
  }

  // Find ATC button as injection anchor
  const atcButton = findAddToCartButton()
  dbg('ATC button found:', atcButton ? `${atcButton.tagName}.${atcButton.className}` : 'null')
  if (!atcButton) {
    console.warn('[TailorKit] Fallback: Add-to-Cart button not found — cannot inject CTA')
    dbg('EXIT: no ATC button')
    return
  }

  // Prevent double injection
  if (document.querySelector('#tailorkit-fallback-cta')) {
    dbg('EXIT: CTA already injected')
    return
  }

  // Inject styles and CTA button
  injectFallbackStyles()
  const ctaButton = createPersonalizeButton()

  // Pre-fetch panel HTML (use cache if available, otherwise fetch in background)
  const fetchPromise = cached
    ? Promise.resolve(cached)
    : fetchPanelHTML(productId, variantId, locale).then(html => {
        // Only cache successful responses — null means error (don't cache, retry next time)
        if (html !== null) setCache(key, html)
        return html
      })

  // Handle click — open modal with the panel
  ctaButton.addEventListener('click', async () => {
    ctaButton.setAttribute('disabled', 'true')
    ctaButton.style.opacity = '0.6'

    try {
      const html = await fetchPromise
      if (!html) {
        // No integration — remove button silently
        ctaButton.remove()
        return
      }

      // Use the current variant (may have changed since page load)
      const currentVariantId = getCurrentVariantId() || variantId
      let currentHtml = html

      // If variant changed, fetch the new one
      if (currentVariantId !== variantId) {
        const currentKey = cacheKey(productId, currentVariantId)
        const currentCached = getCached(currentKey)
        if (currentCached) {
          currentHtml = currentCached
        } else {
          currentHtml = await fetchPanelHTML(productId, currentVariantId, locale)
          if (currentHtml !== null) setCache(currentKey, currentHtml)
        }
      }

      if (!currentHtml) {
        ctaButton.remove()
        return
      }

      await openPersonalizationModal(currentHtml, productId, currentVariantId)
    } catch (err) {
      console.error('[TailorKit] Fallback: error opening modal', err)
    } finally {
      ctaButton.removeAttribute('disabled')
      ctaButton.style.opacity = ''
    }
  })

  // Start the background fetch, then decide whether to show the button
  dbg('Starting background fetch...')
  fetchPromise
    .then(html => {
      dbg('Fetch resolved. HTML length:', html?.length || 0, html ? 'HAS CONTENT' : 'EMPTY')
      if (!html) {
        dbg('No integration for this product — CTA button will NOT be shown')
        return
      }
      // Panel exists — inject the CTA button
      injectButtonAboveATC(atcButton, ctaButton)
      dbg('CTA button injected above ATC for product', productId)
    })
    .catch(err => {
      console.error('[TailorKit] Fallback: prefetch error', err)
    })

  // Watch for variant changes to pre-fetch
  watchVariantChanges(productId, ctaButton)
}
