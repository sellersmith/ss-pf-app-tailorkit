/* eslint-disable max-len */
import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { Popover, type PopoverOptions } from '../../../../assets/components/commons/popover'
import { POSITIONS } from '../../../../assets/components/commons/popover/constants'
import { SELECT_ICON_PATH, createSvgIcon } from '../../../../assets/icons'

const ELEMENT_NAME = 'tailorkit-image-dropdown-grid'
const DEBOUNCE_DELAY = 150 // ms
const VIRTUAL_SCROLL_CHUNK_SIZE = 10 // Number of items to render at a time
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
 * Image Dropdown Element - Displays images in a dropdown list with virtual scrolling
 */
export class ImageDropdownGridElement extends BaseOptionSetElement {
  #popover: Popover | null = null
  #button: HTMLButtonElement | null = null
  #componentMounted: boolean = false
  #dropdownContent: HTMLElement | null = null
  #resizeObserver: ResizeObserver | null = null
  #intersectionObserver: IntersectionObserver | null = null
  #renderedItems: Set<string> = new Set()
  #loadingMore: boolean = false
  private optionSetType: string = 'image_option'

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
  private createOptionElement(
    item: any,
    printAreaId: string,
    optionSetId: string,
    width: number,
    height: number
  ): HTMLElement {
    const container = document.createElement('div')
    const selectedOption = this.getSelectedOption()
    const isSelected = item?.i === selectedOption?.i
    const radioName = `${printAreaId} / ${optionSetId}`
    const additionalPricing = item.additionalPricing ? `data-pricing='${JSON.stringify(item.additionalPricing)}'` : ''
    const isShopifyCdn = item?.v?.includes('cdn.shopify.com') || item?.v?.includes('cdn/shop/files')
    const optionUrl = isShopifyCdn ? `${item?.v}&width=${width * 2}` : item?.v
    const optionClass = this.optionSetType === 'mask_option' ? 'emtlkit-mask-option' : 'emtlkit-image-option'

    container.className = `emtlkit--option-container ${optionClass}${isSelected ? ' active' : ''}`
    container.setAttribute('role', 'option')
    container.setAttribute('aria-selected', String(isSelected))
    container.dataset.itemId = item.i
    container.dataset.printAreaId = printAreaId
    container.dataset.optionSetId = optionSetId
    container.style.maxWidth = `${this.#button?.offsetWidth || 0}px`
    container.style.position = 'relative'

    // Use loading="lazy" for images
    container.innerHTML = `
      <img width=${width} height=${height} alt="${item.l}" src="${optionUrl}" loading="lazy" />
      <input
        type="radio"
        name="${radioName}"
        value="${item.v}"
        data-id="${item.i}"
        data-name="${item.l}"
        ${additionalPricing}
        ${isSelected ? 'checked' : ''}
        style="display: block; position: absolute; left: 0px; top: 2px;"
      />
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
    const width = 60
    const height = 60

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
      const optionElement = this.createOptionElement(item, printAreaId, optionSetId, width, height)
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

    const listbox = this.createElement(
      'div',
      'emtlkit--image-options-listbox emtlkit--d-flex emtlkit--flex-wrap emtlkit--gap-8'
    )
    listbox.setAttribute('role', 'listbox')
    listbox.style.maxHeight = '400px'
    listbox.style.overflowY = 'auto'
    if (this.#button?.offsetWidth) {
      listbox.style.maxWidth = `${this.#button?.offsetWidth}px`
    }

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
          this.updateButtonPreview()
        }
      }
    })

    // Cache the content
    this.#dropdownContent = listbox
    return listbox
  }

  /**
   * Update the button preview with the selected image
   */
  private updateButtonPreview(): void {
    if (!this.#button) return

    const optionSet = this.getOptionSet()
    if (!optionSet) return

    const selectedOption = this.getSelectedOption()
    if (!selectedOption) return

    const width = 30
    const height = 30
    const isShopifyCdn = selectedOption?.v?.includes('cdn.shopify.com') || selectedOption?.v?.includes('cdn/shop/files')
    const optionUrl = isShopifyCdn ? `${selectedOption?.v}&width=${width * 2}` : selectedOption?.v

    // Update preview container using more efficient DOM manipulation
    const previewContainer = this.#button.querySelector('.emtlkit--preview-container')
    if (previewContainer) {
      const img = previewContainer.querySelector('img') || document.createElement('img')
      img.width = width
      img.height = height
      img.style.width = `${width}px !important`
      img.style.height = `${height}px !important`
      img.src = optionUrl
      img.alt = selectedOption?.l
      img.loading = 'lazy'
      img.className = 'emtlkit--image-preview'

      const text = previewContainer.querySelector('.emtlkit-button-text') || document.createElement('span')
      text.className = 'emtlkit-button-text'
      text.textContent = selectedOption?.l

      if (!previewContainer.contains(img)) {
        previewContainer.appendChild(img)
      }
      if (!previewContainer.contains(text)) {
        previewContainer.appendChild(text)
      }
    }
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
        popoverElement.style.maxWidth = width
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

    const selectedOption = this.getSelectedOption()
    const displayText = selectedOption?.l || 'Select image'

    // Create button element
    const button = document.createElement('div')
    button.className = 'emtlkit--dropdown-wrapper'
    button.innerHTML = `
      <button
        class="emtlkit--image-selector-button emtlkit--w-100 emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between emtlkit--gap-8"
        aria-haspopup="listbox"
        type="button"
      >
        <div class="emtlkit--preview-container emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8">
          ${
            selectedOption
              ? `
            <img
              width="30"
              height="30"
              src="${
                selectedOption?.v?.includes('cdn.shopify.com') || selectedOption?.v?.includes('cdn/shop/files')
                  ? `${selectedOption?.v}&width=60`
                  : selectedOption?.v
              }"
              style="width: 30px; height: 30px;"
              alt="${selectedOption?.l}"
              loading="lazy"
              class="emtlkit--image-preview"
            />
          `
              : ''
          }
          <span class="emtlkit-button-text">${displayText}</span>
        </div>
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
        popoverClass: 'emtlkit--popover emtlkit--image-options-popover',
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
    const optionSetType = this.getAttribute('data-option-set-type')
    if (optionSetType) {
      this.optionSetType = optionSetType
    }
    this.#componentMounted = true
  }

  disconnectedCallback() {
    this.cleanup()
    super.disconnectedCallback()
    this.#componentMounted = false
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ImageDropdownGridElement)
}
