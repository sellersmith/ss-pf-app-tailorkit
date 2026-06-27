/**
 * Text Option Set Element - Chunk Version
 *
 * This is a chunk-specific version that imports BaseOptionSetElement from
 * window.TailorKit via BaseWrapper instead of the shared module.
 *
 * Main element that chooses between dropdown and vertical list based on displayStyle.
 */
import { BaseOptionSetElement } from './BaseWrapper'
import { TextOptionsDropdownElement } from './TextOptionsDropdownElement'
import { TextOptionsVerticalListElement } from './TextOptionsVerticalListElement'

/**
 * Main Text Option Set Element that chooses between dropdown and vertical list
 */
export class TextOptionSetElement extends BaseOptionSetElement {
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

    // Copy attributes
    Array.from(this.attributes).forEach(attr => {
      if (attr.name !== 'initialized') {
        component.setAttribute(attr.name, attr.value)
      }
    })

    // Replace this element with the specific component
    this.replaceWith(component)
  }
}
