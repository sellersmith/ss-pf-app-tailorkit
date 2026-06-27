/**
 * DOM Selectors for various button types
 * Centralized here to avoid circular dependencies between modules
 */

/**
 * Comprehensive list of express checkout button selectors
 * These buttons bypass the cart and need to be intercepted for customized products
 */
export const EXPRESS_CHECKOUT_SELECTORS = [
  // Modern Shopify Accelerated Checkout (2023+)
  'shopify-accelerated-checkout button',
  'shopify-accelerated-checkout-cart button',
  // Web component hosts (buttons are rendered inside shadow DOM)
  'shopify-accelerated-checkout',
  'shopify-accelerated-checkout-cart',

  // Legacy Shopify Buy It Now
  '[data-shopify="buy-now"]',
  '.shopify-payment-button button',
  '.shopify-payment-button__button',

  // Additional Checkout Buttons Container
  '.additional-checkout-buttons button',
  '.additional-checkout-buttons [role="button"]',

  // Specific Payment Methods (fallback selectors)
  '[data-payment-method="shop_pay"]',
  '[data-payment-method="paypal"]',
  '[data-payment-method="apple_pay"]',
  '[data-payment-method="google_pay"]',
  '[data-payment-method="microsoft_pay"]',
  '[data-payment-method="amazon_pay"]',
  '[data-payment-method="meta_pay"]',

  // PayPal specific
  '[data-funding-source="paypal"]',
  '.paypal-button',
  '.paypal-checkout-button',

  // Apple Pay specific
  '.apple-pay-button',
  '[data-apple-pay-button]',

  // Google Pay specific
  '.google-pay-button',
  '[data-google-pay-button]',

  // Shop Pay specific
  '.shop-pay-button',
  '[data-shop-pay-button]',

  // Amazon Pay specific
  '.amazon-pay-button',
  '[data-amazon-pay-button]',

  // Microsoft Pay specific
  '.microsoft-pay-button',
  '[data-microsoft-pay-button]',

  // Buy It Now variations
  '.btn-buy-now',
  '.buy-now-button',
  '.buy-it-now',
  '.instant-checkout',
  '.express-checkout',
  '.quick-buy',
  '.fast-checkout',

  // Theme-specific variations (common patterns)
  '[data-action="buy-now"]',
  '[data-type="buy-now"]',
  '.product-form__buttons .btn[data-action*="buy"]',
  '.product-form__payment-button',
]

/** Selectors for Add to Cart buttons with Alpine.js handlers (to remove on:click) */
export const ATC_ALPINE_SELECTORS = [
  'button[name="add"][on\\:click]',
  '.add-to-cart-button[on\\:click]',
  'button.product-form__submit[on\\:click]',
]

/** Selectors for all Add to Cart buttons (for click interception) */
export const ATC_BUTTON_SELECTORS = [
  'button[name="add"]',
  'button[type="submit"][name="add"]',
  '.add-to-cart-button',
  'button.product-form__submit',
  '[data-add-to-cart]',
  '.btn-addtocart',
  '.addtocart-button',
  'form[action*="/cart/add"] button[type="submit"]',
  'button.add-to-cart',
  'button.product-form__submit',
  'button#AddToCart',
  'button[data-action="add-to-cart"]',
  'button[data-add-to-cart]',
  'button[type="submit"]',
  'input[type="submit"][name="add"]',
  'input[type="submit"][data-add-to-cart]',
]

/** Combined selectors for both ATC and BIN buttons */
export const ALL_CHECKOUT_SELECTORS = [...ATC_BUTTON_SELECTORS, ...EXPRESS_CHECKOUT_SELECTORS]
