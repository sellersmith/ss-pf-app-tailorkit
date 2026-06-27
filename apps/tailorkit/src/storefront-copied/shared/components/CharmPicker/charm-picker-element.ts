import type {
  StorefrontCharmConfig,
  CharmProductFullData,
  CharmChangeDetail,
  CharmSelection,
  CharmFetchDiagnostic,
} from './charm-picker-types'
import { charmPickerStyles } from './charm-picker-styles'
import {
  getCustomerCurrencyInfo,
  getCurrencySymbol,
  formatCustomerPrice,
} from '../../../assets/utils/storefront-pricing'
import { fetchCharmProducts } from './charm-picker-data'

/** Source of truth for charm change event name. Also inlined in product-personalizer.ts (keep in sync). */
export const CHARM_CHANGE_EVENT = 'tailorkit-charm-change'

/**
 * <tailorkit-charm-picker> Web Component
 *
 * Metafield stores only stable IDs (productId, variantId).
 * ALL display data (title, price, thumbnail, availability) is fetched
 * at runtime from the Storefront API — same pattern as the hidden pricing product.
 *
 * Supports `data-prefetched-products` attribute for admin preview context
 * where Storefront API is unavailable. When set, skips fetch and renders directly.
 *
 * Lifecycle: parse config → check prefetch → render loading → fetch products → render full UI.
 */
export class CharmPickerElement extends HTMLElement {
  private config: StorefrontCharmConfig | null = null
  private quantities: Map<string, number> = new Map()
  /** Full product data fetched at runtime (keyed by _id) */
  private products: Map<string, CharmProductFullData> = new Map()
  private activeTab: string | null = null
  private printAreaId = ''
  private mounted = false
  private loading = true
  private fetchError = false
  /** Last fetch diagnostic — surfaced in the error UI to help support/merchants identify the cause */
  private fetchDiagnostic: CharmFetchDiagnostic | null = null
  /** Bound handler for document-level charm-removed events (canvas X delete) */
  private _onCharmRemoved: ((e: Event) => void) | null = null
  /** Bound handler for charm state sync events (undo/redo) */
  private _onCharmStateSync: ((e: Event) => void) | null = null

  /** Observed attributes for dynamic updates (admin preview re-renders) */
  static get observedAttributes() {
    return ['data-prefetched-products', 'data-charm-config']
  }

  connectedCallback() {
    if (this.mounted) return
    this.parseConfig()
    this.injectStyles()
    this.mounted = true

    // Listen for charm removal from canvas X button (dispatched by deleteLayer)
    this._onCharmRemoved = (e: Event) => {
      const { productId } = (e as CustomEvent<{ productId: string }>).detail
      const product = this.config?.products.find(p => p.productId === productId)
      if (!product) return
      this.handleDecrement(product._id)
    }
    document.addEventListener('tailorkit-charm-removed', this._onCharmRemoved)

    // Listen for charm state sync (undo/redo restores charm selections)
    this._onCharmStateSync = (e: Event) => {
      const { selections } = (e as CustomEvent<{ selections: CharmSelection[] }>).detail
      this.quantities.clear()
      for (const sel of selections) {
        // Reverse-map Shopify productId → internal _id
        const product = this.config?.products.find(p => p.productId === sel.productId)
        if (product && sel.quantity > 0) {
          this.quantities.set(product._id, sel.quantity)
        }
      }
      this.render()
      // Do NOT dispatchChange() here — undo/redo already has the correct charmState
      // in product-personalizer. Dispatching would create duplicate undo entries.
    }
    document.addEventListener('tailorkit-charm-state-sync', this._onCharmStateSync)

    // Check for pre-fetched products (admin preview context — bypasses Storefront API)
    const hasPrefetched = this.parsePrefetchedProducts()

    // If products loaded (prefetched or cached from previous mount), render immediately
    if (this.products.size > 0) {
      this.loading = false
      // Restore selections from layer store state (survives tab switch) or fall back to defaults
      if (hasPrefetched && !this.restoreSelections()) this.applyDefaults()
      this.render()
      return
    }

    this.loading = true
    this.render()
    this.fetchProducts()
  }

  /** Re-render when observed attributes change (e.g. admin preview updates product data) */
  attributeChangedCallback(name: string) {
    if (!this.mounted) return
    if (name === 'data-prefetched-products') {
      this.parsePrefetchedProducts()
      this.loading = false
      this.applyDefaults()
      this.render()
    }
    if (name === 'data-charm-config') {
      this.parseConfig()
      this.render()
    }
  }

