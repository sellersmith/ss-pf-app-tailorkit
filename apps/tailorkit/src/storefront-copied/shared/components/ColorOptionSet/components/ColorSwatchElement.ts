import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { openColourGuideModal } from './colour-guide-modal-host'
import type { ColorOptionItem } from '../types'

const ELEMENT_NAME = 'tailorkit-color-swatch'

/**
 * Color Swatch Element - Displays colors in a grid layout
 */
export class ColorSwatchElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { printAreaId, optionSetId } = this.getIds()

    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    // Check if any option is selected
    const selectedOption = this.getSelectedOption()

    // Colour Guide image (optional). When set, renders a small "Colour guide" link
    // below the swatches that opens a popup with the reference image + colour names.
    const colourGuideUrl = typeof optionSet.cg === 'string' ? optionSet.cg : ''

    // Create HTML using template literal
    const html = `
      <div class="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap">
        ${optionSet.ol
          .map((option, index) => {
            if (!option) return ''

            // Check if this option is selected (first option by default or option with selecting === true)
            const isSelected = option?.i === selectedOption?.i
            const radioName = `${printAreaId} / ${optionSetId}`
            const additionalPricing = option.additionalPricing
              ? `data-pricing='${JSON.stringify(option.additionalPricing)}'`
              : ''

            return `
            <div class="emtlkit--option-container emtlkit-color-option${isSelected ? ' active' : ''}"
                 style="cursor: pointer; background-color: ${option.v};"
                 data-item-id="${option.i}">
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
      ${
        colourGuideUrl
          ? '<button type="button" class="emtlkit-colour-guide-link" aria-haspopup="dialog">Colour guide</button>'
          : ''
      }
    `

    // Set the HTML
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

    // Wire up Colour Guide link → opens modal with image + dynamic swatch list.
    if (colourGuideUrl) {
      const link = container.querySelector('.emtlkit-colour-guide-link') as HTMLButtonElement | null
      link?.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        // Cast through unknown to narrow to ColorOptionItem[] — at this point we
        // know the option set is color_option since `cg` is only emitted for that type.
        const colourOptions = (optionSet.ol || []) as unknown as ColorOptionItem[]
        openColourGuideModal({
          imageUrl: colourGuideUrl,
          description: typeof optionSet.cd === 'string' ? optionSet.cd : '',
          optionSetLabel: optionSet.l || '',
          options: colourOptions.map(o => ({
            id: o?.i || '',
            name: o?.l || '',
            value: o?.v || '',
            description: typeof o?.cgd === 'string' ? o.cgd : '',
          })),
        })
      })
    }

    super.renderOptionSet()
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ColorSwatchElement)
}
