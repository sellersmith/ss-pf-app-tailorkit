import { getCart } from '../utils/cart'

/**
 * Reject non-string values or stringified objects like "[object File]" that Shopify
 * preserves verbatim when a merchant's PDP accidentally stored a File/Blob/object
 * as the `_Preview` line-item property.
 */
function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.startsWith('[object ')) return false
  if (value === 'undefined' || value === 'null') return false
  return (
    value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('//')
    || value.startsWith('/')
    || value.startsWith('data:')
    || value.startsWith('blob:')
  )
}

/**
 * Configuration interface for cart image management
 */
interface CartImageConfig {
  // Cart item selector (e.g., '.cart-item', '.line-item', '[data-cart-item]')
  cartItemSelector: string

  // Selectors for image elements within each cart item
  imageSelectors: string[] // e.g., ['.cart-item__image img', '.line-item-image img', '.cart__image img']

  // Preview property key to look for
  previewPropertyKey?: string

  // Debug mode
  debugMode?: boolean

  // Debounce delay in milliseconds
  debounceDelay?: number

  // Disable theme fallback event listeners such as 'cart:updated'
  disableFallbackListeners?: boolean
}

/**
 * Cart Image Controller
 * Updates cart item images based on preview properties from TailorKit customization
 *
 * Features:
 * - Handles stale state cleanup
 * - Supports config updates via getInstance
 * - Automatic cart change detection
 * - Proper debouncing to prevent API throttling
 */
export class CartImageController {
  private static instance: CartImageController | null = null
  private static isInitializing = false
  private config: CartImageConfig
  private processedItems = new Set<string>()
  private lastCartHash = ''
  private debounceTimer: number | null = null
  private isProcessing = false
  private pendingRefresh = false
  private instanceId: string
  private eventHandlers: Map<string, EventListener> = new Map()

  private constructor(config: CartImageConfig) {
    this.instanceId = `CartImageController-${Date.now()}`
    // Merge provided config with sensible defaults
    this.config = {
      previewPropertyKey: '_Preview',
      debugMode: false,
      debounceDelay: 750,
      disableFallbackListeners: true,
      ...config,
    }

    this.init()
  }

  public static getInstance(config?: CartImageConfig): CartImageController {
    // Prevent duplicate initialization
    if (CartImageController.isInitializing) {
      console.warn('[TailorKit Cart Images] Already initializing, returning existing instance')
      return CartImageController.instance!
    }

    if (!CartImageController.instance && config) {
      CartImageController.isInitializing = true
      try {
        CartImageController.instance = new CartImageController(config)
      } finally {
        CartImageController.isInitializing = false
      }
    } else if (CartImageController.instance && config) {
      // Update existing instance configuration
      CartImageController.instance.log('Updating existing instance configuration')
      CartImageController.instance.config = {
        previewPropertyKey: '_Preview',
        debugMode: false,
        debounceDelay: 750,
        disableFallbackListeners: true,
        ...config,
      }
      // Refresh with new config
      CartImageController.instance.debouncedRefresh()
    }

    if (!CartImageController.instance) {
      console.warn('[TailorKit Cart Images] No instance available and no config provided')
    }

    return CartImageController.instance!
  }

  private cartDrawerObserver: MutationObserver | null = null

  private init() {
    this.log('Initializing Cart Image Controller', this.instanceId)
    // Remove automatic refresh on init - cart images will be updated when cart changes
    // this.debouncedRefresh()
    this.observeCartDrawer()
    this.listenToCartEvents()
  }

