import { MultiLayoutOptionSetElement } from './components/MultiLayoutOptionSetElement'
import { MultiLayoutDropdownElement } from './components/MultiLayoutDropdownElement'
import { MultiLayoutSwatchElement } from './components/MultiLayoutSwatchElement'

// Register all web components
const components = {
  'tailorkit-multi-layout-options-list': MultiLayoutOptionSetElement,
  'tailorkit-multi-layout-dropdown': MultiLayoutDropdownElement,
  'tailorkit-multi-layout-swatch': MultiLayoutSwatchElement,
}

export function registerMultiLayoutOptionSetElements() {
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
