import type { PopoverOptions } from '../components/commons/popover'
import { Popover } from '../components/commons/popover'
import { POSITIONS } from '../components/commons/popover/constants'
import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { getFontDropdownContent } from '../utils/renders/popovers-content/font-dropdown'
import type { Layer } from '../type'
import { saveToLocalStorage } from './optionHandlers'
import { createSvgIcon, SPINNER_ICON_PATH } from '../icons/editor-icons'
import { Transmitter } from '../libraries/transmitter'

/**
 * Handles click events on font dropdown selectors by delegating to the FontDropdownManager.
 * Uses lazy initialization - dropdowns are only created when needed, not on page load.
 * If a dropdown has already been created for this selector, it will be reused.
 *
 * @param target - The element that was clicked
 * @param instance - The TailorKitProductPersonalizer instance
 * @returns Promise<void>
 */
export const handleFontDropdownClick = async (
  target: HTMLElement,
  instance: TailorKitProductPersonalizer
): Promise<void> => {
  // Find the button trigger
  const trigger = target.closest('.emtlkit--font-selector')
  if (!trigger || !(trigger instanceof HTMLElement)) return

  // Get the FontDropdownManager instance
  const manager = FontDropdownManager.getInstance()

  // Ensure manager has instance reference
  manager.setInstance(instance)

  // Handle the click through the manager
  await manager.handleSelectorClick(trigger)
}

/**
 * Font dropdown manager that utilizes the existing Popover component
 * to create a consistent dropdown experience
 */
export class FontDropdownManager {
  private static instance: FontDropdownManager | null = null
  private dropdowns: Map<HTMLElement, Popover> = new Map()
  private initialized: boolean = false
  private instance: TailorKitProductPersonalizer | null = null
  private escapeKeyHandlerAttached: boolean = false
  private activeOptions: Map<HTMLElement, HTMLElement | null> = new Map()

  /**
   * Get the FontDropdownManager singleton instance
   */
  public static getInstance(): FontDropdownManager {
    if (!this.instance) {
      this.instance = new FontDropdownManager()
    }
    return this.instance
  }

  /**
   * Set the TailorKit instance to access layer data
   */
  public setInstance(instance: TailorKitProductPersonalizer): void {
    this.instance = instance
  }

  /**
   * Handle a click on a font selector element
   * Creates and opens a popover for the clicked element
   *
   * @param selector The font selector element that was clicked
   */
  public async handleSelectorClick(selector: HTMLElement): Promise<void> {
    if (!this.instance) return

    // Close any existing popovers first
    this.closeAllDropdowns()

    // Check if we need to attach the escape key handler
    if (!this.escapeKeyHandlerAttached) {
      document.addEventListener('keydown', this.handleEscapeKey)
      this.escapeKeyHandlerAttached = true
    }

    // Check if popover already exists for this selector
    let popover = this.dropdowns.get(selector)

    // If not, create a new one
    if (!popover) {
      await this.setupFontDropdown(selector)
      popover = this.dropdowns.get(selector)
    }

    // Open the popover if it exists
    if (popover) {
      popover.open()

      // Set previously selected option as active if it exists
      const activeOption = this.activeOptions.get(selector)
      if (activeOption) {
        activeOption.classList.add('active')
      }
    }
  }

  /**
   * Initialize just the manager - no dropdowns created yet
   */
  public initialize(): void {
    if (this.initialized || !this.instance) return
    this.initialized = true
  }

  /**
   * Get layer from selector element
   */
  private getLayerFromSelector(selector: HTMLElement): Layer | null {
    if (!this.instance) return null

    // Get the fieldset and layer ID
    const fieldset = selector.closest('fieldset')
    if (!fieldset) return null

    const layerId = fieldset.getAttribute('data-layer-id')
    if (!layerId) return null

    // Find the layer from instance data
    const layers = this.instance.productPersonalizer.lis?.flatMap(li => li.data?.ls || []) || []
    return layers.find(layer => layer.i === layerId) || null
  }

