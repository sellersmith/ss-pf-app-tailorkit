import { TextOptionSetElement } from './components/TextOptionSetElement'
import { TextOptionsDropdownElement } from './components/TextOptionsDropdownElement'
import { TextOptionsVerticalListElement } from './components/TextOptionsVerticalListElement'

// Register all web components
const components = {
  'tailorkit-text-options-list': TextOptionSetElement,
  'tailorkit-text-options-dropdown': TextOptionsDropdownElement,
  'tailorkit-text-options-vertical': TextOptionsVerticalListElement,
}

export function registerTextOptionSetElements() {
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
