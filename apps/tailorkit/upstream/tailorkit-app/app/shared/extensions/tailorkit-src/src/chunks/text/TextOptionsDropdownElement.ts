/* eslint-disable max-len */
/**
 * Text Options Dropdown Element - Chunk Version
 *
 * This is a chunk-specific version that imports all shared dependencies from
 * window.TailorKit via BaseWrapper instead of direct ES module imports.
 */
import {
  BaseOptionSetElement,
  Popover,
  POSITIONS,
  CHECK_ICON_PATH,
  SELECT_ICON_PATH,
  createSvgIcon,
  type PopoverOptions,
} from './BaseWrapper'

const DEBOUNCE_DELAY = 150 // ms
const VIRTUAL_SCROLL_CHUNK_SIZE = 20 // Number of items to render at a time
const INTERSECTION_OBSERVER_OPTIONS = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1,
}

/**
 * Debounce function to limit the rate at which a function can fire
 */
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * Text Option Set Element - Dropdown Style with Virtual Scrolling
 */
export class TextOptionsDropdownElement extends BaseOptionSetElement {
  #popover: Popover | null = null
  #button: HTMLButtonElement | null = null
  #componentMounted: boolean = false
  #dropdownContent: HTMLElement | null = null
  #resizeObserver: ResizeObserver | null = null
  #intersectionObserver: IntersectionObserver | null = null
  #renderedItems: Set<string> = new Set()
  #loadingMore: boolean = false

  constructor() {
    super()
    this.setAttribute('data-value-from-fieldset', '')
  }

  /**
   * Cleanup existing popover instance and observers
   */
  private cleanup(): void {
    if (this.#popover) {
      this.#popover.destroy()
      this.#popover = null
    }

    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect()
      this.#resizeObserver = null
    }

    if (this.#intersectionObserver) {
      this.#intersectionObserver.disconnect()
      this.#intersectionObserver = null
    }

