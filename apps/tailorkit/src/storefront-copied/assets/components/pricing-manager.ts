import { PROPERTY_PREFIX } from '../constants'
import { isJSON } from '../fns/is-json'
import { formatCustomerPrice, getCustomerCurrencyInfo } from '../utils/storefront-pricing'
import type { TailorKitProductPersonalizer } from './product-personalizer'
import { FormManager } from './form-manager'
import { isFieldSetHidden } from '../utils/fieldset'

export const TOTAL_ADDITIONAL_COST_PROPERTY = `${PROPERTY_PREFIX}_Total_Additional_Cost`
export const TOTAL_ADDITIONAL_COST_DISPLAY_PROPERTY = `${PROPERTY_PREFIX}_Total_Additional_Cost_Display`

/**
 * Handles pricing calculations and updates for option sets
 */
export class PricingManager {
  /**
   * Extract pricing string from an element (either an <input> inside option-container or the fieldset itself).
   * This fallback logic is important for option types like "font_option" where the active choice is stored on
   * the <fieldset> rather than an <input> element.
   */
  static getOptionPricing(element: Element | null): string {
    if (!element) return ''

    // Try to get pricing from the element itself first, then fall back to its fieldset
    const fieldset = element.closest('fieldset') as HTMLFieldSetElement
    const pricingData = element.getAttribute('data-pricing') || fieldset.getAttribute('data-pricing') || ''

    if (pricingData && isJSON(pricingData)) {
      try {
        const pricing = JSON.parse(pricingData)
        if (pricing && pricing.flatRate > 0) {
          const currencyInfo = getCustomerCurrencyInfo()
          const customerPrice = pricing.flatRate * currencyInfo.rate
          const formattedPrice = formatCustomerPrice(customerPrice, currencyInfo)

          return ` (+${currencyInfo.symbol}${formattedPrice})`
        }
      } catch (error) {
        console.warn('Failed to parse pricing data:', error)
      }
    }
    return ''
  }

  /**
   * Get enhanced display value with pricing for an option
   */
  static getDisplayValueWithPricing(fieldset: Element, layerOption: { value: string }): string {
    const selectedOptionInput = fieldset.querySelector('.emtlkit--option-container.active input') as HTMLInputElement

    // For font options the pricing might be stored on fieldset directly if no input exists
    const pricingString = PricingManager.getOptionPricing(selectedOptionInput || fieldset)

    return `${layerOption.value}${pricingString}`
  }

  /**
   * Update fieldset labels with pricing information
   */
  static updateFieldsetLabelsWithPricing(productPersonalizer: TailorKitProductPersonalizer) {
    const fieldsets = productPersonalizer.querySelectorAll('fieldset')

    fieldsets.forEach(fieldset => {
      // Skip hidden option sets
      if (isFieldSetHidden(fieldset as HTMLFieldSetElement)) {
        return
      }

      const selectedOptionInput = fieldset.querySelector('.emtlkit--option-container.active input') as HTMLInputElement

      const pricingString = PricingManager.getOptionPricing(selectedOptionInput || fieldset)

      const fieldsetLabel = fieldset.querySelector('label') as HTMLElement
      if (fieldsetLabel) {
        const truncatedLabelContent = fieldsetLabel.textContent?.split('(+')[0]

        if (pricingString) {
          fieldsetLabel.textContent = `${truncatedLabelContent}${pricingString}`
        } else {
          // Clear the pricing string if label is showing another
          fieldsetLabel.textContent = truncatedLabelContent || ''
        }
      }
    })
  }

  /**
   * Add total pricing information to the form
   */
  static addTotalPricingToForm(addToCartForm: HTMLFormElement, productPersonalizer: TailorKitProductPersonalizer) {
    let totalAdditionalCost = 0
    const currencyInfo = getCustomerCurrencyInfo()
    const fieldsets = productPersonalizer.querySelectorAll('fieldset[data-layer-id]')

    fieldsets.forEach(fieldset => {
      // Skip hidden option sets
      if (isFieldSetHidden(fieldset as HTMLFieldSetElement)) {
        return
      }

      // Check for active option input (swatch/radio style) OR checked checkbox input
      const selectedOptionInput
        = (fieldset.querySelector('.emtlkit--option-container.active input') as HTMLInputElement)
        || (fieldset.querySelector('.emtlkit--checkbox-input:checked') as HTMLInputElement)

      const pricingData = selectedOptionInput?.getAttribute('data-pricing') || fieldset.getAttribute('data-pricing')

      if (pricingData && isJSON(pricingData)) {
        try {
          const pricing = JSON.parse(pricingData)
          if (pricing && pricing.flatRate > 0) {
            const customerPrice = pricing.flatRate * currencyInfo.rate
            totalAdditionalCost += customerPrice
          }
        } catch (error) {
          console.warn('Failed to parse pricing data:', error)
        }
      }
    })

    // NOTE: Charm costs are NOT included here. Charm products are added as separate
    // cart line items (with their own Shopify variant IDs) by the ATC middleware,
    // not through the hidden pricing product mechanism.

    // Remove existing pricing inputs
    const existingPricingInputs = addToCartForm.querySelectorAll('input[data-name*="additional-cost"]')
    existingPricingInputs.forEach(input => input.parentNode?.removeChild(input))

    // Add total additional cost to form if greater than 0
    if (totalAdditionalCost > 0) {
      // Create hidden input for cart processing
      FormManager.createInputElement(TOTAL_ADDITIONAL_COST_PROPERTY, totalAdditionalCost.toFixed(2), addToCartForm)

      // Display formatted total to customer
      const formattedTotal = formatCustomerPrice(totalAdditionalCost, currencyInfo)
      FormManager.createInputElement(
        TOTAL_ADDITIONAL_COST_DISPLAY_PROPERTY,
        `${currencyInfo.symbol}${formattedTotal}`,
        addToCartForm
      )

      // Dispatch event to notify other components about pricing update
      const pricingEvent = new CustomEvent('tailorkit-pricing-updated', {
        detail: {
          totalCost: totalAdditionalCost,
          formattedCost: `${currencyInfo.symbol}${formattedTotal}`,
          currency: currencyInfo.code,
        },
      })
      window.dispatchEvent(pricingEvent)
    }
  }

  /**
   * Update pricing for all forms and generate canvas preview
   */
  static updatePricingAndPreview(
    addToCartForms: HTMLFormElement[],
    productPersonalizer: TailorKitProductPersonalizer,
    canvasPreviewCallback: (
      productPersonalizer: TailorKitProductPersonalizer,
      addToCartForms: HTMLFormElement[]
    ) => void
  ) {
    // Update fieldset labels once for all forms
    PricingManager.updateFieldsetLabelsWithPricing(productPersonalizer)

    // Add total pricing to each form.
    // Pricing data (data-pricing) is set on fieldsets synchronously by option
    // components in their click handlers BEFORE dispatching the setOptions event
    // that triggers this method — so the DOM is ready when we query it.
    addToCartForms.forEach(addToCartForm => {
      PricingManager.addTotalPricingToForm(addToCartForm, productPersonalizer)
    })

    // Generate canvas preview once for all forms
    canvasPreviewCallback(productPersonalizer, addToCartForms)
  }
}
