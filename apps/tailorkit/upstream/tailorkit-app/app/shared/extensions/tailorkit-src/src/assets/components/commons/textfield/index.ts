import type { TextFieldOptions } from './types'
/**
 * TextField component
 * @param options - Options for the TextField component
 * @returns TextField component
 *
 * @example
 * new TextField({
 *   label: 'Store name',
 *   placeholder: 'Enter your store name',
 *   helpText: 'This will be displayed to customers'
 * }).appendTo('#container');
 */
class TextField {
  private options: TextFieldOptions
  private element: HTMLElement | null
  private inputElement: HTMLInputElement | HTMLTextAreaElement | null
  private currentValue: string

  constructor(options: TextFieldOptions = {}) {
    this.options = {
      id: options.id || this.generateId(),
      label: options.label || '',
      placeholder: options.placeholder || '',
      value: options.value || '',
      type: options.type || 'text',
      disabled: options.disabled || false,
      readOnly: options.readOnly || false,
      required: options.required || false,
      error: options.error || null,
      helpText: options.helpText || '',
      prefix: options.prefix || null,
      suffix: options.suffix || null,
      multiline: options.multiline || false,
      rows: options.rows || 3,
      autoComplete: options.autoComplete || 'off',
      maxLength: options.maxLength || null,
      showCharacterCount: options.showCharacterCount || false,
      clearable: options.clearable || false,
      size: options.size || 'medium',
      loading: options.loading || false,
      monospaced: options.monospaced || false,
      autoSize: options.autoSize || false,
      connectedLeft: options.connectedLeft || false,
      connectedRight: options.connectedRight || false,
      focused: options.focused || false,
      align: options.align || 'left',
      inputMode: options.inputMode,
      variant: options.variant || 'inherit',
      onChange: options.onChange,
      onBlur: options.onBlur,
      onFocus: options.onFocus,
      onInput: options.onInput,
      ...options,
    }

    this.element = null
    this.inputElement = null
    this.currentValue = this.options.value || ''

    this.render()
    this.bindEvents()

    // if (this.options.focused) {
    //   setTimeout(() => this.focus(), 100)
    // }
  }

  private generateId(): string {
    return `textfield-${Math.random().toString(36).substr(2, 9)}`
  }

  private render(): void {
    const wrapper = document.createElement('div')
    wrapper.className = this.getWrapperClasses()

    // Label
    if (this.options.label) {
      const label = document.createElement('label')
      label.className = this.getLabelClasses()
      label.htmlFor = this.options.id || ''
      if (typeof this.options.label === 'string') {
        label.textContent = this.options.label
      } else {
        label.appendChild(this.options.label)
      }
      wrapper.appendChild(label)
    }

    // Input wrapper
    const inputWrapper = document.createElement('div')
    inputWrapper.className = 'emtlkit-textfield__input-wrapper'

    // Prefix
    if (this.options.prefix) {
      const prefix = document.createElement('div')
      prefix.className = 'emtlkit-textfield__prefix'
      prefix.textContent = typeof this.options.prefix === 'string' ? this.options.prefix : ''
      inputWrapper.appendChild(prefix)
    }

    // Input element
    this.inputElement = this.createInputElement()
    inputWrapper.appendChild(this.inputElement)

    // Character count
    if (this.options.showCharacterCount || this.options.maxLength) {
      const charCount = document.createElement('div')
      charCount.className = this.getCharacterCountClasses()
      charCount.textContent = this.getCharacterCountText()
      inputWrapper.appendChild(charCount)
    }

    // Clear button
    if (this.options.clearable) {
      const clearButton = document.createElement('button')
      clearButton.type = 'button'
      clearButton.className = 'emtlkit-textfield__clear-button'
      clearButton.innerHTML = '✕'
      clearButton.setAttribute('aria-label', 'Clear')
      inputWrapper.appendChild(clearButton)
    }

    // Suffix
    if (this.options.suffix) {
      const suffix = document.createElement('div')
      suffix.className = 'emtlkit-textfield__suffix'
      suffix.textContent = typeof this.options.suffix === 'string' ? this.options.suffix : ''
      inputWrapper.appendChild(suffix)
    }

    wrapper.appendChild(inputWrapper)

    // Error message
    if (this.options.error) {
      const error = document.createElement('div')
      error.className = 'emtlkit-textfield__error'
      error.textContent = typeof this.options.error === 'string' ? this.options.error : ''
      wrapper.appendChild(error)
    }

    // Help text
    if (this.options.helpText && !this.options.error) {
      const helpText = document.createElement('div')
      helpText.className = 'emtlkit-textfield__help-text'
      helpText.textContent = typeof this.options.helpText === 'string' ? this.options.helpText : ''
      wrapper.appendChild(helpText)
    }

    this.element = wrapper
    this.updateClearButtonVisibility()
  }

