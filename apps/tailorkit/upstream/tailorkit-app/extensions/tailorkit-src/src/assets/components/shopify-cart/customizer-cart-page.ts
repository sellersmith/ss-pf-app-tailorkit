import { CANVAS_PREVIEW_PROPERTY_KEY } from '../../constants'
import { welcomeMsg } from '../../fns/logs'
import observeCartChanges from '../../utils/cart-page/observe-cart-changes'

/**
 * Interface for Shopify cart item
 */
interface ShopifyCartItem {
  key: string
  id: number
  properties: Record<string, any>
  [key: string]: any
}

/**
 * TailorKit Cart Page Customizer - Simplified version
 */
class TailorKitCartPageCustomizer {
  private itemsCart: ShopifyCartItem[] = []
  private processedItems = new Set<string>()
  private cartObserverCleanup: (() => void) | null = null
  private isInitialized: boolean = false
  private debounceTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.init()
  }

  /**
   * Initialize cart customizer
   */
  private async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      welcomeMsg()
      await this.loadCartData()

      if (this.itemsCart.length === 0) {
        return
      }

      await this.startCustomization()
      this.setupCartObserver()
      this.isInitialized = true
    } catch (error) {
      console.error('[TailorKit Cart] Initialization failed:', error)
    }
  }

  /**
   * Load cart data from Shopify
   */
  private async loadCartData(newCartItems?: ShopifyCartItem[]): Promise<void> {
    if (newCartItems) {
      this.itemsCart = newCartItems
      return
    }

    const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`)
    if (!response.ok) {
      throw new Error(`[TailorKit Cart] Cart fetch failed: ${response.status}`)
    }

    const cart = await response.json()
    this.itemsCart = cart.items || []
  }

  /**
   * Start customization process
   */
  private async startCustomization(): Promise<void> {
    const cartImages = this.getCartImages()
    if (cartImages.length === 0) {
      return
    }

    for (let i = 0; i < this.itemsCart.length && i < cartImages.length; i++) {
      const item = this.itemsCart[i]
      const image = cartImages[i]

      // Skip if already processed
      if (this.processedItems.has(item.key)) {
        continue
      }

      await this.customizeCartItem(item, image)
    }
  }

  /**
   * Get cart images using selector from helper data
   */
  private getCartImages(): HTMLImageElement[] {
    const helperData = (window as any).TAILORKIT_HELPER_DATA
    const selector = helperData?.cart_item_image_selector

    if (!selector) {
      throw new Error('[TailorKit Cart] Cart image selector not found')
    }

    return Array.from(document.querySelectorAll(selector)) as HTMLImageElement[]
  }

  /**
   * Customize individual cart item
   */
  private async customizeCartItem(cartItem: ShopifyCartItem, imageElement: HTMLImageElement): Promise<void> {
    try {
      const previewUrl = cartItem.properties[CANVAS_PREVIEW_PROPERTY_KEY]
      if (!previewUrl) {
        return
      }

      await this.replaceImageWithPreview(imageElement, previewUrl, cartItem)
      this.processedItems.add(cartItem.key)
    } catch (error) {
      console.error(`[TailorKit Cart] Failed to customize "`, cartItem, error)
    }
  }

  /**
   * Replace image with preview
   */
  private async replaceImageWithPreview(
    imageElement: HTMLImageElement,
    previewUrl: string,
    cartItem: ShopifyCartItem
  ): Promise<void> {
    // Store original data
    if (!imageElement.dataset.originalSrc) {
      imageElement.dataset.originalSrc = imageElement.src
    }
    imageElement.dataset.tailorkitItem = cartItem.key

    // Add loading transition
    imageElement.style.transition = 'opacity 0.15s ease-out'
    imageElement.style.opacity = '0.7'

    try {
      // Load image
      await this.loadImage(previewUrl)

      // Update image
      imageElement.src = previewUrl
      imageElement.dataset.customized = 'true'
      imageElement.style.opacity = '1'
    } catch (error) {
      imageElement.style.opacity = '1'
      // Restore original image to avoid broken image
      imageElement.src = imageElement.dataset.originalSrc || imageElement.src
      throw error
    }
  }

  /**
   * Simple image loader
   */
  private loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
      img.crossOrigin = 'anonymous'
      img.src = url
    })
  }

  /**
   * Setup cart observer for AJAX cart changes
   */
  private setupCartObserver(): void {
    this.cleanupCartObserver()

    try {
      this.cartObserverCleanup = observeCartChanges((newCartData: any) => {
        this.debounceReinitialize(newCartData)
      })
    } catch (error) {
      console.error('[TailorKit Cart] Failed to setup cart observer:', error)
    }
  }

  /**
   * Clean up cart observer
   */
  private cleanupCartObserver(): void {
    if (this.cartObserverCleanup) {
      try {
        this.cartObserverCleanup()
      } catch (error) {
        console.error('[TailorKit Cart] Error during observer cleanup:', error)
      }
      this.cartObserverCleanup = null
    }
  }

  /**
   * Debounced reinitialize
   */
  private debounceReinitialize = (newCartData?: any): void => {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
    }

    this.debounceTimeout = setTimeout(() => {
      this.reinitialize(newCartData)
    }, 50)
  }

  /**
   * Reinitialize the customizer
   */
  private async reinitialize(newCartData?: any): Promise<void> {
    try {
      this.cleanupCartObserver()
      this.processedItems.clear()

      const newCartItems = newCartData?.items || []
      await this.loadCartData(newCartItems)

      if (this.itemsCart.length > 0) {
        await this.startCustomization()
      }

      this.setupCartObserver()
    } catch (error) {
      console.error('[TailorKit Cart] Reinitialize failed:', error)
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }

    this.cleanupCartObserver()
    this.processedItems.clear()
    this.itemsCart = []
    this.isInitialized = false
  }
}

/**
 * Initialize cart customizer
 */
function initCartCustomizer(): void {
  const currentPath = window.location.pathname
  const routes = (window as any).routes
  const cartUrl = routes?.cart_url || '/cart'

  if (!currentPath.includes(cartUrl)) {
    return
  }

  // Prevent duplicate initialization
  if ((window as any).__tailorkit_cart_customizer__) {
    ;(window as any).__tailorkit_cart_customizer__.destroy()
  }

  const initializeCustomizer = () => {
    ;(window as any).__tailorkit_cart_customizer__ = new TailorKitCartPageCustomizer()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeCustomizer, 50)
    })
  } else {
    setTimeout(initializeCustomizer, 50)
  }
}

const enableCartCustomizer = false
// Initialize
try {
  if (enableCartCustomizer) {
    initCartCustomizer()
  }
} catch (error) {
  console.error('[TailorKit Cart] Failed to initialize:', error)
}
