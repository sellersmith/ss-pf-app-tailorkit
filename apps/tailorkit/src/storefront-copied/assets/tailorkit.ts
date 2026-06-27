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

// Import global styling utility
import { applyGlobalStylingVariables } from './utils/global-styling'

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