    this.#dropdownContent = null
    this.#renderedItems.clear()
    this.#loadingMore = false
  }

  /**
   * Create an option element with optimized rendering
   */
  private createOptionElement(item: any, printAreaId: string, optionSetId: string): HTMLElement {
    const container = document.createElement('div')
    const selectedOption = this.getSelectedOption()
    const isSelected = item?.i === selectedOption?.i
    const radioName = `${printAreaId} / ${optionSetId}`
    const additionalPricing = item.additionalPricing ? `data-pricing='${JSON.stringify(item.additionalPricing)}'` : ''

    container.className = `emtlkit--option-container emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between emtlkit-text-option${isSelected ? ' active' : ''}`
    container.setAttribute('role', 'option')
    container.setAttribute('aria-selected', String(isSelected))
    container.dataset.itemId = item.i
    container.dataset.printAreaId = printAreaId
    container.dataset.optionSetId = optionSetId

    container.innerHTML = `
      ${item.v}
      ${isSelected ? createSvgIcon(CHECK_ICON_PATH) : ''}
      <input type="radio"
        name="${radioName}"
        value="${item.v}"
        data-id="${item.i}"
        data-name="${item.l}"
        ${isSelected ? 'checked' : ''}
        ${additionalPricing}
      >
    `

    return container
  }

  /**
   * Load more items when scrolling
   */
  private loadMoreItems = debounce(() => {
    if (this.#loadingMore || !this.#dropdownContent) return

    const optionSet = this.getOptionSet()
    if (!optionSet) return

    const { ol = [] } = optionSet
    const { printAreaId, optionSetId } = this.getIds()

    this.#loadingMore = true

    // Get unrendered items
    const unrenderedItems = ol.filter(item => item && !this.#renderedItems.has(item.i))
    const itemsToRender = unrenderedItems.slice(0, VIRTUAL_SCROLL_CHUNK_SIZE)

    if (itemsToRender.length === 0) {
      this.#loadingMore = false
      return
    }

    // Create and append new items
    const fragment = document.createDocumentFragment()
    itemsToRender.forEach(item => {
      const optionElement = this.createOptionElement(item, printAreaId, optionSetId)
      fragment.appendChild(optionElement)
      this.#renderedItems.add(item.i)
    })

    this.#dropdownContent.appendChild(fragment)
    this.#loadingMore = false

    // Setup intersection observer for new items
    if (this.#intersectionObserver) {
      const lastItem = itemsToRender[itemsToRender.length - 1]
      if (lastItem) {
        const lastElement = this.#dropdownContent.querySelector(`[data-item-id="${lastItem.i}"]`)
        if (lastElement) {
          this.#intersectionObserver.observe(lastElement)
        }
      }
    }
  }, 100)

  /**
   * Create the dropdown content element with virtual scrolling
   */
  private createDropdownContent(): HTMLElement {
    if (this.#dropdownContent) {
      return this.#dropdownContent
    }

    const listbox = this.createElement('div', 'emtlkit-options-listbox emtlkit--text-options-listbox')
    listbox.setAttribute('role', 'listbox')
    listbox.style.maxHeight = '300px'
    listbox.style.overflowY = 'auto'

    const optionSet = this.getOptionSet()
    if (!optionSet) return listbox

    const { printAreaId, optionSetId } = this.getIds()
    listbox.dataset.printAreaId = printAreaId
    listbox.dataset.optionSetId = optionSetId

    // Setup intersection observer for infinite scroll
    this.#intersectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadMoreItems()
        }
      })
    }, INTERSECTION_OBSERVER_OPTIONS)

    // Initial load
    this.loadMoreItems()

    // Use event delegation for better performance
    listbox.addEventListener('click', e => {
      const optionContainer = (e.target as HTMLElement).closest('.emtlkit--option-container')
      if (optionContainer instanceof HTMLElement) {
        const itemId = optionContainer.dataset.itemId
        if (itemId) {
          this.handleSelect(itemId, e)
          this.#popover?.close()
        }
      }
    })

    // Cache the content
    this.#dropdownContent = listbox
    return listbox
  }

  /**
   * Handle button size changes
   */
  private handleButtonResize = debounce(() => {
    if (this.#button && this.#popover) {
      const popoverElement = this.#popover.ensurePopoverExists()
      if (popoverElement) {
        const width = `${this.#button.offsetWidth}px`
        popoverElement.style.width = width
        popoverElement.style.minWidth = width
      }
    }
  }, DEBOUNCE_DELAY)

  protected renderOptionSet(): void {
    this.cleanup()

    const container = this.getContainer()
    const optionSet = this.getOptionSet()

    if (!container || !optionSet) {
      console.warn('No container or optionSet', { container, optionSet })
      return
    }

    // Clear existing content
    container.innerHTML = ''

    const selectedItem = this.getSelectedOption()
    const displayText = selectedItem?.v || 'Select text option'

    // Create button element
    const button = document.createElement('div')
    button.className = 'emtlkit--dropdown-wrapper'
    button.innerHTML = `
      <button
        class="emtlkit--text-selector-button emtlkit--w-100 emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between"
        aria-haspopup="listbox"
        type="button"
      >
        <span class="emtlkit-button-text">${displayText}</span>
        <span class="emtlkit-button-icon">${createSvgIcon(SELECT_ICON_PATH)}</span>
      </button>
    `

    container.appendChild(button)
    this.#button = container.querySelector('button')

    if (this.#button) {
      // Initialize ResizeObserver for responsive updates
      this.#resizeObserver = new ResizeObserver(this.handleButtonResize)
      this.#resizeObserver.observe(this.#button)

      // Initialize Popover with optimized settings
      const popoverOptions: PopoverOptions = {
        position: POSITIONS.BOTTOM_CENTER,
        closeOnClickOutside: true,
        content: this.createDropdownContent(),
        popoverClass: 'emtlkit--popover emtlkit--text-options-popover',
        onClose: () => {
          this.#button?.setAttribute('aria-expanded', 'false')
          this.#button?.classList.remove('active')
        },
        onOpen: () => {
          this.#button?.setAttribute('aria-expanded', 'true')
          this.#button?.classList.add('active')
        },
      }

      this.#popover = new Popover(this.#button, popoverOptions)
    }

    super.renderOptionSet()
  }

  connectedCallback() {
    if (this.#componentMounted) return

    super.connectedCallback()
    this.#componentMounted = true
  }

  disconnectedCallback() {
    this.cleanup()
    super.disconnectedCallback()
    this.#componentMounted = false
  }
}
