import TextField from '../../../assets/components/commons/textfield'
import { ROLE_TEXT_COUNTER, ROLE_TEXT_INPUT } from '../../../assets/utils/dom-constants'
import { graphemeCount, graphemeTruncate } from '../../utils/grapheme-utils'
import { fontStorefrontLoader } from '../font-storefront-loader'

const ELEMENT_NAME = 'tailorkit-text-customer-input'

class TextCustomerInputElement extends HTMLElement {
  #mounted = false
  #inputEl: HTMLInputElement | HTMLTextAreaElement | null = null
  #counterEl: HTMLSpanElement | null = null
  #characterLimit = 50
  #textFieldInstance: TextField | null = null
  /** When true, use grapheme counting instead of .length for character limit */
  #useGraphemeCounting = false
  /** Cached to allow rebuild without re-reading from DOM */
  #allowMultiLine = false
  /** Cached fieldset reference to avoid repeated closest() queries */
  #fieldset: HTMLFieldSetElement | null = null
  /** Wrapper div containing the TextField — replaced on rebuild */
  #wrapper: HTMLDivElement | null = null
  /** Observes font option set fieldset for data-family changes */
  #fontObserver: MutationObserver | null = null

  static get observedAttributes() {
    return [
      'value',
      'data-placeholder',
      'data-allow-multiline',
      'data-character-limit',
      'data-font-family',
      'data-font-src',
      'data-emoji-picker',
      'data-emoji-font-family',
      'data-emoji-font-src',
    ]
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'value' && this.#inputEl) {
      this.#setValue(newValue || '')
    }
    if (name === 'data-placeholder' && this.#inputEl) {
      this.#inputEl.placeholder = newValue || 'Input your text'
    }
    // Switching multiline requires replacing <input> with <textarea> — rebuild the TextField
    if (name === 'data-allow-multiline' && this.#mounted && this.#fieldset) {
      const currentValue = this.#inputEl?.value || ''
      this.#allowMultiLine = newValue === 'true'
      this.#buildTextField()
      if (this.#inputEl) this.#setValue(currentValue)
    }
    // Update character limit live — clamps current value if it now exceeds the new limit.
    // Guard: skip if attribute removed (null) or value unchanged — avoids resetting to
    // default 50 when React removes/re-adds the attribute during reconciliation.
    if (
      name === 'data-character-limit'
      && this.#inputEl
      && this.#counterEl
      && newValue !== null
      && _oldValue !== newValue
    ) {
      // Fallback to existing limit if value is NaN/0 to avoid breaking the counter
      const newLimit = Math.max(1, Number(newValue) || this.#characterLimit)
      this.#characterLimit = newLimit
      if (!this.#useGraphemeCounting) {
        this.#inputEl.maxLength = newLimit
      }
      // Re-apply limit to current value (truncates if value is now too long)
      const currentValue = this.#inputEl.value
      if (this.#countChars(currentValue) > newLimit) {
        this.#setValue(this.#truncate(currentValue, newLimit))
      } else {
        // Just update the counter display to show the new max
        this.#counterEl.textContent = `${this.#countChars(currentValue)}/${newLimit}`
      }
    }
    // Re-apply text font when font attributes change (e.g., from restore-option-values)
    if ((name === 'data-font-family' || name === 'data-font-src') && this.#mounted) {
      if (!this.#hasEmojiFont()) {
        const family = this.getAttribute('data-font-family')
        const src = this.getAttribute('data-font-src')
        if (family) {
          this.#applyFont(family, src || undefined)
        }
      }
    }
    // Rebuild emoji picker when emoji data or font changes
    if (
      (name === 'data-emoji-picker' || name === 'data-emoji-font-family' || name === 'data-emoji-font-src')
      && this.#mounted
    ) {
      this.#rebuildEmojiPicker()
    }
  }

  /** Count characters — grapheme-aware when emoji picker is enabled */
  #countChars(str: string): number {
    return this.#useGraphemeCounting ? graphemeCount(str) : str.length
  }

