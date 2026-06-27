import { CLOSE_ICON_PATH, createSvgIcon } from '../../../icons/editor-icons'
import type { ModalSize } from './constants'
import { MODAL_SIZES } from './constants'

/**
 * Module-level ref-count for body scroll lock.
 * Multiple open modals increment the counter; scroll is restored only when all are closed.
 */
let _modalOverflowCount = 0

function lockBodyScroll() {
  _modalOverflowCount++
  if (_modalOverflowCount === 1) document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  _modalOverflowCount = Math.max(0, _modalOverflowCount - 1)
  if (_modalOverflowCount === 0) document.body.style.overflow = ''
}

/**
 * Module-level stack of open modals — used to ensure Escape closes only the topmost.
 */
const _modalStack: EmtlkitModal[] = []

/**
 * Modal Class - Create and manage modals
 *
 * How to use:
 * ```
 * // Create modal
 * const modal = new EmtlkitModal({
 *   header: 'Modal title',
 *   content: 'Modal content',
 *   footer: '<button class="emtlkit-Button">Close</button>',
 *   size: 'medium', // 'small', 'medium', 'large'
 *   closeOnBackdropClick: true,
 *   closeOnEsc: true,
 *   onOpen: () => console.log('Modal opened'),
 *   onClose: () => console.log('Modal closed')
 * });
 *
 * // Open modal
 * modal.open();
 *
 * // Close modal
 * modal.close();
 *
 * // Update content
 * modal.update({
 *   content: 'New content'
 * });
 *
 * // Destroy modal
 * modal.destroy();
 * ```
 */
class EmtlkitModal {
  private SIZE_CLASSES = {
    [MODAL_SIZES.SMALL]: 'emtlkit-Modal--sizeSmall',
    [MODAL_SIZES.MEDIUM]: 'emtlkit-Modal--sizeMedium',
    [MODAL_SIZES.LARGE]: 'emtlkit-Modal--sizeLarge',
  }

  private options: {
    header: string | HTMLElement | null
    content: string | HTMLElement | null
    footer: string | HTMLElement | null
    size: ModalSize
    closeOnBackdropClick: boolean
    closeOnEsc: boolean
    zIndex: number
    onOpen: (() => void) | null
    onClose: (() => void) | null
  }

  private modalContainer!: HTMLDivElement
  private modalBackdrop!: HTMLDivElement
  private modal!: HTMLDivElement
  private modalDialog!: HTMLDivElement
  private modalHeader?: HTMLDivElement
  private modalSection!: HTMLDivElement
  private modalFooter?: HTMLDivElement
  private lastFocusedElement: HTMLElement | null = null

  /**
   * Initialize modal
   * @param {Object} options - Modal options
   * @param {string|HTMLElement} [options.header] - Modal header content (can be HTML or element)
   * @param {string|HTMLElement} [options.content] - Modal content (can be HTML or element)
   * @param {string|HTMLElement} [options.footer] - Modal footer content (can be HTML or element)
   * @param {string} [options.size] - Modal size ('small', 'medium', 'large')
   * @param {boolean} [options.closeOnBackdropClick=true] - Close modal when clicking on backdrop
   * @param {boolean} [options.closeOnEsc=true] - Close modal when pressing Escape key
   * @param {Function} [options.onOpen] - Callback when modal opens
   * @param {Function} [options.onClose] - Callback when modal closes
   */
  constructor(
    options: {
      header?: string | HTMLElement | null
      content?: string | HTMLElement | null
      footer?: string | HTMLElement | null
      size?: ModalSize
      closeOnBackdropClick?: boolean
      closeOnEsc?: boolean
      zIndex?: number
      onOpen?: (() => void) | null
      onClose?: (() => void) | null
    } = {}
  ) {
    // Set default options
    this.options = Object.assign(
      {
        header: null,
        content: null,
        footer: null,
        size: MODAL_SIZES.MEDIUM,
        closeOnBackdropClick: true,
        closeOnEsc: true,
        zIndex: 9998,
        onOpen: null,
        onClose: null,
      },
      options
    )

    // Create DOM elements
    this.createElements()

    // Setup event listeners
    this.setupEventListeners()

    // Add modal to body
    document.body.appendChild(this.modalContainer)
  }

