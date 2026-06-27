import { debounce } from '../../../utils'
import { POSITIONS, type PopoverPosition } from './constants'

/**
 * Events emitted by Popover
 */
export const POPOVER_EVENTS = {
  BEFORE_OPEN: 'emtlkit:popover:beforeOpen',
  AFTER_OPEN: 'emtlkit:popover:afterOpen',
  BEFORE_CLOSE: 'emtlkit:popover:beforeClose',
  AFTER_CLOSE: 'emtlkit:popover:afterClose',
} as const

/**
 * Options for Popover initialization
 */
export interface PopoverOptions {
  position?: PopoverPosition
  closeOnClickOutside?: boolean
  showArrow?: boolean
  content?: string | HTMLElement
  popoverClass?: string
  allowMultiplePopovers?: boolean
  zIndex?: number | null
  // Custom data attributes
  dataAttributes?: Record<string, string>[]
  onOpen?: (() => void) | null
  onClose?: (() => void) | null
}

/**
 * Default popover options
 */
const DEFAULT_OPTIONS: Required<PopoverOptions> = {
  position: POSITIONS.BOTTOM,
  closeOnClickOutside: true,
  showArrow: false,
  content: '',
  popoverClass: 'emtlkit--popover',
  onOpen: null,
  onClose: null,
  allowMultiplePopovers: false,
  zIndex: null,
  dataAttributes: [],
}

/**
 * Tag names of elements that can be focused
 */
const FOCUSABLE_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT']

/**
 * CSS selector for focusable elements
 */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Default offset from trigger element
 */
const DEFAULT_OFFSET = 4

/**
 * Safety margin from viewport edges
 */
const SAFETY_MARGIN = 16

/**
 * Mobile breakpoint for special handling
 */
const MOBILE_BREAKPOINT = 480

/**
 * Check if position is a specific type
 */
function isPositionType(position: PopoverPosition, type: 'top' | 'bottom' | 'left' | 'right'): boolean {
  return position.startsWith(type) || position === type
}

/**
 * Popover class to handle popover functionality
 */
export class Popover {
  private static instances: Set<Popover> = new Set()
  private static baseZIndex: number = 999999
  private trigger: HTMLElement
  private options: Required<PopoverOptions>
  private isOpen: boolean = false
  private positionTrackingInterval: number | null = null
  private popoverElement: HTMLElement | null = null
  private documentClickHandler: (e: MouseEvent) => void
  private documentKeydownHandler: (e: KeyboardEvent) => void
  private windowResizeHandler: () => void
  private debouncedResizeHandler: () => void
  private documentScrollHandler: () => void

  /**
   * Get all registered popover instances
   */
  public static getAllInstances(): Set<Popover> {
    return new Set(Popover.instances)
  }

  /**
   * Get all currently open popovers
   */
  public static getOpenPopovers(): Popover[] {
    return Array.from(Popover.instances).filter(popover => popover.isPopoverOpen())
  }

  /**
   * Close all open popovers
   */
  public static closeAll(): void {
    Popover.instances.forEach(popover => {
      if (popover.isPopoverOpen()) {
        popover.closeWithoutFocus()
      }
    })
  }

  /**
   * Close all popovers except the specified one
   * @param currentPopover The popover to keep open
   */
  private static closeAllExcept(currentPopover: Popover): void {
    if (!currentPopover.options.allowMultiplePopovers) {
      Popover.instances.forEach(popover => {
        if (popover !== currentPopover && popover.isPopoverOpen()) {
          popover.closeWithoutFocus()
        }
      })
    }
  }

  /**
   * Get the next available z-index
   */
  private static getNextZIndex(): number {
    const openPopovers = Popover.getOpenPopovers()
    if (openPopovers.length === 0) return Popover.baseZIndex

    const maxZIndex = Math.max(
      ...openPopovers
        .map(p => p.popoverElement)
        .filter((el): el is HTMLElement => el !== null)
        .map(el => parseInt(getComputedStyle(el).zIndex) || Popover.baseZIndex)
    )

    return maxZIndex + 1
  }

  /**
   * Dispatch a custom event
   */
  private dispatchEvent(eventName: keyof typeof POPOVER_EVENTS): void {
    const event = new CustomEvent(POPOVER_EVENTS[eventName], {
      detail: {
        popover: this,
        trigger: this.trigger,
        content: this.popoverElement,
      },
      bubbles: true,
    })
    this.trigger.dispatchEvent(event)
  }

