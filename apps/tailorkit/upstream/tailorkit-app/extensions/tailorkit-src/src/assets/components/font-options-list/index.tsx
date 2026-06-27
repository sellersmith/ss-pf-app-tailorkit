/** @jsxImportSource preact */
import { render } from 'preact'
import { FontOptionsList } from './FontOptionsList'

// Define the custom element tag
const TAG_NAME = 'tailorkit-font-options-list'

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: TailorKitFontOptionsListElement
  }
}

interface FontOptionsListData {
  defaultFontFamily: {
    src: string
    family: string
    additionalPricing?: any
  }
}

class TailorKitFontOptionsListElement extends HTMLElement {
  private mounted = false

  connectedCallback() {
    if (this.mounted) return

    // Create container
    const container = document.createElement('div')
    this.replaceChildren(container)

    // Get data from attributes
    const defaultFontData = this.getAttribute('data-default-font')

    let defaultFontFamily: FontOptionsListData['defaultFontFamily'] = {
      src: '',
      family: '',
    }

    if (defaultFontData) {
      try {
        defaultFontFamily = JSON.parse(defaultFontData)
      } catch (e) {
        console.error('Failed to parse default font data:', e)
      }
    }

    // Get fieldset data for localStorage key generation
    const fieldset = this.closest('fieldset')
    const fieldsetData = fieldset
      ? {
          layerId: fieldset.getAttribute('data-layer-id') || '',
          printAreaId: fieldset.getAttribute('data-print-area-id') || '',
          optionSetId: fieldset.getAttribute('data-id') || '',
        }
      : null

    // Render Preact component
    render(<FontOptionsList defaultFontFamily={defaultFontFamily} fieldsetData={fieldsetData} />, container)

    this.mounted = true
  }

  disconnectedCallback() {
    this.mounted = false
    this.replaceChildren()
  }
}

// if (!customElements.get(TAG_NAME)) {
//   customElements.define(TAG_NAME, TailorKitFontOptionsListElement)
// }