  /**
   * Observe cart drawer for DOM changes (handles drawer opening/re-rendering)
   * This is needed because cart drawer content may be dynamically loaded
   */
  private observeCartDrawer() {
    // Common cart drawer selectors for various themes
    const cartDrawerSelectors = [
      'cart-drawer',
      'cart-notification',
      '.cart-drawer',
      '#CartDrawer',
      '.mini-cart',
      '[data-cart-drawer]',
      // Broader selectors as fallback (but still scoped to cart elements)
      'aside[id*="cart" i]',
      'div[id*="cart-drawer" i]',
      '[class*="cart-drawer"]',
    ]

    const setupObserver = () => {
      // Find cart drawer element
      let cartDrawer: Element | null = null
      for (const selector of cartDrawerSelectors) {
        cartDrawer = document.querySelector(selector)
        if (cartDrawer) {
          this.log('Found cart drawer with selector:', selector)
          break
        }
      }

      if (!cartDrawer) {
        // No cart drawer found - skip DOM observation for performance
        // Rely on callback from handleUpdateCart and cart change events instead
        this.log('No cart drawer found, skipping DOM observation')
        return
      }

      this.cartDrawerObserver = new MutationObserver(mutations => {
        // Early exit if no added nodes (performance optimization)
        if (!mutations.some(m => m.addedNodes.length > 0)) return

        // Check if cart items were added/modified
        const hasCartItemChanges = mutations.some(mutation => {
          for (const node of Array.from(mutation.addedNodes)) {
            if (!(node instanceof Element)) continue

            const cartItemSelector = this.config.cartItemSelector.split(',').map(selector => selector.trim())
            // Check if the added node is a cart item or contains cart items
            if (cartItemSelector.some(selector => node.matches?.(selector) || node.querySelector?.(selector))) {
              return true
            }
          }
          return false
        })

        if (hasCartItemChanges) {
          this.log('Cart drawer DOM changed, refreshing images')
          this.debouncedRefresh()
        }
      })

      this.cartDrawerObserver.observe(cartDrawer, {
        childList: true,
        subtree: true,
      })

      this.log('Cart drawer observer initialized')
    }

    // Setup observer when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupObserver)
    } else {
      setupObserver()
    }
  }

  private log(...args: any[]) {
    const prefix = `[TailorKit Cart Images ${this.instanceId}]`
    if (this.config.debugMode) {
      console.log(prefix, ...args)
    }
  }

  private async getCartData(): Promise<any> {
    const callId = `getCartData-${Date.now()}`
    this.log(`API Call Start: ${callId}`)

    try {
      const cartData = await getCart()
      this.log(`API Call Success: ${callId}`, {
        itemsCount: cartData.items?.length || 0,
        totalPrice: cartData.total_price,
      })

      return cartData
    } catch (error) {
      console.error(`[TailorKit Cart Images] API Call Error: ${callId}`, error)
      return null
    }
  }

  private findCartItems(): NodeListOf<Element> {
    const cartItems = document.querySelectorAll(this.config.cartItemSelector)
    this.log('Found cart items:', cartItems.length)
    return cartItems
  }

  private findImageInCartItem(cartItem: Element): HTMLImageElement | null {
    for (const selector of this.config.imageSelectors) {
      const img = cartItem.querySelector(selector) as HTMLImageElement
      if (img) {
        this.log('Found image with selector:', selector)
        return img
      }
    }

    this.log('No image found in cart item with any selector')
    return null
  }

  private clearStaleAttributes(cartItems: NodeListOf<Element>) {
    cartItems.forEach(cartItem => {
      // Remove TailorKit attributes
      cartItem.removeAttribute('data-tlk-has-preview')
      cartItem.removeAttribute('data-tlk-item-key')

      // Reset image attributes
      const img = this.findImageInCartItem(cartItem)
      if (img) {
        img.removeAttribute('data-tlk-preview-updated')

        // Restore original image if it was replaced
        const originalSrc = img.getAttribute('data-original-src')
        if (originalSrc && img.src !== originalSrc) {
          img.src = originalSrc
        }
      }
    })
  }

  private async processCartImages() {
    const processId = `processCartImages-${Date.now()}`
    this.log(`Process Start: ${processId}`)

    // Prevent overlapping requests
    if (this.isProcessing) {
      this.log(`Process Already Running: ${processId}, marking for retry`)
      this.pendingRefresh = true
      return
    }

    this.isProcessing = true
    this.pendingRefresh = false

    try {
      console.log('Processing cart images from cart-image-controller')
      const cartData = await this.getCartData()
      if (!cartData || !cartData.items) {
        this.log(`Process No Data: ${processId}`)
        return
      }

      this.processCartImagesWithData(cartData, processId)
    } finally {
      this.isProcessing = false
      this.log(`Process End: ${processId}`)

      // // If there was a pending refresh while processing, execute it
      // if (this.pendingRefresh) {
      //   this.log(`Process Pending: ${processId}`)
      //   setTimeout(() => this.processCartImages(), 100)
      // }
    }
  }

  /**
   * Process cart images with provided cart data (avoids making API calls)
   */
  public processCartImagesWithData(cartData: any, processId?: string) {
    const currentProcessId = processId || `processCartImagesWithData-${Date.now()}`
    this.log(`Process With Data Start: ${currentProcessId}`)

    if (!cartData || !cartData.items) {
      this.log(`Process With Data No Data: ${currentProcessId}`)
      return
    }

    this.isProcessing = true
    this.pendingRefresh = false

    try {
      const cartItems = this.findCartItems()

      this.log(`Process With Data Running: ${currentProcessId}`, {
        cartItemsFound: cartItems.length,
        cartDataItems: cartData.items.length,
      })

      this.log(`Process With Data Updating: ${currentProcessId}`)

      // Clear stale attributes from all cart items first
      this.clearStaleAttributes(cartItems)

      // Match cart items (DOM) with cart data by position
      const totalCartItems = cartData.items.length

      cartItems.forEach((cartItem, index) => {
        const cartDataItem = cartData.items[index % totalCartItems]

        if (!cartDataItem) {
          this.log(`No cart data for item at index ${index}`)
          return
        }

        // Set the item key for identification
        const itemKey = cartDataItem.key || `item-${index}`
        cartItem.setAttribute('data-tlk-item-key', itemKey)

        this.updateCartItemImage(cartItem, cartDataItem, index)
      })
    } finally {
      this.isProcessing = false
      this.log(`Process With Data End: ${currentProcessId}`)

      // If there was a pending refresh while processing, execute it
      if (this.pendingRefresh) {
        this.log(`Process With Data Pending: ${currentProcessId}`)
        setTimeout(() => this.processCartImagesWithData(cartData, currentProcessId), 100)
      }
    }
  }

  private updateCartItemImage(cartItem: Element, cartDataItem: any, index: number) {
    const itemKey = cartDataItem.key || `item-${index}`

    // Skip hidden items (charm products, pricing products) — they don't need preview images
    const props = cartDataItem.properties || {}
    const isHidden = Object.values(props).some(
      (v: any) => v === 'true' && Object.keys(props).some(k => k.endsWith('_hidden'))
    )
    if (isHidden) {
      this.log(`Skipping hidden item ${index} (charm/pricing product)`)
      return
    }

    // Look for preview property
    const previewPropertyKey = this.config.previewPropertyKey!
    const previewProperty = cartDataItem.properties?.[previewPropertyKey]

    if (!previewProperty) {
      this.log(`No preview property found for item ${index}`)
      return
    }

    // Guard against invalid preview values. Shopify preserves whatever string was sent as
    // a line-item property; if the frontend accidentally stored a File/Blob/object, it is
    // serialized as "[object File]"/"[object Object]" and produces 404s when assigned to
    // img.src. Without this check, the MutationObserver below re-applies the bad URL in an
    // infinite loop with the onerror revert.
    if (!isValidImageUrl(previewProperty)) {
      console.warn(`[TailorKit Cart Images] Invalid preview property for item ${index}, skipping:`, previewProperty)
      return
    }

    // Find image element in cart item
    const imgElement = this.findImageInCartItem(cartItem)

    if (!imgElement) {
      this.log(`No image element found for item ${index}`)
      return
    }

    // Update image source
    const originalSrc = imgElement.src

    this.log(`Updating image for item ${index}:`, {
      originalSrc: `${originalSrc.substring(0, 50)}...`,
      previewSrc: `${previewProperty.substring(0, 50)}...`,
      itemKey,
    })

    // Store original src as fallback
    if (!imgElement.hasAttribute('data-original-src')) {
      imgElement.setAttribute('data-original-src', originalSrc)
    }

    // Store original srcset as fallback (for themes like Horizon that use srcset)
    const originalSrcset = imgElement.getAttribute('srcset')
    if (originalSrcset && !imgElement.hasAttribute('data-original-srcset')) {
      imgElement.setAttribute('data-original-srcset', originalSrcset)
    }

    // Add TailorKit data attributes for identification
    imgElement.setAttribute('data-tlk-preview-updated', 'true')
    cartItem.setAttribute('data-tlk-has-preview', 'true')

    // Update srcset if it exists (browsers prioritize srcset over src)
    if (imgElement.hasAttribute('srcset')) {
      imgElement.setAttribute('srcset', previewProperty)
    }

    // Update the image source
    imgElement.src = previewProperty

    // Watch for third-party apps overwriting our changes and re-apply.
    // hasFailed stops re-apply after an onerror revert — otherwise an unreachable preview
    // URL creates an infinite observer/revert loop.
    let hasFailed = false
    const imgObserver = new MutationObserver(mutations => {
      if (hasFailed) return
      mutations.forEach(m => {
        if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'srcset')) {
          const currentValue = (m.target as HTMLImageElement).getAttribute(m.attributeName!)
          // If someone changed it away from our preview URL, re-apply
          if (currentValue && !currentValue.includes(previewProperty.substring(0, 50))) {
            ;(m.target as HTMLImageElement).src = previewProperty
            if ((m.target as HTMLImageElement).hasAttribute('srcset')) {
              ;(m.target as HTMLImageElement).setAttribute('srcset', previewProperty)
            }
          }
        }
      })
    })
    imgObserver.observe(imgElement, { attributes: true, attributeOldValue: true })

    // Handle image load errors by reverting to original
    imgElement.onerror = () => {
      hasFailed = true
      imgObserver.disconnect()
      const fallbackSrc = imgElement.getAttribute('data-original-src')
      const fallbackSrcset = imgElement.getAttribute('data-original-srcset')
      if (fallbackSrc && imgElement.src !== fallbackSrc) {
        console.warn('[TailorKit Cart Images] Preview image failed to load, reverting to original')
        imgElement.src = fallbackSrc
        // Restore srcset if it was stored
        if (fallbackSrcset) {
          imgElement.setAttribute('srcset', fallbackSrcset)
        }
      }
    }

    // Mark as processed
    this.processedItems.add(itemKey)
  }

  // DOM observation removed - observeCartChanges system handles all cart updates

  private listenToCartEvents() {
    if (this.config.disableFallbackListeners) {
      this.log('Fallback event listeners disabled by config')
      return
    }

    // Minimal event listening - most cart updates handled by observeCartChanges system
    // Only keep essential fallback events
    const cartEvents = [
      'cart:updated', // Fallback for themes that dispatch this event
    ]

    cartEvents.forEach(event => {
      const handler = () => {
        this.log(`Fallback cart event detected: ${event}`)
        // Note: This will still make API calls as fallback
        // Primary cart updates should come through observeCartChanges -> processCartImagesWithData
        this.debouncedRefresh()
      }

      // Store handler reference for cleanup
      this.eventHandlers.set(event, handler)
      window.addEventListener(event, handler)
    })
  }

  /**
   * Debounced refresh method to prevent multiple simultaneous calls
   */
  private debouncedRefresh() {
    const debounceId = `debounce-${Date.now()}`
    this.log(`Debounce Triggered: ${debounceId}`)

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.log(`Debounce Cancelled Previous: ${debounceId}`)
    }

    // Set new timer
    this.debounceTimer = window.setTimeout(() => {
      this.log(`Debounce Executing: ${debounceId}`)
      this.refresh()
    }, this.config.debounceDelay)
  }

  public refresh() {
    this.log('Refreshing cart images')
    this.processedItems.clear()
    this.lastCartHash = ''
    this.processCartImages()
  }

  public clearAllStates() {
    this.log('Clearing all cart states')
    const cartItems = this.findCartItems()
    this.clearStaleAttributes(cartItems)
    this.processedItems.clear()
    this.lastCartHash = ''
  }

  public destroy() {
    this.log('Destroying CartImageController instance:', this.instanceId)

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // Remove event listeners
    this.eventHandlers.forEach((handler, event) => {
      window.removeEventListener(event, handler)
      this.log(`Removed event listener for: ${event}`)
    })
    this.eventHandlers.clear()

    // Clear all states first
    this.clearAllStates()

    // Disconnect cart drawer observer
    if (this.cartDrawerObserver) {
      this.cartDrawerObserver.disconnect()
      this.cartDrawerObserver = null
      this.log('Cart drawer observer disconnected')
    }

    CartImageController.instance = null
    CartImageController.isInitializing = false
  }
}

