import { ColorOptionSetElement } from './components/ColorOptionSetElement'
import { ColorSwatchElement } from './components/ColorSwatchElement'
import { ColorDropdownElement } from './components/ColorDropdownElement'

// Register all web components
const components = {
  'tailorkit-color-options-list': ColorOptionSetElement,
  'tailorkit-color-swatch': ColorSwatchElement,
  'tailorkit-color-dropdown': ColorDropdownElement,
}

export function registerColorOptionSetElements() {
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
