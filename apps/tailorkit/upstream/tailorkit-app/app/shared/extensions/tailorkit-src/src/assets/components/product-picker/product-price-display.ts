/**
 * Product Picker Price Display Web Component
 *
 * Shows a running total of all selected products with an itemized breakdown.
 * Only renders when the `showRunningTotal` control is enabled.
 */

import type { ProductPickerStateManager, ProductPickerState } from './product-picker-state'
import { formatCustomerPrice, CURRENCY_MAP } from '../../utils/storefront-pricing'

export class TailorKitProductPriceDisplay extends HTMLElement {
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

    if (!state.controlSettings.showRunningTotal) {
      this.innerHTML = ''
      return
    }

    const slots = this.stateManager.getSlotAssignments()
    if (slots.length === 0) {
      this.innerHTML = ''
      return
    }

    const total = this.stateManager.getTotalPrice()

    const container = document.createElement('div')
    container.className = 'emtlkit--product-picker-total'

    const label = document.createElement('span')
    label.className = 'emtlkit--product-picker-total__label'
    label.textContent = 'Total: '
    container.appendChild(label)

    const amount = document.createElement('span')
    amount.className = 'emtlkit--product-picker-total__amount'
    amount.textContent = this.formatPrice(total)
    container.appendChild(amount)

    this.innerHTML = ''
    this.appendChild(container)
  }

  private formatPrice(amount: number): string {
    const currencyCode = window.Shopify?.currency?.active || 'USD'
    const symbolEntry = (CURRENCY_MAP as Record<string, { symbol: string }>)[currencyCode]
    const symbol = symbolEntry?.symbol || '$'
    const formatted = formatCustomerPrice(amount, { code: currencyCode })
    return `${symbol}${formatted}`
  }
}

customElements.define('tailorkit-product-price-display', TailorKitProductPriceDisplay)