// Common configuration for CartImageController
const commonImageConfig: CartImageConfig = {
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
  imageSelectors: [
    // Table-based cart structures (like Dawn theme and variants)
    '.cart-item__image-container img',
    'td.cart-item__media img',
    '.cart-item__media img',

    // Horizon theme (uses cart-items plural)
    'td.cart-items__media img',
    '.cart-items__media-container img',
    '.cart-items__media-image',

    // Halo Digital Themes (hdt- prefix) — cart page + cart drawer
    '.hdt-main-cart-item__media img',
    'img.hdt-main-cart-item__image',
    '.hdt-cart-item__media img',

    // Shrine-style themes (e.g. uniqal.de) — drawer image (cart page uses .cart__image below)
    '.product-cart__image img',

    // Standard div-based cart structures
    '.cart-item__image img',
    '.cart__item-image img',
    '.line-item__image img',
    '.cart-item-image img',
    '.product-image img',
    '.cart__image img',

    // Data attribute selectors
    '[data-cart-item-image] img',
    'img[data-cart-item-image]',

    // Generic fallbacks
    '.media img',
    '.image img',
    'img',
  ],
  previewPropertyKey: '_Preview',
  debugMode: false,
  debounceDelay: 750,
  disableFallbackListeners: true,
}

// Automatic initialization is handled through the observeCartChanges system
// to prevent duplicate API calls

let _cartImageInitialized = false
export function ensureCartImageControllerInitialized() {
  if (!_cartImageInitialized) {
    _cartImageInitialized = true
    return CartImageController.getInstance(commonImageConfig)
  }
  return CartImageController.getInstance()
}
