import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import type { BaseOptionItem } from '../../types'

/** Option item with optional thumbnail for imageless swatch */
interface ImagelessSwatchItem extends BaseOptionItem {
  /** Thumbnail URL (if available) */
  t?: string
}

const ELEMENT_NAME = 'tailorkit-imageless-swatch'

/**
 * Imageless Swatch Element - Displays options as clickable blocks.
 * Shows thumbnail image if available, otherwise renders an SVG text label.
 * Follows the same pattern as ColorSwatchElement for consistency.
 */
export class ImagelessSwatchElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { printAreaId, optionSetId } = this.getIds()

    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const selectedOption = this.getSelectedOption()

    const html = `
      <div class="emtlkit--d-flex emtlkit--gap-8 emtlkit--flex-wrap">
        ${(optionSet.ol as ImagelessSwatchItem[])
          .map(option => {
            if (!option) return ''

            const isSelected = option?.i === selectedOption?.i
            const radioName = `${printAreaId} / ${optionSetId}`
            const additionalPricing = option.additionalPricing
              ? `data-pricing='${JSON.stringify(option.additionalPricing)}'`
              : ''
            const thumbnail = option.t
            const typeClass = thumbnail ? ' emtlkit-image-option' : ' emtlkit-imageless-option emtlkit--thumbnail'

            const content = thumbnail
              ? `<img alt="${option.l}" src="${thumbnail}">`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 50 50">
                  <rect width="100%" height="100%" fill="white"></rect>
                  <text x="50%" y="50%" fill="black" font-size="25" font-weight="bold"
                    text-anchor="middle" dominant-baseline="central"
                    style="white-space: nowrap">${option.l}</text>
                </svg>`

            return `
            <div class="emtlkit--option-container${typeClass}${isSelected ? ' active' : ''}"
                 data-item-id="${option.i}" style="cursor: pointer;">
              ${content}
              <input type="radio"
                     name="${radioName}"
                     value="${option.v}"
                     data-id="${option.i}"
                     data-name="${option.l}"
                     ${isSelected ? 'checked' : ''}
                     ${additionalPricing}>
            </div>
          `
          })
          .join('')}
      </div>
    `

    container.innerHTML = html

    // Add click handlers after rendering
    container.querySelectorAll('.emtlkit--option-container').forEach(optionContainer => {
      optionContainer.addEventListener('click', e => {
        const itemId = (optionContainer as HTMLElement).dataset.itemId
        if (itemId) {
          this.handleSelect(itemId, e)
        }
      })
    })

    super.renderOptionSet()
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ImagelessSwatchElement)
}
