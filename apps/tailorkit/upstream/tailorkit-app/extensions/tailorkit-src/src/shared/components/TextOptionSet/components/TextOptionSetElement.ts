import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { TextOptionsDropdownElement } from './TextOptionsDropdownElement'
import { TextOptionsVerticalListElement } from './TextOptionsVerticalListElement'

const ELEMENT_NAME = 'tailorkit-text-options-list'

/**
 * Main Text Option Set Element that chooses between dropdown and vertical list
 */
export class TextOptionSetElement extends BaseOptionSetElement {
  // constructor() {
  //   super()
  // }

  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const { displayStyle = 'text_vertical_list' } = optionSet

    // Create the appropriate component based on display style
    const ComponentClass
      = displayStyle === 'text_dropdown_list' ? TextOptionsDropdownElement : TextOptionsVerticalListElement

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
  customElements.define(ELEMENT_NAME, TextOptionSetElement)
}