  disconnectedCallback() {
    this.mounted = false
    // Keep products AND quantities cached — don't clear on unmount so
    // charm selections survive modal close/reopen (DOM move = disconnect + reconnect).

    // Clean up document-level listeners
    if (this._onCharmRemoved) {
      document.removeEventListener('tailorkit-charm-removed', this._onCharmRemoved)
      this._onCharmRemoved = null
    }
    if (this._onCharmStateSync) {
      document.removeEventListener('tailorkit-charm-state-sync', this._onCharmStateSync)
      this._onCharmStateSync = null
    }
  }

  /** Fetch full product data from Storefront API */
  private async fetchProducts() {
    if (!this.config?.products.length) {
      this.loading = false
      this.render()
      return
    }
    try {
      const { products, diagnostic } = await fetchCharmProducts(this.config.products)
      if (!this.mounted) return
      this.products = products
      this.fetchDiagnostic = diagnostic
      this.loading = false
      this.fetchError = products.size === 0
      this.applyDefaults()
      this.render()
    } catch (err) {
      if (!this.mounted) return
      this.loading = false
      this.fetchError = true
      this.fetchDiagnostic = {
        reason: 'network-error',
        message: 'An unexpected error occurred while loading charms.',
        context: { error: err instanceof Error ? err.message : String(err) },
      }
      this.render()
    }
  }

  private parseConfig() {
    const raw = this.getAttribute('data-charm-config')
    this.printAreaId = this.getAttribute('data-print-area-id') || ''
    if (!raw) return
    try {
      this.config = JSON.parse(raw)
    } catch {
      this.config = null
    }
  }

  /** Parse pre-fetched products from attribute (admin preview context where Storefront API is unavailable) */
  private parsePrefetchedProducts(): boolean {
    const raw = this.getAttribute('data-prefetched-products')
    if (!raw) return false
    try {
      const products: CharmProductFullData[] = JSON.parse(raw)
      if (!Array.isArray(products) || products.length === 0) return false
      this.products = new Map(products.map(p => [p._id, p]))
      return true
    } catch {
      return false
    }
  }

  /**
   * Restore quantities from layer store state (passed via data-initial-selections).
   * Does NOT dispatch change event — store already has correct state.
   * Returns true if selections were restored, false if attribute is empty/missing.
   */
  private restoreSelections(): boolean {
    const raw = this.getAttribute('data-initial-selections')
    if (!raw) return false
    try {
      const counts: Record<string, number> = JSON.parse(raw)
      const entries = Object.entries(counts)
      // Empty object means "confirmed zero selections" — attribute was explicitly set,
      // so do NOT fall back to applyDefaults(). Return true to skip defaults.
      if (entries.length === 0) return true
      this.quantities.clear()
      for (const [productId, qty] of entries) {
        if (qty > 0) this.quantities.set(productId, qty)
      }
      return true
    } catch {
      return false
    }
  }

  private injectStyles() {
    if (document.getElementById('tlk-charm-picker-styles')) return
    const style = document.createElement('style')
    style.id = 'tlk-charm-picker-styles'
    style.textContent = charmPickerStyles
    document.head.appendChild(style)
  }

  /** Apply default quantities from admin config and dispatch initial change event */
  private applyDefaults() {
    if (!this.config || this.quantities.size > 0) return
    let hasDefaults = false
    const maxCharms = this.config.maxCharms ?? Infinity
    let totalApplied = 0
    for (const product of this.config.products) {
      // products map is keyed by _id (set in fetchCharmProducts), so check _id not productId
      if (product.defaultQuantity && product.defaultQuantity > 0 && this.products.has(product._id)) {
        const productData = this.products.get(product._id)!
        // Skip out-of-stock products
        if (!productData.availableForSale) continue
        // Cap at available inventory (null/undefined = unlimited)
        let qty = product.defaultQuantity
        if (productData.quantityAvailable && productData.quantityAvailable > 0) {
          qty = Math.min(qty, productData.quantityAvailable)
        }
        // Cap at remaining maxCharms budget
        qty = Math.min(qty, maxCharms - totalApplied)
        if (qty > 0) {
          this.quantities.set(product._id, qty)
          totalApplied += qty
          hasDefaults = true
        }
      }
    }
    if (hasDefaults) this.dispatchChange()
  }

