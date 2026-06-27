/**
 * Product Picker Manager (Orchestrator)
 *
 * Main Web Component `<tailorkit-product-picker>` that:
 * 1. Parses PreparedProductPickerData from `data-layer` attribute
 * 2. Creates ProductPickerStateManager
 * 3. Registers state manager for canvas rendering
 * 4. Creates and wires child components (catalog, price display, controls)
 * 5. On selection change: updates fieldset, injects items[] into ATC forms,
 *    triggers canvas re-render via Transmitter
 */

import { ProductPickerStateManager } from './product-picker-state'
import {
  registerProductPickerStateManager,
  unregisterProductPickerStateManager,
} from './product-canvas-renderer'
import {
  buildProductPickerCartItems,
  injectProductPickerItemsIntoForm,
  clearProductPickerItemsFromForm,
  validateProductPickerSelection,
} from './product-picker-cart'
import { Transmitter } from '../../libraries/transmitter'
import { TransmitterEvents } from '../../constants/transmitter-events'
import { PROPERTY_PREFIX } from '../../constants'

// Import child component registrations (side-effects only)
import './product-catalog'
import './product-price-display'
import './product-picker-controls'

// Import styles
import './styles/product-picker.css'

export class TailorKitProductPicker extends HTMLElement {
  private stateManager: ProductPickerStateManager | null = null
  private unsubscribe: (() => void) | null = null
  private layerId = ''
  private printAreaId = ''

  connectedCallback(): void {
    this.layerId = this.getAttribute('data-layer-id') || ''
    this.printAreaId = this.getAttribute('data-print-area-id') || ''

    const layerJson = this.getAttribute('data-layer')
    if (!layerJson) {
      console.warn('[TailorKit ProductPicker] Missing data-layer attribute')
      return
    }

    let layerData: any
    try {
      layerData = JSON.parse(layerJson)
    } catch {
      console.error('[TailorKit ProductPicker] Invalid data-layer JSON')
      return
    }

    const ppd = layerData.ppd
    if (!ppd) {
      console.warn('[TailorKit ProductPicker] No ppd (PreparedProductPickerData) on layer')
      return
    }

    // Create state manager
    this.stateManager = new ProductPickerStateManager(ppd)

    // Register for canvas rendering
    if (this.layerId) {
      registerProductPickerStateManager(this.layerId, this.stateManager)
    }

    // Build UI
    this.buildUI()

    // Subscribe to state changes
    this.unsubscribe = this.stateManager.subscribe(() => this.onSelectionChange())

    // Initial canvas render
    this.triggerCanvasRender()
  }

  disconnectedCallback(): void {
    this.unsubscribe?.()
    this.unsubscribe = null

    if (this.layerId) {
      unregisterProductPickerStateManager(this.layerId)
    }

    // Clean up items from ATC forms
    this.getAtcForms().forEach(form => clearProductPickerItemsFromForm(form))

    this.stateManager = null
  }

  // ─── UI Construction ──────────────────────────────────────────

  private buildUI(): void {
    if (!this.stateManager) return

    // Catalog
    const catalog = document.createElement('tailorkit-product-catalog') as any
    this.appendChild(catalog)
    catalog.setStateManager(this.stateManager)

    // Controls
    const controls = document.createElement('tailorkit-product-picker-controls') as any
    this.appendChild(controls)
    controls.setStateManager(this.stateManager)

    // Price display
    const priceDisplay = document.createElement('tailorkit-product-price-display') as any
    this.appendChild(priceDisplay)
    priceDisplay.setStateManager(this.stateManager)
  }

  // ─── State Change Handler ─────────────────────────────────────

  private onSelectionChange(): void {
    if (!this.stateManager) return

    // 1. Update parent fieldset value attribute with selection summary
    this.updateFieldsetValue()

    // 2. Inject items[] into ATC forms
    this.injectCartItems()

    // 3. Trigger canvas re-render
    this.triggerCanvasRender()
  }

  private updateFieldsetValue(): void {
    if (!this.stateManager) return

    const fieldset = this.closest('fieldset')
    if (!fieldset) return

    const assignments = this.stateManager.getSlotAssignments()
    const summary = assignments.map(a => `${a.product.t} x${a.quantity}`).join(', ')
    fieldset.setAttribute('value', summary || '')
  }

  private injectCartItems(): void {
    if (!this.stateManager) return

    const forms = this.getAtcForms()
    if (forms.length === 0) return

    // Get current ref_id from the form
    const refIdInput = forms[0].querySelector(
      `input[data-name="${PROPERTY_PREFIX}_ref_id"]`
    ) as HTMLInputElement | null
    const refId = refIdInput?.value || ''

    // Get product name
    const nameInput = forms[0].querySelector(
      `input[data-name="${PROPERTY_PREFIX}_product_name"]`
    ) as HTMLInputElement | null
    const productName = nameInput?.value || ''

    const items = buildProductPickerCartItems(this.stateManager, refId, productName)

    forms.forEach(form => {
      injectProductPickerItemsIntoForm(form, items)
    })
  }

  private triggerCanvasRender(): void {
    Transmitter.trigger(TransmitterEvents.SET_OPTIONS)
  }

  // ─── Validation (called by FormManager) ───────────────────────

  /**
   * Public method for FormManager to call during validation chain.
   * Returns `{ isValid, reason }`.
   */
  getValidation(): { isValid: boolean; reason?: string } {
    if (!this.stateManager) return { isValid: true }
    return validateProductPickerSelection(this.stateManager)
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private getAtcForms(): HTMLFormElement[] {
    return Array.from(document.querySelectorAll<HTMLFormElement>(
      'form[action*="/cart/add"]'
    ))
  }
}

customElements.define('tailorkit-product-picker', TailorKitProductPicker)
