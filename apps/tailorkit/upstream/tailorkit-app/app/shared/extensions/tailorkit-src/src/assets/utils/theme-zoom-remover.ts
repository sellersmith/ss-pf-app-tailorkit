/**
 * Theme Zoom Remover
 *
 * Removes native theme zoom elements to prevent conflicts with TailorKit's pinch-zoom.
 * Each Shopify theme has different zoom implementations, so we handle them individually.
 *
 * Pattern follows update-cart.ts for theme-specific handling.
 */

// ============================================
// Theme-specific handlers
// ============================================

function handleDawnTheme(): void {
  // Dawn uses modal-opener for product image zoom
  // Only remove the first matching element to avoid removing multiple instances
  removeElements(
    [
      'modal-opener.product__modal-opener button.product__media-toggle',
      'modal-opener.product__modal-opener .product__media-icon.quick-add-hidden',
    ],
    { firstOnly: true }
  )
}

function handleCraftTheme(): void {
  // Craft uses product-gallery custom element
  const selector = 'modal-opener > button'
  removeElements([selector], { firstOnly: true })
}

function handleHorizonTheme(): void {
  // Horizon uses zoom-dialog custom element

  // Slideshow
  const mediaSelector = 'div.product-information__media > media-gallery'
  const slideShowSelector = 'slideshow-component > slideshow-container > slideshow-slides'
  const slideShowItemSelector = `${mediaSelector} ${slideShowSelector} > slideshow-slide:nth-child(1)`
  const slideShowItemElement = document.querySelector(slideShowItemSelector)
  if (slideShowItemElement) {
    // Remove onClick attribute from the element
    slideShowItemElement.removeAttribute('on:click')
  }

  // Grid
  const gridItemSelector = 'div.product-information__media > media-gallery > ul > li:nth-child(1) > button'
  const gridItemElement = document.querySelector(gridItemSelector)
  if (gridItemElement) {
    // Remove onClick attribute from the element
    gridItemElement.removeAttribute('on:click')
  }

  // Default media zoom button
  const defaultMediaZoomButtonSelector = 'div.product-information__media .product-media-container__zoom-button'
  removeElements([defaultMediaZoomButtonSelector], { firstOnly: true })
}

function handlePrestigeTheme(): void {
  // Prestige uses scroll-carousel custom element
  const selector = 'product-gallery scroll-carousel > div > div > div > div > button'
  const element = document.querySelector(selector)
  if (element) {
    // Remove class 'product-gallery__media'
    element.classList.remove('product-gallery__media')
  }
}

function handleSpotlightTheme(): void {
  // Spotlight uses product-gallery custom element
  const selector = 'slider-component .product__media-list li:nth-child(1) button.product__media-zoom-lightbox'
  removeElements([selector], { firstOnly: true })
}

function handleGenericTheme(): void {
  // Generic fallback: remove common modal/lightbox triggers used across many themes.
  // Covers Dawn-like patterns (modal-opener + media-toggle) which are shared by
  // Refresh, Studio, and other themes based on Dawn's product media structure.
  removeElements(
    [
      'modal-opener.product__modal-opener button.product__media-toggle',
      'modal-opener.product__modal-opener button.product__media-zoom-lightbox',
      'modal-opener.product__modal-opener .product__media-icon.quick-add-hidden',
    ],
    { firstOnly: true }
  )
}

// ============================================
// Core utility
// ============================================

function removeElements(selectors: string[], options?: { firstOnly?: boolean }): void {
  const firstOnly = options?.firstOnly ?? false

  for (const selector of selectors) {
    if (firstOnly) {
      const element = document.querySelector(selector)
      if (element) {
        element.remove()
      }
    } else {
      document.querySelectorAll(selector).forEach(el => el.remove())
    }
  }
}

// ============================================
// Main entry point
// ============================================

/**
 * Remove theme-specific zoom elements based on detected theme.
 * Uses window.Shopify.theme.schema_name for accurate theme detection.
 */
export function removeThemeZoom(): void {
  const schemaName = window.Shopify?.theme?.schema_name

  if (!schemaName) {
    return
  }

  switch (true) {
    case /^Dawn$/i.test(schemaName):
      handleDawnTheme()
      break
    case /^Craft$/i.test(schemaName):
      handleCraftTheme()
      break
    case /^Horizon$/i.test(schemaName):
      handleHorizonTheme()
      break
    case /^Prestige$/i.test(schemaName):
      handlePrestigeTheme()
      break
    case /^Spotlight$/i.test(schemaName):
      handleSpotlightTheme()
      break
    default:
      handleGenericTheme()
      break
  }
}
