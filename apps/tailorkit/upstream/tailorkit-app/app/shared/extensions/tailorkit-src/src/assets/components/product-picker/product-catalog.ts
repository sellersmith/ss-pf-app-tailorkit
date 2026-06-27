/**
 * Product Catalog Web Component
 *
 * Renders a browsable product grid with collection tabs, tag filtering,
 * search, and product cards. Handles product selection and quantity controls.
 */

import type { ProductPickerStateManager, ProductPickerProduct, ProductPickerState } from './product-picker-state'
import { formatCustomerPrice, CURRENCY_MAP } from '../../utils/storefront-pricing'
import { APP_PROXY_PATH } from '../../constants'

// prettier-ignore
const SEARCH_ICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"',
  ' viewBox="0 0 24 24" fill="none" stroke="currentColor"',
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
  '<circle cx="11" cy="11" r="8"></circle>',
  '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
  '</svg>',
].join('')

export class TailorKitProductCatalog extends HTMLElement {
  private stateManager!: ProductPickerStateManager
  private unsubscribe: (() => void) | null = null
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private loadingMore = false

  setStateManager(manager: ProductPickerStateManager): void {
    this.stateManager = manager
    this.unsubscribe = manager.subscribe(state => this.onStateChange(state))
    this.render()
  }

  disconnectedCallback(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer)
  }

  private onStateChange(_state: ProductPickerState): void {
    this.render()
  }

  private render(): void {
    if (!this.stateManager) return
    const state = this.stateManager.getState()

    this.innerHTML = ''

    // Tabs
    if (state.collections.length > 1) {
      this.appendChild(this.buildTabs(state))
    }

    // Search bar
    if (state.displaySettings.showSearchBar) {
      this.appendChild(this.buildSearchBar(state))
    }

    // Tag filter
    if (state.displaySettings.filterByTags) {
      const tags = this.stateManager.getAllTags()
      if (tags.length > 0) {
        this.appendChild(this.buildTagFilter(tags, state.filterTag))
      }
    }

    // Product grid
    const products = this.stateManager.getFilteredProducts()
    if (products.length > 0) {
      this.appendChild(this.buildProductGrid(products, state))
    } else {
      this.appendChild(this.buildEmptyState())
    }

    // Load more button
    const activeCollection = this.stateManager.getActiveCollection()
    if (activeCollection?.hasMore) {
      this.appendChild(this.buildLoadMore())
    }
  }

  // ─── Tabs ────────────────────────────────────────────────────

  private buildTabs(state: ProductPickerState): HTMLElement {
    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-tabs'

    state.collections.forEach(collection => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.className = 'emtlkit--product-picker-tab'
      if (collection.id === state.activeCollectionId) {
        tab.classList.add('emtlkit--product-picker-tab--active')
      }
      tab.textContent = collection.title
      tab.addEventListener('click', () => this.stateManager.setActiveCollection(collection.id))
      container.appendChild(tab)
    })

    return container
  }

  // ─── Search ──────────────────────────────────────────────────

  private buildSearchBar(state: ProductPickerState): HTMLElement {
    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-search'

    const icon = document.createElement('span')
    icon.className = 'emtlkit--product-picker-search-icon'
    icon.innerHTML = SEARCH_ICON_SVG
    container.appendChild(icon)

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Search products...'
    input.value = state.searchQuery
    input.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer)
      this.searchDebounceTimer = setTimeout(() => {
        this.stateManager.setSearchQuery(value)
      }, 250)
    })
    container.appendChild(input)

    return container
  }

  // ─── Tag Filter ──────────────────────────────────────────────

  private buildTagFilter(tags: string[], activeTag: string | null): HTMLElement {
    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-tag-filter'

    // "All" chip
    const allChip = document.createElement('button')
    allChip.type = 'button'
    allChip.className = 'emtlkit--product-picker-tag'
    if (!activeTag) allChip.classList.add('emtlkit--product-picker-tag--active')
    allChip.textContent = 'All'
    allChip.addEventListener('click', () => this.stateManager.setFilterTag(null))
    container.appendChild(allChip)

    tags.forEach(tag => {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'emtlkit--product-picker-tag'
      if (tag === activeTag) chip.classList.add('emtlkit--product-picker-tag--active')
      chip.textContent = tag
      chip.addEventListener('click', () => this.stateManager.setFilterTag(tag === activeTag ? null : tag))
      container.appendChild(chip)
    })

    return container
  }

  // ─── Product Grid ────────────────────────────────────────────

  private buildProductGrid(products: ProductPickerProduct[], state: ProductPickerState): HTMLElement {
    const grid = document.createElement('div')
    grid.className = 'emtlkit--product-picker-grid'
    grid.style.setProperty('--pp-columns', String(state.displaySettings.columns))

    products.forEach(product => {
      grid.appendChild(this.buildProductCard(product, state))
    })

    return grid
  }

  private buildProductCard(product: ProductPickerProduct, state: ProductPickerState): HTMLElement {
    const card = document.createElement('div')
    card.className = 'emtlkit--product-picker-card'

    const isSelected = this.stateManager.isProductSelected(product.vid)
    if (isSelected) card.classList.add('emtlkit--product-picker-card--selected')
    if (!product.avl) card.classList.add('emtlkit--product-picker-card--out-of-stock')

    // Image
    const img = document.createElement('img')
    img.className = 'emtlkit--product-picker-card__image'
    img.src = product.img
    img.alt = product.t
    img.loading = 'lazy'
    card.appendChild(img)

    // Info section
    const info = document.createElement('div')
    info.className = 'emtlkit--product-picker-card__info'

    const title = document.createElement('p')
    title.className = 'emtlkit--product-picker-card__title'
    title.textContent = product.t
    info.appendChild(title)

    // Price
    if (state.displaySettings.showPrice) {
      const price = document.createElement('p')
      price.className = 'emtlkit--product-picker-card__price'
      price.textContent = this.formatPrice(product.p)
      info.appendChild(price)
    }

    card.appendChild(info)

    // Stock badge
    if (!product.avl && state.displaySettings.showStockBadge) {
      const badge = document.createElement('span')
      badge.className = 'emtlkit--product-picker-card__stock-badge'
      badge.textContent = 'Sold out'
      card.appendChild(badge)
    }

    // Selected check with quantity
    if (isSelected) {
      const qty = this.stateManager.getProductQuantity(product.vid)
      const check = document.createElement('span')
      check.className = 'emtlkit--product-picker-card__check'
      check.textContent = String(qty)
      card.appendChild(check)
    }

    // Quantity controls (shown when selected and quantity mode enabled)
    if (isSelected && state.displaySettings.showQuantityControl && state.selectionRules.allowQuantity) {
      const slot = this.stateManager.getSlotForProduct(product.vid)
      if (slot) {
        info.appendChild(this.buildQuantityControls(slot.slotIndex, slot.quantity))
      }
    }

    // Click handler
    if (product.avl) {
      card.addEventListener('click', (e) => {
        // Don't trigger selection if clicking quantity controls
        if ((e.target as HTMLElement).closest('.emtlkit--product-picker-qty')) return

        if (isSelected && !state.selectionRules.allowQuantity) {
          this.stateManager.removeProductByVid(product.vid)
        } else {
          this.stateManager.selectProduct(product)
        }
      })
    }

    return card
  }

  // ─── Quantity Controls ───────────────────────────────────────

  private buildQuantityControls(slotIndex: number, currentQty: number): HTMLElement {
    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-qty'

    const minusBtn = document.createElement('button')
    minusBtn.type = 'button'
    minusBtn.textContent = '-'
    minusBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.stateManager.setQuantity(slotIndex, currentQty - 1)
    })
    container.appendChild(minusBtn)

    const qtyLabel = document.createElement('span')
    qtyLabel.textContent = String(currentQty)
    container.appendChild(qtyLabel)

    const plusBtn = document.createElement('button')
    plusBtn.type = 'button'
    plusBtn.textContent = '+'
    plusBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.stateManager.setQuantity(slotIndex, currentQty + 1)
    })
    container.appendChild(plusBtn)

    return container
  }

  // ─── Load More ───────────────────────────────────────────────

  private buildLoadMore(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-load-more'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = this.loadingMore ? 'Loading...' : 'Load more'
    btn.disabled = this.loadingMore
    btn.addEventListener('click', () => this.handleLoadMore())
    container.appendChild(btn)

    return container
  }

  private async handleLoadMore(): Promise<void> {
    const collection = this.stateManager.getActiveCollection()
    if (!collection || !collection.hasMore || this.loadingMore) return

    this.loadingMore = true
    this.render()

    try {
      const response = await fetch(`${APP_PROXY_PATH}?action=get-product-picker-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: collection.tp,
          sourceId: collection.id,
          cursor: collection.endCursor || null,
          limit: 20,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const json = await response.json()
      if (json.success && json.data) {
        this.stateManager.appendProducts(
          collection.id,
          json.data.products || [],
          json.data.pageInfo?.hasNextPage || false,
          json.data.pageInfo?.endCursor
        )
      }
    } catch (error) {
      console.error('[TailorKit ProductCatalog] Error loading more products:', error)
    } finally {
      this.loadingMore = false
    }
  }

  // ─── Empty State ─────────────────────────────────────────────

  private buildEmptyState(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'emtlkit--product-picker-empty'
    div.textContent = 'No products found'
    return div
  }

  // ─── Price Formatting ────────────────────────────────────────

  private formatPrice(priceStr: string): string {
    const amount = parseFloat(priceStr)
    if (isNaN(amount)) return priceStr
    const currencyCode = window.Shopify?.currency?.active || 'USD'
    const symbol = (CURRENCY_MAP as Record<string, { symbol: string }>)[currencyCode]?.symbol || '$'
    const formatted = formatCustomerPrice(amount, { code: currencyCode })
    return `${symbol}${formatted}`
  }
}

customElements.define('tailorkit-product-catalog', TailorKitProductCatalog)
