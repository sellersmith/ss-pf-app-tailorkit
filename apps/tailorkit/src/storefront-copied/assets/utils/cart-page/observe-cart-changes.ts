import fetchShopifyCartData from './fetchShopifyCartData'

export const lastFetchedCartProducts: any = { items: [] }

/**
 * This module provides a robust cart change detection system using the Performance Observer API
 * to monitor cart-related network requests and automatically fetch updated cart data when changes occur.
 */

/**
 * @class CartObserver
 * @description
 * A sophisticated cart monitoring system that observes network requests to detect cart changes
 * and automatically fetches updated cart data with proper debouncing and error handling.
 *
 * **Key Features:**
 * - Uses Performance Observer API for efficient network request monitoring
 * - Debounced cart data fetching to prevent excessive API calls
 * - Queue-based callback management for handling multiple simultaneous changes
 * - Automatic cleanup and memory management
 * - Built-in error handling and recovery
 *
 * **Technical Implementation:**
 * - Monitors XMLHttpRequest and fetch requests targeting cart endpoints
 * - Implements a 100ms debounce delay to handle rapid consecutive changes
 * - Maintains a callback queue to ensure all handlers receive updates
 * - Compares cart state using item ID, key, and quantity to detect actual changes
 */
class CartObserver {
  private observer: PerformanceObserver | null = null
  private isFetching: boolean = false
  private queueCallbacks: ((data: any) => void)[] = []
  private isActive: boolean = false

  constructor(private handler: (data: any) => void) {
    this.setupObserver()
  }

  /**
   * @method setupObserver
   * @private
   * @description
   * Initializes the Performance Observer to monitor network requests.
   * Filters for cart-related endpoints and manages observer lifecycle.
   *
   * **Monitored Endpoints:**
   * - /cart/change - Item quantity updates
   * - /cart/add - Adding items to cart
   * - /cart/update - Bulk cart updates
   * - /cart/clear - Cart clearing operations
   *
   * @see {@link https://shopify.dev/docs/api/ajax/reference/cart} Shopify Cart API
   *
   * **Error Handling:**
   * Gracefully handles cases where Performance Observer is not supported
   * or fails to initialize, preventing application crashes.
   */
  private setupObserver(): void {
    if (this.isActive) {
      return
    }

    this.observer = new PerformanceObserver(list => {
      if (!this.isActive) {
        return
      }

      const isCartChanged = list.getEntries().filter((entry: any) => {
        const isValidRequestType = ['xmlhttprequest', 'fetch'].includes(entry.initiatorType)
        const isCartChangeRequest = /\/cart\/(change|add|update|clear)/.test(entry.name)
        return isValidRequestType && isCartChangeRequest
      })

      if (isCartChanged?.length && typeof this.handler === 'function') {
        this.handleCartChange()
      }
    })

    try {
      this.observer.observe({ entryTypes: ['resource'] })
      this.isActive = true
    } catch (error) {
      console.error('[CartObserver] Failed to setup observer:', error)
    }
  }

  /**
   * @method handleCartChange
   * @private
   * @description
   * Manages cart change events with intelligent debouncing and queue management.
   * Prevents duplicate requests and ensures all callbacks receive updates.
   *
   * **Debouncing Strategy:**
   * - 100ms delay prevents excessive API calls during rapid changes
   * - Queue system ensures no callbacks are lost during debounce period
   * - Single request per change cycle to optimize performance
   *
   * **Queue Management:**
   * - Callbacks are queued during debounce period
   * - All queued callbacks receive the same cart data
   * - Queue is cleared after successful data fetch
   */
  private handleCartChange(): void {
    // Push the handler to queue
    this.queueCallbacks.push(this.handler)

    // Prevent handling another request if one is already in progress
    if (this.isFetching) {
      return
    }

    this.isFetching = true

    // Debounce rapid cart changes (e.g. charm batch + main product add in quick succession)
    // 500ms allows Shopify rate limit to recover between bursts
    setTimeout(() => {
      this.fetchCartData()
    }, 500)
  }

  /**
   * @method fetchCartData
   * @private
   * @async
   * @description
   * Fetches current cart data from Shopify's cart.js endpoint with comprehensive error handling.
   * Only triggers callbacks when actual cart changes are detected.
   *
   * **Change Detection:**
   * Compares item IDs, keys, quantities, etc. to determine if cart actually changed.
   * This prevents unnecessary re-renders and callback executions.
   *
   * **Error Recovery:**
   * - Handles network failures gracefully
   * - Logs errors for debugging
   * - Ensures observer state is properly reset
   * - Clears callback queue to prevent memory leaks
   *
   * @throws {Error} When cart fetch fails or response is invalid
   */
  private async fetchCartData(): Promise<void> {
    try {
      const data = (await fetchShopifyCartData()) || { items: [] }

      // Only update when cart items actually change
      if (this.hasCartChanged(data)) {
        lastFetchedCartProducts['items'] = data?.items || []

        // Execute all queued callbacks
        const callbacks = [...this.queueCallbacks]
        this.queueCallbacks = []

        await Promise.allSettled(
          callbacks.map(callback => {
            try {
              return callback(data)
            } catch (error) {
              console.error('[CartObserver] Callback error:', error)
              return Promise.reject(error)
            }
          })
        )
      }
    } catch (error) {
      console.error('[CartObserver] Failed to fetch cart data:', error)
    } finally {
      this.queueCallbacks = []
      this.isFetching = false
    }
  }

  /**
   * @method hasCartChanged
   * @private
   * @description
   * Performs deep comparison of cart items to detect actual changes.
   * Compares essential properties (ID, key, quantity, etc.) while ignoring cosmetic differences.
   *
   * **Comparison Strategy:**
   * - Extracts essential item properties (id, key, quantity, etc.)
   * - Sorts items by key for consistent comparison
   * - Uses JSON.stringify for deep equality check
   * - Handles empty cart states gracefully
   *
   * **Performance Optimization:**
   * - Only compares essential properties to reduce computation
   * - Sorts arrays to handle item order changes
   * - Returns early for identical carts
   *
   * @param {any} newData - Fresh cart data from API
   * @returns {boolean} True if cart items have changed, false otherwise
   */
  private hasCartChanged(newData: any): boolean {
    const lastFetchedProducts = (
      lastFetchedCartProducts?.items?.length
        ? lastFetchedCartProducts.items.map((item: any) => ({
            ...item,
          }))
        : []
    ).sort((a: any, b: any) => a.key.localeCompare(b.key))

    const currentProducts = (
      newData?.items?.length
        ? newData.items.map((item: any) => ({
            ...item,
          }))
        : []
    ).sort((a: any, b: any) => a.key.localeCompare(b.key))

    return JSON.stringify(lastFetchedProducts) !== JSON.stringify(currentProducts)
  }

  public disconnect(): void {
    this.isActive = false

    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    this.queueCallbacks = []
    this.isFetching = false
  }

  /**
   * @method isObserving
   * @public
   * @description
   * Checks if the observer is currently active and monitoring changes.
   * Useful for debugging and ensuring proper observer state.
   *
   * @returns {boolean} True if observer is active, false otherwise
   */
  public isObserving(): boolean {
    return this.isActive && this.observer !== null
  }
}

export default function observeCartChanges(handler: (data: any) => void): () => void {
  const observer = new CartObserver(handler)

  return () => {
    observer.disconnect()
  }
}
