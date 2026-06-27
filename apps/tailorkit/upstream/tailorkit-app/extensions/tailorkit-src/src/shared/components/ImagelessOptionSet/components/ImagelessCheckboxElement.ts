import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { tlkOptionSetClickEvent } from '../../../constants/optionSets'
import type { BaseOptionItem } from '../../types'
import {
  getCustomerCurrencyInfo,
  getCurrencySymbol,
  formatCustomerPrice,
} from '../../../../assets/utils/storefront-pricing'

/** Option item with additional pricing for imageless checkbox */
interface ImagelessCheckboxItem extends BaseOptionItem {
  additionalPricing?: { value?: number; flatRate?: number }
}

const ELEMENT_NAME = 'tailorkit-imageless-checkbox'

/**
 * Formats additional pricing for display using the store's actual currency.
 * Returns formatted string like "+5,000₫" or "+€3.00" or empty string if no pricing.
 */
function formatPricingLabel(
  additionalPricing?: ImagelessCheckboxItem['additionalPricing'],
  fallbackCurrencyCode?: string
): string {
  if (!additionalPricing || !additionalPricing.flatRate || additionalPricing.flatRate <= 0) return ''
  const value = additionalPricing.value ?? additionalPricing.flatRate
  // Use customer's market currency (storefront). In admin preview window.Shopify.currency
  // is unavailable so getCustomerCurrencyInfo falls back to USD — use fallbackCurrencyCode instead.
  let currencyInfo = getCustomerCurrencyInfo()
  if (currencyInfo.code === 'USD' && fallbackCurrencyCode && fallbackCurrencyCode !== 'USD') {
    currencyInfo = { code: fallbackCurrencyCode, symbol: getCurrencySymbol(fallbackCurrencyCode), rate: 1 }
  }
  const formatted = formatCustomerPrice(Number(value), currencyInfo)
  // Match the heading's format: "+{amount} {code}" for non-USD, "+${amount}" for USD
  if (currencyInfo.code === 'USD') {
    return `+$${formatted}`
  }
  return `+${formatted} ${currencyInfo.code}`
}

/**
 * Imageless Checkbox Element — renders a single toggle checkbox.
 *
 * Uses click + preventDefault for manual state control. This avoids a race condition
 * where the product-personalizer's capture-phase change handler reads fieldset
 * data-option-id BEFORE handleToggle updates it, causing inverted conditional logic.
 *
 * Key behaviors:
 * - Uses first value from optionSet.ol as the checkbox item
 * - Checked = first value selected (triggers conditional logic via data-option-id)
 * - Unchecked = no selection (clears data-option-id, hides controlled layers)
 * - Starts unchecked by default (uses data-can-default-select="false")
 * - Supports additional pricing display next to label
 */
export class ImagelessCheckboxElement extends BaseOptionSetElement {
  #checkboxInput: HTMLInputElement | null = null

  /**
   * Get the first option item (the checkbox value)
   */
  private getCheckboxItem(): ImagelessCheckboxItem | null {
    const optionSet = this.getOptionSet()
    if (!optionSet?.ol?.length) return null
    return optionSet.ol[0] as ImagelessCheckboxItem
  }