  // --- Data helpers ---

  /** Get currency info with admin preview fallback.
   *  In storefront: uses window.Shopify.currency (customer's market currency).
   *  In admin preview: window.Shopify.currency is unavailable, so fall back to
   *  the product's own currencyCode (from the admin API). Rate=1 since prices
   *  are already in the store's base currency. */
  private getEffectiveCurrencyInfo(): { code: string; symbol: string; rate: number } {
    const info = getCustomerCurrencyInfo()
    // If Shopify currency is available (storefront), use it as-is
    if (typeof window !== 'undefined' && window.Shopify?.currency) return info
    // Admin preview fallback: use first product's currencyCode
    const firstProduct = this.products.values().next().value as CharmProductFullData | undefined
    if (firstProduct?.currencyCode) {
      return { code: firstProduct.currencyCode, symbol: getCurrencySymbol(firstProduct.currencyCode), rate: 1 }
    }
    return info
  }

  /** Get enriched products list (only those successfully fetched) */
  private getProducts(): CharmProductFullData[] {
    return Array.from(this.products.values())
  }

  private getFilteredProducts(): CharmProductFullData[] {
    const all = this.getProducts()
    if (!this.activeTab) return all
    return all
  }

  private getCategories(): string[] {
    // Categories come from product tags — future enhancement
    return []
  }

  private getTotalCount(): number {
    let total = 0
    this.quantities.forEach(q => {
      total += q
    })
    return total
  }

  private getTotalCost(): number {
    let cost = 0
    this.quantities.forEach((qty, productId) => {
      const product = this.products.get(productId)
      if (product) cost += (parseFloat(product.price) || 0) * qty
    })
    return cost
  }

  private canIncrement(): boolean {
    if (!this.config) return true
    const total = this.getTotalCount()
    // In FIXED mode, also cap at total slot capacity (prevents overflow when maxCharms > node count)
    if (this.config.displayStyle === 'FIXED' && this.config.nodes?.length) {
      const totalSlotCapacity = this.config.nodes.reduce((sum, n) => sum + (n.slotLimit || 1), 0)
      if (total >= totalSlotCapacity) return false
    }
    if (!this.config.maxCharms) return true
    return total < this.config.maxCharms
  }

  /** Check per-product inventory limit (null = unlimited) */
  private canIncrementProduct(productId: string): boolean {
    const product = this.products.get(productId)
    if (!product || !product.availableForSale) return false
    // null/undefined = inventory not tracked, allow unlimited
    if (product.quantityAvailable === null || product.quantityAvailable === undefined) return true
    const current = this.quantities.get(productId) || 0
    return current < product.quantityAvailable
  }

  // --- Event handlers ---

  private handleIncrement(productId: string) {
    if (!this.canIncrement()) return
    if (!this.canIncrementProduct(productId)) return
    const current = this.quantities.get(productId) || 0
    this.quantities.set(productId, current + 1)
    this.render()
    this.dispatchChange()
  }

  private handleDecrement(productId: string) {
    const current = this.quantities.get(productId) || 0
    if (current <= 0) return
    const next = current - 1
    if (next === 0) this.quantities.delete(productId)
    else this.quantities.set(productId, next)
    this.render()
    this.dispatchChange()
  }

  private handleTabClick(tab: string | null) {
    this.activeTab = tab
    this.render()
  }

  private handleRetry() {
    this.loading = true
    this.fetchError = false
    this.fetchDiagnostic = null
    this.render()
    this.fetchProducts()
  }

  private dispatchChange() {
    if (!this.config) return

    const selections: CharmSelection[] = []
    this.quantities.forEach((quantity, productId) => {
      if (quantity <= 0) return
      const p = this.products.get(productId)
      if (!p) return
      selections.push({
        productId: p.productId,
        // Prefer live variant ID (authoritative from Storefront API)
        variantId: p.liveVariantId || p.variantId,
        title: p.title,
        price: p.price,
        currencyCode: p.currencyCode,
        quantity,
        thumbnailUrl: p.thumbnailUrl,
      })
    })

    const detail: CharmChangeDetail = {
      layerId: this.config.layerId,
      printAreaId: this.printAreaId,
      selections,
      totalCost: this.getTotalCost(),
      totalCount: this.getTotalCount(),
    }

    this.dispatchEvent(new CustomEvent(CHARM_CHANGE_EVENT, { detail, bubbles: true }))
  }