  /** Truncate string to character limit — grapheme-aware when emoji picker is enabled */
  #truncate(str: string, limit: number): string {
    return this.#useGraphemeCounting ? graphemeTruncate(str, limit) : str.substring(0, limit)
  }

  /** Rebuild the emoji picker when emojis or font attributes change */
  #rebuildEmojiPicker(): void {
    const emojiPickerEmojis = this.getAttribute('data-emoji-picker') || ''
    const emojiFontFamily = this.getAttribute('data-emoji-font-family')
    const emojiFontSrc = this.getAttribute('data-emoji-font-src')

    this.#useGraphemeCounting = emojiPickerEmojis.length > 0

    // Remove existing emoji picker
    const existingPicker = this.querySelector('tailorkit-emoji-picker')
    if (existingPicker) existingPicker.remove()

    // Update input font if emoji font changed
    if (emojiFontFamily && emojiFontSrc && this.#inputEl) {
      const inputEl = this.#inputEl
      const safeEmojiName = emojiFontFamily.replace(/'/g, "\\'")
      fontStorefrontLoader
        .loadFont(emojiFontFamily, emojiFontSrc)
        .then(() => {
          if (this.#inputEl !== inputEl) return
          inputEl.style.setProperty('font-family', `'${safeEmojiName}', sans-serif`, 'important')
        })
        .catch((err: unknown) => {
          console.error('[TextCustomer] Failed to load emoji font:', err)
        })
    } else if (this.#inputEl) {
      // Emoji font cleared — fall back to text layer font if available
      const textFontFamily = this.getAttribute('data-font-family')
      const textFontSrc = this.getAttribute('data-font-src')
      if (textFontFamily) {
        this.#applyFont(textFontFamily, textFontSrc || undefined)
      } else {
        this.#inputEl.style.fontFamily = ''
      }
    }

    // Re-create emoji picker if emojis are set
    if (emojiPickerEmojis) {
      const pickerEl = document.createElement('tailorkit-emoji-picker') as HTMLElement
      pickerEl.setAttribute('data-emojis', emojiPickerEmojis)
      if (emojiFontFamily) pickerEl.setAttribute('data-font-family', emojiFontFamily)
      if (emojiFontSrc) pickerEl.setAttribute('data-font-src', emojiFontSrc)
      this.appendChild(pickerEl)

      pickerEl.addEventListener('emoji-select', ((e: CustomEvent<{ emoji: string }>) => {
        const emoji = e.detail.emoji
        if (!this.#inputEl) return
        const currentValue = this.#inputEl.value
        const start = this.#inputEl.selectionStart ?? currentValue.length
        const end = this.#inputEl.selectionEnd ?? currentValue.length
        const before = currentValue.substring(0, start)
        const after = currentValue.substring(end)
        const insertedValue = before + emoji + after
        if (this.#countChars(insertedValue) > this.#characterLimit) return
        this.#inputEl.value = insertedValue
        this.#inputEl.setSelectionRange(start + emoji.length, start + emoji.length)
        this.#inputEl.dispatchEvent(new Event('input', { bubbles: true }))
        this.#inputEl.focus()
      }) as EventListener)
    }
  }

  /** Check if emoji font is active (emoji font takes precedence over text font) */
  #hasEmojiFont(): boolean {
    return !!(this.getAttribute('data-emoji-font-family') && this.getAttribute('data-emoji-font-src'))
  }

  /** Load a font and apply it to the input element */
  #applyFont(family: string, src?: string): void {
    if (!this.#inputEl) return
    const inputEl = this.#inputEl
    const safeName = family.replace(/'/g, "\\'")
    const cssValue = `'${safeName}', sans-serif`
    if (src) {
      fontStorefrontLoader
        .loadFont(family, src)
        .then(() => {
          if (this.#inputEl !== inputEl) return
          inputEl.style.setProperty('font-family', cssValue, 'important')
        })
        .catch((err: unknown) => {
          console.error('[TextCustomer] Failed to load font:', err)
        })
    } else {
      inputEl.style.setProperty('font-family', cssValue, 'important')
    }
  }

  /** Watch sibling font_option fieldset for data-family changes and update input font */
  #observeFontOptionChanges(): void {
    if (!this.#fieldset) return
    const layerWrapper = this.#fieldset.closest('.emtlkit--option-set-wrapper')?.parentElement
    if (!layerWrapper) return

    const layerId = this.#fieldset.getAttribute('data-layer-id')
    const fontFieldset = layerWrapper.querySelector<HTMLFieldSetElement>(
      `fieldset[data-option-type="font_option"]${layerId ? `[data-layer-id="${layerId}"]` : ''}`
    )
    if (!fontFieldset) return

    this.#fontObserver = new MutationObserver(() => {
      if (this.#hasEmojiFont()) return
      const family = fontFieldset.getAttribute('data-family')
      const src = fontFieldset.getAttribute('data-font-src')
      if (family) {
        this.#applyFont(family, src || undefined)
      }
    })

    this.#fontObserver.observe(fontFieldset, { attributes: true, attributeFilter: ['data-family', 'data-font-src'] })
  }

  /**
   * Build or rebuild the TextField DOM, replacing any existing wrapper.
   * Called on first mount and whenever data-allow-multiline changes.
   */
  #buildTextField(): void {
    const fieldset = this.#fieldset
    if (!fieldset) return

    // Remove existing wrapper if rebuilding (multiline toggle)
    if (this.#wrapper) {
      this.#wrapper.remove()
      this.#wrapper = null
      this.#inputEl = null
      this.#counterEl = null
    }

    const placeholder = this.getAttribute('data-placeholder') || 'Input your text'
    const initialValue = this.getAttribute('value') || ''

    const wrapper = document.createElement('div')
    wrapper.className = 'emtlkit-textfield-container'

    this.#textFieldInstance = new TextField({
      value: initialValue,
      placeholder,
      multiline: this.#allowMultiLine ? 4 : false,
      rows: 4,
      // When emoji picker is enabled, don't use HTML maxLength (it counts UTF-16 code units).
      // We enforce the limit in JS with grapheme-aware counting instead.
      maxLength: this.#useGraphemeCounting ? null : this.#characterLimit,
      showCharacterCount: true,
      clearable: false,
      onInput: (_e: Event, v: string) => {
        let value = v || ''
        if (this.#countChars(value) > this.#characterLimit) {
          value = this.#truncate(value, this.#characterLimit)
          // Sync truncated value back to the input element
          if (this.#inputEl) this.#inputEl.value = value
        }
        // Always override the counter with the current #characterLimit.
        // TextField constructs with whatever maxLength was at build time (may be stale
        // if connectedCallback ran before attributes were set). Overriding here ensures
        // the displayed limit always matches the live #characterLimit value.
        if (this.#counterEl) {
          this.#counterEl.textContent = `${this.#countChars(value)}/${this.#characterLimit}`
        }
        fieldset.setAttribute('value', value)
        fieldset.dispatchEvent(new CustomEvent('emtlkit:textChanged', { bubbles: true, detail: { value } }))
        fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))

        // Remove shake class from required indicator label when user types
        fieldset
          .querySelectorAll('.emtlkit--required-indicator--shake')
          .forEach(el => el.classList.remove('emtlkit--required-indicator--shake'))
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

    this.#wrapper = wrapper

    // Insert before emoji picker (if present) to keep picker below the text field
    const pickerEl = this.querySelector('tailorkit-emoji-picker')
    if (pickerEl) {
      this.insertBefore(wrapper, pickerEl)
    } else {
      this.appendChild(wrapper)
    }
  }

  connectedCallback(): void {
    if (this.#mounted) return
    this.#mounted = true

    // Remove SSR children if any
    while (this.firstChild) this.removeChild(this.firstChild)

    const fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    if (!fieldset) return

    this.#fieldset = fieldset

    const characterLimit = Number(this.getAttribute('data-character-limit') || '50')
    const allowMultiLine = (this.getAttribute('data-allow-multiline') || 'false') === 'true'
    const emojiPickerEmojis = this.getAttribute('data-emoji-picker') || ''

    this.#characterLimit = characterLimit
    this.#allowMultiLine = allowMultiLine
    this.#useGraphemeCounting = emojiPickerEmojis.length > 0

    this.#buildTextField()

    // Load custom emoji font and apply to input so inserted characters render correctly
    const emojiFontFamily = this.getAttribute('data-emoji-font-family')
    const emojiFontSrc = this.getAttribute('data-emoji-font-src')
    if (emojiFontFamily && emojiFontSrc && this.#inputEl) {
      const inputEl = this.#inputEl
      const safeEmojiName = emojiFontFamily.replace(/'/g, "\\'")
      fontStorefrontLoader
        .loadFont(emojiFontFamily, emojiFontSrc)
        .then(() => {
          if (this.#inputEl !== inputEl) return
          inputEl.style.setProperty('font-family', `'${safeEmojiName}', sans-serif`, 'important')
        })
        .catch((err: unknown) => {
          console.error('[TextCustomer] Failed to load emoji font:', err)
        })
    }

    // Apply the layer's default font to the input (skip if emoji font takes precedence)
    if (!this.#hasEmojiFont()) {
      const fontFamily = this.getAttribute('data-font-family')
      const fontSrc = this.getAttribute('data-font-src')
      if (fontFamily) {
        this.#applyFont(fontFamily, fontSrc || undefined)
      }
    }

    // Watch for font option set changes to update input font dynamically
    this.#observeFontOptionChanges()

    // Inline emoji picker — rendered as a visible row below the text input
    if (emojiPickerEmojis) {
      const pickerEl = document.createElement('tailorkit-emoji-picker') as HTMLElement
      pickerEl.setAttribute('data-emojis', emojiPickerEmojis)
      if (emojiFontFamily) pickerEl.setAttribute('data-font-family', emojiFontFamily)
      if (emojiFontSrc) pickerEl.setAttribute('data-font-src', emojiFontSrc)
      this.appendChild(pickerEl)

      pickerEl.addEventListener('emoji-select', ((e: CustomEvent<{ emoji: string }>) => {
        const emoji = e.detail.emoji
        if (!this.#inputEl) return

        const currentValue = this.#inputEl.value
        const start = this.#inputEl.selectionStart ?? currentValue.length
        const end = this.#inputEl.selectionEnd ?? currentValue.length
        const before = currentValue.substring(0, start)
        const after = currentValue.substring(end)
        const insertedValue = before + emoji + after

        // Respect character limit using grapheme-aware counting
        if (this.#countChars(insertedValue) > this.#characterLimit) return

        this.#inputEl.value = insertedValue
        this.#inputEl.setSelectionRange(start + emoji.length, start + emoji.length)

        // Trigger the same events as normal typing
        this.#inputEl.dispatchEvent(new Event('input', { bubbles: true }))
        this.#inputEl.focus()
      }) as EventListener)
    }
  }

  disconnectedCallback(): void {
    this.#mounted = false
    this.#inputEl = null
    this.#counterEl = null
    this.#fieldset = null
    this.#wrapper = null
    this.#fontObserver?.disconnect()
    this.#fontObserver = null
  }

  #setValue(value: string) {
    if (!this.#inputEl || !this.#counterEl) return
    const limited = this.#truncate(value, this.#characterLimit)
    this.#inputEl.value = limited
    this.#counterEl.textContent = `${this.#countChars(limited)}/${this.#characterLimit}`
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