  /**
   * @param trigger The element that triggers the popover
   * @param options Popover options
   */
  constructor(trigger: HTMLElement, options: PopoverOptions = {}) {
    this.trigger = trigger
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // Add instance to registry
    Popover.instances.add(this)

    // Pre-bind handlers to maintain reference for later removal
    this.documentClickHandler = this.handleDocumentClick.bind(this)
    this.documentKeydownHandler = this.handleDocumentKeydown.bind(this)
    this.windowResizeHandler = this.updatePopoverPosition.bind(this)
    this.debouncedResizeHandler = debounce(this.updatePopoverPosition.bind(this), 100)
    this.documentScrollHandler = this.updatePopoverPosition.bind(this)

    this.init()
  }

  /**
   * Initialize popover event listeners and attributes
   */
  private init(): void {
    this.ensurePopoverExists()

    // Setup trigger attributes
    this.setupTriggerAttributes()

    // Setup trigger event listeners
    this.trigger.addEventListener('click', this.handleTriggerClick.bind(this))
    this.trigger.addEventListener('keydown', this.handleTriggerKeydown.bind(this))
  }

  /**
   * Create the popover element
   */
  private createPopoverElement(): HTMLElement {
    // Create new popover element
    const popover = document.createElement('div')
    popover.className = this.options.popoverClass

    // Generate a unique ID if not present
    popover.id = `emtlkit--popover-${Math.random().toString(36).substring(2, 9)}`

    // Set position and arrow attributes
    popover.setAttribute('data-position', this.options.position)
    popover.setAttribute('data-arrow', this.options.showArrow.toString())
    this.options.dataAttributes.forEach(attribute => {
      popover.setAttribute(attribute.name, attribute.value)
    })
    // Add accessibility attributes
    popover.setAttribute('role', 'dialog')
    popover.setAttribute('aria-hidden', 'true')

    // Add content
    if (this.options.content) {
      const contentElement = document.createElement('div')
      contentElement.className = 'emtlkit--popover-content'

      if (typeof this.options.content === 'string') {
        contentElement.innerHTML = this.options.content
      } else {
        contentElement.appendChild(this.options.content)
      }

      popover.appendChild(contentElement)
    }

    // Add event listener
    popover.addEventListener('click', this.handlePopoverClick.bind(this))

    return popover
  }

  /**
   * Set initial attributes for trigger element
   */
  private setupTriggerAttributes(): void {
    // Add accessibility attributes
    this.trigger.setAttribute('aria-haspopup', 'true')
    this.trigger.setAttribute('aria-expanded', 'false')
  }

  /**
   * Check if the popover is currently open
   * @returns True if popover is open, false otherwise
   */
  public isPopoverOpen(): boolean {
    return this.isOpen
  }

  /**
   * Handle trigger click events
   */
  private handleTriggerClick(e: MouseEvent): void {
    e.stopPropagation()
    this.toggle()
  }

