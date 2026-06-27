import { CHECK_ICON_PATH, createSvgIcon, SELECT_ICON_PATH } from '../../../../assets/icons'
import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { Popover, type PopoverOptions } from '../../../../assets/components/commons/popover'
import { POSITIONS } from '../../../../assets/components/commons/popover/constants'
import type { BaseOptionItem } from '../../types'

/** Option item with additional pricing for imageless options */
interface ImagelessOptionItem extends BaseOptionItem {
  additionalPricing?: { value?: number; flatRate?: number }
  s?: number
}

const ELEMENT_NAME = 'tailorkit-imageless-options-dropdown'
const DEBOUNCE_DELAY = 150
const VIRTUAL_SCROLL_CHUNK_SIZE = 20

/**
 * Debounce utility to limit function call frequency
 */
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * Formats additional pricing for display.
 * Returns formatted string like "+$3.00" or empty string if no pricing.
 */
function formatPricingLabel(additionalPricing?: ImagelessOptionItem['additionalPricing']): string {
  if (!additionalPricing || !additionalPricing.flatRate || additionalPricing.flatRate <= 0) return ''
  const value = additionalPricing.value ?? additionalPricing.flatRate
  return `+$${Number(value).toFixed(2)}`
}

/**
 * Imageless Option Set Element - Custom Dropdown Style
 * Renders a popover-based dropdown with option labels and pricing aligned right.
 * Follows the same pattern as TextOptionsDropdownElement for consistency.
 */
export class ImagelessDropdownElement extends BaseOptionSetElement {
  #popover: Popover | null = null
  #button: HTMLButtonElement | null = null
  #componentMounted: boolean = false
  #dropdownContent: HTMLElement | null = null
  #resizeObserver: ResizeObserver | null = null
  #intersectionObserver: IntersectionObserver | null = null
  #renderedItems: Set<string> = new Set()
  #loadingMore: boolean = false