  /**
   * Handle checkbox click — manually toggle state with correct timing.
   * Intercepts click, prevents native toggle, updates fieldset FIRST,
   * then re-renders so capture-phase handlers see correct data-option-id.
   */
  private handleCheckboxClick(e: Event): void {
    // Prevent event propagation to product-personalizer
    e.preventDefault()
    e.stopPropagation()

    const item = this.getCheckboxItem()
    if (!item || !this.#checkboxInput) return

    // When clicking the input directly, the browser toggles checked state BEFORE
    // handlers run. Read the already-toggled state directly in that case.
    // When clicking the label/pricing text, no native toggle occurs — invert manually.
    const clickedInput = e.target === this.#checkboxInput
    const willBeChecked = clickedInput ? this.#checkboxInput.checked : !this.#checkboxInput.checked

    if (willBeChecked) {
      // Set pricing on fieldset SYNCHRONOUSLY before handleSelect dispatches events.
      // handleSelect triggers setOptions → addTotalPricingToForm which reads data-pricing
      // from fieldsets. The async Preact render (renderOptionSet) sets it too late.
      const fieldset = this.closest('fieldset')
      if (fieldset && item.additionalPricing) {
        fieldset.setAttribute('data-pricing', JSON.stringify(item.additionalPricing))
      }
      // Select the checkbox value — base class sets fieldset attributes + dispatches event
      this.handleSelect(item.i)
    } else {
      // Clear selection — explicitly remove fieldset attributes for conditional logic
      const fieldset = this.closest('fieldset')
      if (fieldset) {
        fieldset.removeAttribute('data-option-id')
        fieldset.setAttribute('value', '')
        fieldset.setAttribute('data-name', '')
        fieldset.removeAttribute('data-pricing')
      }

      // Clear internal selecting state
      const optionSet = this.getOptionSet()
      if (optionSet) {
        const items = optionSet.ol.map(o => ({ ...o, selecting: false }))
        this.setOptionSet({ ...optionSet, ol: items })
      }

      // Dispatch custom event for admin preview compatibility
      this.dispatchEvent(
        new CustomEvent(tlkOptionSetClickEvent, {
          detail: {
            optionSet: this.getOptionSet(),
            currentPrintAreaId: this.getIds().printAreaId,
            currentOptionSetId: this.getIds().optionSetId,
            currentLayerId: this.getIds().layerId,
          },
          bubbles: true,
        })
      )

      // Re-render to update checkbox visual state
      this.renderOptionSet()
    }

    // Dispatch synthetic change event AFTER fieldset data-option-id is updated.
    // This triggers product-personalizer's capture-phase change handler → renderCanvas
    // → isLayerVisible re-evaluates conditional logic with correct state.
    this.#checkboxInput?.dispatchEvent(new Event('change', { bubbles: true }))
  }

  protected renderOptionSet(): void {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()

    if (!container || !optionSet) {
      console.warn('No container or optionSet for checkbox')
      return
    }

    const item = this.getCheckboxItem()
    if (!item) {
      console.warn('No checkbox item available')
      return
    }

    const { printAreaId, optionSetId } = this.getIds()
    const selectedOption = this.getSelectedOption()
    const isChecked = selectedOption?.i === item.i
    const radioName = `${printAreaId} / ${optionSetId}`
    const fallbackCurrency = this.getAttribute('data-currency-code') || ''
    const pricingLabel = formatPricingLabel(item.additionalPricing, fallbackCurrency)
    const additionalPricing = item.additionalPricing ? `data-pricing='${JSON.stringify(item.additionalPricing)}'` : ''

    container.innerHTML = `
      <label class="emtlkit--checkbox-container emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8">
        <input
          type="checkbox"
          class="emtlkit--checkbox-input"
          name="${radioName}"
          value="${item.v}"
          data-id="${item.i}"
          data-name="${item.l}"
          ${isChecked ? 'checked' : ''}
          ${additionalPricing}
        >
        <span class="emtlkit--checkbox-label">${item.l}</span>
        ${pricingLabel ? `<span class="emtlkit--checkbox-pricing">${pricingLabel}</span>` : ''}
      </label>
    `

    this.#checkboxInput = container.querySelector('.emtlkit--checkbox-input')

    // Bind click on the ENTIRE checkbox container (label + input + pricing).
    // Can't bind on input alone because product-personalizer's clickEventHandler calls
    // preventDefault() on label clicks, preventing label-to-input forwarding.
    const checkboxContainer = container.querySelector('.emtlkit--checkbox-container')
    checkboxContainer?.addEventListener('click', (e: Event) => this.handleCheckboxClick(e))

    // Set fieldset attributes directly — do NOT call super.renderOptionSet().
    // The base class modifies the h3 label text nodes, which conflicts with
    // React's DOM management in admin preview (causes "removeChild" NotFoundError).
    // For checkbox, the label suffix is unnecessary since the checkbox visually
    // indicates selection state. Only set data attributes for conditional logic.
    const fieldset = this.closest('fieldset')
    if (fieldset) {
      if (isChecked) {
        fieldset.setAttribute('data-option-id', item.i)
        fieldset.setAttribute('value', item.v)
        fieldset.setAttribute('data-name', item.l)
        // Sync pricing to fieldset so PricingManager can read it
        // (checkbox uses .emtlkit--checkbox-container, not .emtlkit--option-container)
        if (item.additionalPricing) {
          fieldset.setAttribute('data-pricing', JSON.stringify(item.additionalPricing))
        }
      } else {
        fieldset.removeAttribute('data-option-id')
        fieldset.setAttribute('value', '')
        fieldset.setAttribute('data-name', '')
        fieldset.removeAttribute('data-pricing')
      }
    }
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ImagelessCheckboxElement)
}
