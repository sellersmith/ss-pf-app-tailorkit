import type { ButtonOptions } from './types'

class Button {
  private options: ButtonOptions
  private element: HTMLElement | null

  constructor(options: ButtonOptions = {}) {
    this.options = {
      variant: 'default', // 'default', 'primary', 'destructive', 'outline', 'plain'
      size: 'medium', // 'slim', 'medium', 'large'
      tone: 'default', // 'default', 'success', 'critical'
      className: '',
      styles: {} as Record<string, string>,
      attributes: {},
      fullWidth: false,
      disabled: false,
      loading: false,
      pressed: false,
      submit: false,
      destructive: false,
      outline: false,
      plain: false,
      primary: false,
      icon: null,
      iconOnly: false,
      disclosure: false,
      external: false,
      url: null,
      target: null,
      download: null,
      id: null,
      name: null,
      value: null,
      onBlur: null,
      onClick: null,
      onFocus: null,
      onKeyDown: null,
      onKeyPress: null,
      onKeyUp: null,
      onMouseEnter: null,
      onMouseLeave: null,
      onTouchStart: null,
      children: '',
      ...options,
    }

    this.element = null
    this.create()
  }

  create(): HTMLElement {
    // Determine the element type
    const isLink = this.options.url || this.options.external
    const elementType = isLink ? 'a' : 'button'

    this.element = document.createElement(elementType)

    // Set basic attributes
    this.setAttributes()
    this.setClasses()
    this.setContent()
    this.attachEventListeners()

    return this.element
  }

  setAttributes(): void {
    const { element, options } = this
    if (!element) return

    // Common attributes
    if (options.id) element.id = options.id

    if (options.styles) {
      Object.entries(options.styles).forEach(([key, value]) => {
        element.style[key as any] = value
      })
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value)
      })
    }

    if (element.tagName === 'BUTTON') {
      // Button-specific attributes
      ;(element as HTMLButtonElement).type = options.submit ? 'submit' : 'button'
      if (options.name) (element as HTMLButtonElement).name = options.name
      if (options.value) (element as HTMLButtonElement).value = options.value
      if (options.disabled || options.loading) (element as HTMLButtonElement).disabled = true
      if (options.pressed) element.setAttribute('aria-pressed', 'true')
    } else {
      // Link-specific attributes
      if (options.url) (element as HTMLAnchorElement).href = options.url
      if (options.target) (element as HTMLAnchorElement).target = options.target || ''
      if (options.download) (element as HTMLAnchorElement).download = options.download
      if (options.external) {
        const anchorElement = element as HTMLAnchorElement
        anchorElement.target = '_blank'
        anchorElement.rel = 'noopener noreferrer'
      }
    }
  }

  setClasses(): void {
    const { element, options } = this
    if (!element) return

    const classes = ['emtlkit-button']

    if (options.className) {
      const classList = options.className.split(' ')
      classList.forEach(className => {
        classes.push(className)
      })
    }

    // Variant classes
    if (options.primary || options.variant === 'primary') {
      classes.push('emtlkit-button--primary')
    } else if (options.destructive || options.variant === 'destructive') {
      classes.push('emtlkit-button--destructive')
    } else if (options.outline || options.variant === 'outline') {
      classes.push('emtlkit-button--outline')
    } else if (options.plain || options.variant === 'plain') {
      classes.push('emtlkit-button--plain')
    } else if (options.monochromePlain || options.variant === 'monochromePlain') {
      classes.push('emtlkit-button--monochromePlain')
    }

    // Size classes
    if (options.size === 'slim') {
      classes.push('emtlkit-button--slim')
    } else if (options.size === 'large') {
      classes.push('emtlkit-button--large')
    }

    // State classes
    if (options.fullWidth) classes.push('emtlkit-button--fullWidth')
    if (options.loading) classes.push('emtlkit-button--loading')
    if (options.pressed) classes.push('emtlkit-button--pressed')
    if (options.iconOnly) classes.push('emtlkit-button--iconOnly')

    element.className = classes.join(' ')
  }

  setContent(): void {
    const { element, options } = this
    if (!element) return

    element.innerHTML = ''

    // Add loading spinner
    if (options.loading) {
      const spinner = document.createElement('span')
      spinner.className = 'emtlkit-button__spinner'
      element.appendChild(spinner)
    }

    // Add icon
    if (options.icon && !options.iconOnly) {
      const iconWrapper = document.createElement('span')
      iconWrapper.className = 'emtlkit-button__icon'
      iconWrapper.innerHTML = options.icon
      element.appendChild(iconWrapper)
    }

    // Add text content
    if (options.children && !options.iconOnly) {
      const textNode = document.createTextNode(options.children)
      element.appendChild(textNode)
    } else if (options.iconOnly && options.icon) {
      const iconWrapper = document.createElement('span')
      iconWrapper.className = 'emtlkit-button__icon'
      iconWrapper.innerHTML = options.icon
      element.appendChild(iconWrapper)
    }

    // Add disclosure indicator
    if (options.disclosure) {
      const disclosureIcon = document.createElement('span')
      disclosureIcon.className = 'emtlkit-button__icon'
      disclosureIcon.innerHTML = `
                        <svg viewBox="0 0 20 20">
                            <path d="M7 7l3 3 3-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    `
      element.appendChild(disclosureIcon)
    }
  }

  attachEventListeners(): void {
    const { element, options } = this
    if (!element) return

    // Attach all event listeners
    const events = [
      'onBlur',
      'onClick',
      'onFocus',
      'onKeyDown',
      'onKeyPress',
      'onKeyUp',
      'onMouseEnter',
      'onMouseLeave',
      'onTouchStart',
    ]

    events.forEach(eventName => {
      if (
        options[eventName as keyof ButtonOptions]
        && typeof options[eventName as keyof ButtonOptions] === 'function'
      ) {
        const domEventName = eventName.replace('on', '').toLowerCase()
        element.addEventListener(domEventName, options[eventName as keyof ButtonOptions] as EventListener)
      }
    })
  }

  // Public methods
  setLoading(loading: boolean): void {
    this.options.loading = loading
    if (!this.element) return
    ;(this.element as HTMLButtonElement).disabled = loading || !!this.options.disabled

    if (loading) {
      this.element.classList.add('emtlkit-button--loading')
    } else {
      this.element.classList.remove('emtlkit-button--loading')
    }

    this.setContent()
  }

  setDisabled(disabled: boolean): void {
    this.options.disabled = disabled
    if (!this.element) return
    ;(this.element as HTMLButtonElement).disabled = disabled || !!this.options.loading
  }

  setPressed(pressed: boolean): void {
    this.options.pressed = pressed
    if (!this.element) return

    if (pressed) {
      this.element.classList.add('emtlkit-button--pressed')
      this.element.setAttribute('aria-pressed', 'true')
    } else {
      this.element.classList.remove('emtlkit-button--pressed')
      this.element.removeAttribute('aria-pressed')
    }
  }

  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }

  /**
   * Appends the button to a container element
   * @param container - The container element or selector to append the button to
   * @example
   * new Button({
   *   children: 'Click me',
   *   variant: 'primary'
   * }).appendTo('#container');
   */
  appendTo(container: string | HTMLElement): void {
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

  /**
   * Get the button element
   * @returns The button element or null if not created
   */
  getElement(): HTMLElement | null {
    return this.element
  }

  // Static method for creating buttons
  static create(options: ButtonOptions): Button {
    return new Button(options)
  }
}

export default Button
