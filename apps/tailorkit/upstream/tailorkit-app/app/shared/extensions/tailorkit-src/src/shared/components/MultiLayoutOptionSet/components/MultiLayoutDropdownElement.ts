import { CHECK_ICON_PATH, createSvgIcon, SELECT_ICON_PATH } from '../../../../assets/icons'
import { BaseOptionSetElement } from '../../BaseOptionSetElement'
import { Popover, type PopoverOptions } from '../../../../assets/components/commons/popover'
import { POSITIONS } from '../../../../assets/components/commons/popover/constants'
import type { BaseOptionItem } from '../../types'

/** Multi-layout option item with thumbnail and layer IDs */
interface MultiLayoutOptionItem extends BaseOptionItem {
  /** Thumbnail SVG or image URL */
  t?: string
  /** Layer IDs belonging to this layout */
  ls?: string[]
}

const ELEMENT_NAME = 'tailorkit-multi-layout-dropdown'

/**
 * Multi-Layout Option Set Element - Custom Dropdown Style
 * Renders a popover-based dropdown with layout thumbnails and names.
 * Follows the same pattern as ImagelessDropdownElement for consistency.
 *
 * Key differences from ImagelessDropdownElement:
 * - Items show thumbnail (SVG or img) + layout name
 * - No virtual scrolling needed (typically 2-10 layouts)
 * - Items have `emtlkit-multi_layout-option` class for event routing
 * - Radio input name is `layout-{optionSetId}`
 */
export class MultiLayoutDropdownElement extends BaseOptionSetElement {
  #popover: Popover | null = null
  #button: HTMLButtonElement | null = null
  #componentMounted: boolean = false
  #dropdownContent: HTMLElement | null = null
  #resizeObserver: ResizeObserver | null = null

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
    this.#dropdownContent = null
  }

  /**
   * Create a single layout option row with thumbnail + name
   */
  private createOptionElement(item: MultiLayoutOptionItem, optionSetId: string): HTMLElement {
    const container = document.createElement('div')
    const selectedOption = this.getSelectedOption()
    const isSelected = item?.i === selectedOption?.i
    const radioName = `layout-${optionSetId}`

    container.className = `emtlkit--option-container emtlkit-multi_layout-option emtlkit--d-flex emtlkit--flex-center${isSelected ? ' active' : ''}`
    container.setAttribute('role', 'option')
    container.setAttribute('aria-selected', String(isSelected))
    container.dataset.itemId = item.i

    // Thumbnail: SVG inline or img tag
    const thumbnailHtml = item.t
      ? item.t.includes('<svg')
        ? item.t
        : `<img src="${item.t}" width="40" height="40" alt="${item.l}" loading="lazy">`
      : ''

    container.innerHTML = `
      <span class="emtlkit--multi-layout-option-thumb">${thumbnailHtml}</span>
      <span class="emtlkit--multi-layout-option-label">${item.l}</span>
      <span class="emtlkit--multi-layout-option-check">
        ${isSelected ? createSvgIcon(CHECK_ICON_PATH) : ''}
      </span>
      <input type="radio" name="${radioName}" value="${item.v}" data-id="${item.i}" data-name="${item.l}" ${isSelected ? 'checked' : ''}>
    `

    return container
  }

  /**
   * Create the popover listbox content with all layout options
   */
  private createDropdownContent(): HTMLElement {
    if (this.#dropdownContent) return this.#dropdownContent

    const listbox = this.createElement('div', 'emtlkit-options-listbox emtlkit--multi-layout-options-listbox')
    listbox.setAttribute('role', 'listbox')

    const optionSet = this.getOptionSet()
    if (!optionSet) return listbox

    const { printAreaId, optionSetId } = this.getIds()
    listbox.dataset.printAreaId = printAreaId
    listbox.dataset.optionSetId = optionSetId

    const { ol = [] } = optionSet
    const fragment = document.createDocumentFragment()
    ol.forEach(item => {
      if (item) {
        fragment.appendChild(this.createOptionElement(item, optionSetId))
      }
    })
    listbox.appendChild(fragment)

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
  private handleButtonResize = () => {
    if (this.#button && this.#popover) {
      const popoverElement = this.#popover.ensurePopoverExists()
      if (popoverElement) {
        const width = `${this.#button.offsetWidth}px`
        popoverElement.style.width = width
        popoverElement.style.minWidth = width
      }
    }
  }

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
    const displayText = selectedItem?.l || selectedItem?.v || 'Select layout'

    // Create trigger button
    const wrapper = document.createElement('div')
    wrapper.className = 'emtlkit--dropdown-wrapper'
    wrapper.innerHTML = `
      <button
        class="emtlkit--multi-layout-selector-button emtlkit--w-100 emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between"
        aria-haspopup="listbox"
        aria-label="${optionSet.l || 'Select layout'}"
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
        popoverClass: 'emtlkit--popover emtlkit--multi-layout-options-popover',
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

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, MultiLayoutDropdownElement)
}
