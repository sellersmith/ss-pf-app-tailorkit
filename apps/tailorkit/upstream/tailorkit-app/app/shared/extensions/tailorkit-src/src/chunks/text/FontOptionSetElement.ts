/**
 * Font Option Set Element - Chunk Version
 *
 * This is a chunk-specific version that imports BaseOptionSetElement from
 * window.TailorKit via BaseWrapper instead of the shared module.
 *
 * Main element that chooses between swatch and dropdown based on displayStyle.
 */
import { BaseOptionSetElement } from './BaseWrapper'
import { FontSwatchElement } from './FontSwatchElement'
import { FontDropdownElement } from './FontDropdownElement'

/**
 * Main Font Option Set Element that chooses between swatch and dropdown
 */
export class FontOptionSetElement extends BaseOptionSetElement {
  protected renderOptionSet(): void {
    const optionSet = this.getOptionSet()
    if (!optionSet) {
      console.warn('No option set data available')
      return
    }

    const { displayStyle = 'font_dropdown_list' } = optionSet

    // Create the appropriate component based on display style
    const ComponentClass = displayStyle === 'font_swatch' ? FontSwatchElement : FontDropdownElement

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