  // --- Rendering ---

  private render() {
    if (!this.config) {
      this.replaceChildren()
      return
    }

    const container = document.createElement('div')
    container.className = 'emtlkit--charm-picker'
    // Prevent clicks from bubbling to parent theme handlers (accordion collapse, etc.)
    container.addEventListener('click', e => e.stopPropagation())

    const currencyInfo = this.getEffectiveCurrencyInfo()
    container.appendChild(this.renderHeader(currencyInfo))

    if (this.loading) {
      container.appendChild(this.renderLoading())
    } else if (this.fetchError) {
      container.appendChild(this.renderError())
    } else {
      const categories = this.getCategories()
      if (categories.length > 0) {
        container.appendChild(this.renderTabs(categories))
      }
      container.appendChild(this.renderGrid(currencyInfo))
    }

    this.replaceChildren(container)
  }

  private renderLoading(): HTMLElement {
    const loading = document.createElement('div')
    loading.className = 'emtlkit--charm-picker-loading'
    loading.textContent = 'Loading charms...'
    return loading
  }

  private renderError(): HTMLElement {
    const error = document.createElement('div')
    error.className = 'emtlkit--charm-picker-error'

    const heading = document.createElement('span')
    heading.textContent = 'Failed to load charms'
    error.appendChild(heading)

    // Surface the diagnostic message so merchants/support can identify the cause
    // without needing to open DevTools (still logged to console for deeper context).
    if (this.fetchDiagnostic?.message) {
      const detail = document.createElement('span')
      detail.className = 'emtlkit--charm-picker-error-detail'
      detail.textContent = this.fetchDiagnostic.message
      error.appendChild(detail)
    }

    const retryBtn = document.createElement('button')
    retryBtn.type = 'button'
    retryBtn.textContent = 'Retry'
    retryBtn.className = 'emtlkit--charm-retry-btn'
    retryBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.handleRetry()
    })
    error.appendChild(retryBtn)

    return error
  }

  private renderHeader(currencyInfo: { code: string; symbol: string; rate: number }): HTMLElement {
    const header = document.createElement('div')
    header.className = 'emtlkit--charm-picker-header'

    const label = document.createElement('span')
    label.className = 'emtlkit--charm-picker-label'
    label.textContent = this.config?.label || 'Add Charms'
    header.appendChild(label)

    const countEl = document.createElement('span')
    countEl.className = 'emtlkit--charm-picker-count'

    const totalCount = this.getTotalCount()
    const totalCost = this.getTotalCost()

    if (totalCount > 0) {
      const costInCustomerCurrency = totalCost * currencyInfo.rate
      const formatted = formatCustomerPrice(costInCustomerCurrency, currencyInfo)
      const charmWord = totalCount === 1 ? 'charm' : 'charms'
      countEl.textContent = `${totalCount} ${charmWord} selected (+${currencyInfo.symbol}${formatted})`
    } else {
      countEl.textContent = 'No charms selected'
    }

    header.appendChild(countEl)
    return header
  }

  private renderTabs(categories: string[]): HTMLElement {
    const tabsContainer = document.createElement('div')
    tabsContainer.className = 'emtlkit--charm-picker-tabs'

    const allTab = document.createElement('button')
    allTab.type = 'button'
    allTab.textContent = 'All'
    if (!this.activeTab) allTab.className = 'emtlkit--active'
    allTab.addEventListener('click', e => {
      e.stopPropagation()
      this.handleTabClick(null)
    })
    tabsContainer.appendChild(allTab)

    for (const cat of categories) {
      const tabBtn = document.createElement('button')
      tabBtn.type = 'button'
      tabBtn.textContent = cat
      if (this.activeTab === cat) tabBtn.className = 'emtlkit--active'
      tabBtn.addEventListener('click', e => {
        e.stopPropagation()
        this.handleTabClick(cat)
      })
      tabsContainer.appendChild(tabBtn)
    }

    return tabsContainer
  }

  private renderGrid(currencyInfo: { code: string; symbol: string; rate: number }): HTMLElement {
    const products = this.getFilteredProducts()

    if (products.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'emtlkit--charm-picker-empty'
      empty.textContent = 'No charms available'
      return empty
    }

    const grid = document.createElement('div')
    grid.className = 'emtlkit--charm-picker-grid'

    for (const product of products) {
      grid.appendChild(this.renderCharmItem(product, currencyInfo))
    }

    return grid
  }

  private renderCharmItem(
    product: CharmProductFullData,
    currencyInfo: { code: string; symbol: string; rate: number }
  ): HTMLElement {
    const qty = this.quantities.get(product._id) || 0
    const available = product.availableForSale

    const item = document.createElement('div')
    item.className = 'emtlkit--charm-item'
    if (qty > 0) item.className += ' emtlkit--selected'
    if (!available) item.className += ' emtlkit--sold-out'

    // Thumbnail
    const thumbWrapper = document.createElement('div')
    thumbWrapper.className = 'emtlkit--charm-thumbnail'
    if (product.thumbnailUrl) {
      const img = document.createElement('img')
      img.src = product.thumbnailUrl
      img.alt = product.title
      img.loading = 'lazy'
      img.width = 80
      img.height = 80
      thumbWrapper.appendChild(img)
    }
    if (available) {
      thumbWrapper.addEventListener('click', e => {
        e.stopPropagation()
        this.handleIncrement(product._id)
      })
    }
    item.appendChild(thumbWrapper)

    // Sold-out badge
    if (!available) {
      const badge = document.createElement('span')
      badge.className = 'emtlkit--charm-sold-out-badge'
      badge.textContent = 'Sold out'
      item.appendChild(badge)
    }

    // Title (with tooltip for truncated names)
    const title = document.createElement('span')
    title.className = 'emtlkit--charm-title'
    title.textContent = product.title
    title.title = product.title
    item.appendChild(title)

    // Price
    const priceEl = document.createElement('span')
    priceEl.className = 'emtlkit--charm-price'
    const priceInCustomerCurrency = (parseFloat(product.price) || 0) * currencyInfo.rate
    const formattedPrice = formatCustomerPrice(priceInCustomerCurrency, currencyInfo)

    if (product.compareAtPrice) {
      const compareAt = parseFloat(product.compareAtPrice) || 0
      if (compareAt > 0) {
        const formattedCompare = formatCustomerPrice(compareAt, currencyInfo)
        priceEl.innerHTML = ''
        const saleSpan = document.createElement('span')
        saleSpan.className = 'emtlkit--charm-sale-price'
        saleSpan.textContent = `${currencyInfo.symbol}${formattedPrice}`
        const compareSpan = document.createElement('span')
        compareSpan.className = 'emtlkit--charm-compare-price'
        compareSpan.textContent = `${currencyInfo.symbol}${formattedCompare}`
        priceEl.appendChild(saleSpan)
        priceEl.appendChild(document.createTextNode(' '))
        priceEl.appendChild(compareSpan)
      } else {
        priceEl.textContent = `${currencyInfo.symbol}${formattedPrice}`
      }
    } else {
      priceEl.textContent = `${currencyInfo.symbol}${formattedPrice}`
    }
    item.appendChild(priceEl)

    // Stepper
    item.appendChild(this.renderStepper(product._id, qty, available))

    return item
  }

  private renderStepper(productId: string, qty: number, available = true): HTMLElement {
    const stepper = document.createElement('div')
    stepper.className = 'emtlkit--charm-stepper'

    const minusBtn = document.createElement('button')
    minusBtn.type = 'button'
    minusBtn.className = 'emtlkit--charm-stepper-btn'
    minusBtn.textContent = '-'
    minusBtn.disabled = qty === 0 || !available
    minusBtn.setAttribute('aria-label', 'Remove one charm')
    minusBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.handleDecrement(productId)
    })
    stepper.appendChild(minusBtn)

    const countSpan = document.createElement('span')
    countSpan.className = 'emtlkit--charm-stepper-count'
    countSpan.textContent = String(qty)
    stepper.appendChild(countSpan)

    const plusBtn = document.createElement('button')
    plusBtn.type = 'button'
    plusBtn.className = 'emtlkit--charm-stepper-btn'
    plusBtn.textContent = '+'
    plusBtn.disabled = !this.canIncrement() || !this.canIncrementProduct(productId)
    plusBtn.setAttribute('aria-label', 'Add one charm')
    plusBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.handleIncrement(productId)
    })
    stepper.appendChild(plusBtn)

    return stepper
  }
}
