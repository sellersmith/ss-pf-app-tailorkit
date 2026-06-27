export const TAILORKIT_CART_SYNC_REFRESH_EVENT = 'tailorkit:cart-sync-refresh'
export const PAGEFLY_CART_UPDATE_EVENT = 'cart-update'
export const SHOPIFY_CART_REFRESH_EVENT = 'cart:refresh'
export const SHOPIFY_CART_BUILD_EVENT = 'cart:build'
export const AJAX_PRODUCT_ADDED_EVENT = 'ajaxProduct:added'

declare global {
  interface Window {
    publish?: (eventName: string, payload: unknown) => void
  }
}

export function getTailorKitCartRefreshEventNames() {
  return [
    TAILORKIT_CART_SYNC_REFRESH_EVENT,
    PAGEFLY_CART_UPDATE_EVENT,
    SHOPIFY_CART_REFRESH_EVENT,
    SHOPIFY_CART_BUILD_EVENT,
    AJAX_PRODUCT_ADDED_EVENT,
  ]
}

function createCartEvent(eventName: string, cart: unknown) {
  return new CustomEvent(eventName, {
    bubbles: true,
    detail: { cart },
  })
}

/** Dispatches the common cart refresh events TailorKit/PageFly storefront themes already listen to. */
export function refreshTailorKitCartUI(cart: unknown) {
  window.dispatchEvent(createCartEvent(TAILORKIT_CART_SYNC_REFRESH_EVENT, cart))

  if (typeof window.publish === 'function') {
    window.publish(PAGEFLY_CART_UPDATE_EVENT, { cartData: cart })
  }

  document.documentElement.dispatchEvent(createCartEvent(SHOPIFY_CART_REFRESH_EVENT, cart))
  document.dispatchEvent(createCartEvent(SHOPIFY_CART_BUILD_EVENT, cart))
  document.dispatchEvent(
    new CustomEvent(AJAX_PRODUCT_ADDED_EVENT, {
      bubbles: true,
      detail: { product: cart },
    })
  )
}
