import { readTailorKitStorefrontConfig } from './konva-loader'

// Ported verbatim from the standalone TailorKit `tailorkit-helper` extension
// (handlers/cart-hidden-product-manager.ts). PageFly adaptations only:
//   - PROPERTY_PREFIX resolved at runtime from the app-embed storefront-config (parity with
//     cart-change-observer) instead of a build-time constant import.
//   - Local minimal cart types instead of importing the upstream types/shopify-cart.
// Behaviour (CSS control-hiding, injected label, DOM matching, money formatting) is unchanged.

/** Minimal cart shapes — only the fields this manager reads. */
interface CartLineItem {
  key: string
  product_title: string
  original_line_price: number
  final_line_price: number
  properties: Record<string, string>
}

interface ShopifyCart {
  items: CartLineItem[]
}

/**
 * Shopify window globals exposed by themes
 */
interface ShopifyWindow extends Window {
  Shopify?: {
    formatMoney?: (cents: number, format?: string) => string
    money_format?: string
    currency?: { active?: string }
  }
  theme?: {
    moneyFormat?: string
    strings?: { moneyFormat?: string }
  }
  __onetick_store__?: {
    money_format?: string
  }
}

/**
 * Configuration interface for cart hidden product management
 */
interface CartHiddenProductConfig {
  // Cart item selector (e.g., '.cart-item', '.line-item', '[data-cart-item]')
  cartItemSelector: string
  // Debug mode
  debugMode?: boolean
}

/**
 * Default configuration - can be overridden
 */
const DEFAULT_CONFIG: CartHiddenProductConfig = {
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
}

function resolvePropertyPrefix(): string {
  return readTailorKitStorefrontConfig().propertyPrefix || '__pf_tailorkit'
}

/**
 * Map a DOM cart row to its cart.js line by the theme's own 1-based line index
 * (e.g. Dawn `id="CartDrawer-Item-3"`, or a descendant `[data-index]` on the
 * quantity input / remove button). This replaces fragile global positional
 * matching so a hidden pricing row is never mis-identified — and, critically,
 * so the MAIN product row is never relabeled as the hidden pricing line — when
 * DOM order differs from cart.js order or multiple cart UIs (drawer + page)
 * render at once. Returns null when no usable index is exposed (caller falls
 * back to positional matching, i.e. never worse than before).
 */
function resolveCartLineIndex(el: HTMLElement): number | null {
  const fromId = el.id.match(/-(\d+)$/)?.[1]
  if (fromId) return Number(fromId)
  const fromChild = el.querySelector('[data-index]')?.getAttribute('data-index')
  if (fromChild && /^\d+$/.test(fromChild)) return Number(fromChild)
  return null
}

/**
 * Cart Hidden Product Manager
 * Configurable system to hide controls for hidden pricing products
 */
export class CartHiddenProductManager {
  private static instance: CartHiddenProductManager | null = null
  private config: CartHiddenProductConfig
  private observer: MutationObserver | null = null
  private styleElement: HTMLStyleElement | null = null
  private isInitialized = false
  private lastCartData: ShopifyCart | null = null

  private constructor(config?: Partial<CartHiddenProductConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.init()
  }

  public static getInstance(config?: Partial<CartHiddenProductConfig>): CartHiddenProductManager {
    if (!CartHiddenProductManager.instance) {
      CartHiddenProductManager.instance = new CartHiddenProductManager(config)
    }
    return CartHiddenProductManager.instance
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<CartHiddenProductConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.reinitialize()
  }

  private init(): void {
    if (this.isInitialized) return

    try {
      this.injectStyles()
      this.setupCartMonitoring()
      this.processCart()
      this.isInitialized = true

      this.log('Cart Hidden Product Manager initialized')
    } catch (error) {
      console.error('[TailorKit] Failed to initialize cart manager:', error)
    }
  }

  private reinitialize(): void {
    this.cleanup()
    this.isInitialized = false
    this.init()
  }

