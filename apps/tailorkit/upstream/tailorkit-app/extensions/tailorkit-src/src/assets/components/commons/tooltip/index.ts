import type { TooltipOptions, TooltipPosition } from './types'

class Tooltip {
  private static instances: WeakMap<HTMLElement, Tooltip> = new WeakMap()

  private options: TooltipOptions
  private triggerElement: HTMLElement
  private tooltipElement: HTMLElement | null
  private isVisible: boolean
  private showTimeout: number | null
  private hideTimeout: number | null
  private boundHandlers: Map<string, EventListener>

  constructor(triggerElement: HTMLElement, options: TooltipOptions) {
    this.triggerElement = triggerElement
    this.options = {
      position: 'top',
      trigger: 'hover',
      delay: 0,
      hideDelay: 0,
      className: '',
      maxWidth: 200,
      disabled: false,
      offset: 8,
      zIndex: 1000,
      appendTo: document.body,
      onShow: undefined,
      onHide: undefined,
      onToggle: undefined,
      ...options,
    }

    this.tooltipElement = null
    this.isVisible = false
    this.showTimeout = null
    this.hideTimeout = null
    this.boundHandlers = new Map()

    // Store instance in WeakMap
    Tooltip.instances.set(triggerElement, this)

    this.init()
  }

  private init(): void {
    if (this.options.disabled) return

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      this.createTooltip()
      this.attachEventListeners()
    })
  }

  private createTooltip(): void {
    this.tooltipElement = document.createElement('div')
    this.tooltipElement.className = this.getTooltipClasses()
    this.tooltipElement.style.zIndex = this.options.zIndex!.toString()

    // Ensure tooltip is initially hidden
    this.tooltipElement.style.visibility = 'hidden'
    this.tooltipElement.style.opacity = '0'
    this.tooltipElement.style.pointerEvents = 'none'

    // Create content wrapper
    const contentElement = document.createElement('div')
    contentElement.className = 'emtlkit-tooltip__content'
    contentElement.textContent = this.options.content

    if (this.options.maxWidth) {
      contentElement.style.maxWidth = `${this.options.maxWidth}px`
    }

    // Create arrow
    const arrowElement = document.createElement('div')
    arrowElement.className = 'emtlkit-tooltip__arrow'

    this.tooltipElement.appendChild(contentElement)
    this.tooltipElement.appendChild(arrowElement)

    // Append to container
    const container = this.getContainer()
    container.appendChild(this.tooltipElement)

    // Set initial position off-screen to prevent flash
    this.tooltipElement.style.top = '-9999px'
    this.tooltipElement.style.left = '-9999px'
  }

  private getTooltipClasses(): string {
    const classes = ['emtlkit-tooltip', `emtlkit-tooltip--${this.options.position}`]

    if (this.options.className) {
      classes.push(this.options.className)
    }

    return classes.join(' ')
  }

  private getContainer(): HTMLElement {
    if (typeof this.options.appendTo === 'string') {
      const container = document.querySelector(this.options.appendTo) as HTMLElement
      return container || document.body
    }
    return (this.options.appendTo as HTMLElement) || document.body
  }

  private attachEventListeners(): void {
    const trigger = this.options.trigger!

    if (trigger === 'hover') {
      this.addEventHandler('mouseenter', this.handleMouseEnter.bind(this))
      this.addEventHandler('mouseleave', this.handleMouseLeave.bind(this))
      this.addEventHandler('focus', this.handleFocus.bind(this))
      this.addEventHandler('blur', this.handleBlur.bind(this))
    } else if (trigger === 'click') {
      this.addEventHandler('click', this.handleClick.bind(this))
    } else if (trigger === 'focus') {
      this.addEventHandler('focus', this.handleFocus.bind(this))
      this.addEventHandler('blur', this.handleBlur.bind(this))
    }

    // Global handlers
    this.addGlobalEventHandler('scroll', this.handleScroll.bind(this))
    this.addGlobalEventHandler('resize', this.handleResize.bind(this))
  }

  private addEventHandler(event: string, handler: EventListener): void {
    this.triggerElement.addEventListener(event, handler)
    this.boundHandlers.set(event, handler)
  }

  private addGlobalEventHandler(event: string, handler: EventListener): void {
    window.addEventListener(event, handler)
    this.boundHandlers.set(`global:${event}`, handler)
  }

  private handleMouseEnter(): void {
    this.clearHideTimeout()
    this.scheduleShow()
  }

  private handleMouseLeave(): void {
    this.clearShowTimeout()
    this.scheduleHide()
  }

  private handleFocus(): void {
    this.clearHideTimeout()
    this.scheduleShow()
  }

  private handleBlur(): void {
    this.clearShowTimeout()
    this.scheduleHide()
  }

  private handleClick(): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  private handleScroll(): void {
    if (this.isVisible) {
      this.updatePosition()
    }
  }

  private handleResize(): void {
    if (this.isVisible) {
      this.updatePosition()
    }
  }

  private scheduleShow(): void {
    if (this.options.disabled || this.isVisible) return

    this.clearShowTimeout()

    if (this.options.delay! > 0) {
      this.showTimeout = window.setTimeout(() => {
        this.show()
      }, this.options.delay)
    } else {
      this.show()
    }
  }

  private scheduleHide(): void {
    if (!this.isVisible) return

    this.clearHideTimeout()

    if (this.options.hideDelay! > 0) {
      this.hideTimeout = window.setTimeout(() => {
        this.hide()
      }, this.options.hideDelay)
    } else {
      this.hide()
    }
  }

  private clearShowTimeout(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout)
      this.showTimeout = null
    }
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
  }

  show(): void {
    if (this.options.disabled || this.isVisible || !this.tooltipElement) return

    this.isVisible = true

    // Reset inline styles that might interfere
    this.tooltipElement.style.visibility = ''
    this.tooltipElement.style.opacity = ''
    this.tooltipElement.style.pointerEvents = ''

    // Update position before showing
    this.updatePosition()

    // Add visible class and animation
    this.tooltipElement.classList.add('emtlkit-tooltip--visible')
    this.tooltipElement.classList.add('emtlkit-tooltip--fade-in')

    // Remove fade-in class after animation
    setTimeout(() => {
      if (this.tooltipElement) {
        this.tooltipElement.classList.remove('emtlkit-tooltip--fade-in')
      }
    }, 200)

    this.options.onShow?.()
    this.options.onToggle?.(true)
  }

  hide(): void {
    if (!this.isVisible || !this.tooltipElement) return

    this.isVisible = false
    this.tooltipElement.classList.add('emtlkit-tooltip--fade-out')
    this.tooltipElement.classList.remove('emtlkit-tooltip--visible')

    // Remove fade-out class after animation and ensure hidden state
    setTimeout(() => {
      if (this.tooltipElement) {
        this.tooltipElement.classList.remove('emtlkit-tooltip--fade-out')
        // Ensure tooltip is properly hidden
        this.tooltipElement.style.visibility = 'hidden'
        this.tooltipElement.style.opacity = '0'
        this.tooltipElement.style.pointerEvents = 'none'
      }
    }, 200)

    this.options.onHide?.()
    this.options.onToggle?.(false)
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  private updatePosition(): void {
    if (!this.tooltipElement) return

    const triggerRect = this.triggerElement.getBoundingClientRect()
    const tooltipRect = this.tooltipElement.getBoundingClientRect()
    const position = this.options.position!
    const offset = this.options.offset!

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - offset
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'top-left':
        top = triggerRect.top - tooltipRect.height - offset
        left = triggerRect.left
        break
      case 'top-right':
        top = triggerRect.top - tooltipRect.height - offset
        left = triggerRect.right - tooltipRect.width
        break
      case 'bottom':
        top = triggerRect.bottom + offset
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'bottom-left':
        top = triggerRect.bottom + offset
        left = triggerRect.left
        break
      case 'bottom-right':
        top = triggerRect.bottom + offset
        left = triggerRect.right - tooltipRect.width
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.left - tooltipRect.width - offset
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.right + offset
        break
    }

    // Adjust for viewport boundaries
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    // Horizontal boundary checks
    if (left < 0) {
      left = 8
    } else if (left + tooltipRect.width > viewport.width) {
      left = viewport.width - tooltipRect.width - 8
    }

    // Vertical boundary checks
    if (top < 0) {
      top = 8
    } else if (top + tooltipRect.height > viewport.height) {
      top = viewport.height - tooltipRect.height - 8
    }

    // Add scroll offset
    top += window.scrollY
    left += window.scrollX

    this.tooltipElement.style.top = `${top}px`
    this.tooltipElement.style.left = `${left}px`
  }

  updateContent(content: string): void {
    this.options.content = content
    if (this.tooltipElement) {
      const contentElement = this.tooltipElement.querySelector('.emtlkit-tooltip__content')
      if (contentElement) {
        contentElement.textContent = content
      }
    }
  }

  setPosition(position: TooltipPosition): void {
    this.options.position = position
    if (this.tooltipElement) {
      // Update classes
      this.tooltipElement.className = this.getTooltipClasses()
      if (this.isVisible) {
        this.tooltipElement.classList.add('emtlkit-tooltip--visible')
      }
      // Update position
      this.updatePosition()
    }
  }

  enable(): void {
    this.options.disabled = false
    this.attachEventListeners()
  }

  disable(): void {
    this.options.disabled = true
    this.hide()
    this.removeEventListeners()
  }

  private removeEventListeners(): void {
    this.boundHandlers.forEach((handler, event) => {
      if (event.startsWith('global:')) {
        const globalEvent = event.replace('global:', '')
        window.removeEventListener(globalEvent, handler)
      } else {
        this.triggerElement.removeEventListener(event, handler)
      }
    })
    this.boundHandlers.clear()
  }

  destroy(): void {
    this.hide()
    this.clearShowTimeout()
    this.clearHideTimeout()
    this.removeEventListeners()

    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement)
    }

    this.tooltipElement = null

    // Remove from instances map
    Tooltip.instances.delete(this.triggerElement)
  }

  getElement(): HTMLElement | null {
    return this.tooltipElement
  }

  isShown(): boolean {
    return this.isVisible
  }

  updateOptions(newOptions: Partial<TooltipOptions>): void {
    const wasVisible = this.isVisible

    // Hide tooltip if visible
    if (wasVisible) {
      this.hide()
    }

    // Update options
    this.options = { ...this.options, ...newOptions }

    // Update content if tooltip exists
    if (this.tooltipElement && newOptions.content) {
      this.updateContent(newOptions.content)
    }

    // Update position class if changed
    if (this.tooltipElement && newOptions.position) {
      this.tooltipElement.className = this.getTooltipClasses()
    }

    // Re-attach event listeners if trigger changed
    if (newOptions.trigger) {
      this.removeEventListeners()
      this.attachEventListeners()
    }

    // Show again if it was visible
    if (wasVisible && !this.options.disabled) {
      this.show()
    }
  }

  static create(triggerElement: HTMLElement, options: TooltipOptions): Tooltip {
    // Check if instance already exists
    const existingInstance = Tooltip.instances.get(triggerElement)
    if (existingInstance) {
      // Update existing instance instead of creating new one
      existingInstance.updateOptions(options)
      return existingInstance
    }

    return new Tooltip(triggerElement, options)
  }

  static getInstance(triggerElement: HTMLElement): Tooltip | undefined {
    return Tooltip.instances.get(triggerElement)
  }

  static destroyInstance(triggerElement: HTMLElement): boolean {
    const instance = Tooltip.instances.get(triggerElement)
    if (instance) {
      instance.destroy()
      return Tooltip.instances.delete(triggerElement)
    }
    return false
  }

  static destroyAll(): void {
    // Note: WeakMap doesn't have iteration methods, so we can't destroy all instances
    // This is actually a feature - instances will be garbage collected when elements are removed
    console.warn('Tooltip.destroyAll(): WeakMap instances will be garbage collected automatically')
  }
}

export default Tooltip
