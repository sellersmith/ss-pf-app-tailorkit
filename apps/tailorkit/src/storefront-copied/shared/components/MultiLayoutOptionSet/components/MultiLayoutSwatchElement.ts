import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import type { BaseOptionItem } from '../../types'

/** Multi-layout option item with thumbnail */
interface MultiLayoutSwatchItem extends BaseOptionItem {
  /** Thumbnail SVG or image URL */
  t?: string
}

const ELEMENT_NAME = 'tailorkit-multi-layout-swatch'

/**
 * Multi-Layout Swatch Element - Displays layouts as clickable thumbnail blocks.
 * Renders SVG inline or img tag based on thumbnail content.
 * Follows the same pattern as ColorSwatchElement for consistency.
 */
export class MultiLayoutSwatchElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { optionSetId } = this.getIds()

    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const selectedOption = this.getSelectedOption()

    const html = `
      <div class="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap">
        ${(optionSet.ol as MultiLayoutSwatchItem[])
          .map(option => {
            if (!option) return ''

            const isSelected = option?.i === selectedOption?.i
            const radioName = `layout-${optionSetId}`
            const thumbnail = option.t || ''

            const content = thumbnail.includes('<svg')
              ? `<div class="emtlkit--multi-layout-swatch-thumb">${thumbnail}</div>`
              : `<img src="${thumbnail}?width=60" width="60" height="60" alt="${option.l}" loading="lazy" style="object-fit:contain">`

            return `
            <div class="emtlkit--option-container emtlkit-multi_layout-option emtlkit--thumbnail${isSelected ? ' active' : ''}"
                 data-item-id="${option.i}" style="cursor:pointer;width:60px;height:60px;">
              ${content}
              <input type="radio"
                     name="${radioName}"
                     value="${option.v}"
                     data-id="${option.i}"
                     data-name="${option.l}"
                     ${isSelected ? 'checked' : ''}>
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
  customElements.define(ELEMENT_NAME, MultiLayoutSwatchElement)
}