  /**
   * Inject CSS styles based on configuration
   */
  private injectStyles(): void {
    if (this.styleElement) {
      this.styleElement.remove()
    }

    this.styleElement = document.createElement('style')
    this.styleElement.id = 'tailorkit-hidden-product-styles'

    this.styleElement.textContent = `
      /* Hide ALL theme-rendered content inside hidden products.
         We inject our own .tlk-hidden-label instead — guarantees
         consistent display regardless of theme structure. */
      [data-tlk-hidden="true"]:not(tr) > *:not(.tlk-hidden-label) {
        display: none !important;
      }

      /* Table-row themes (<tr>): hide all <td> except the wrapper cell
         holding our injected label. Browsers disallow non-<td> children
         inside <tr>, so the label must be wrapped — see injectHiddenLabel. */
      tr[data-tlk-hidden="true"] > td:not(.tlk-hidden-label-cell) {
        display: none !important;
      }

      /* Compact hidden product row — indented to nest under parent */
      [data-tlk-hidden="true"]:not(tr) {
        background: transparent !important;
        border: none !important;
        border-top: 1px dashed #e5e5e5 !important;
        padding: 6px 16px 6px 40px !important;
        padding-right: 0 !important;
        margin-top: -1px;
        min-height: auto !important;
      }

      /* <tr> cannot take padding directly — apply via wrapper <td> */
      tr[data-tlk-hidden="true"] {
        background: transparent !important;
        border-top: 1px dashed #e5e5e5 !important;
      }
      tr[data-tlk-hidden="true"] > td.tlk-hidden-label-cell {
        padding: 6px 16px 6px 40px !important;
        background: transparent !important;
        border: none !important;
      }

      /* Injected label layout. grid-column:1/-1 spans all parent grid columns
         so the price area can align to the row's right edge; no-op on themes
         whose cart rows are not grid containers. */
      .tlk-hidden-label {
        display: flex !important;
        justify-content: flex-start;
        align-items: center;
        gap: 12px;
        width: 100%;
        grid-column: 1 / -1;
      }
      .tlk-hidden-label__info {
        color: #444;
        font-size: 0.9em;
        line-height: 1.4;
      }
      .tlk-hidden-label__title {
        font-weight: 600;
      }
      .tlk-hidden-label__for {
        font-weight: 400;
        font-size: 0.9em;
        color: #888;
        margin-top: 2px;
      }
      .tlk-hidden-label__price-area {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-left: auto;
        white-space: nowrap;
      }
      .tlk-hidden-label__original-price {
        font-size: 0.85em;
        color: #999;
        text-decoration: line-through;
      }
      .tlk-hidden-label__price {
        font-weight: 600;
        color: #333;
        font-size: 0.9em;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        [data-tlk-hidden="true"] {
          padding: 6px 10px 6px 24px !important;
        }
        .tlk-hidden-label {
          flex-wrap: wrap;
        }
        .tlk-hidden-label__price-area {
          width: 100%;
          justify-content: flex-end;
        }
      }

      /* Fix AOS (Animate On Scroll) animation causing cart items to stay invisible
         after cart updates on themes like Broadcast that use data-animation. */
      .aos-initialized .cart [data-animation=cart-items-fade] {
        opacity: 1 !important;
        animation: none !important;
      }
    `

    document.head.appendChild(this.styleElement)
  }

