/** @jsxImportSource preact */
import { render } from 'preact'
import { TextOptionsList } from './TextOptionsList'

// Define the custom element tag
const TAG_NAME = 'tailorkit-text-options-list'

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: TailorKitTextOptionsListElement
  }
}

interface TextOptionsListData {
  options: Array<{
    i: string
    l: string
    v: string
    s?: number
    additionalPricing?: any
  }>
  currentPrintAreaId: string
  currentOptionSetId: string
  optionSetLabel: string
  layerId: string
  layerIndex: number
}

class TailorKitTextOptionsListElement extends HTMLElement {
  private mounted = false

  connectedCallback() {
    if (this.mounted) return

    // Create container with grid layout
    const container = document.createElement('div')
    container.className = 'emtlkit--d-grid emtlkit--grid-template-columns-1 emtlkit--gap-4'
    this.replaceChildren(container)

    // Get data from attributes
    const optionsData = this.getAttribute('data-options')
    const currentPrintAreaId = this.getAttribute('data-current-print-area-id') || ''
    const currentOptionSetId = this.getAttribute('data-current-option-set-id') || ''
    const optionSetLabel = this.getAttribute('data-option-set-label') || ''
    const layerId = this.getAttribute('data-layer-id') || ''
    const layerIndex = parseInt(this.getAttribute('data-layer-index') || '0', 10)

    let options: TextOptionsListData['options'] = []
    if (optionsData) {
      try {
        options = JSON.parse(optionsData)
      } catch (e) {
        console.error('Failed to parse options data:', e)
      }
    }

    // Render Preact component
    render(
      <TextOptionsList
        options={options}
        currentPrintAreaId={currentPrintAreaId}
        currentOptionSetId={currentOptionSetId}
        optionSetLabel={optionSetLabel}
        layerId={layerId}
        layerIndex={layerIndex}
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
//   customElements.define(TAG_NAME, TailorKitTextOptionsListElement)
// }
