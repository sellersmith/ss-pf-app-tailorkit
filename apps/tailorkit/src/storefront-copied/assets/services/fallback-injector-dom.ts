/**
 * DOM detection and manipulation helpers for the fallback panel injector.
 *
 * Detects whether the TailorKit app block is present, identifies the product page context,
 * locates the Add-to-Cart button as an injection anchor, and creates DOM elements
 * for the fallback CTA button.
 */

import { ProductPersonalizerWebComponentTag } from '../constants'

// ── Shopify globals access (uses type assertions to avoid Window interface conflicts) ──

/** Access ShopifyAnalytics.meta safely via the window's string index. */
function getShopifyAnalyticsMeta(): Record<string, any> | undefined {
  return (window as any).ShopifyAnalytics?.meta
}

/** Access the window.Shopify object safely via the window's string index. */
function getShopifyGlobal(): Record<string, any> | undefined {
  return (window as any).Shopify
}

// ── Detection helpers ──

/** True when Shopify Theme Editor is open — merchants should place the block manually. */
export function isDesignMode(): boolean {
  return !!getShopifyGlobal()?.designMode
}

/** True when the current page is a Shopify product page. */
export function isProductPage(): boolean {
  // Primary: Shopify analytics meta (most reliable)
  if (getShopifyAnalyticsMeta()?.page?.pageType === 'product') return true

  // Fallback: URL pattern
  return /\/products\/[^/]+/.test(window.location.pathname)
}

/**
 * True when a **functional** app block is already rendering on the page.
 *
 * Checks for the inner `<tailorkit-product-personalizer>` tag (emitted by
 * `print-areas.liquid` only when the variant has integration data) rather than
 * the outer `<tailorkit-product-personalizer-customizer>` tag (emitted by
 * `customizer.liquid` unconditionally when the block is placed).
 *
 * Without this distinction, the fallback wrongly exits on product pages where
 * the block is placed but the current variant has no data — leaving merchants
 * with no way to personalize.
 */
export function isBlockPresent(): boolean {
  return !!document.querySelector(ProductPersonalizerWebComponentTag)
}

// ── Product context extraction ──

/** Extract the numeric product ID from Shopify analytics globals. */
export function getCurrentProductId(): string | null {
  const id = getShopifyAnalyticsMeta()?.product?.id
  return id ? String(id) : null
}

/**
 * Extract the currently selected variant ID.
 * Priority: URL param > Shopify analytics meta > first variant from product JSON.
 */
export function getCurrentVariantId(): string | null {
  // 1. URL param (most reliable when present)
  const urlParams = new URLSearchParams(window.location.search)
  const fromUrl = urlParams.get('variant')
  if (fromUrl) return fromUrl

  // 2. Shopify analytics meta
  const fromMeta = getShopifyAnalyticsMeta()?.selectedVariantId
  if (fromMeta) return String(fromMeta)

  // 3. First variant from product JSON embedded in the page
  //    Shopify themes embed product data as <script type="application/json"> or window.product
  try {
    // Try window.ShopifyAnalytics.meta.product.variants (some themes)
    const variants = getShopifyAnalyticsMeta()?.product?.variants
    if (Array.isArray(variants) && variants.length > 0) {
      return String(variants[0].id)
    }

    // Try product JSON script tag (Dawn and most OS 2.0 themes)
    const productJsonScript = document.querySelector<HTMLScriptElement>(
      'script[type="application/json"][data-product-json], '
        + 'script[type="application/json"][id*="product"][id*="json"], '
        + 'script[type="application/json"][data-section-type="product"]'
    )
    if (productJsonScript?.textContent) {
      const productData = JSON.parse(productJsonScript.textContent)
      const v = productData?.variants || productData?.product?.variants
      if (Array.isArray(v) && v.length > 0) {
        return String(v[0].id)
      }
    }

    // Try the hidden variant input in the product form
    const variantInput = document.querySelector<HTMLInputElement>(
      'form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"]'
    )
    if (variantInput?.value) return variantInput.value
  } catch {
    // JSON parse or DOM query failed — ignore
  }

  return null
}

/** Get the current storefront locale. */
export function getLocale(): string {
  return getShopifyGlobal()?.locale || 'en'
}

// ── DOM anchor + element creation ──

/**
 * Find the Add-to-Cart button on the product page.
 * Uses a priority-ordered selector list covering major theme patterns.
 */
export function findAddToCartButton(): HTMLElement | null {
  const selectors = [
    // Standard ATC form submit buttons
    'form[action*="/cart/add"] [type="submit"]',
    'form[action*="/cart/add"] button[name="add"]',
    // Dawn / OS 2.0 themes
    '.product-form__submit',
    'button[data-add-to-cart]',
    // Debut / classic themes
    '.btn--add-to-cart',
    '.product-form__cart-submit',
    // Generic fallbacks
    '#AddToCart',
    '#addToCartButton',
  ]

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) return el
  }

  return null
}

/**
 * Create the "Personalize" CTA button that will be injected above the ATC button.
 * Styled to match the theme's button patterns as closely as possible.
 */
export function createPersonalizeButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = 'tailorkit-fallback-cta'
  button.setAttribute('data-tailorkit-fallback', 'true')
  button.setAttribute('aria-label', 'Personalize this product')
  button.className = 'tailorkit-fallback-cta-button'

  // Icon (paintbrush) + label
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('width', '20')
  icon.setAttribute('height', '20')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('stroke-width', '2')
  icon.setAttribute('aria-hidden', 'true')
  icon.innerHTML = [
    '<path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9',
    '1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/>',
    '<path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>',
    '<path d="M14.5 17.5 4.5 15"/>',
  ].join(' ')

  const label = document.createElement('span')
  label.textContent = 'Personalize this product'

  button.appendChild(icon)
  button.appendChild(label)

  return button
}

/** Inject the button above the ATC button's parent container. */
export function injectButtonAboveATC(atcButton: HTMLElement, ctaButton: HTMLButtonElement): void {
  // Walk up to find the form or immediate wrapper to place button before it
  const form = atcButton.closest('form[action*="/cart/add"]')
  const anchor = form || atcButton.parentElement

  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(ctaButton, anchor)
  } else {
    // Last resort: insert before the button itself
    atcButton.parentElement?.insertBefore(ctaButton, atcButton)
  }
}

/** Inject minimal inline styles for the CTA button (theme-neutral). */
export function injectFallbackStyles(): void {
  if (document.querySelector('#tailorkit-fallback-styles')) return

  const style = document.createElement('style')
  style.id = 'tailorkit-fallback-styles'
  style.textContent = `
    .tailorkit-fallback-cta-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 12px 24px;
      margin-bottom: 10px;
      border: 2px solid currentColor;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }
    .tailorkit-fallback-cta-button:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    .tailorkit-fallback-cta-button svg {
      flex-shrink: 0;
    }
  `
  document.head.appendChild(style)
}