  private createInputElement(): HTMLInputElement | HTMLTextAreaElement {
    const isMultiline = !!this.options.multiline
    const element = isMultiline ? document.createElement('textarea') : document.createElement('input')

    element.id = this.options.id || ''
    element.className = this.getInputClasses()
    element.value = this.options.value || ''
    element.placeholder = this.options.placeholder || ''
    element.disabled = !!this.options.disabled
    element.readOnly = !!this.options.readOnly
    element.required = !!this.options.required

    // Handle autocomplete as a string attribute
    if (this.options.autoComplete) {
      element.setAttribute('autocomplete', this.options.autoComplete)
    }

    // Handle input mode if provided
    if (this.options.inputMode) {
      element.setAttribute('inputmode', this.options.inputMode)
    }

    // Handle text alignment
    if (this.options.align) {
      element.style.textAlign = this.options.align
    }

    if (!isMultiline && element instanceof HTMLInputElement) {
      element.type = this.options.type || 'text'
    }

    if (isMultiline && element instanceof HTMLTextAreaElement) {
      const rows = typeof this.options.multiline === 'number' ? this.options.multiline : this.options.rows || 3
      element.rows = rows
    }

    if (this.options.maxLength && this.options.maxLength > 0) {
      element.maxLength = this.options.maxLength
    }

    if (this.options.monospaced) {
      element.style.fontFamily = 'monospace'
    }

    return element
  }

  private getWrapperClasses(): string {
    const classes = ['emtlkit-textfield']

    if (this.options.readOnly) classes.push('emtlkit-textfield--readonly')
    if (this.options.loading) classes.push('emtlkit-textfield--loading')
    if (this.options.variant === 'borderless') classes.push('emtlkit-textfield--borderless')

    return classes.join(' ')
  }

  private getLabelClasses(): string {
    const classes = ['emtlkit-textfield__label']

    if (this.options.required) classes.push('emtlkit-textfield__label--required')
    if (this.options.disabled) classes.push('emtlkit-textfield__label--disabled')

    return classes.join(' ')
  }

  private getInputClasses(): string {
    const classes = ['emtlkit-textfield__input']

    if (this.options.error) classes.push('emtlkit-textfield__input--error')
    if (this.options.multiline) classes.push('emtlkit-textfield__input--multiline')
    if (this.options.showCharacterCount || this.options.maxLength) {
      classes.push('emtlkit-textfield__input--with-counter')
    }

    if (this.options.size === 'large') {
      classes.push('emtlkit-textfield__input--large')
    } else if (this.options.size === 'slim') {
      classes.push('emtlkit-textfield__input--slim')
    }

    if (this.options.prefix) classes.push('emtlkit-textfield__input--with-prefix')
    if (this.options.suffix) classes.push('emtlkit-textfield__input--with-suffix')

    return classes.join(' ')
  }

  private getCharacterCountClasses(): string {
    const classes = ['emtlkit-textfield__character-count']

    if (this.options.maxLength && this.currentValue.length > this.options.maxLength) {
      classes.push('emtlkit-textfield__character-count--error')
    }

    return classes.join(' ')
  }