  /**
   * Set up a font dropdown for a specific selector element
   * @param selector The font selector element
   */
  private async setupFontDropdown(selector: HTMLElement): Promise<void> {
    // Get the layer for this selector
    const layer = this.getLayerFromSelector(selector)
    if (!layer) return

    // Get the wrapper for icon updates
    const wrapper = selector.closest('.emtlkit--font-option-set')
    if (!wrapper) return

    // Create loading indicator first and show it immediately in a temporary popover
    const loadingContent = this.createLoadingContent()

    // Get the trigger element width to match the popover width
    const triggerWidth = selector.offsetWidth

    // Create temporary popover with loading indicator
    const tempPopoverOptions: PopoverOptions = {
      position: POSITIONS.BOTTOM,
      closeOnClickOutside: false,
      showArrow: false,
      content: loadingContent,
      popoverClass: 'emtlkit--popover emtlkit--font-dropdown-popover',
      onOpen: () => {
        this.handlePopoverOpen(wrapper)
      },
    }

    // Create and open the temporary loading popover
    const tempPopover = new Popover(selector, tempPopoverOptions)
    const tempPopoverElement = tempPopover.ensurePopoverExists()
    if (tempPopoverElement && triggerWidth > 0) {
      tempPopoverElement.style.width = `${triggerWidth}px`
      tempPopoverElement.style.minWidth = `${triggerWidth}px`
    }

    tempPopover.open()

    let content: string = ''

    // Generate content from layer data
    try {
      const { content: contentString } = await getFontDropdownContent(wrapper, layer)
      content = contentString
    } catch (error) {
      console.error('Error generating font dropdown content:', error)
      content = '<div class="emtlkit--font-dropdown-error">Failed to load fonts</div>'
    } finally {
      // Close the temporary loading popover
      tempPopover.close()
      tempPopover.destroy()
    }

    // Create a container div for the content
    const div = document.createElement('div')
    div.innerHTML = content

    // Create popover options for the actual content
    const popoverOptions: PopoverOptions = {
      position: POSITIONS.BOTTOM,
      closeOnClickOutside: true,
      showArrow: false,
      content: div,
      popoverClass: 'emtlkit--popover emtlkit--font-dropdown-popover',
      onOpen: () => {
        this.handlePopoverOpen(wrapper)
      },
      onClose: () => {
        this.handlePopoverClose(wrapper)
      },
    }

    // Create the popover
    const popover = new Popover(selector, popoverOptions)

    // Ensure popover element exists and set its width before it's visible
    const popoverElement = popover.ensurePopoverExists()
    if (popoverElement && triggerWidth > 0) {
      popoverElement.style.width = `${triggerWidth}px`
      popoverElement.style.minWidth = `${triggerWidth}px`
    }

    // Store the popover
    this.dropdowns.set(selector, popover)

    // Find the currently selected font value
    const selectedFontValue = this.getCurrentSelectedFontValue(wrapper)

    // Mark the current option as active if it exists
    if (selectedFontValue) {
      const options = div.querySelectorAll('.emtlkit--option-container')
      for (const option of options) {
        if (option.getAttribute('value') === selectedFontValue) {
          option.classList.add('active')
          this.activeOptions.set(selector, option as HTMLElement)
          break
        }
      }
    }

    // Add click handlers for all options
    await this.addPopoverOptionClickListeners(div, wrapper, popover, selector)

    // Open the actual popover with content
    popover.open()
  }

  /**
   * Create loading indicator content
   */
  private createLoadingContent(): HTMLElement {
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'emtlkit--font-dropdown-loading'
    loadingDiv.innerHTML = `
      <div class="emtlkit--loading-spinner">
        ${createSvgIcon(SPINNER_ICON_PATH, 20)}
      </div>
      <div class="emtlkit--loading-text">Loading fonts...</div>
    `
    return loadingDiv
  }

  /**
   * Get the currently selected font value from the wrapper
   */
  private getCurrentSelectedFontValue(wrapper: Element): string | null {
    const fieldset = wrapper.closest('fieldset')
    if (!fieldset) return null

    // Try to get the current value from a hidden input or data attribute
    const hiddenInput = fieldset.querySelector('input[type="hidden"][name$="[font]"]')
    if (hiddenInput instanceof HTMLInputElement) {
      return hiddenInput.value
    }

    return null
  }

  /**
   * Handle popover open event - update icon
   */
  private handlePopoverOpen(wrapper: Element): void {
    const icon = wrapper.querySelector('.emtlkit--dropdown-arrow svg')
    if (icon instanceof SVGElement) {
      icon.classList.remove('down')
      icon.classList.add('up')
    }
  }

  /**
   * Handle popover close event - update icon
   */
  private handlePopoverClose(wrapper: Element): void {
    const icon = wrapper.querySelector('.emtlkit--dropdown-arrow svg')
    if (icon instanceof SVGElement) {
      icon.classList.remove('up')
      icon.classList.add('down')
    }
  }

