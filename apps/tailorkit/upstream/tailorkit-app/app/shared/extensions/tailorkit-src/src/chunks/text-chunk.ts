/**
 * TailorKit Text Chunk
 *
 * Contains text-related web components:
 * - Text option set web components (dropdown, vertical list, etc.)
 * - Font option set web components (dropdown, swatch, etc.)
 * - Text customer input elements
 *
 * This chunk is loaded only when the template contains text layers.
 *
 * IMPORTANT: Text and Font option set components are imported from ./text/
 * which uses BaseWrapper to reference window.TailorKit.BaseOptionSetElement
 * instead of importing it directly. This prevents code duplication.
 *
 * @module chunks/text-chunk
 */

// Import chunk-specific components that use BaseWrapper
import { TextOptionSetElement } from './text/TextOptionSetElement'
import { TextOptionsDropdownElement } from './text/TextOptionsDropdownElement'
import { TextOptionsVerticalListElement } from './text/TextOptionsVerticalListElement'
import { FontOptionSetElement } from './text/FontOptionSetElement'
import { FontDropdownElement } from './text/FontDropdownElement'
import { FontSwatchElement } from './text/FontSwatchElement'

// TextCustomer chunk version also uses BaseWrapper for TextField
import { registerTextCustomerElements } from './text/TextCustomerElement'

// Register text option set components
const textComponents: Record<string, CustomElementConstructor> = {
  'tailorkit-text-options-list': TextOptionSetElement,
  'tailorkit-text-options-dropdown': TextOptionsDropdownElement,
  'tailorkit-text-options-vertical': TextOptionsVerticalListElement,
}

// Register font option set components
const fontComponents: Record<string, CustomElementConstructor> = {
  'tailorkit-font-options-list': FontOptionSetElement,
  'tailorkit-font-swatch': FontSwatchElement,
  'tailorkit-font-dropdown': FontDropdownElement,
}

// Register all components
Object.entries({ ...textComponents, ...fontComponents }).forEach(([tagName, component]) => {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, component)
  }
})

// Register text customer input (doesn't depend on BaseOptionSetElement)
registerTextCustomerElements()

// Mark chunk as loaded
window.__tailorkit__ = window.__tailorkit__ || {}
window.__tailorkit__.textChunkLoaded = true

console.log('[TailorKit] Text chunk loaded - registered text/font components')
