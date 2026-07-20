import './components/ai-assistant'
import './components/customizer'
import './components/preact/views-bar'
import '../shared/components/registerOptionSetElements'
import './components/product-personalizer'
import { registerWizardComponents } from './components/wizard'

// import './components/shopify-cart/customizer-cart-page'
// import './components/floating-button' // enable this to use the Agentic AI Product Personalizer

// Import and initialize interceptor system
import { initializeHiddenPricingProductCache } from './utils/hidden-pricing-cache'
import { applyProxyForFetchApi } from './utils/interceptorFetchApi'
import { startRadioInputMonitor } from './utils/radio-input-monitor'

// Sync TailorKit properties to sticky/secondary ATC forms at submit time
import { installCartFormSync } from './utils/cart-form-sync'

// Import Buy It Now handler
import { initializeBuyItNowHandler } from './handlers/buyItNowHandler'

// Import events API for developer discovery
import { logAvailableEvents } from './events'

// Import cross-product personalizer modal listener
import { registerCrossProductModalListener } from './components/cross-product-modal/cross-product-modal-listener'

// Import inline ATC checkout-redirect setup (covers the non-modal flow where
// the buyer customizes on-page and clicks the theme's native ATC button)
import { installInlineCheckoutRedirect } from './features/post-atc-redirect/inline-atc-setup'

// Import global styling utility
import { applyGlobalStylingVariables } from './utils/global-styling'

// PageFly hidden-pricing interceptor. The upstream customizer pricing path relies on a
// `<tailorkit-product-personalizer>` element that PageFly's modal rendering never mounts, so it no-ops
// and the personalization fee is silently dropped. Install PageFly's own /cart/add interceptor, which
// reads the `_Total_Additional_Cost` property this build already writes and adds the hidden pricing
// product line. Idempotent + uses an `X-TailorKit-Internal` marker so it never re-processes its own add.
import { installTailorKitHiddenPricingFetchInterceptor } from '../../storefront/hidden-pricing-fetch-interceptor'
import { installTailorKitHiddenPricingNativeSubmit } from '../../storefront/hidden-pricing-native-submit'
// PageFly delta: hide the "Generate image with AI" controls — the AI generation
// backend is not wired in the app-platform port, so the button would fail.
import { installHideAiImageGenerator } from '../../storefront/hide-ai-image-generator'
// Keeps the hidden pricing line in sync after the interceptor adds it: re-scales its quantity when the
// main product quantity changes and removes orphaned fee lines when the main product leaves the cart.
import { initializeTailorKitCartSync } from '../../storefront/cart-change-observer'
// Hides the theme's qty stepper / remove button on the hidden pricing line and renders a clean label
// instead, so buyers can't edit or delete the fee line independently.
import { type CartHiddenProductManager, initializeCartHiddenProductManager } from '../../storefront/cart-hidden-product-manager'

// Initialize TailorKit interceptor system
console.log('[TailorKit] Initializing interceptor system...')

// Apply global styling variables emitted by Liquid
applyGlobalStylingVariables()

// Register wizard step-by-step Web Component
registerWizardComponents()

// Sync TailorKit properties to sticky/secondary ATC forms at submit time
installCartFormSync()

// Apply proxy for fetch API (for Add to Cart middleware)
applyProxyForFetchApi()

// Initialize hidden pricing product cache
initializeHiddenPricingProductCache()

// Install PageFly's hidden-pricing cart-add interceptor (native submit + AJAX/fetch) so the
// personalization fee is actually added to the cart in the PageFly-embedded storefront.
installTailorKitHiddenPricingNativeSubmit()
installTailorKitHiddenPricingFetchInterceptor()

// Hide the (unwired) "Generate image with AI" storefront controls.
installHideAiImageGenerator()

// Hide qty/remove controls on the hidden pricing line and render a clean label.
const tailorKitHiddenManager = initializeCartHiddenProductManager()

// Observe Ajax cart mutations to keep the hidden pricing line's quantity in sync, clean up
// orphans, and re-tag the hidden line after the theme re-renders cart rows on each change.
initializeTailorKitCartSync({
  onCartData: cart =>
    tailorKitHiddenManager.processCartWithData(
      cart as unknown as Parameters<CartHiddenProductManager['processCartWithData']>[0]
    ),
})

// Tag the hidden pricing line on initial cart render. The manager's own init runs before
// section-rendered themes finish rendering cart rows (losing the DOM race), so drive it once the
// DOM is ready with fresh cart data — mirrors the standalone helper's initial getCart→processCart.
const tagTailorKitHiddenLineOnLoad = () => {
  fetch('/cart.js')
    .then(response => response.json())
    .then(cart => tailorKitHiddenManager.processCartWithData(cart))
    .catch(error => console.error('[TailorKit] Initial hidden-line tag failed:', error))
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tagTailorKitHiddenLineOnLoad)
} else {
  tagTailorKitHiddenLineOnLoad()
}

// Initialize Buy It Now handler
initializeBuyItNowHandler({
  debugMode: false, // Set to true for debugging
  enabled: true,
  redirectDelay: 200, // ms to wait before redirecting to checkout
})

// Start monitoring radio inputs to prevent theme conflicts
startRadioInputMonitor()

// Log available events for developer discovery
logAvailableEvents()

// Register cross-product personalizer modal listener (singleton — safe to call once)
registerCrossProductModalListener()

// Arm the post-ATC checkout redirect when buyers click the theme's native ATC
// button on a page hosting a TailorKit customizer (inline personalization).
installInlineCheckoutRedirect()