  /**
   * Add click listeners to all popover options using DOM delegation
   */
  private async addPopoverOptionClickListeners(
    contentElement: HTMLElement,
    wrapper: Element,
    popover: Popover,
    selector: HTMLElement
  ): Promise<void> {
    contentElement.addEventListener('click', async event => {
      // Safe type casting
      const target = event.target

      // Find the option container
      let optionElement: Element | null = null

      if (target instanceof Element) {
        if (target.classList.contains('emtlkit--option-container')) {
          optionElement = target
        } else {
          optionElement = target.closest('.emtlkit--option-container')
        }
      }

      if (!optionElement) return

      // Remove active class from all options
      const allOptions = contentElement.querySelectorAll('.emtlkit--option-container')
      allOptions.forEach(option => option.classList.remove('active'))

      // Add active class to the selected option
      optionElement.classList.add('active')

      // Store the active option for this dropdown
      this.activeOptions.set(selector, optionElement as HTMLElement)

      await this.handleOptionSelection(wrapper, popover, optionElement)
    })
  }

  /**
   * Handle when a font option is selected
   */
  private async handleOptionSelection(wrapper: Element, popover: Popover, optionElement: Element): Promise<void> {
    // Update selected font display
    const label = optionElement.getAttribute('data-label') || ''
    const isDefault = optionElement.getAttribute('data-default') === 'true'
    const fontFamily = optionElement.getAttribute('data-family') || ''
    const fontSource = optionElement.getAttribute('value') || ''
    const selectedFont = wrapper.querySelector('.emtlkit--selected-font')

    if (selectedFont) {
      selectedFont.innerHTML
        = isDefault && label
          ? `<span style="font-family: '${fontFamily}'">${label}</span> <span style="font-family: ''">(Default)</span>`
          : label || '--'
      if (selectedFont instanceof HTMLElement) {
        selectedFont.style.fontFamily = fontFamily
      }
    }

    // Update fieldset
    const fieldset = wrapper.closest('fieldset')
    if (fieldset) {
      const option = optionElement.querySelector('input[type="radio"]') as HTMLInputElement
      const optionId = option.getAttribute('data-id') || ''

      // Update the fieldset and save to localStorage
      this.instance?.updateFieldset(fieldset, optionId, label, fontSource)
      fieldset.setAttribute('data-default', `${isDefault}`)
      fieldset.setAttribute('data-family', `${fontFamily}`)

      // Update pricing data on fieldset (used by PricingManager)
      const pricingData = option.getAttribute('data-pricing')
      if (pricingData) {
        fieldset.setAttribute('data-pricing', pricingData)
      } else {
        fieldset.removeAttribute('data-pricing')
      }

      saveToLocalStorage(fieldset, option, {
        type: 'font',
        family: fontFamily,
        value: fontSource,
        isDefault: `${isDefault}`,
        name: label,
        ...(pricingData ? { additionalPricing: JSON.parse(pricingData) } : {}),
      })
      // Trigger canvas render
      // Render canvas with new text
      await this.instance?.renderCanvas()
      Transmitter.trigger('tailorkit-set-options')

      // Close the popover
      // popover.close()
    }
  }

  /**
   * Close all open dropdowns
   */
  public closeAllDropdowns(): void {
    this.dropdowns.forEach(popover => {
      if (popover.isPopoverOpen()) {
        popover.close()
      }
    })
  }

  /**
   * Handle Escape key press to close all dropdowns
   */
  private handleEscapeKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.closeAllDropdowns()
    }
  }

  /**
   * Clean up all dropdowns and event listeners
   */
  public cleanup(): void {
    // Destroy all popovers
    this.dropdowns.forEach(popover => {
      popover.destroy()
    })

    this.dropdowns.clear()
    this.activeOptions.clear()
    document.removeEventListener('keydown', this.handleEscapeKey)
    this.escapeKeyHandlerAttached = false
    this.initialized = false
  }
}

/**
 * Initialize font dropdown manager for the application.
 * Uses lazy initialization - dropdowns are created only when clicked, not on page load.
 *
 * @param instance TailorKitProductPersonalizer instance
 * @returns Functions to initialize manager and clean up dropdowns
 */
export const setupFontDropdowns = (instance: TailorKitProductPersonalizer) => {
  const manager = FontDropdownManager.getInstance()
  manager.setInstance(instance)

  function initFontDropdowns() {
    manager.initialize()
  }

  function cleanupFontDropdowns() {
    manager.cleanup()
  }

  return {
    initFontDropdowns,
    cleanupFontDropdowns,
  }
}
