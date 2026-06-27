import { OPTION_PRICING_PROPERTY_PREFIX } from '../handlers/option-pricing-change'
import type { CartLineItem, LineItemProperties } from '../types/shopify-cart'

/**
 * Advanced cart synchronization utilities
 * Based on real-world edge cases from successful personalization apps
 */

/**
 * Debounce cart operations to prevent rapid API calls
 * Critical for preventing rate limiting and ensuring smooth UX
 */
export class CartOperationDebouncer {
  private pendingOperations = new Map<
    string,
    {
      operation: () => Promise<void>
      timeout: NodeJS.Timeout
    }
  >()

  private readonly debounceTime = 50 // 50ms — just enough to batch rapid clicks

  /**
   * Debounce a cart operation by its unique key
   * @param key - Unique identifier for the operation
   * @param operation - The operation to execute
   */
  debounce(key: string, operation: () => Promise<void>): void {
    // Clear existing timeout for this key
    const existing = this.pendingOperations.get(key)
    if (existing) {
      clearTimeout(existing.timeout)
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await operation()
      } catch (error) {
        console.error(`[TailorKit] Debounced operation failed for key ${key}:`, error)
      } finally {
        this.pendingOperations.delete(key)
      }
    }, this.debounceTime)

    this.pendingOperations.set(key, { operation, timeout })
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    for (const { timeout } of this.pendingOperations.values()) {
      clearTimeout(timeout)
    }
    this.pendingOperations.clear()
  }
}

/**
 * Express checkout compatibility handler
 * Handles cases where customers use express checkout buttons that bypass cart page
 */
export class ExpressCheckoutHandler {
  private static instance: ExpressCheckoutHandler
  private isExpressCheckoutActive = false

  static getInstance(): ExpressCheckoutHandler {
    if (!ExpressCheckoutHandler.instance) {
      ExpressCheckoutHandler.instance = new ExpressCheckoutHandler()
    }
    return ExpressCheckoutHandler.instance
  }

  /**
   * Initialize express checkout monitoring
   */
  init(): void {
    this.monitorExpressCheckoutButtons()
    this.handleCheckoutRedirect()
  }

  /**
   * Monitor for express checkout button clicks
   */
  private monitorExpressCheckoutButtons(): void {
    // Monitor common express checkout selectors
    const expressSelectors = [
      '[data-shopify-buttoncomponent="true"]', // Shop Pay
      '.shopify-payment-button__button--unbranded', // Generic
      '.dynamic-checkout__content button', // Dynamic checkout
      '[data-testid="Checkout-button"]', // Various implementations
      '.paypal-button', // PayPal
      '.apple-pay-button', // Apple Pay
      '.google-pay-button', // Google Pay
    ]

    for (const selector of expressSelectors) {
      document.addEventListener('click', event => {
        const target = event.target as HTMLElement
        if (target.matches(selector) || target.closest(selector)) {
          this.handleExpressCheckoutClick()
        }
      })
    }
  }

  /**
   * Handle express checkout button click
   */
  private handleExpressCheckoutClick(): void {
    this.isExpressCheckoutActive = true
    console.log('[TailorKit] Express checkout detected - disabling cart synchronization')

    // Disable cart synchronization temporarily
    window.dispatchEvent(new CustomEvent('tailorkit:express-checkout-start'))
  }

  /**
   * Handle checkout page redirect detection
   */
  private handleCheckoutRedirect(): void {
    // Monitor for navigation to checkout
    if (window.location.pathname.includes('/checkout')) {
      this.isExpressCheckoutActive = false
      window.dispatchEvent(new CustomEvent('tailorkit:express-checkout-end'))
    }
  }

  /**
   * Check if express checkout is currently active
   */
  isActive(): boolean {
    return this.isExpressCheckoutActive
  }
}

/**
 * Cart conflict resolution for third-party app compatibility
 * Handles conflicts with other apps that modify cart
 */
export class CartConflictResolver {
  private static readonly KNOWN_THIRD_PARTY_PROPERTIES = [
    '_bundleId', // Bundle apps
    '_subscriptionId', // Subscription apps
    '_upsellId', // Upsell apps
    '_personalizeId', // Other personalization apps
    'Bold_', // Bold apps prefix
    'ReCharge_', // ReCharge subscription
    'CartHook_', // CartHook upsells
  ]

  /**
   * Check if a line item has third-party app properties
   */
  static hasThirdPartyProperties(item: CartLineItem): boolean {
    return Object.keys(item.properties || {}).some(key =>
      this.KNOWN_THIRD_PARTY_PROPERTIES.some(prefix => key.startsWith(prefix))
    )
  }

  /**
   * Safely merge properties without overwriting third-party data
   */
  static mergeProperties(existing: LineItemProperties, updates: LineItemProperties): LineItemProperties {
    const merged = { ...existing }

    // Only update TailorKit properties
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes('TLK') || key.startsWith('_TLK')) {
        merged[key] = value
      }
    }

    return merged
  }

  /**
   * Detect potential conflicts with other apps
   */
  static detectConflicts(cartItems: CartLineItem[]): Array<{
    item: CartLineItem
    conflicts: string[]
  }> {
    const conflicts: Array<{ item: CartLineItem; conflicts: string[] }> = []

    for (const item of cartItems) {
      const itemConflicts: string[] = []

      // Check for quantity manipulation by other apps
      if (this.hasThirdPartyProperties(item)) {
        itemConflicts.push('Third-party app properties detected')
      }

      // Check for suspicious pricing modifications
      if (item.price !== item.original_price && !item.properties[`${OPTION_PRICING_PROPERTY_PREFIX} - Amount`]) {
        itemConflicts.push('Price modified by external source')
      }

      if (itemConflicts.length > 0) {
        conflicts.push({ item, conflicts: itemConflicts })
      }
    }

    return conflicts
  }
}
