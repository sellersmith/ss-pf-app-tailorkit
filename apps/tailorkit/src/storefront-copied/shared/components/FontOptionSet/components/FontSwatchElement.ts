import { fontStorefrontLoader } from '../../font-storefront-loader'
import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import type { FontOptionItem } from '../types'

const ELEMENT_NAME = 'tailorkit-font-swatch'

/**
 * Font Swatch Element for displaying font options in a grid
 */
export class FontSwatchElement extends BaseOptionSetElement {
  #componentMounted: boolean = false

  protected async renderOptionSet(): Promise<void> {
    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { printAreaId, optionSetId } = this.getIds()

    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    // Fire-and-forget font loading so initial UI appears without delay
    await Promise.all(
      optionSet.ol.map(async (option: FontOptionItem) => {
        const fontData = JSON.parse(option.v || '{}')
        if (fontData?.family && fontData?.src) {
          try {
            await fontStorefrontLoader.loadFont(fontData.family, fontData.src)
          } catch (error) {
            // Non-critical: show fallback font until loaded
            console.error('Failed to load font', fontData, error)
          }
        }
      })
    ).catch(() => {
      /* swallow errors – UI already rendered */
    })

    // Check if any option is selected
    const selectedOption = this.getSelectedOption()

    // Create HTML using template literal
    const html = `
      <div class="emtlkit--d-flex emtlkit--flex-wrap emtlkit--gap-8">
        ${optionSet.ol
          .map((option: FontOptionItem, index) => {
            if (!option) return ''

            const fontData = JSON.parse(option.v || '{}')
            const fontSrc = fontData.src || ''
            const isSelected = option?.i === selectedOption?.i
            const radioName = `${printAreaId} / ${optionSetId}`
            const additionalPricing = option.additionalPricing
              ? `data-pricing='${JSON.stringify(option.additionalPricing)}'`
              : ''

            // Flag default if matches template default font
            const isDefault = option?.isDefault ? 'true' : 'false'

            return `
              <div class="emtlkit--option-container emtlkit-font-option emtlkit--font-swatch${isSelected ? ' active' : ''}"
                data-item-id="${option.i}"
                data-label="${option.l}"
                data-default="${isDefault}"
                data-family="${fontData.family}"
              >
                <div class="emtlkit--font-preview" style="font-family: '${fontData.family}'">Abc</div>
                <input
                  type="radio"
                  name="${radioName}"
                  value="${fontSrc}"
                  data-id="${option.i}"
                  data-name="${option.l}${option.isDefault ? ' (Default)' : ''}"
                  data-family="${fontData.family}"
                  ${isSelected ? 'checked' : ''}
                  ${additionalPricing}
                />
              </div>
            `
          })
          .join('')}
      </div>
    `

    // Set the HTML
    container.innerHTML = html

    // Add click handlers after rendering
    container.querySelectorAll('.emtlkit--option-container').forEach(optionContainer => {
      optionContainer.addEventListener('click', e => {
        const itemId = (optionContainer as HTMLElement).dataset.itemId
        if (itemId) {
          // Update UI selection state
          container.querySelectorAll('.emtlkit--option-container').forEach(el => el.classList.remove('active'))
          optionContainer.classList.add('active')

          // Delegate fieldset updates & canvas re-render to TailorKitProductPersonalizer
          this.handleSelect(itemId, e)
        }
      })
    })

    super.renderOptionSet()
  }

  protected handleSelect = (id: string, event?: Event) => {
    const fieldset = this.closest('fieldset')
    const option = this.querySelector(`[data-item-id="${id}"]`)
    const fontFamily = option?.getAttribute('data-family') || ''
    const src = option?.getAttribute('value') || ''

    if (fieldset) {
      fieldset.setAttribute('data-family', fontFamily)
      fieldset.setAttribute('data-default', option?.getAttribute('data-default') || 'false')
      fieldset.setAttribute('data-font-src', src)
    }
    super.handleSelect(id, event)
  }

  async connectedCallback() {
    if (this.#componentMounted) return

    super.connectedCallback()
    this.#componentMounted = true
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.#componentMounted = false
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, FontSwatchElement)
}
