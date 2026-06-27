const ELEMENT_NAME = 'tailorkit-text-customer-input'

type TextInputElement = HTMLInputElement | HTMLTextAreaElement

function countChars(value: string) {
  return value.length
}

function truncate(value: string, limit: number) {
  return value.substring(0, limit)
}

class TextCustomerInputElement extends HTMLElement {
  private mounted = false
  private inputEl: TextInputElement | null = null
  private counterEl: HTMLSpanElement | null = null
  private wrapperEl: HTMLDivElement | null = null
  private fieldset: HTMLFieldSetElement | null = null
  private characterLimit = 50
  private allowMultiline = false

  static get observedAttributes() {
    return ['value', 'data-placeholder', 'data-allow-multiline', 'data-character-limit']
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (!this.mounted) return

    if (name === 'value') {
      this.setValue(newValue || '')
      return
    }

    if (name === 'data-placeholder' && this.inputEl) {
      this.inputEl.placeholder = newValue || 'Input your text'
      return
    }

    if (name === 'data-character-limit') {
      this.characterLimit = Math.max(1, Number(newValue) || this.characterLimit)
      this.setValue(this.inputEl?.value || '')
      return
    }

    if (name === 'data-allow-multiline') {
      const nextAllowMultiline = newValue === 'true'
      if (nextAllowMultiline !== this.allowMultiline) {
        const currentValue = this.inputEl?.value || ''
        this.allowMultiline = nextAllowMultiline
        this.buildInput()
        this.setValue(currentValue)
      }
    }
  }

  connectedCallback() {
    if (this.mounted) return
    this.mounted = true
    this.fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    this.characterLimit = Math.max(1, Number(this.getAttribute('data-character-limit')) || 50)
    this.allowMultiline = this.getAttribute('data-allow-multiline') === 'true'

    while (this.firstChild) this.removeChild(this.firstChild)
    this.buildInput()
    this.setValue(this.getAttribute('value') || '')
  }

  disconnectedCallback() {
    this.inputEl?.removeEventListener('input', this.handleInput)
    this.mounted = false
    this.inputEl = null
    this.counterEl = null
    this.wrapperEl = null
    this.fieldset = null
  }

  private buildInput() {
    this.inputEl?.removeEventListener('input', this.handleInput)
    this.wrapperEl?.remove()

    const wrapper = document.createElement('div')
    wrapper.className = 'emtlkit-textfield-container'

    const input = this.allowMultiline ? document.createElement('textarea') : document.createElement('input')
    input.className = 'emtlkit-textfield__input'
    input.placeholder = this.getAttribute('data-placeholder') || 'Input your text'
    input.setAttribute('data-role', 'text-input')
    if (!this.allowMultiline) {
      ;(input as HTMLInputElement).type = 'text'
    } else {
      ;(input as HTMLTextAreaElement).rows = 4
    }
    input.maxLength = this.characterLimit
    input.addEventListener('input', this.handleInput)

    const counter = document.createElement('span')
    counter.className = 'emtlkit-textfield__character-count'
    counter.setAttribute('data-role', 'text-counter')

    wrapper.appendChild(input)
    wrapper.appendChild(counter)
    this.appendChild(wrapper)

    this.inputEl = input
    this.counterEl = counter
    this.wrapperEl = wrapper
  }

  private readonly handleInput = () => {
    this.setValue(this.inputEl?.value || '')
  }

  private setValue(nextValue: string) {
    if (!this.inputEl || !this.counterEl) return

    const value = countChars(nextValue) > this.characterLimit ? truncate(nextValue, this.characterLimit) : nextValue
    this.inputEl.value = value
    this.counterEl.textContent = `${countChars(value)}/${this.characterLimit}`

    const fieldset = this.fieldset || (this.closest('fieldset') as HTMLFieldSetElement | null)
    if (fieldset) {
      fieldset.setAttribute('value', value)
      fieldset.dispatchEvent(new CustomEvent('emtlkit:textChanged', { bubbles: true, detail: { value } }))
      fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))
    }
  }
}

/** Registers TailorKit's customer text input element used by Liquid text_customer fieldsets. */
export function registerTextCustomerElements() {
  if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, TextCustomerInputElement)
  }
}
