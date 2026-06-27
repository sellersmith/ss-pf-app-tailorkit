import { EmojiPickerElement } from './emoji-picker-element'

const ELEMENT_NAME = 'tailorkit-emoji-picker'

export function registerEmojiPickerElement() {
  if (typeof globalThis === 'undefined' || !('customElements' in globalThis)) return
  if (!globalThis.customElements.get(ELEMENT_NAME)) {
    globalThis.customElements.define(ELEMENT_NAME, EmojiPickerElement)
  }
}

export { EmojiPickerElement } from './emoji-picker-element'
