import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { MultiLayoutDropdownElement } from './MultiLayoutDropdownElement'
import { MultiLayoutSwatchElement } from './MultiLayoutSwatchElement'

const ELEMENT_NAME = 'tailorkit-multi-layout-options-list'

/**
 * Main Multi-Layout Option Set Element that routes to swatch or dropdown
 * based on the displayStyle property.
 * Follows the same router pattern as ColorOptionSetElement and ImagelessOptionSetElement.
 */
export class MultiLayoutOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const { displayStyle = 'multi_layout_swatch' } = optionSet

    // Route to appropriate component based on display style
    const ComponentClass
      = displayStyle === 'multi_layout_dropdown_list' ? MultiLayoutDropdownElement : MultiLayoutSwatchElement

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
  customElements.define(ELEMENT_NAME, MultiLayoutOptionSetElement)
}
