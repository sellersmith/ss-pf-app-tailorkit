import { ImagelessOptionSetElement } from './components/ImagelessOptionSetElement'
import { ImagelessCheckboxElement } from './components/ImagelessCheckboxElement'
import { ImagelessDropdownElement } from './components/ImagelessDropdownElement'
import { ImagelessSwatchElement } from './components/ImagelessSwatchElement'

// Register all web components
const components = {
  'tailorkit-imageless-options-list': ImagelessOptionSetElement,
  'tailorkit-imageless-checkbox': ImagelessCheckboxElement,
  'tailorkit-imageless-options-dropdown': ImagelessDropdownElement,
  'tailorkit-imageless-swatch': ImagelessSwatchElement,
}

export function registerImagelessOptionSetElements() {
  if (typeof globalThis === 'undefined' || !('customElements' in globalThis)) {
    console.error('Custom elements not supported')
    return
  }

  Object.entries(components).forEach(([tagName, component]) => {
    if (!globalThis.customElements.get(tagName)) {
      globalThis.customElements.define(tagName, component)
    }
  })
}
