/** @jsxImportSource preact */
import { render } from 'preact'
import { ColorOptionsList } from './ColorOptionsList'

// Define the custom element tag
const TAG_NAME = 'tailorkit-color-options-list'

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: TailorKitColorOptionsListElement
  }
}

interface ColorOptionsListData {
  options: Array<{
    i: string
    l: string
    v: string
    s?: number
    additionalPricing?: any
  }>
  currentPrintAreaId: string
  currentOptionSetId: string
}

class TailorKitColorOptionsListElement extends HTMLElement {
  private mounted = false

  connectedCallback() {
    if (this.mounted) return

    // Create container
    const container = document.createElement('div')
    container.className = 'emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap'
    this.replaceChildren(container)

    // Get data from attributes
    const optionsData = this.getAttribute('data-options')
    const currentPrintAreaId = this.getAttribute('data-current-print-area-id') || ''
    const currentOptionSetId = this.getAttribute('data-current-option-set-id') || ''

    let options: ColorOptionsListData['options'] = []
    if (optionsData) {
      try {
        options = JSON.parse(optionsData)
      } catch (e) {
        console.error('Failed to parse options data:', e)
      }
    }

    // Render Preact component
    render(
      <ColorOptionsList
        options={options}
        currentPrintAreaId={currentPrintAreaId}
        currentOptionSetId={currentOptionSetId}
      />,
      container
    )

    this.mounted = true
  }

  disconnectedCallback() {
    this.mounted = false
    this.replaceChildren()
  }
}

// if (!customElements.get(TAG_NAME)) {
//   customElements.define(TAG_NAME, TailorKitColorOptionsListElement)
// }
