// Self-contained helper script for TailorKit theme extension
// This script observes cart changes and triggers callbacks

import { CartHiddenProductManager, initializeCartHiddenProductManager } from './handlers/cart-hidden-product-manager'
import { ensureCartImageControllerInitialized } from './handlers/cart-image-controller'
import handleOptionPricingChange, { forceCleanupOrphanedProducts } from './handlers/option-pricing-change'
import type { ShopifyCart } from './types/shopify-cart'
import { getCart } from './utils/cart'
import observeCartChanges, { lastFetchedCartProducts } from './utils/observe-cart-changes'

// Initialize fallback panel injector for product pages without the app block
import { initFallbackInjector } from '../../tailorkit-src/src/assets/services/fallback-injector'

function handleCartChange(data: ShopifyCart) {
  // Update cart images using the same cart data (prevents duplicate API calls)
  const cartImageController = ensureCartImageControllerInitialized()
  if (cartImageController) {
    cartImageController.processCartImagesWithData(data)
  }

  // Update cart hidden products using the same cart data (prevents duplicate API calls)
  const cartHiddenProductManager = CartHiddenProductManager.getInstance()
  if (cartHiddenProductManager) {
    cartHiddenProductManager.processCartWithData(data)
  }
}

// Initialize the cart observer
observeCartChanges(async (data: ShopifyCart, operationType: string) => {
  // Handle option pricing changes
  await handleOptionPricingChange(data, operationType)

  handleCartChange(data)
})

// Export for potential external use
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).TailorkitHelper = {
    observeCartChanges,
    lastFetchedCartProducts,
  }
}

// Initialize Cart Hidden Product Manager
initializeCartHiddenProductManager({
  cartItemSelector: [
    '.cart-item',
    '.cart__item',
    '.line-item',
    '[data-cart-item]',
    '.cart__table-row[data-item]',
    '.cart-items__table-row[data-key]',
    '.hdt-main-cart-item',
    '.hdt-cart-item',
    // Shrine-style themes (e.g. uniqal.de) — both cart page + drawer
    '[data-product-cart-line]',
  ].join(', '),
  debugMode: false,
})
;(async () => {
  const cart = await getCart()
  handleCartChange(cart)

  // On cart page, run orphan cleanup on initial load.
  // Native-POST themes (Broadcast, etc.) reload the page when items are removed,
  // so the PerformanceObserver never fires — cleanup must run at page load.
  if (window.location.pathname.includes('/cart')) {
    await forceCleanupOrphanedProducts()
  }
})()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFallbackInjector)
} else {
  initFallbackInjector()
}

console.log('[TailorKit] All systems initialized successfully')
