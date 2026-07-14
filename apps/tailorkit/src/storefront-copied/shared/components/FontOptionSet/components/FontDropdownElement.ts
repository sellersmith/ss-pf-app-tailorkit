/* eslint-disable max-len */
import { fontStorefrontLoader } from '../../font-storefront-loader'
import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import type { FontOptionItem } from '../types'
import { Popover, type PopoverOptions } from '../../../../assets/components/commons/popover'
import { POSITIONS } from '../../../../assets/components/commons/popover/constants'
import { SELECT_ICON_PATH, CHECK_ICON_PATH, createSvgIcon } from '../../../../assets/icons'

const ELEMENT_NAME = 'tailorkit-font-dropdown'
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
 * Font Dropdown Element - Displays fonts in a dropdown list with virtual scrolling
 */
export class FontDropdownElement extends BaseOptionSetElement {
  #popover: Popover | null = null
  #button: HTMLButtonElement | null = null
  #componentMounted: boolean = false
  #dropdownContent: HTMLElement | null = null
  #resizeObserver: ResizeObserver | null = null
  #intersectionObserver: IntersectionObserver | null = null
  #renderedItems: Set<string> = new Set()
  #loadingMore: boolean = false
  #rendering: boolean = false

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
  private createOptionElement(item: FontOptionItem, printAreaId: string, optionSetId: string): HTMLElement {
    const fontData: any = JSON.parse(item.v || '{}')
    const container = document.createElement('div')

    const selectedOption = this.getSelectedOption()
    const isSelected = item?.i === selectedOption?.i
    const radioName = `${printAreaId} / ${optionSetId}`
    const additionalPricing = item.additionalPricing ? `data-pricing='${JSON.stringify(item.additionalPricing)}'` : ''

    // Use font source string (fontData.src) as the primary value, matching legacy behaviour
    const fontSrc: string = fontData?.src || ''

    container.className = `emtlkit--option-container emtlkit--font-option-set emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between emtlkit-font-option${isSelected ? ' active' : ''}`
    const dataAttributes = {
      role: 'option',
      ariaSelected: String(isSelected),
      value: fontSrc, // src string instead of JSON
      label: item.l,
      default: item.isDefault ? 'true' : 'false',
      itemId: item.i,
      printAreaId,
      optionSetId,
      family: fontData.family,
    }

    // Set multiple dataset attributes in one go
    Object.keys(dataAttributes).forEach(key => {
      container.dataset[key] = dataAttributes[key as keyof typeof dataAttributes] as string
    })

    // Maintain backward-compatibility with the legacy dropdown implementation –
    // expose the same DOM attributes that old handlers relied on
    container.setAttribute('value', dataAttributes.value)
    container.setAttribute('data-label', dataAttributes.label || '')
    container.setAttribute('data-default', dataAttributes.default)
    container.setAttribute('data-family', dataAttributes.family || '')

    container.innerHTML = `
      <div class="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8">
        <span style="font-family: '${fontData.family}'">${item.l || '--'}</span>
        ${item.isDefault ? `<span style="font-family: ''">(Default)</span>` : ''}
      </div>
      ${isSelected ? createSvgIcon(CHECK_ICON_PATH) : ''}
      <input type="radio"
        name="${radioName}"
        value="${fontSrc}"
        data-id="${item.i}"
        data-name="${item.l}${item.isDefault ? ' (Default)' : ''}"
        data-family="${fontData.family}"
        ${isSelected ? 'checked' : ''}
        ${additionalPricing}
      >
    `

    return container
  }

  /**
   * Load more items when scrolling
   */
  private loadMoreItems = debounce(async () => {
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

    // Create and append new items immediately for better perceived performance
    const fragment = document.createDocumentFragment()
    itemsToRender.forEach(item => {
      const optionElement = this.createOptionElement(item, printAreaId, optionSetId)
      fragment.appendChild(optionElement)
      this.#renderedItems.add(item.i)
    })

    this.#dropdownContent.appendChild(fragment)

    // Fire-and-forget font loading to avoid blocking the UI thread.
    // Once each font is loaded, the browser will automatically swap in the
    // correct font-face, so we don't need to await these promises.
    await Promise.all(
      itemsToRender.map(async (option: FontOptionItem) => {
        const fontData = JSON.parse(option.v || '{}')
        if (fontData?.family && fontData?.src) {
          try {
            await fontStorefrontLoader.loadFont(fontData.family, fontData.src)
          } catch (err) {
            // Non-critical: log and continue. The text will fall back to a
            // system font until the custom font is ready.
            console.error('Failed to load font', fontData, err)
          }
        }
      })
    ).catch(() => {
      /* Swallow errors – UI already rendered */
    })

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

    const listbox = this.createElement('div', 'emtlkit-options-listbox emtlkit--font-options-listbox')
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

          // Delegate fieldset update & canvas re-render to TailorKitProductPersonalizer via tlkOptionSetClickEvent
          // The BaseOptionSetElement.handleSelect dispatches this event, which ProductPersonalizer
          // listens to and runs handleStandardOptionClick—keeping all option-set logic in one place.
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

  protected async renderOptionSet(): Promise<void> {
    if (this.#rendering) return
    this.#rendering = true

    try {
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
      let fontData = null

      if (selectedOption) {
        fontData = JSON.parse(selectedOption?.v || '{}')
        // Preload selected font
        if (fontData?.family && fontData?.src) {
          await fontStorefrontLoader.loadFont(fontData.family, fontData.src)
        }
      }

      const displayText = selectedOption?.l || 'Select font'
      const isDefaultSelected = selectedOption?.isDefault === true

      // Create button element
      const button = document.createElement('div')
      button.className = 'emtlkit--dropdown-wrapper'
      button.innerHTML = `
        <button
          class="emtlkit--font-selector emtlkit--w-100 emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between"
          aria-haspopup="listbox"
          type="button"
        >
          <div class="emtlkit--selected-font-wrapper emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8">
            <span class="emtlkit--selected-font" style="font-family: '${fontData?.family || ''}'">
              ${displayText}
            </span>
            ${isDefaultSelected ? '<span style="font-family: \'\'">(Default)</span>' : ''}
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

        // Create popover
        const popoverOptions: PopoverOptions = {
          position: POSITIONS.BOTTOM_CENTER,
          closeOnClickOutside: true,
          showArrow: false,
          content: this.createDropdownContent(),
          popoverClass: 'emtlkit--popover emtlkit--font-dropdown-popover',
          onOpen: () => {
            this.#button?.setAttribute('aria-expanded', 'true')
            this.#button?.classList.add('active')
          },
          onClose: () => {
            this.#button?.setAttribute('aria-expanded', 'false')
            this.#button?.classList.remove('active')
          },
        }

        this.#popover = new Popover(this.#button, popoverOptions)
      }

      super.renderOptionSet()
    } finally {
      this.#rendering = false
    }
  }

  protected handleSelect = (id: string, event?: Event) => {
    const fieldset = this.closest('fieldset')
    const option = this.querySelector(`[data-item-id="${id}"]`)
    const fontFamily = option?.getAttribute('data-family') || ''
    const src = option?.getAttribute('value') || ''

    if (fieldset) {
      fieldset.setAttribute('data-family', fontFamily)
      fieldset.setAttribute('data-default', option?.getAttribute('data-default') || 'false')
      fieldset.setAttribute('data-font-src', src)
    }
    super.handleSelect(id, event)
  }

  async connectedCallback() {
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

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, FontDropdownElement)
}