  /**
   * Setup cart monitoring
   */
  private setupCartMonitoring(): void {
    // Minimal DOM observation - most cart updates handled by observeCartChanges system
    this.observer = new MutationObserver(mutations => {
      let shouldProcess = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (this.isCartElement(element)) {
                shouldProcess = true
              }
            }
          })
        }
      })

      if (shouldProcess && this.lastCartData) {
        // Re-tag new DOM elements immediately using cached cart data.
        // Prevents FOUC where quantity/price controls flash before the
        // full observer cycle (fetch cart.js → process) completes.
        this.processCartWithData(this.lastCartData)
      }
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Minimal fallback event listening - most updates handled by observeCartChanges system
    const essentialCartEvents = ['cart:updated'] // Only keep essential fallbacks
    essentialCartEvents.forEach(event => {
      window.addEventListener(event, () => {
        this.log(`Fallback cart event detected: ${event}`)
        // Note: This may still make API calls as fallback
        setTimeout(() => {
          this.processCart()
        }, 250)
      })
    })
  }

  /**
   * Check if element is cart-related
   */
  private isCartElement(element: Element): boolean {
    return element.matches(this.config.cartItemSelector) || element.querySelector(this.config.cartItemSelector) !== null
  }

  /**
   * Main processing function - matches cart.js data with DOM elements
   */
  private async processCart(): Promise<void> {
    try {
      // Get cart data from Shopify
      const cart = await this.getCartData()

      if (!cart || !cart.items || cart.items.length === 0) {
        this.log('No cart items found')
        return
      }

      this.processCartWithData(cart)
    } catch (error) {
      console.warn('[TailorKit] Error processing cart:', error)
    }
  }

  /**
   * Process cart with provided data (avoids making API calls)
   */
  public processCartWithData(cart: ShopifyCart): void {
    if (!cart || !cart.items || cart.items.length === 0) {
      this.log('No cart items found in provided data')
      return
    }

    // Cache for instant re-tagging when theme re-renders cart DOM
    this.lastCartData = cart

    // Get cart item elements from DOM
    const cartItemElements = document.querySelectorAll(this.config.cartItemSelector)
    if (cartItemElements.length === 0) {
      this.log('No cart item elements found with selector:', this.config.cartItemSelector)
      return
    }

    this.log('Processing cart with provided data:', {
      cartItems: cart.items.length,
      domElements: cartItemElements.length,
    })

    // Match cart items with DOM elements by the theme's own 1-based line index
    // when exposed (order-independent, handles drawer + cart page rendered at
    // once); fall back to positional matching (each item rendered multiple
    // times) only when no index is available.
    const propertyPrefix = resolvePropertyPrefix()
    const totalCartItems = cart.items.length

    cartItemElements.forEach((el, idx) => {
      const cartElement = el as HTMLElement
      const lineIndex = resolveCartLineIndex(cartElement)
      const item =
        lineIndex !== null && lineIndex >= 1 && lineIndex <= totalCartItems
          ? cart.items[lineIndex - 1]
          : cart.items[idx % totalCartItems]
      const properties = item.properties
      const isHidden = properties && properties[`${propertyPrefix}_hidden`] === 'true'

      cartElement.setAttribute('data-tlk-item-key', item.key)

      if (isHidden) {
        cartElement.setAttribute('data-tlk-hidden', 'true')
        this.injectHiddenLabel(cartElement, item)
        this.log(`Marked hidden product (duplicate aware) at DOM index ${idx}:`, item.product_title)
      } else if (cartElement.getAttribute('data-tlk-hidden') === 'true') {
        // Idempotent cleanup. On ATC the theme re-renders the drawer and this runs
        // multiple times (once per cart mutation: main add, then the hidden pricing
        // add); an early run against a transient cart/DOM state can wrongly mark a
        // REAL product row hidden, and the theme reuses the same row nodes across
        // re-renders so the stale `data-tlk-hidden` + injected label persist. Without
        // this branch the main product stays hidden until a full page reload. Un-mark
        // rows that resolve to a non-hidden line so the real product shows.
        cartElement.removeAttribute('data-tlk-hidden')
        cartElement
          .querySelectorAll(':scope > .tlk-hidden-label-cell, :scope > .tlk-hidden-label')
          .forEach(node => node.remove())
      }
    })
  }

  /**
   * Get cart data from Shopify API
   */
  private async getCartData(): Promise<ShopifyCart | null> {
    try {
      const response = await fetch('/cart.js')
      if (!response.ok) {
        throw new Error(`Cart API error: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      this.log('Error fetching cart data:', error)
      return null
    }
  }

  /**
   * Manual refresh
   */
  public refresh(): void {
    this.processCart()
  }

  /**
   * Get current configuration
   */
  public getConfig(): CartHiddenProductConfig {
    return { ...this.config }
  }

  /**
   * Inject a clean label into the hidden product cart item.
   * Replaces all theme-rendered content (hidden via CSS > *:not(.tlk-hidden-label)).
   */
  private injectHiddenLabel(cartElement: HTMLElement, item: CartLineItem): void {
    const existing = cartElement.querySelector('.tlk-hidden-label')

    // Use actual cart line prices (includes discounts from apps like KITE)
    const hasDiscount = item.original_line_price > item.final_line_price
    const finalText = item.final_line_price > 0 ? this.formatPrice(item.final_line_price) : ''
    const originalText = hasDiscount ? this.formatPrice(item.original_line_price) : ''

    // Update existing label if present
    if (existing) {
      const priceEl = existing.querySelector('.tlk-hidden-label__price')
      const originalEl = existing.querySelector('.tlk-hidden-label__original-price')
      if (priceEl) priceEl.textContent = finalText
      if (hasDiscount && !originalEl && priceEl) {
        const orig = document.createElement('span')
        orig.className = 'tlk-hidden-label__original-price'
        orig.textContent = originalText
        priceEl.parentElement?.insertBefore(orig, priceEl)
      } else if (originalEl && !hasDiscount) {
        originalEl.remove()
      } else if (originalEl) {
        originalEl.textContent = originalText
      }
      return
    }

    const label = document.createElement('div')
    label.className = 'tlk-hidden-label'
    label.setAttribute('role', 'status')
    label.setAttribute('aria-label', `Pricing for ${item.product_title}`)

    const info = document.createElement('div')
    info.className = 'tlk-hidden-label__info'

    const title = document.createElement('span')
    title.className = 'tlk-hidden-label__title'
    title.textContent = item.product_title
    info.appendChild(title)

    const forProduct = item.properties['For Product']
    if (forProduct) {
      const forEl = document.createElement('div')
      forEl.className = 'tlk-hidden-label__for'
      forEl.textContent = `For Product: ${forProduct}`
      info.appendChild(forEl)
    }

    label.appendChild(info)

    // Price area: original (crossed out) + final price
    const priceArea = document.createElement('div')
    priceArea.className = 'tlk-hidden-label__price-area'

    if (hasDiscount) {
      const orig = document.createElement('span')
      orig.className = 'tlk-hidden-label__original-price'
      orig.textContent = originalText
      priceArea.appendChild(orig)
    }

    if (finalText) {
      const price = document.createElement('span')
      price.className = 'tlk-hidden-label__price'
      price.textContent = finalText
      priceArea.appendChild(price)
    }

    label.appendChild(priceArea)

    // <tr> cart rows only accept <td>/<th> children — wrap the label in a <td>
    // that spans the full row so the injected content renders as valid HTML.
    if (cartElement.tagName === 'TR') {
      const cellCount = cartElement.querySelectorAll(':scope > td, :scope > th').length || 1
      const wrapper = document.createElement('td')
      wrapper.className = 'tlk-hidden-label-cell'
      wrapper.colSpan = cellCount
      wrapper.appendChild(label)
      cartElement.appendChild(wrapper)
    } else {
      cartElement.appendChild(label)
    }
  }

  /**
   * Format a price in cents using Shopify's native money format for consistency.
   * Checks multiple locations where themes store the money format string.
   */
  private formatPrice(amountInCents: number): string {
    const win = window as unknown as ShopifyWindow
    const shopify = win.Shopify
    const theme = win.theme
    let result: string

    // Try Shopify.formatMoney first (built-in utility in many themes)
    if (typeof shopify?.formatMoney === 'function') {
      const format = theme?.moneyFormat || theme?.strings?.moneyFormat || shopify?.money_format
      result = shopify.formatMoney(amountInCents, format) as string
    } else {
      // Manual format using the theme's money_format string
      const format
        = theme?.moneyFormat
        || theme?.strings?.moneyFormat
        || shopify?.money_format
        || win.__onetick_store__?.money_format
      if (format) {
        result = this.applyMoneyFormat(amountInCents, format)
      } else {
        // Last resort fallback
        const currency = shopify?.currency?.active || 'USD'
        try {
          result = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountInCents / 100)
        } catch {
          result = `${currency} ${(amountInCents / 100).toFixed(2)}`
        }
      }
    }

    // Strip HTML tags — format strings may contain markup like <span class="...">
    return result.replace(/<[^>]*>/g, '')
  }

  /**
   * Apply Shopify money format template to cents value.
   * Mirrors Shopify's formatMoney logic.
   */
  private applyMoneyFormat(cents: number, format: string): string {
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/
    const match = format.match(placeholderRegex)
    if (!match) return (cents / 100).toFixed(2)

    const formatWithDelimiters = (amount: number, precision: number, thousands: string, decimal: string) => {
      const num = (amount / 100).toFixed(precision)
      const parts = num.split('.')
      const dollars = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousands}`)
      return parts[1] ? dollars + decimal + parts[1] : dollars
    }

    let value: string
    switch (match[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2, ',', '.')
        break
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0, ',', '.')
        break
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',')
        break
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',')
        break
      case 'amount_with_space_separator':
        value = formatWithDelimiters(cents, 2, ' ', ',')
        break
      case 'amount_no_decimals_with_space_separator':
        value = formatWithDelimiters(cents, 0, ' ', '')
        break
      default:
        value = formatWithDelimiters(cents, 2, ',', '.')
        break
    }
    return format.replace(placeholderRegex, value)
  }

  /**
   * Debug logging
   */
  private log(...args: unknown[]): void {
    if (this.config.debugMode) {
      console.log('[TailorKit Cart Manager]', ...args)
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    if (this.styleElement) {
      this.styleElement.remove()
      this.styleElement = null
    }
  }

  /**
   * Destroy the manager
   */
  public destroy(): void {
    this.cleanup()
    this.isInitialized = false
    CartHiddenProductManager.instance = null
  }
}

/**
 * Initialize cart hidden product manager with custom config
 */
export function initializeCartHiddenProductManager(
  config?: Partial<CartHiddenProductConfig>
): CartHiddenProductManager {
  return CartHiddenProductManager.getInstance(config)
}
