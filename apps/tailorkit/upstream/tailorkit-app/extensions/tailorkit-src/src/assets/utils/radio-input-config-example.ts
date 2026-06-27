/**
 * Example of how to update radio input configuration if your DOM structure changes
 *
 * This file demonstrates how to use the configuration system to adapt to
 * future changes without modifying the core monitoring logic.
 */

import { updateRadioInputConfig, type RadioInputConfig } from './radio-input-monitor'

/**
 * Example: If you change from 'emtlkit--option-container' to 'tlk-option' class
 */
export function updateToNewClassNames() {
  updateRadioInputConfig({
    containerSelector: '.tlk-option',
    activeClass: 'tlk-active',
  })
}

/**
 * Example: If you change data attribute names
 */
export function updateToNewDataAttributes() {
  updateRadioInputConfig({
    containerDataAttribute: 'data-option-id',
    printAreaAttribute: 'data-area',
    optionSetAttribute: 'data-set',
  })
}

/**
 * Example: If you change radio naming convention
 */
export function updateRadioNaming() {
  updateRadioInputConfig({
    radioNameFormat: (printAreaId: string, optionSetId: string) => `tailorkit_${printAreaId}_${optionSetId}`,
  })
}

/**
 * Example: If you add new attributes that need to be preserved
 */
export function addCustomAttributes() {
  updateRadioInputConfig({
    getAdditionalAttributes: (container: HTMLElement) => {
      const attrs: Record<string, string> = {}

      // Preserve pricing data
      const pricing = container.querySelector('[data-pricing]')?.getAttribute('data-pricing')
      if (pricing) attrs['data-pricing'] = pricing

      // Preserve custom variant data
      const variant = container.getAttribute('data-variant-id')
      if (variant) attrs['data-variant-id'] = variant

      // Preserve any other custom attributes
      const customData = container.getAttribute('data-custom')
      if (customData) attrs['data-custom'] = customData

      return attrs
    },
  })
}

/**
 * Example: Complete configuration for a hypothetical future structure
 */
export function updateToFutureStructure() {
  const futureConfig: Partial<RadioInputConfig> = {
    containerSelector: '.tailorkit-choice-item',
    containerDataAttribute: 'data-choice-id',
    parentSelector: '[data-customizer-area][data-choice-group]',
    printAreaAttribute: 'data-customizer-area',
    optionSetAttribute: 'data-choice-group',
    imageSelector: '.choice-preview',
    imageValueAttribute: 'data-image-url',
    imageLabelAttribute: 'data-choice-label',
    activeClass: 'choice-selected',
    radioNameFormat: (areaId: string, groupId: string) => `customizer[${areaId}][${groupId}]`,
    getAdditionalAttributes: (container: HTMLElement) => {
      const attrs: Record<string, string> = {}

      // Future pricing structure
      const priceData = container.getAttribute('data-price-delta')
      if (priceData) attrs['data-price-delta'] = priceData

      // Future inventory tracking
      const stock = container.getAttribute('data-stock-level')
      if (stock) attrs['data-stock-level'] = stock

      return attrs
    },
  }

  updateRadioInputConfig(futureConfig)
}