  private getCharacterCountText(): string {
    if (this.options.maxLength) {
      return `${this.currentValue.length}/${this.options.maxLength}`
    }
    return `${this.currentValue.length} characters`
  }

  private bindEvents(): void {
    if (!this.inputElement) return

    this.inputElement.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement
      this.currentValue = target.value
      this.updateCharacterCount()
      this.updateClearButtonVisibility()
      if (this.options.onInput) this.options.onInput(e, this.currentValue)
      if (this.options.onChange) this.options.onChange(this.currentValue)
    })

    this.inputElement.addEventListener('focus', (e: Event) => {
      if (this.options.onFocus) this.options.onFocus(e)
    })

    this.inputElement.addEventListener('blur', (e: Event) => {
      if (this.options.onBlur) this.options.onBlur(e)
    })

    // Handle Escape key press to unfocus (blur) the text field
    this.inputElement.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent
      if (keyEvent.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.blur()
      }
      // Handle Enter key press for single-line text fields
      if (keyEvent.key === 'Enter' && !this.options.multiline) {
        e.preventDefault()
        e.stopPropagation()
        this.blur()
      }
    })

    // Clear button
    if (this.options.clearable && this.element) {
      const clearButton = this.element.querySelector('.emtlkit-textfield__clear-button')
      if (clearButton) {
        clearButton.addEventListener('click', () => {
          this.setValue('')
          this.focus()
        })
      }
    }
  }

  private updateCharacterCount(): void {
    if (!this.element) return

    const charCountElement = this.element.querySelector('.emtlkit-textfield__character-count')
    if (charCountElement) {
      charCountElement.textContent = this.getCharacterCountText()
      charCountElement.className = this.getCharacterCountClasses()
    }
  }

  private updateClearButtonVisibility(): void {
    if (!this.options.clearable || !this.element) return

    const clearButton = this.element.querySelector('.emtlkit-textfield__clear-button')
    if (clearButton) {
      if (this.currentValue.length > 0 && !this.options.disabled && !this.options.readOnly) {
        clearButton.classList.add('emtlkit-textfield__clear-button--visible')
      } else {
        clearButton.classList.remove('emtlkit-textfield__clear-button--visible')
      }
    }
  }

  // Public methods
  public getValue(): string {
    return this.currentValue
  }

  public setValue(value: string): void {
    this.currentValue = value
    if (this.inputElement) {
      this.inputElement.value = value
      this.updateCharacterCount()
      this.updateClearButtonVisibility()
    }
    // Ensure external listeners react the same way as user input
    if (this.options.onChange) this.options.onChange(this.currentValue)
    if (this.options.onInput) this.options.onInput(new Event('input'), this.currentValue)
  }

  public focus(): void {
    if (this.inputElement) {
      this.inputElement.focus()
    }
  }

  public blur(): void {
    if (this.inputElement) {
      this.inputElement.blur()
    }
  }

  public setError(error: string | null): void {
    this.options.error = error
    // Re-render error state
    if (!this.element) return

    const existingError = this.element.querySelector('.emtlkit-textfield__error')
    if (existingError) {
      existingError.remove()
    }

    if (error && this.inputElement) {
      const errorElement = document.createElement('div')
      errorElement.className = 'emtlkit-textfield__error'
      errorElement.textContent = error
      this.element.appendChild(errorElement)
      this.inputElement.classList.add('emtlkit-textfield__input--error')
    } else if (this.inputElement) {
      this.inputElement.classList.remove('emtlkit-textfield__input--error')
    }
  }

  public setDisabled(disabled: boolean): void {
    this.options.disabled = disabled
    if (this.inputElement) {
      this.inputElement.disabled = disabled
    }
    this.updateClearButtonVisibility()
  }

  public appendTo(container: string | HTMLElement): void {
    if (typeof container === 'string') {
      const element = document.querySelector(container)
      if (element instanceof HTMLElement) {
        container = element
      } else {
        return // Invalid selector or element not found
      }
    }
    if (container && this.element) {
      container.appendChild(this.element)
    }
  }

  public destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}

export default TextField
