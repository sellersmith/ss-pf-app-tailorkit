import { FontDropdownElement } from './components/FontDropdownElement'
import { FontOptionSetElement } from './components/FontOptionSetElement'
import { FontSwatchElement } from './components/FontSwatchElement'

// Register all web components
const components = {
  'tailorkit-font-options-list': FontOptionSetElement,
  'tailorkit-font-swatch': FontSwatchElement,
  'tailorkit-font-dropdown': FontDropdownElement,
}

export function registerFontOptionSetElements() {
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
