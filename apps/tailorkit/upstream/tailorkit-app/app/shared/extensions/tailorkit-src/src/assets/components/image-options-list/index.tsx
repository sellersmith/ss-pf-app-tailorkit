/** @jsxImportSource preact */
import { render } from 'preact'
import { ImageOptionsList } from './ImageOptionsList'

// Define the custom element tag
const TAG_NAME = 'tailorkit-image-options-list'

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: TailorKitImageOptionsListElement
  }
}

interface ImageOptionsListData {
  options: Array<{
    i: string
    l: string
    v: string
    additionalPricing?: any
  }>
  currentPrintAreaId: string
  currentOptionSetId: string
  optionSetType: string
}

class TailorKitImageOptionsListElement extends HTMLElement {
  private mounted = false

  connectedCallback() {
    if (this.mounted) return

    // Create container
    const container = document.createElement('div')
    container.className
      = 'image-uploaded-generated-option-set-container emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap'
    this.replaceChildren(container)

    // Get data from attributes
    const optionsData = this.getAttribute('data-options')
    const currentPrintAreaId = this.getAttribute('data-current-print-area-id') || ''
    const currentOptionSetId = this.getAttribute('data-current-option-set-id') || ''
    const optionSetType = this.getAttribute('data-option-set-type') || ''

    let options: ImageOptionsListData['options'] = []
    if (optionsData) {
      try {
        options = JSON.parse(optionsData)
      } catch (e) {
        console.error('Failed to parse options data:', e)
      }
    }

    // Render Preact component
    render(
      <ImageOptionsList
        options={options}
        currentPrintAreaId={currentPrintAreaId}
        currentOptionSetId={currentOptionSetId}
        optionSetType={optionSetType}
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
//   customElements.define(TAG_NAME, TailorKitImageOptionsListElement)
// }
