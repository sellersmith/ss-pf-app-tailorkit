/**
 * Product Picker State Manager
 *
 * Central state store for the product picker element.
 * Parses PreparedProductPickerData from the layer metafield and manages
 * selection state, filtering, and computed values.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface ProductPickerProduct {
  pid: string
  vid: string
  t: string
  img: string
  p: string
  avl: boolean
  tags: string[]
}

export interface ProductPickerCollection {
  id: string
  tp: 'collection' | 'product'
  title: string
  products: ProductPickerProduct[]
  hasMore: boolean
  total: number
  endCursor?: string
}

export interface SlotPosition {
  si: number
  l: number
  tp: number
  w: number
  h: number
}

export interface SlotAssignment {
  slotIndex: number
  product: ProductPickerProduct
  quantity: number
}

export interface SelectionRules {
  mode: 'single' | 'multi'
  required: boolean
  min: number
  max: number
  allowQuantity: boolean
  maxQuantityPerProduct: number
}

export interface DisplaySettings {
  layout: 'grid' | 'list' | 'swatches'
  columns: number
  showPrice: boolean
  showStockBadge: boolean
  filterByTags: boolean
  showSearchBar: boolean
  showQuantityControl: boolean
}

export interface ControlSettings {
  showRandomize: boolean
  showReset: boolean
  showRunningTotal: boolean
  showItemCount: boolean
  allowReorder: boolean
}

export interface ProductPickerState {
  collections: ProductPickerCollection[]
  selectionRules: SelectionRules
  slotPositions: SlotPosition[]
  previewEnabled: boolean
  displaySettings: DisplaySettings
  controlSettings: ControlSettings
  slots: SlotAssignment[]
  activeCollectionId: string | null
  filterTag: string | null
  searchQuery: string
}

// ─── Prepared Data Types (from Track 3 contract) ────────────────────

interface PreparedProductPickerData {
  t: 'product-picker'
  src: Array<{
    id: string
    tp: 'collection' | 'product'
    title: string
    products: ProductPickerProduct[]
    hasMore: boolean
    total: number
  }>
  sel: { m: 'single' | 'multi'; req: boolean; min: number; max: number; qty: boolean; mqpp: number }
  prv: { en: boolean; pos: SlotPosition[] }
  dsp: {
    ly: 'grid' | 'list' | 'swatches'
    cols: number
    price: boolean
    stock: boolean
    tags: boolean
    search: boolean
    qtyCtrl: boolean
  }
  ctrl: { rand: boolean; reset: boolean; total: boolean; count: boolean; reorder: boolean }
}

type StateListener = (state: ProductPickerState) => void

// ─── State Manager ───────────────────────────────────────────────────

export class ProductPickerStateManager {
  private state: ProductPickerState
  private listeners: Set<StateListener> = new Set()

  constructor(ppd: PreparedProductPickerData) {
    this.state = {
      collections: ppd.src.map(s => ({
        id: s.id,
        tp: s.tp,
        title: s.title,
        products: s.products || [],
        hasMore: s.hasMore || false,
        total: s.total || s.products?.length || 0,
      })),
      selectionRules: {
        mode: ppd.sel.m,
        required: ppd.sel.req,
        min: ppd.sel.min,
        max: ppd.sel.max,
        allowQuantity: ppd.sel.qty,
        maxQuantityPerProduct: ppd.sel.mqpp,
      },
      slotPositions: ppd.prv.pos || [],
      previewEnabled: ppd.prv.en,
      displaySettings: {
        layout: ppd.dsp.ly,
        columns: ppd.dsp.cols,
        showPrice: ppd.dsp.price,
        showStockBadge: ppd.dsp.stock,
        filterByTags: ppd.dsp.tags,
        showSearchBar: ppd.dsp.search,
        showQuantityControl: ppd.dsp.qtyCtrl,
      },
      controlSettings: {
        showRandomize: ppd.ctrl.rand,
        showReset: ppd.ctrl.reset,
        showRunningTotal: ppd.ctrl.total,
        showItemCount: ppd.ctrl.count,
        allowReorder: ppd.ctrl.reorder,
      },
      slots: [],
      activeCollectionId: ppd.src[0]?.id || null,
      filterTag: null,
      searchQuery: '',
    }
  }

  getState(): ProductPickerState {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const snapshot = this.state
    this.listeners.forEach(fn => fn(snapshot))
  }

  // ─── Mutations ──────────────────────────────────────────────────

  selectProduct(product: ProductPickerProduct): boolean {
    if (!product.avl) return false
    if (!this.canAddMore()) return false

    if (this.state.selectionRules.mode === 'single') {
      this.state = { ...this.state, slots: [{ slotIndex: 0, product, quantity: 1 }] }
      this.notify()
      return true
    }

    // Check if product already selected and quantity allowed
    const existingSlot = this.state.slots.find(s => s.product.vid === product.vid)
    if (existingSlot && this.state.selectionRules.allowQuantity) {
      const mqpp = this.state.selectionRules.maxQuantityPerProduct
      if (mqpp > 0 && existingSlot.quantity >= mqpp) return false
      this.state = {
        ...this.state,
        slots: this.state.slots.map(s =>
          s.product.vid === product.vid ? { ...s, quantity: s.quantity + 1 } : s
        ),
      }
      this.notify()
      return true
    }

    if (existingSlot && !this.state.selectionRules.allowQuantity) return false

    const nextSlotIndex = this.getAvailableSlotIndex()
    if (nextSlotIndex === null) return false

    this.state = {
      ...this.state,
      slots: [...this.state.slots, { slotIndex: nextSlotIndex, product, quantity: 1 }],
    }
    this.notify()
    return true
  }

  removeProduct(slotIndex: number): void {
    this.state = {
      ...this.state,
      slots: this.state.slots.filter(s => s.slotIndex !== slotIndex),
    }
    this.notify()
  }

  removeProductByVid(vid: string): void {
    this.state = {
      ...this.state,
      slots: this.state.slots.filter(s => s.product.vid !== vid),
    }
    this.notify()
  }

  setQuantity(slotIndex: number, qty: number): void {
    if (qty <= 0) {
      this.removeProduct(slotIndex)
      return
    }
    const mqpp = this.state.selectionRules.maxQuantityPerProduct
    const clampedQty = mqpp > 0 ? Math.min(qty, mqpp) : qty
    this.state = {
      ...this.state,
      slots: this.state.slots.map(s => (s.slotIndex === slotIndex ? { ...s, quantity: clampedQty } : s)),
    }
    this.notify()
  }

  setActiveCollection(collectionId: string): void {
    this.state = { ...this.state, activeCollectionId: collectionId }
    this.notify()
  }

  setFilterTag(tag: string | null): void {
    this.state = { ...this.state, filterTag: tag }
    this.notify()
  }

  setSearchQuery(query: string): void {
    this.state = { ...this.state, searchQuery: query }
    this.notify()
  }

  randomize(): void {
    const allProducts = this.getAllAvailableProducts()
    if (allProducts.length === 0) return

    const maxSlots = this.getMaxSlots()
    const shuffled = [...allProducts].sort(() => Math.random() - 0.5)
    const newSlots: SlotAssignment[] = []

    for (let i = 0; i < Math.min(shuffled.length, maxSlots); i++) {
      newSlots.push({ slotIndex: i, product: shuffled[i], quantity: 1 })
    }

    this.state = { ...this.state, slots: newSlots }
    this.notify()
  }

  reset(): void {
    this.state = { ...this.state, slots: [] }
    this.notify()
  }

  reorderSlot(fromIndex: number, toIndex: number): void {
    const slots = [...this.state.slots]
    const fromSlot = slots.find(s => s.slotIndex === fromIndex)
    const toSlot = slots.find(s => s.slotIndex === toIndex)
    if (!fromSlot) return

    if (toSlot) {
      // Swap
      fromSlot.slotIndex = toIndex
      toSlot.slotIndex = fromIndex
    } else {
      fromSlot.slotIndex = toIndex
    }

    this.state = { ...this.state, slots }
    this.notify()
  }

  appendProducts(sourceId: string, products: ProductPickerProduct[], hasMore: boolean, endCursor?: string): void {
    this.state = {
      ...this.state,
      collections: this.state.collections.map(c => {
        if (c.id !== sourceId) return c
        const existingPids = new Set(c.products.map(p => p.pid))
        const newProducts = products.filter(p => !existingPids.has(p.pid))
        return { ...c, products: [...c.products, ...newProducts], hasMore, endCursor }
      }),
    }
    this.notify()
  }

  // ─── Computed ───────────────────────────────────────────────────

  getTotalPrice(): number {
    return this.state.slots.reduce((sum, slot) => {
      const price = parseFloat(slot.product.p) || 0
      return sum + price * slot.quantity
    }, 0)
  }

  getSelectionCount(): number {
    return this.state.slots.reduce((sum, slot) => sum + slot.quantity, 0)
  }

  isSelectionValid(): boolean {
    const count = this.getSelectionCount()
    const { required, min, max } = this.state.selectionRules
    if (required && count === 0) return false
    if (min > 0 && count < min) return false
    if (max > 0 && count > max) return false
    return true
  }

  canAddMore(): boolean {
    const { max } = this.state.selectionRules
    if (max <= 0) return true
    return this.getSelectionCount() < max
  }

  getAvailableSlotIndex(): number | null {
    const usedIndices = new Set(this.state.slots.map(s => s.slotIndex))
    const maxSlots = this.getMaxSlots()
    for (let i = 0; i < maxSlots; i++) {
      if (!usedIndices.has(i)) return i
    }
    return null
  }

  getFilteredProducts(): ProductPickerProduct[] {
    const { activeCollectionId, filterTag, searchQuery } = this.state
    const collection = this.state.collections.find(c => c.id === activeCollectionId)
    if (!collection) return []

    let products = collection.products

    if (filterTag) {
      products = products.filter(p => p.tags.includes(filterTag))
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      products = products.filter(p => p.t.toLowerCase().includes(query))
    }

    return products
  }

  getSlotAssignments(): SlotAssignment[] {
    return [...this.state.slots].sort((a, b) => a.slotIndex - b.slotIndex)
  }

  isProductSelected(vid: string): boolean {
    return this.state.slots.some(s => s.product.vid === vid)
  }

  getProductQuantity(vid: string): number {
    const slot = this.state.slots.find(s => s.product.vid === vid)
    return slot?.quantity || 0
  }

  getSlotForProduct(vid: string): SlotAssignment | undefined {
    return this.state.slots.find(s => s.product.vid === vid)
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>()
    const collection = this.state.collections.find(c => c.id === this.state.activeCollectionId)
    if (collection) {
      collection.products.forEach(p => p.tags?.forEach(tag => tagSet.add(tag)))
    }
    return Array.from(tagSet).sort()
  }

  getActiveCollection(): ProductPickerCollection | undefined {
    return this.state.collections.find(c => c.id === this.state.activeCollectionId)
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private getMaxSlots(): number {
    const { max } = this.state.selectionRules
    const slotCount = this.state.slotPositions.length
    if (max > 0 && slotCount > 0) return Math.min(max, slotCount)
    if (max > 0) return max
    if (slotCount > 0) return slotCount
    return 100 // Effectively unlimited
  }

  private getAllAvailableProducts(): ProductPickerProduct[] {
    const products: ProductPickerProduct[] = []
    const seen = new Set<string>()
    for (const collection of this.state.collections) {
      for (const product of collection.products) {
        if (product.avl && !seen.has(product.vid)) {
          products.push(product)
          seen.add(product.vid)
        }
      }
    }
    return products
  }
}
