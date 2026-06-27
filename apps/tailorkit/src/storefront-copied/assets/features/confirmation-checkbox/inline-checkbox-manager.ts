/**
 * Inline Confirmation Checkbox Manager
 *
 * Handles rendering and state management of the confirmation checkbox
 * in inline (non-modal) mode. Extracted from customizer.ts for SOLID compliance.
 */

import { h, render } from 'preact'
import { ConfirmationCheckbox } from '../../components/preact/commons/confirmation-checkbox'
import { getConfirmationCheckboxSettings } from './settings'
import { Transmitter } from '../../libraries/transmitter'
import { TransmitterEvents } from '../../constants/transmitter-events'
import { ATC_ALPINE_SELECTORS } from '../../constants/selectors'

export class InlineConfirmationCheckboxManager {
  private container: HTMLElement | null = null
  private parentElement: HTMLElement
  private storedOnClickHandlers: Map<HTMLElement, string> = new Map()
  private currentCheckedState: boolean = false
  private optionChangeHandler: ((e: Event) => void) | null = null

  constructor(parentElement: HTMLElement) {
    this.parentElement = parentElement
  }

  /**
   * Render the confirmation checkbox for inline mode
   */
  render(): void {
    const settings = getConfirmationCheckboxSettings()

    // Only render if feature is enabled
    if (!settings.enabled) {
      this.cleanup()
      return
    }

    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.className = 'emtlkit-inline-confirmation-checkbox-container'

      // Find the tab content container to insert after it
      const tabContainer = this.parentElement.querySelector('.emtlkit--tab-content-container')
      if (tabContainer && tabContainer.parentElement) {
        tabContainer.parentElement.insertBefore(this.container, tabContainer.nextSibling)
      } else {
        this.parentElement.appendChild(this.container)
      }
    }

    // Listen for option changes to uncheck the checkbox
    this.setupOptionChangeListener()

    // Initially remove on:click handlers (checkbox starts unchecked)
    this.removeAddToCartOnClick()

    // Render the Preact component
    this.renderWithState(false)
  }

  /**
   * Set up listener for option changes to reset checkbox state
   * When customer changes their design, they need to re-confirm
   */
  private setupOptionChangeListener(): void {
    // Remove existing listener if any
    if (this.optionChangeHandler) {
      Transmitter.remove(TransmitterEvents.SET_OPTIONS, this.optionChangeHandler)
    }

    this.optionChangeHandler = (e: Event) => {
      // Only uncheck if currently checked
      if (this.currentCheckedState) {
        this.renderWithState(false)
      }
    }

    Transmitter.listen(TransmitterEvents.SET_OPTIONS, this.optionChangeHandler)
  }

  /**
   * Render checkbox with specific checked state
   */
  private renderWithState(checked: boolean): void {
    const settings = getConfirmationCheckboxSettings()

    if (!this.container || !settings.enabled) return

    // Track current state for option change listener
    this.currentCheckedState = checked

    // Manage on:click handlers based on checkbox state
    if (checked) {
      this.restoreAddToCartOnClick()
      // Remove shake class that may have been added directly by FormManager
      // (FormManager adds it via DOM manipulation, not through Preact state)
      this.removeShakeClass()
    } else {
      this.removeAddToCartOnClick()
    }

    render(
      h(ConfirmationCheckbox, {
        id: 'emtlkit-inline-confirmation-checkbox',
        checked,
        onChange: (newChecked: boolean) => {
          this.renderWithState(newChecked)
        },
        message: settings.message,
        shake: false,
      }),
      this.container
    )
  }

  /**
   * Remove shake class that was manually added by FormManager
   */
  private removeShakeClass(): void {
    const checkboxWrapper = this.container?.querySelector('[data-confirmation-checkbox]')
    if (checkboxWrapper) {
      checkboxWrapper.classList.remove('emtlkit-confirmation-checkbox--shake')
    }
  }

  /**
   * Remove on:click attributes from Add to Cart buttons to prevent
   * theme frameworks (like Alpine.js in Horizon) from showing fake animations
   */
  private removeAddToCartOnClick(): void {
    const addToCartButtons = document.querySelectorAll(ATC_ALPINE_SELECTORS.join(', '))

    addToCartButtons.forEach(button => {
      const el = button as HTMLElement
      const onClickValue = el.getAttribute('on:click')
      if (onClickValue && !this.storedOnClickHandlers.has(el)) {
        // Store the original value
        this.storedOnClickHandlers.set(el, onClickValue)
        // Remove the attribute
        el.removeAttribute('on:click')
      }
    })
  }

  /**
   * Restore on:click attributes to Add to Cart buttons
   */
  private restoreAddToCartOnClick(): void {
    this.storedOnClickHandlers.forEach((value, el) => {
      if (el && el.isConnected) {
        el.setAttribute('on:click', value)
      }
    })
    // Clear stored handlers after restoring
    this.storedOnClickHandlers.clear()
  }

  /**
   * Cleanup: remove container, restore handlers, and remove listeners
   */
  cleanup(): void {
    // Remove option change listener
    if (this.optionChangeHandler) {
      Transmitter.remove(TransmitterEvents.SET_OPTIONS, this.optionChangeHandler)
      this.optionChangeHandler = null
    }

    if (this.container) {
      this.container.remove()
      this.container = null
    }

    this.currentCheckedState = false
    this.restoreAddToCartOnClick()
  }
}
