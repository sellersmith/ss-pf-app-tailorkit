/**
 * Text Customer Input Element - Chunk Version
 *
 * This is a chunk-specific version that imports all shared dependencies from
 * window.TailorKit via BaseWrapper instead of direct ES module imports.
 */
import { TextField, ROLE_TEXT_INPUT, ROLE_TEXT_COUNTER } from './BaseWrapper'

const ELEMENT_NAME = 'tailorkit-text-customer-input'

class TextCustomerInputElement extends HTMLElement {
  #mounted = false
  #inputEl: HTMLInputElement | HTMLTextAreaElement | null = null
  #counterEl: HTMLSpanElement | null = null
  #characterLimit = 50
  #textFieldInstance: InstanceType<typeof TextField> | null = null

  static get observedAttributes() {
    return ['data-initial-value']
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'data-initial-value' && this.#inputEl) {
      this.#setValue(newValue || '')
    }
  }

  connectedCallback(): void {
    if (this.#mounted) return
    this.#mounted = true

    // Remove SSR children if any
    while (this.firstChild) this.removeChild(this.firstChild)

    const fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    if (!fieldset) return

    const characterLimit = Number(this.getAttribute('data-character-limit') || '50')
    const placeholder = this.getAttribute('data-placeholder') || 'Input your text'
    const allowMultiLine = (this.getAttribute('data-allow-multiline') || 'false') === 'true'
    const initialValue = this.getAttribute('data-initial-value') || ''

    this.#characterLimit = characterLimit

    const wrapper = document.createElement('div')
    wrapper.className = 'emtlkit-textfield-container'

    this.#textFieldInstance = new TextField({
      value: initialValue,
      placeholder,
      multiline: allowMultiLine ? 4 : false,
      rows: 4,
      maxLength: characterLimit,
      showCharacterCount: true,
      clearable: false,
      onInput: (_e: Event, v: string) => {
        let value = v || ''
        if (value.length > this.#characterLimit) {
          value = value.substring(0, this.#characterLimit)
        }
        fieldset.setAttribute('value', value)
        fieldset.dispatchEvent(new CustomEvent('emtlkit:textChanged', { bubbles: true, detail: { value } }))
        fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))
      },
    })

    this.#textFieldInstance.appendTo(wrapper)

    // Grab the inner input to set name for localStorage integration
    const innerInput = wrapper.querySelector('.emtlkit-textfield__input') as HTMLInputElement | HTMLTextAreaElement
    this.#inputEl = innerInput
    if (innerInput) {
      const pa = fieldset.getAttribute('data-print-area-id')
      const lid = fieldset.getAttribute('data-layer-id')
      if (pa && lid) {
        innerInput.setAttribute('name', `${pa} / ${lid}`)
        innerInput.setAttribute('data-role', ROLE_TEXT_INPUT)
      }
    }

    // Character counter element
    const counter = wrapper.querySelector('.emtlkit-textfield__character-count') as HTMLSpanElement
    if (counter) counter.setAttribute('data-role', ROLE_TEXT_COUNTER)
    this.#counterEl = counter

    this.appendChild(wrapper)
  }

  disconnectedCallback(): void {
    this.#mounted = false
    this.#inputEl = null
    this.#counterEl = null
  }

  #setValue(value: string) {
    if (!this.#inputEl || !this.#counterEl) return
    const limited = value.substring(0, this.#characterLimit)
    this.#inputEl.value = limited
    this.#counterEl.textContent = `${limited.length}/${this.#characterLimit}`
    const fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    if (fieldset) {
      fieldset.setAttribute('value', limited)
    }
  }
}

export function registerTextCustomerElements() {
  if (!globalThis?.customElements?.get(ELEMENT_NAME)) {
    globalThis.customElements.define(ELEMENT_NAME, TextCustomerInputElement)
  }
}