  /**
   * Cleanup popover, observers, and cached state
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
   * Create a single option row element with label left, pricing right
   */
  private createOptionElement(item: ImagelessOptionItem, printAreaId: string, optionSetId: string): HTMLElement {
    const container = document.createElement('div')
    const selectedOption = this.getSelectedOption()
    const isSelected = item?.i === selectedOption?.i
    const radioName = `${printAreaId} / ${optionSetId}`
    const additionalPricing = item.additionalPricing ? `data-pricing='${JSON.stringify(item.additionalPricing)}'` : ''
    const pricingLabel = formatPricingLabel(item.additionalPricing)

    const baseClasses = 'emtlkit--option-container emtlkit--d-flex emtlkit--flex-center'
    const layoutClasses = 'emtlkit--flex-space-between emtlkit-imageless-dropdown-option'
    container.className = `${baseClasses} ${layoutClasses}${isSelected ? ' active' : ''}`
    container.setAttribute('role', 'option')
    container.setAttribute('aria-selected', String(isSelected))
    container.dataset.itemId = item.i
    container.dataset.printAreaId = printAreaId
    container.dataset.optionSetId = optionSetId

    container.innerHTML = `
      <span class="emtlkit--imageless-option-label">${item.l}</span>
      <span class="emtlkit--imageless-option-right">
        ${pricingLabel ? `<span class="emtlkit--imageless-option-pricing">${pricingLabel}</span>` : ''}
        ${isSelected ? createSvgIcon(CHECK_ICON_PATH) : ''}
      </span>
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
   * Load more items for virtual scrolling
   */
  private loadMoreItems = debounce(() => {
    if (this.#loadingMore || !this.#dropdownContent) return

    const optionSet = this.getOptionSet()
    if (!optionSet) return

    const { ol = [] } = optionSet
    const { printAreaId, optionSetId } = this.getIds()

    this.#loadingMore = true

    const unrenderedItems = ol.filter(item => item && !this.#renderedItems.has(item.i))
    const itemsToRender = unrenderedItems.slice(0, VIRTUAL_SCROLL_CHUNK_SIZE)

    if (itemsToRender.length === 0) {
      this.#loadingMore = false
      return
    }

    const fragment = document.createDocumentFragment()
    itemsToRender.forEach(item => {
      const optionElement = this.createOptionElement(item, printAreaId, optionSetId)
      fragment.appendChild(optionElement)
      this.#renderedItems.add(item.i)
    })

    this.#dropdownContent.appendChild(fragment)
    this.#loadingMore = false

    // Observe last item for intersection-based lazy loading
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
   * Create the popover listbox content with virtual scrolling
   */
  private createDropdownContent(): HTMLElement {
    if (this.#dropdownContent) return this.#dropdownContent

    const listbox = this.createElement('div', 'emtlkit-options-listbox emtlkit--imageless-options-listbox')
    listbox.setAttribute('role', 'listbox')
    listbox.style.maxHeight = '300px'
    listbox.style.overflowY = 'auto'

    const optionSet = this.getOptionSet()
    if (!optionSet) return listbox

    const { printAreaId, optionSetId } = this.getIds()
    listbox.dataset.printAreaId = printAreaId
    listbox.dataset.optionSetId = optionSetId

    // Setup intersection observer for virtual scroll
    this.#intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadMoreItems()
          }
        })
      },
      { root: null, rootMargin: '50px', threshold: 0.1 }
    )

    // Initial load
    this.loadMoreItems()

    // Event delegation for option clicks
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

    this.#dropdownContent = listbox
    return listbox
  }

  /**
   * Sync popover width with button width on resize
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

    container.innerHTML = ''

    const selectedItem = this.getSelectedOption()
    const displayText = selectedItem?.l || selectedItem?.v || 'Select option'

    // Create trigger button
    const wrapper = document.createElement('div')
    wrapper.className = 'emtlkit--dropdown-wrapper'
    wrapper.innerHTML = `
      <button
        class="emtlkit--imageless-selector-button emtlkit--w-100 emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between"
        aria-haspopup="listbox"
        aria-label="${optionSet.l || 'Select option'}"
        type="button"
      >
        <span class="emtlkit-button-text">${displayText}</span>
        <span class="emtlkit-button-icon">${createSvgIcon(SELECT_ICON_PATH)}</span>
      </button>
    `

    container.appendChild(wrapper)
    this.#button = container.querySelector('button')

    if (this.#button) {
      // Responsive width sync
      this.#resizeObserver = new ResizeObserver(this.handleButtonResize)
      this.#resizeObserver.observe(this.#button)

      // Initialize popover dropdown
      const popoverOptions: PopoverOptions = {
        position: POSITIONS.BOTTOM_CENTER,
        closeOnClickOutside: true,
        content: this.createDropdownContent(),
        popoverClass: 'emtlkit--popover emtlkit--imageless-options-popover',
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

    // Sync selected option's pricing to fieldset so PricingManager can read it
    // (Popover content renders outside the fieldset DOM)
    this.syncPricingToFieldset()
  }

  /**
   * Sync the selected option's additionalPricing to the parent fieldset.
   * PricingManager reads data-pricing from fieldset as fallback when
   * the active input is not found inside the fieldset (dropdown renders in Popover).
   */
  private syncPricingToFieldset(): void {
    const fieldset = this.closest('fieldset')
    if (!fieldset) return

    const selectedOption = this.getSelectedOption() as ImagelessOptionItem | null
    if (selectedOption?.additionalPricing) {
      fieldset.setAttribute('data-pricing', JSON.stringify(selectedOption.additionalPricing))
    } else {
      fieldset.removeAttribute('data-pricing')
    }
  }

  protected handleSelect = (id: string, event?: Event) => {
    super.handleSelect(id, event)
    this.syncPricingToFieldset()
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

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, ImagelessDropdownElement)
}
