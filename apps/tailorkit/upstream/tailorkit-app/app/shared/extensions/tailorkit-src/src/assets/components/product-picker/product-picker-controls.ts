/**
 * Product Picker Controls Web Component
 *
 * Provides randomize, reset, and item counter controls.
 * Only renders controls that are enabled via controlSettings.
 */

import type { ProductPickerStateManager, ProductPickerState } from './product-picker-state'

export class TailorKitProductPickerControls extends HTMLElement {
  private stateManager!: ProductPickerStateManager
  private unsubscribe: (() => void) | null = null

  setStateManager(manager: ProductPickerStateManager): void {
    this.stateManager = manager
    this.unsubscribe = manager.subscribe(state => this.onStateChange(state))
    this.render()
  }

  disconnectedCallback(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private onStateChange(_state: ProductPickerState): void {
    this.render()
  }

  private render(): void {
    if (!this.stateManager) return
    const state = this.stateManager.getState()
    const ctrl = state.controlSettings
    const hasAnyControl = ctrl.showRandomize || ctrl.showReset || ctrl.showItemCount

    if (!hasAnyControl) {
      this.innerHTML = ''
      return
    }

    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-controls'

    // Item counter
    if (ctrl.showItemCount) {
      const counter = document.createElement('span')
      counter.className = 'emtlkit--product-picker-controls__counter'
      const count = this.stateManager.getSelectionCount()
      const max = state.selectionRules.max
      counter.textContent = max > 0 ? `${count} of ${max} selected` : `${count} selected`
      container.appendChild(counter)
    }

    // Spacer to push buttons right
    if (ctrl.showItemCount && (ctrl.showRandomize || ctrl.showReset)) {
      const spacer = document.createElement('span')
      spacer.style.flex = '1'
      container.appendChild(spacer)
    }

    // Randomize button
    if (ctrl.showRandomize) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'emtlkit--product-picker-controls__btn'
      btn.textContent = 'Randomize'
      btn.addEventListener('click', () => this.stateManager.randomize())
      container.appendChild(btn)
    }

    // Reset button
    if (ctrl.showReset) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'emtlkit--product-picker-controls__btn'
      btn.textContent = 'Reset'
      const hasSelections = this.stateManager.getSelectionCount() > 0
      btn.disabled = !hasSelections
      btn.addEventListener('click', () => this.stateManager.reset())
      container.appendChild(btn)
    }

    this.innerHTML = ''
    this.appendChild(container)
  }
}

customElements.define('tailorkit-product-picker-controls', TailorKitProductPickerControls)