  /**
   * Handle trigger keydown events
   */
  private handleTriggerKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.toggle()
    } else if (e.key === 'Escape' && this.isOpen) {
      this.trigger.focus()
    }
  }

  /**
   * Handle document click events for outside clicks
   */
  private handleDocumentClick(e: MouseEvent): void {
    if (
      this.isOpen
      && this.popoverElement
      && !this.popoverElement.contains(e.target as Node)
      && e.target !== this.trigger
    ) {
      this.close()
    }
  }

  /**
   * Handle document keydown events for Escape key
   */
  private handleDocumentKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !this.isOpen || !this.popoverElement) return

    const activeElement = document.activeElement as HTMLElement
    console.log('activeElement', activeElement)

    if (activeElement && this.popoverElement.contains(activeElement)) {
      const isFormElement = FOCUSABLE_ELEMENTS.includes(activeElement.tagName)
      console.log('isFormElement', isFormElement)

      if (isFormElement) {
        activeElement.blur()
        setTimeout(() => this.trigger.focus(), 10)
      } else {
        // this.close()
      }

      e.preventDefault()
    } else {
      this.close()
    }
  }

  /**
   * Handle clicks inside the popover
   */
  private handlePopoverClick(e: MouseEvent): void {
    // Prevent the click from propagating to document
    e.stopPropagation()
  }

  /**
   * Focus the first focusable element in the popover
   */
  private focusFirstElement(): void {
    if (!this.popoverElement) return

    setTimeout(() => {
      const focusableElements = this.popoverElement?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      }
    }, 100)
  }

  /**
   * Ensure no element inside popover has focus
   * @returns true if focus was moved, false otherwise
   */
  private ensureNoFocusInPopover(): boolean {
    if (!this.popoverElement) return false

    const activeElement = document.activeElement as HTMLElement
    if (activeElement && this.popoverElement.contains(activeElement)) {
      activeElement.blur()
      return true
    }
    return false
  }

  /**
   * Open the popover
   */
  public open(): void {
    if (this.isOpen) return

    this.dispatchEvent('BEFORE_OPEN')

    // Close all other popovers before opening this one
    Popover.closeAllExcept(this)

    // Create popover if it doesn't exist
    if (!this.popoverElement) {
      return
    }

    this.isOpen = true
    this.popoverElement.classList.add('active')

    // Set z-index
    const zIndex = this.options.zIndex ?? Popover.getNextZIndex()
    this.popoverElement.style.zIndex = zIndex.toString()

    this.updatePopoverPosition()

    // Add event listeners for resize, scroll and document clicks/keys
    window.addEventListener('resize', this.debouncedResizeHandler) // Use debounced handler for performance
    window.addEventListener('orientationchange', this.debouncedResizeHandler) // Handle device rotation with debounce
    document.addEventListener('scroll', this.documentScrollHandler, true)

    if (this.options.closeOnClickOutside) {
      document.addEventListener('click', this.documentClickHandler)
    }
    document.addEventListener('keydown', this.documentKeydownHandler)

    this.startPositionTracking()

    // Update accessibility attributes
    this.trigger.setAttribute('aria-expanded', 'true')
    this.popoverElement.setAttribute('aria-hidden', 'false')
    this.trigger.setAttribute('aria-controls', this.popoverElement.id)

    this.focusFirstElement()

    if (typeof this.options.onOpen === 'function') {
      this.options.onOpen()
    }

    this.dispatchEvent('AFTER_OPEN')
  }

  /**
   * Close the popover without changing focus
   * Used when closing from close button
   */
  private closeWithoutFocus(): void {
    if (!this.isOpen || !this.popoverElement) return

    this.dispatchEvent('BEFORE_CLOSE')

    this.isOpen = false
    this.ensureNoFocusInPopover()
    document.body.focus()

    this.cleanupOnClose()

    this.dispatchEvent('AFTER_CLOSE')
  }

  /**
   * Close the popover and return focus to trigger
   */
  public close(): void {
    if (!this.isOpen || !this.popoverElement) return

    this.dispatchEvent('BEFORE_CLOSE')

    this.isOpen = false
    this.ensureNoFocusInPopover()
    this.trigger.focus()

    this.cleanupOnClose()

    this.dispatchEvent('AFTER_CLOSE')
  }

  /**
   * Common cleanup operations when closing popover
   */
  private cleanupOnClose(): void {
    if (!this.popoverElement) return

    this.popoverElement.classList.remove('active')

    // Remove event listeners
    window.removeEventListener('resize', this.debouncedResizeHandler)
    window.removeEventListener('orientationchange', this.debouncedResizeHandler)
    document.removeEventListener('scroll', this.documentScrollHandler, true)
    document.removeEventListener('click', this.documentClickHandler)
    document.removeEventListener('keydown', this.documentKeydownHandler)

    this.stopPositionTracking()

    // Update accessibility attributes
    this.trigger.setAttribute('aria-expanded', 'false')
    this.popoverElement.setAttribute('aria-hidden', 'true')

    if (typeof this.options.onClose === 'function') {
      this.options.onClose()
    }
  }

  /**
   * Toggle the popover open/close state
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Get the popover element
   */
  public getPopoverElement(): HTMLElement | null {
    return this.popoverElement
  }

  /**
   * Calculate position based on chosen position value with viewport boundary detection
   */
  private calculatePosition(
    triggerRect: DOMRect,
    popoverRect: DOMRect,
    position: PopoverPosition
  ): { top: number; left: number; adjustedPosition: PopoverPosition } {
    const offset = DEFAULT_OFFSET
    const positionFunctions = this.getFixedPositions()

    // Get viewport dimensions
    const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth)
    const viewportHeight = Math.min(window.innerHeight, document.documentElement.clientHeight)

    // Calculate initial position
    const positionFunction = positionFunctions[position] || positionFunctions[POSITIONS.BOTTOM]
    const { top, left } = positionFunction(triggerRect, popoverRect, offset)

    // Check for viewport boundaries and adjust position
    const result = this.adjustPositionForViewport(
      { top, left },
      triggerRect,
      popoverRect,
      position,
      viewportWidth,
      viewportHeight
    )

    return result
  }

  /**
   * Adjust position to stay within viewport boundaries
   */
  private adjustPositionForViewport(
    initialPosition: { top: number; left: number },
    triggerRect: DOMRect,
    popoverRect: DOMRect,
    requestedPosition: PopoverPosition,
    viewportWidth: number,
    viewportHeight: number
  ): { top: number; left: number; adjustedPosition: PopoverPosition } {
    let { top, left } = initialPosition
    let adjustedPosition = requestedPosition

    // Check horizontal overflow
    if (left + popoverRect.width > viewportWidth - SAFETY_MARGIN) {
      // Right side overflow
      if (isPositionType(requestedPosition, 'right')) {
        // Try flipping from right to left
        const leftSidePosition = requestedPosition.replace('right', 'left') as PopoverPosition
        const flippedLeft = triggerRect.left - popoverRect.width - DEFAULT_OFFSET

        if (flippedLeft >= SAFETY_MARGIN) {
          adjustedPosition = leftSidePosition
          left = flippedLeft
        } else {
          // Can't flip, constrain to viewport
          left = Math.max(SAFETY_MARGIN, viewportWidth - popoverRect.width - SAFETY_MARGIN)
        }
      } else {
        // Other positions, constrain to viewport
        left = Math.max(SAFETY_MARGIN, viewportWidth - popoverRect.width - SAFETY_MARGIN)
      }
    } else if (left < SAFETY_MARGIN) {
      // Left side overflow
      if (isPositionType(requestedPosition, 'left')) {
        // Try flipping from left to right
        const rightSidePosition = requestedPosition.replace('left', 'right') as PopoverPosition
        const flippedLeft = triggerRect.right + DEFAULT_OFFSET

        if (flippedLeft + popoverRect.width <= viewportWidth - SAFETY_MARGIN) {
          adjustedPosition = rightSidePosition
          left = flippedLeft
        } else {
          // Can't flip, constrain to viewport
          left = SAFETY_MARGIN
        }
      } else {
        // Other positions, constrain to viewport
        left = SAFETY_MARGIN
      }
    }

    // Check vertical overflow
    if (top + popoverRect.height > viewportHeight - SAFETY_MARGIN) {
      // Bottom overflow
      if (isPositionType(requestedPosition, 'bottom')) {
        // Try flipping from bottom to top
        const topSidePosition = requestedPosition.replace('bottom', 'top') as PopoverPosition
        const flippedTop = triggerRect.top - popoverRect.height - DEFAULT_OFFSET

        if (flippedTop >= SAFETY_MARGIN) {
          adjustedPosition = topSidePosition
          top = flippedTop
        } else {
          // Can't flip, constrain to viewport and add scrolling if needed
          top = Math.max(SAFETY_MARGIN, viewportHeight - popoverRect.height - SAFETY_MARGIN)
        }
      } else {
        // Other positions, constrain to viewport
        top = Math.max(SAFETY_MARGIN, viewportHeight - popoverRect.height - SAFETY_MARGIN)
      }
    } else if (top < SAFETY_MARGIN) {
      // Top overflow
      if (isPositionType(requestedPosition, 'top')) {
        // Try flipping from top to bottom
        const bottomSidePosition = requestedPosition.replace('top', 'bottom') as PopoverPosition
        const flippedTop = triggerRect.bottom + DEFAULT_OFFSET

        if (flippedTop + popoverRect.height <= viewportHeight - SAFETY_MARGIN) {
          adjustedPosition = bottomSidePosition
          top = flippedTop
        } else {
          // Can't flip, constrain to viewport
          top = SAFETY_MARGIN
        }
      } else {
        // Other positions, constrain to viewport
        top = SAFETY_MARGIN
      }
    }

    // Special handling for very small screens (mobile)
    if (viewportWidth < MOBILE_BREAKPOINT) {
      const mobileResult = this.handleMobileLayout(left, top, viewportWidth, viewportHeight)
      left = mobileResult.left
      top = mobileResult.top
    }

    return { top, left, adjustedPosition }
  }

  /**
   * Handle special mobile layout constraints
   */
  private handleMobileLayout(
    currentLeft: number,
    currentTop: number,
    viewportWidth: number,
    viewportHeight: number
  ): { left: number; top: number } {
    if (!this.popoverElement) return { left: currentLeft, top: currentTop }

    const popoverRect = this.popoverElement.getBoundingClientRect()
    const isWiderThanViewport = popoverRect.width > viewportWidth - SAFETY_MARGIN * 2

    let adjustedLeft = currentLeft
    let adjustedTop = currentTop

    if (isWiderThanViewport) {
      // If popover is wider than viewport, center it with proper margins
      adjustedLeft = SAFETY_MARGIN
      // Apply styles immediately for mobile layout
      this.popoverElement.style.width = `calc(100vw - ${SAFETY_MARGIN * 2}px)`
      this.popoverElement.style.maxWidth = `calc(100vw - ${SAFETY_MARGIN * 2}px)`
    }

    // Add max height and scrolling for very tall popovers on mobile
    const maxMobileHeight = viewportHeight * 0.8 // 80% of viewport height
    if (popoverRect.height > maxMobileHeight) {
      // Ensure we don't position the popover too high
      adjustedTop = Math.max(SAFETY_MARGIN, Math.min(adjustedTop, viewportHeight * 0.1))

      this.popoverElement.style.maxHeight = `${maxMobileHeight}px`
      this.popoverElement.style.overflowY = 'auto'
      this.popoverElement.classList.add('emtlkit--popover-scrollable')
    } else {
      this.popoverElement.classList.remove('emtlkit--popover-scrollable')
    }

    return { left: adjustedLeft, top: adjustedTop }
  }

  /**
   * Get all position calculation functions for fixed positioning
   */
  private getFixedPositions(): Record<
    PopoverPosition,
    (trigger: DOMRect, popover: DOMRect, offset: number) => { top: number; left: number }
  > {
    return {
      // TOP POSITIONS
      [POSITIONS.TOP]: (t, p, o) => ({
        top: t.top - p.height - o,
        left: t.left + t.width / 2 - p.width / 2,
      }),
      [POSITIONS.TOP_CENTER]: (t, p, o) => ({
        top: t.top - p.height - o,
        left: t.left + t.width / 2 - p.width / 2,
      }),
      [POSITIONS.TOP_LEFT]: (t, p, o) => ({
        top: t.top - p.height - o,
        left: t.left,
      }),
      [POSITIONS.TOP_RIGHT]: (t, p, o) => ({
        top: t.top - p.height - o,
        left: t.right - p.width,
      }),

      // BOTTOM POSITIONS
      [POSITIONS.BOTTOM]: (t, p, o) => ({
        top: t.bottom + o,
        left: t.left + t.width / 2 - p.width / 2,
      }),
      [POSITIONS.BOTTOM_CENTER]: (t, p, o) => ({
        top: t.bottom + o,
        left: t.left + t.width / 2 - p.width / 2,
      }),
      [POSITIONS.BOTTOM_LEFT]: (t, p, o) => ({
        top: t.bottom + o,
        left: t.left,
      }),
      [POSITIONS.BOTTOM_RIGHT]: (t, p, o) => ({
        top: t.bottom + o,
        left: t.right - p.width,
      }),

      // LEFT POSITIONS
      [POSITIONS.LEFT]: (t, p, o) => ({
        top: t.top + t.height / 2 - p.height / 2,
        left: t.left - p.width - o,
      }),
      [POSITIONS.LEFT_CENTER]: (t, p, o) => ({
        top: t.top + t.height / 2 - p.height / 2,
        left: t.left - p.width - o,
      }),
      [POSITIONS.LEFT_TOP]: (t, p, o) => ({
        top: t.top,
        left: t.left - p.width - o,
      }),
      [POSITIONS.LEFT_BOTTOM]: (t, p, o) => ({
        top: t.bottom - p.height,
        left: t.left - p.width - o,
      }),

      // RIGHT POSITIONS
      [POSITIONS.RIGHT]: (t, p, o) => ({
        top: t.top + t.height / 2 - p.height / 2,
        left: t.right + o,
      }),
      [POSITIONS.RIGHT_CENTER]: (t, p, o) => ({
        top: t.top + t.height / 2 - p.height / 2,
        left: t.right + o,
      }),
      [POSITIONS.RIGHT_TOP]: (t, p, o) => ({
        top: t.top,
        left: t.right + o,
      }),
      [POSITIONS.RIGHT_BOTTOM]: (t, p, o) => ({
        top: t.bottom - p.height,
        left: t.right + o,
      }),
    }
  }

  /**
   * Update popover position based on trigger position
   */
  private updatePopoverPosition(): void {
    if (!this.isOpen || !this.popoverElement || !this.popoverElement.classList.contains('active')) {
      return
    }

    const triggerRect = this.trigger.getBoundingClientRect()
    const popoverRect = this.popoverElement.getBoundingClientRect()
    const position = this.options.position

    // Reset any existing transforms and styles that might affect positioning
    this.popoverElement.style.transform = ''
    this.popoverElement.style.width = ''
    this.popoverElement.style.maxWidth = ''
    this.popoverElement.style.maxHeight = ''
    this.popoverElement.style.overflowY = ''

    // Calculate position with responsive adjustments
    const { top, left, adjustedPosition } = this.calculatePosition(triggerRect, popoverRect, position)

    // Apply calculated position
    this.popoverElement.style.position = 'fixed'
    this.popoverElement.style.top = `${top}px`
    this.popoverElement.style.left = `${left}px`

    // Update position attribute for CSS styling
    this.popoverElement.setAttribute('data-position', adjustedPosition)
  }

  /**
   * Set arrow visibility
   * @param showArrow Whether to show the arrow
   */
  public setArrowVisibility(showArrow: boolean | string): void {
    this.options.showArrow = showArrow === true || showArrow === 'true'
    if (this.popoverElement) {
      this.popoverElement.setAttribute('data-arrow', this.options.showArrow.toString())
    }
  }

  /**
   * Start continuous tracking of trigger position
   */
  private startPositionTracking(): void {
    this.stopPositionTracking()
    this.positionTrackingInterval = window.setInterval(() => {
      this.updatePopoverPosition()
    }, 100)
  }

  /**
   * Stop continuous tracking of trigger position
   */
  private stopPositionTracking(): void {
    if (this.positionTrackingInterval !== null) {
      window.clearInterval(this.positionTrackingInterval)
      this.positionTrackingInterval = null
    }
  }

  /**
   * Update popover options
   * @param options New options to apply
   */
  public update(options: PopoverOptions): void {
    this.options = { ...this.options, ...options }

    if (this.popoverElement) {
      // Update position
      if (options.position) {
        this.popoverElement.setAttribute('data-position', options.position)
        this.updatePopoverPosition()
      }

      // Update arrow
      if (options.showArrow !== undefined) {
        this.setArrowVisibility(options.showArrow)
      }

      // Update content
      if (options.content !== undefined) {
        const contentElement = this.popoverElement.querySelector('.emtlkit--popover-content')
        if (contentElement) {
          contentElement.innerHTML = ''

          if (typeof options.content === 'string') {
            contentElement.innerHTML = options.content
          } else if (options.content) {
            contentElement.appendChild(options.content)
          }
        } else if (options.content) {
          const newContentElement = document.createElement('div')
          newContentElement.className = 'emtlkit--popover-content'

          if (typeof options.content === 'string') {
            newContentElement.innerHTML = options.content
          } else {
            newContentElement.appendChild(options.content)
          }

          this.popoverElement.appendChild(newContentElement)
        }
      }
    }

    // Update click outside behavior
    if (options.closeOnClickOutside !== undefined && this.isOpen) {
      if (options.closeOnClickOutside) {
        document.addEventListener('click', this.documentClickHandler)
      } else {
        document.removeEventListener('click', this.documentClickHandler)
      }
    }
  }

  /**
   * Clean up event listeners when popover is destroyed
   */
  public destroy(): void {
    // Remove from registry when destroyed
    Popover.instances.delete(this)

    this.stopPositionTracking()

    // Close the popover if it's open
    if (this.isOpen) {
      this.close()
    }

    // Remove the popover element from the DOM
    if (this.popoverElement && this.popoverElement.parentElement) {
      this.popoverElement.parentElement.removeChild(this.popoverElement)
      this.popoverElement = null
    }

    // Clean up trigger event listeners
    this.trigger.removeEventListener('click', this.handleTriggerClick)
    this.trigger.removeEventListener('keydown', this.handleTriggerKeydown)

    // Clean up trigger attributes
    this.trigger.removeAttribute('aria-haspopup')
    this.trigger.removeAttribute('aria-expanded')
    this.trigger.removeAttribute('aria-controls')
  }

  /**
   * Ensure the popover DOM element exists
   * This can be called to force DOM creation before open()
   * Returns the popover element
   */
  public ensurePopoverExists(): HTMLElement {
    if (!this.popoverElement) {
      this.popoverElement = this.createPopoverElement()
      document.body.appendChild(this.popoverElement)
    }
    return this.popoverElement
  }
}
