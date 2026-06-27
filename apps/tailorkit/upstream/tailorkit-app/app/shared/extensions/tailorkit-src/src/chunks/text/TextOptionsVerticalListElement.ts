/* eslint-disable max-len */
/**
 * Text Options Vertical List Element - Chunk Version
 *
 * This is a chunk-specific version that imports all shared dependencies from
 * window.TailorKit via BaseWrapper instead of direct ES module imports.
 */
import { BaseOptionSetElement, CHECK_ICON_PATH, createSvgIcon } from './BaseWrapper'

/**
 * Text Option Set Element - Vertical List Style
 */
export class TextOptionsVerticalListElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { printAreaId, optionSetId } = this.getIds()

    if (!container || !optionSet) {
      console.warn('Missing container or optionSet:', { container: !!container, optionSet: !!optionSet })
      return
    }

    const { ol = [] } = optionSet
    const selectedItem = this.getSelectedOption()
    // Create grid container with options using template literal
    const gridHtml = `
      <div class="emtlkit--d-grid emtlkit--grid-template-columns-1 emtlkit--gap-4">
        ${ol
          .map(item => {
            if (!item) return ''
            const isSelected = item?.i === selectedItem?.i
            const radioName = `${printAreaId} / ${optionSetId}`
            const additionalPricing = item.additionalPricing
              ? `data-pricing='${JSON.stringify(item.additionalPricing)}'`
              : ''

            return `
            <div class="emtlkit--option-container emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between emtlkit-text-option${isSelected ? ' active' : ''}"
                 data-item-id="${item.i}">
              ${item.v}
              ${isSelected ? createSvgIcon(CHECK_ICON_PATH) : ''}
              <input type="radio"
                     name="${radioName}"
                     value="${item.v}"
                     data-id="${item.i}"
                     data-name="${item.l}"
                     ${isSelected ? 'checked' : ''}
                     ${additionalPricing}>
            </div>
          `
          })
          .join('')}
      </div>
    `

    // Set the HTML and attach click handlers
    container.innerHTML = gridHtml

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
