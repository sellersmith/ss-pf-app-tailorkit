// registerOptionSetElements.ts - Web Component implementation for option sets
import { registerTextOptionSetElements } from './TextOptionSet'
import { registerColorOptionSetElements } from './ColorOptionSet'
import { registerImageOptionSetElements } from './ImageOptionSet'
import { registerFontOptionSetElements } from './FontOptionSet'
import { registerTextCustomerElements } from './TextCustomer'
import { registerImageEditorModalElement } from './ImageEditorModal'
import { registerCharmPickerElement } from './CharmPicker'
import { registerEmojiPickerElement } from './EmojiPicker'
import { registerImagelessOptionSetElements } from './ImagelessOptionSet'
import { registerMultiLayoutOptionSetElements } from './MultiLayoutOptionSet'

// Register all option set elements
// Note: Charm picker is lazy-loaded via charm-builder feature module (loadFeature('charm-builder'))
export function registerOptionSetElements() {
  registerTextOptionSetElements()
  registerColorOptionSetElements()
  registerImageOptionSetElements()
  registerFontOptionSetElements()
  registerTextCustomerElements()
  registerImageEditorModalElement()

  // Register charm picker element
  registerCharmPickerElement()

  // Register emoji picker element
  registerEmojiPickerElement()

  // Register imageless option set elements
  registerImagelessOptionSetElements()

  // Register multi-layout option set elements
  registerMultiLayoutOptionSetElements()

  console.log('Finished registering all option set elements')
}

// Auto-register when module is imported
registerOptionSetElements()
