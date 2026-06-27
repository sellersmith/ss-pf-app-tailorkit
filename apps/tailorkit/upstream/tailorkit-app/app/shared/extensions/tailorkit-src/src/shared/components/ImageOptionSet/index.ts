import { ImageOptionSetElement } from './components/ImageOptionSetElement'
import { ImageSwatchElement } from './components/ImageSwatchElement'
import { ImageDropdownGridElement } from './components/ImageDropdownGridElement'
import { TailorKitAIImageGeneratorElement } from '../../../assets/components/ai-image-generator'

// Register all web components
const components = {
  'tailorkit-image-options-list': ImageOptionSetElement,
  'tailorkit-image-swatch': ImageSwatchElement,
  'tailorkit-image-dropdown-grid': ImageDropdownGridElement,
  'tailorkit-ai-image-generator': TailorKitAIImageGeneratorElement,
}

/**
 * Register all image option set web components
 */
export function registerImageOptionSetElements() {
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
