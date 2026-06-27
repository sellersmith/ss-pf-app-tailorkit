import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { ImageSwatchElement } from './ImageSwatchElement'
import { ImageDropdownGridElement } from './ImageDropdownGridElement'

const ELEMENT_NAME = 'tailorkit-image-options-list'

/**
 * Main Image Option Set Element that chooses between swatch and grid
 */
export class ImageOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const { displayStyle = 'image_swatch' } = optionSet

    // Create the appropriate component based on display style
    const ComponentClass
      = displayStyle === 'image_dropdown_grid' || displayStyle === 'mask_dropdown_grid'
        ? ImageDropdownGridElement
        : ImageSwatchElement

    // Create new instance
    const component = new ComponentClass()

    // Copy attributes to child component
    Array.from(this.attributes).forEach(attr => {
      if (attr.name !== 'initialized') {
        component.setAttribute(attr.name, attr.value)
      }
    })

    // Render child component inside this element's container instead of replacing.
    // This keeps the router element in the DOM so React can update its attributes
    // and attributeChangedCallback can trigger re-renders.
    this.getContainer().appendChild(component)
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ImageOptionSetElement)
}
