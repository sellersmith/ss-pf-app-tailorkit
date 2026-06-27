import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { ImagelessCheckboxElement } from './ImagelessCheckboxElement'
import { ImagelessDropdownElement } from './ImagelessDropdownElement'
import { ImagelessSwatchElement } from './ImagelessSwatchElement'

const ELEMENT_NAME = 'tailorkit-imageless-options-list'

/**
 * Main Imageless Option Set Element that routes to swatch or dropdown
 * based on the displayStyle property.
 * Follows the same router pattern as ColorOptionSetElement and FontOptionSetElement.
 */
export class ImagelessOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const { displayStyle = 'imageless_swatch' } = optionSet

    // Route to appropriate component based on display style
    const ComponentClass
      = displayStyle === 'imageless_dropdown_list'
        ? ImagelessDropdownElement
        : displayStyle === 'imageless_checkbox'
          ? ImagelessCheckboxElement
          : ImagelessSwatchElement

    const component = new ComponentClass()

    // Copy attributes from this element to the new component
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
  customElements.define(ELEMENT_NAME, ImagelessOptionSetElement)
}