  /**
   * Create DOM elements for modal
   */
  createElements() {
    // Container
    this.modalContainer = document.createElement('div')
    this.modalContainer.className = 'emtlkit-Modal-Container'
    this.modalContainer.setAttribute('aria-hidden', 'true')
    this.modalContainer.style.zIndex = this.options.zIndex.toString()

    // Backdrop
    this.modalBackdrop = document.createElement('div')
    this.modalBackdrop.className = 'emtlkit-Modal-Backdrop'
    this.modalContainer.appendChild(this.modalBackdrop)

    // Modal
    this.modal = document.createElement('div')
    this.modal.className = 'emtlkit-Modal'
    this.modal.setAttribute('role', 'dialog')
    this.modal.setAttribute('aria-modal', 'true')
    this.modal.setAttribute('tabindex', '-1')

    // Prevent click event from modal bubbling up to modalContainer to avoid closing modal when clicking on content
    this.modal.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation()
    })

    this.modal.classList.add(this.SIZE_CLASSES[this.options.size])

    this.modalContainer.appendChild(this.modal)

    // Dialog
    this.modalDialog = document.createElement('div')
    this.modalDialog.className = 'emtlkit-Modal-Dialog'
    this.modal.appendChild(this.modalDialog)

    // Header (if exists)
    if (this.options.header) {
      this.modalHeader = document.createElement('div')
      this.modalHeader.className = 'emtlkit-modal__header'

      if (typeof this.options.header === 'string') {
        // If header is string, create title
        const title = document.createElement('h2')
        title.className = 'emtlkit-modal__title'
        title.innerHTML = this.options.header
        this.modalHeader.appendChild(title)

        // Set aria-labelledby
        const titleId = `modal-title-${this.generateId()}`
        title.id = titleId
        this.modal.setAttribute('aria-labelledby', titleId)
      } else {
        // If header is element, add directly
        this.modalHeader.appendChild(this.options.header)
      }

      // Close button
      const closeButton = document.createElement('button')
      closeButton.className = 'emtlkit-modal__close-button'

      closeButton.setAttribute('aria-label', 'Close')
      closeButton.innerHTML = createSvgIcon(CLOSE_ICON_PATH, 20)
      closeButton.addEventListener('click', () => this.close())
      this.modalHeader.appendChild(closeButton)

      this.modalDialog.appendChild(this.modalHeader)
    }

    // Content
    this.modalSection = document.createElement('div')
    this.modalSection.className = 'emtlkit-Modal-Section'

    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        this.modalSection.innerHTML = this.options.content
      } else {
        this.modalSection.appendChild(this.options.content)
      }
    }

    this.modalDialog.appendChild(this.modalSection)

    // Footer (if exists)
    if (this.options.footer) {
      this.modalFooter = document.createElement('div')
      this.modalFooter.className = 'emtlkit-Modal-Footer'

      if (typeof this.options.footer === 'string') {
        this.modalFooter.innerHTML = this.options.footer
      } else {
        this.modalFooter.appendChild(this.options.footer)
      }

      this.modalDialog.appendChild(this.modalFooter)
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close modal when clicking on backdrop
    if (this.options.closeOnBackdropClick) {
      // Simplify event handling for backdrop
      this.modalBackdrop.addEventListener('click', () => {
        if (this.options.closeOnBackdropClick) {
          this.close()
        }
      })
    }

    // Handle keydown event
    this.handleKeyDown = this.handleKeyDown.bind(this)
  }

  /**
   * Handle keydown event
   * @param {KeyboardEvent} event - Keydown event
   */
  handleKeyDown(event: KeyboardEvent) {
    // Close modal when Escape key is pressed — only if this is the topmost open modal
    if (this.options.closeOnEsc && event.key === 'Escape') {
      if (_modalStack.length === 0 || _modalStack[_modalStack.length - 1] === this) {
        this.close()
      }
      return
    }

    // Trap focus within modal
    if (event.key === 'Tab') {
      const focusableElements = this.getFocusableElements()

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      }
      // Tab
      else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }
  }

  /**
   * Get all focusable elements within modal
   * @returns {Array} - Array of focusable elements
   */
  getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ) as HTMLElement[]
  }

  /**
   * Open modal
   */
  open() {
    // Save the focused element
    this.lastFocusedElement = document.activeElement as HTMLElement

    // Show modal
    this.modalContainer.classList.add('emtlkit-Modal-Container--open')
    this.modalContainer.setAttribute('aria-hidden', 'false')

    // Prevent page scroll (ref-counted — only hides when first modal opens)
    lockBodyScroll()

    // Push to modal stack so Escape closes only the topmost modal
    _modalStack.push(this)

    // Add keydown event listener
    document.addEventListener('keydown', this.handleKeyDown)

    // Call onOpen callback if exists
    if (typeof this.options.onOpen === 'function') {
      this.options.onOpen()
    }
  }

  /**
   * Close modal
   */
  close() {
    // Hide modal
    this.modalContainer.classList.remove('emtlkit-Modal-Container--open')
    this.modalContainer.setAttribute('aria-hidden', 'true')

    // Restore page scroll (ref-counted — only restores when all modals are closed)
    unlockBodyScroll()

    // Remove from modal stack (defensive: only pop if this modal is present)
    const stackIdx = _modalStack.indexOf(this)
    if (stackIdx !== -1) _modalStack.splice(stackIdx, 1)

    // Restore focus
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus()
    }

    // Remove keydown event listener
    document.removeEventListener('keydown', this.handleKeyDown)

    // Call onClose callback if exists
    if (typeof this.options.onClose === 'function') {
      this.options.onClose()
    }
  }

  /**
   * Update modal content
   * @param {Object} options - Options to update
   */
  update(
    options: {
      header?: string | HTMLElement | null
      content?: string | HTMLElement | null
      footer?: string | HTMLElement | null
      size?: ModalSize
      closeOnBackdropClick?: boolean
      closeOnEsc?: boolean
    } = {}
  ) {
    // Update options
    this.options = Object.assign(this.options, options)

    // Update header — use same lowercase BEM classes as createElements() and Preact modal
    if (options.header !== undefined) {
      // Remove old header
      if (this.modalHeader) {
        this.modalDialog.removeChild(this.modalHeader)
      }

      // Create new header if exists
      if (options.header) {
        this.modalHeader = document.createElement('div')
        this.modalHeader.className = 'emtlkit-modal__header'

        if (typeof options.header === 'string') {
          const title = document.createElement('h2')
          title.className = 'emtlkit-modal__title'
          title.innerHTML = options.header
          this.modalHeader.appendChild(title)

          // Set aria-labelledby
          const titleId = `modal-title-${this.generateId()}`
          title.id = titleId
          this.modal.setAttribute('aria-labelledby', titleId)
        } else {
          this.modalHeader.appendChild(options.header)
        }

        // Close button
        const closeButton = document.createElement('button')
        closeButton.className = 'emtlkit-modal__close-button'
        closeButton.setAttribute('aria-label', 'Close')
        closeButton.innerHTML = createSvgIcon(CLOSE_ICON_PATH, 20)
        closeButton.addEventListener('click', () => this.close())
        this.modalHeader.appendChild(closeButton)

        // Add header to the beginning of dialog
        this.modalDialog.insertBefore(this.modalHeader, this.modalDialog.firstChild)
      }
    }

    // Update content
    if (options.content !== undefined) {
      // Remove old content
      this.modalSection.innerHTML = ''

      // Add new content if exists
      if (options.content) {
        if (typeof options.content === 'string') {
          this.modalSection.innerHTML = options.content
        } else {
          this.modalSection.appendChild(options.content)
        }
      }
    }

    // Update footer
    if (options.footer !== undefined) {
      // Remove old footer
      if (this.modalFooter) {
        this.modalDialog.removeChild(this.modalFooter)
      }

      // Create new footer if exists
      if (options.footer) {
        this.modalFooter = document.createElement('div')
        this.modalFooter.className = 'emtlkit-Modal-Footer'

        if (typeof options.footer === 'string') {
          this.modalFooter.innerHTML = options.footer
        } else {
          this.modalFooter.appendChild(options.footer)
        }

        this.modalDialog.appendChild(this.modalFooter)
      }
    }

    // Update size
    if (options.size !== undefined) {
      // Remove old size classes
      this.modal.classList.remove(
        this.SIZE_CLASSES[MODAL_SIZES.SMALL],
        this.SIZE_CLASSES[MODAL_SIZES.MEDIUM],
        this.SIZE_CLASSES[MODAL_SIZES.LARGE]
      )

      // Add new size class
      this.modal.classList.add(this.SIZE_CLASSES[options.size])
    }

    // No need to handle backdrop events because they are set in the constructor
  }

  /**
   * Enable/disable backdrop close feature
   * @param {boolean} enable - Enable/disable feature
   */
  setCloseOnBackdropClick(enable: boolean) {
    this.options.closeOnBackdropClick = enable
  }

  /**
   * Enable/disable close on Escape feature
   * @param {boolean} enable - Enable/disable feature
   */
  setCloseOnEsc(enable: boolean) {
    this.options.closeOnEsc = enable
  }

  /**
   * Destroy modal
   */
  destroy() {
    // Close modal if it is open
    if (this.modalContainer.classList.contains('emtlkit-Modal-Container--open')) {
      this.close()
    }

    // Remove event listener
    document.removeEventListener('keydown', this.handleKeyDown)

    // Remove from DOM
    if (this.modalContainer.parentNode) {
      this.modalContainer.parentNode.removeChild(this.modalContainer)
    }
  }

  /**
   * Generate random ID
   * @returns {string} - Random ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 9)
  }
}

export default EmtlkitModal
