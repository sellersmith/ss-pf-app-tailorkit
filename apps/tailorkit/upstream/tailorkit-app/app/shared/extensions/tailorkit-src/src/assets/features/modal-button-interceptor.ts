/**
 * Modal Button Interceptor
 *
 * Prevents theme ATC/Buy It Now buttons from working in modal mode until
 * the user completes required personalization fields.
 *
 * **Approach:** Validate using state (PersonalizerStore) instead of DOM queries.
 * In modal mode, DOM elements only exist when modal is open, but state persists.
 *
 * When theme buttons are clicked without completing personalization:
 * - Prevents the form submission
 * - Shows a shake animation on the "Personalize Design" trigger button
 * - Scrolls to the trigger button if not visible
 */

import { EXPRESS_CHECKOUT_SELECTORS } from '../handlers/buyItNowHandler'
import { smoothScrollToElement } from '../utils/scroll'
import { getConfirmationCheckboxSettings } from './confirmation-checkbox/settings'
import { PersonalizerStore } from '../libraries/personalizer-store'
import { FormManager } from '../components/form-manager'

/** Selectors for Add to Cart buttons with Alpine.js handlers (to remove on:click) */
const ATC_ALPINE_SELECTORS = [
  'button[name="add"][on\\:click]',
  '.add-to-cart-button[on\\:click]',
  'button.product-form__submit[on\\:click]',
]

/** Selectors for all Add to Cart buttons (for click interception) */
const ATC_BUTTON_SELECTORS = [
  'button[name="add"]',
  'button[type="submit"][name="add"]',
  '.add-to-cart-button',
  'button.product-form__submit',
  '[data-add-to-cart]',
  '.btn-addtocart',
  '.addtocart-button',
  'form[action*="/cart/add"] button[type="submit"]',
]

/** Combined selectors for both ATC and BIN buttons */
const ALL_CHECKOUT_SELECTORS = [...ATC_BUTTON_SELECTORS, ...EXPRESS_CHECKOUT_SELECTORS]

// Debug mode - set to true to enable console logs
const DEBUG = false

const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[ModalButtonInterceptor]', ...args)
  }
}

interface RequiredField {
  printAreaId: string
  layerId: string
  type: 'text_customer' | 'image_option'
  label?: string
}

/**
 * Modal Button Interceptor class
 * Manages blocking/unblocking of theme checkout buttons in modal mode
 */
export class ModalButtonInterceptor {
  private parentElement: HTMLElement
  private modalTriggerContainer: HTMLElement | null = null
  private storedOnClickHandlers: Map<HTMLElement, string> = new Map()
  private clickInterceptors: Map<HTMLElement, (e: Event) => void> = new Map()
  private instanceId: string = ''
  private requiredFields: RequiredField[] = []

  constructor(parentElement: HTMLElement, triggerContainer: HTMLElement | null) {
    this.parentElement = parentElement
    this.modalTriggerContainer = triggerContainer

    // Build instance ID for PersonalizerStore
    const productId = parentElement.getAttribute('data-product-id') || ''
    const variantId = parentElement.getAttribute('data-variant-id') || ''
    this.instanceId = `${productId}::${variantId}`

    log('Constructor called')
    log('instanceId:', this.instanceId)

    // Extract required fields from printAreas data
    this.extractRequiredFields()
  }

  /**
   * Extract required fields from the global product personalizer data
   * Layer info is in: lis[].data.ls[].s.required
   */
  private extractRequiredFields(): void {
    const productPersonalizer = window.__tailorkit__?.['product_personalizer']
    log('window.__tailorkit__ keys:', Object.keys(window.__tailorkit__ || {}))
    log('product_personalizer:', productPersonalizer ? 'exists' : 'null')

    if (!productPersonalizer) {
      log('No product_personalizer in window.__tailorkit__')
      return
    }

    log('product_personalizer keys:', Object.keys(productPersonalizer))

    // Layer integrations contain the layer data
    const lis = productPersonalizer.lis || []
    log('Layer integrations count:', lis.length)

    this.requiredFields = []

    for (const li of lis) {
      // Only template type layer integrations have option layers
      if (li.t !== 'template') continue

      const printAreaId = li.data?.printAreaId || ''
      const layers = li.data?.ls || []
      log('Template LI', li.i, 'printAreaId:', printAreaId, 'layers:', layers.length)

      for (const layer of layers) {
        const settings = layer.s || {}
        log('  Layer:', layer.i, 'type:', layer.t, 'settings.required:', settings.required, 'settings.ot:', settings.ot)

        // Check if layer is required
        if (settings.required) {
          // Determine option type from settings or layer type
          let optionType = settings.optionType || settings.ot

          // If optionType not in settings, infer from layer type
          if (!optionType) {
            if (layer.t === 'text') {
              optionType = 'text_customer'
            } else if (layer.t === 'image' || layer.t === 'imageless') {
              optionType = 'image_option'
            }
          }

          log('    -> Required! optionType:', optionType)
          if (optionType === 'text_customer' || optionType === 'image_option') {
            this.requiredFields.push({
              printAreaId,
              layerId: layer.i,
              type: optionType,
              label: settings.label || settings.n || layer.n,
            })
          }
        }
      }
    }

    log('Required fields found:', this.requiredFields.length)
    this.requiredFields.forEach(f => log('  -', f.type, f.layerId, f.label))
  }

  /**
   * Initialize the interceptor - block theme buttons on page load
   */
  initialize(): void {
    log('initialize() called')
    this.blockThemeButtons()
    log('initialize() complete')
  }

  /**
   * Block theme ATC/BIN buttons by removing on:click attributes
   * and intercepting click events
   */
  private blockThemeButtons(): void {
    log('blockThemeButtons() called')

    // Remove on:click attributes from buttons with Alpine.js handlers
    ATC_ALPINE_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        const el = button as HTMLElement
        const onClickValue = el.getAttribute('on:click')
        if (onClickValue && !this.storedOnClickHandlers.has(el)) {
          log('Removing on:click from:', el.tagName, el.className)
          this.storedOnClickHandlers.set(el, onClickValue)
          el.removeAttribute('on:click')
        }
      })
    })

    // Add click interceptors to all checkout buttons
    let interceptorCount = 0
    ALL_CHECKOUT_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        const el = button as HTMLElement
        if (this.clickInterceptors.has(el)) return

        const interceptor = (e: Event) => this.handleThemeButtonClick(e)
        this.clickInterceptors.set(el, interceptor)
        // Use capture phase to intercept before theme handlers
        el.addEventListener('click', interceptor, true)
        interceptorCount++
      })
    })
    log('Added click interceptors to', interceptorCount, 'buttons')
    log('Total interceptors now:', this.clickInterceptors.size)

    // Also intercept form submit events
    this.interceptFormSubmits()
  }

  /**
   * Intercept form submit events in modal mode
   */
  private interceptFormSubmits(): void {
    const productId = this.parentElement.getAttribute('data-product-id')
    if (!productId) return

    const productInputs = document.querySelectorAll(`input[name="product-id"][value="${productId}"]`)
    productInputs.forEach(input => {
      const form = input.closest('form[action*="/cart/add"]') as HTMLFormElement
      if (!form || form.dataset.tlkModalInterceptorAttached === 'true') return

      form.dataset.tlkModalInterceptorAttached = 'true'
      form.addEventListener(
        'submit',
        e => {
          // Always validate on-demand
          const validationResult = this.validateAllFields()
          if (!validationResult.isValid) {
            log('Form submit blocked:', validationResult.reason)
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            this.shakeModalTrigger()
          }
        },
        true
      )
    })
  }

  /**
   * Handle theme button click - always validate fields and either allow or block
   */
  private handleThemeButtonClick(e: Event): void {
    const target = e.target as HTMLElement
    log('handleThemeButtonClick called, target:', target?.tagName, target?.className)

    // Always validate - no flag check
    const validationResult = this.validateAllFields()
    log('Field validation result:', validationResult)

    if (validationResult.isValid) {
      log('All fields valid - allowing click to proceed')
      return // Allow click
    }

    log('Validation failed:', validationResult.reason, '- blocking click')
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    this.shakeModalTrigger()
  }

  /**
   * Validate all required fields using PersonalizerStore state
   * Returns { isValid: true } if all fields are filled, or { isValid: false, reason: string } if not
   */
  private validateAllFields(): { isValid: boolean; reason?: string } {
    log('Validating fields using state...')
    log('instanceId:', this.instanceId)

    // Re-extract required fields in case they weren't available at init time
    if (this.requiredFields.length === 0) {
      this.extractRequiredFields()
    }

    log('requiredFields:', this.requiredFields.length)

    // If no required fields, check confirmation checkbox only
    if (this.requiredFields.length === 0) {
      log('No required fields configured')
      return this.validateConfirmationCheckbox()
    }

    // Get current state from PersonalizerStore
    const state = PersonalizerStore.getState(this.instanceId)
    log('PersonalizerStore state:', state ? 'exists' : 'null')

    if (!state) {
      // No state means user hasn't interacted with personalization
      log('No state in store - required fields not filled')
      return { isValid: false, reason: 'no_state' }
    }

    const { metaData } = state
    log('metaData keys:', Object.keys(metaData || {}))

    // Check each required field
    for (const field of this.requiredFields) {
      const layerValue = metaData?.[field.printAreaId]?.[field.layerId]
      log(`Checking ${field.type} field:`, field.layerId, 'value:', layerValue)

      if (field.type === 'text_customer') {
        // For text fields, check if value exists and is not empty
        if (!layerValue) {
          log('Required text field has no value:', field.layerId)
          return { isValid: false, reason: 'required_text_empty' }
        }

        // Parse the value if it's JSON - text can be in various locations
        let textValue = layerValue
        try {
          if (typeof layerValue === 'string' && layerValue.startsWith('{')) {
            const parsed = JSON.parse(layerValue)
            // Check multiple possible locations for text content
            textValue = parsed.settings?.content  // Most common: {"settings":{"content":"text"}}
              || parsed.content                    // Alternative: {"content":"text"}
              || parsed.text                       // Alternative: {"text":"text"}
              || parsed.value                      // Alternative: {"value":"text"}
              || ''
            log('Parsed text value:', textValue)
          }
        } catch {
          // Not JSON, use as-is
          log('Using raw value (not JSON):', layerValue)
        }

        if (typeof textValue === 'string' && textValue.trim() === '') {
          log('Required text field is empty:', field.layerId)
          return { isValid: false, reason: 'required_text_empty' }
        }

        log('Text field has content:', textValue)
      } else if (field.type === 'image_option') {
        // For image fields, check if value exists
        if (!layerValue) {
          log('Required image field has no value:', field.layerId)
          return { isValid: false, reason: 'required_image_empty' }
        }

        // Parse and check if image URL exists
        let hasImage = false
        try {
          if (typeof layerValue === 'string' && layerValue.startsWith('{')) {
            const parsed = JSON.parse(layerValue)
            hasImage = !!(parsed.url || parsed.src || parsed.imageUrl)
          } else if (typeof layerValue === 'string' && layerValue.length > 0) {
            hasImage = true
          }
        } catch {
          hasImage = !!layerValue
        }

        if (!hasImage) {
          log('Required image field has no image:', field.layerId)
          return { isValid: false, reason: 'required_image_empty' }
        }
      }
    }

    // All required fields are filled, check confirmation checkbox
    return this.validateConfirmationCheckbox()
  }

  /**
   * Validate confirmation checkbox if enabled
   */
  private validateConfirmationCheckbox(): { isValid: boolean; reason?: string } {
    const confirmationSettings = getConfirmationCheckboxSettings()
    log('Confirmation settings enabled:', confirmationSettings.enabled)

    if (confirmationSettings.enabled) {
      // First check FormManager's persisted state (set by modal when checkbox is checked)
      // This is the source of truth for modal mode
      const isCheckedInState = FormManager.isModalConfirmationChecked()
      log('FormManager.isModalConfirmationChecked():', isCheckedInState)

      if (isCheckedInState) {
        log('Confirmation was checked in modal (via FormManager state) - valid')
        return { isValid: true }
      }

      // Also check skipCheckboxValidation flag (set by modal just before triggering theme ATC)
      const shouldSkip = FormManager.shouldSkipCheckboxValidation()
      log('shouldSkipCheckboxValidation:', shouldSkip)

      if (shouldSkip) {
        log('Skipping checkbox validation - modal already validated')
        return { isValid: true }
      }

      // Check DOM checkbox (for inline mode or if modal is open)
      const checkbox = document.querySelector('[data-confirmation-input="true"]') as HTMLInputElement | null
      log('Confirmation checkbox:', checkbox ? `found, checked=${checkbox.checked}` : 'not found')

      if (!checkbox) {
        // Checkbox not in DOM and state is false - user needs to open modal
        log('Confirmation checkbox not in DOM and not checked in state - need to open modal')
        return { isValid: false, reason: 'confirmation_not_checked_state' }
      }
      if (!checkbox.checked) {
        log('Confirmation checkbox not checked')
        return { isValid: false, reason: 'confirmation_unchecked' }
      }
    }

    log('All validations passed')
    return { isValid: true }
  }

  /**
   * Show shake animation on the "Personalize Design" trigger button
   */
  private shakeModalTrigger(): void {
    if (!this.modalTriggerContainer) return

    // Find the trigger button inside the container
    const triggerButton = this.modalTriggerContainer.querySelector('button') as HTMLElement | null
    if (!triggerButton) return

    // Scroll to the trigger button if not fully visible
    smoothScrollToElement(triggerButton)

    // Add shake animation class
    triggerButton.classList.remove('emtlkit-modal-trigger--shake')
    // Force reflow to restart animation
    void triggerButton.offsetWidth
    triggerButton.classList.add('emtlkit-modal-trigger--shake')

    // Remove shake class after animation completes
    setTimeout(() => {
      triggerButton.classList.remove('emtlkit-modal-trigger--shake')
    }, 500)
  }

  /**
   * Unblock theme buttons - restore on:click handlers and remove interceptors
   */
  private unblockThemeButtons(): void {
    log('unblockThemeButtons() called')
    log('Restoring', this.storedOnClickHandlers.size, 'on:click handlers')
    log('Removing', this.clickInterceptors.size, 'click interceptors')

    // Restore on:click attributes
    this.storedOnClickHandlers.forEach((value, el) => {
      if (el && el.isConnected) {
        el.setAttribute('on:click', value)
      }
    })
    this.storedOnClickHandlers.clear()

    // Remove click interceptors
    this.clickInterceptors.forEach((interceptor, el) => {
      if (el && el.isConnected) {
        el.removeEventListener('click', interceptor, true)
      }
    })
    this.clickInterceptors.clear()

    log('unblockThemeButtons() complete')
  }

  /**
   * Update the trigger container reference (e.g., after re-render)
   */
  updateTriggerContainer(container: HTMLElement | null): void {
    this.modalTriggerContainer = container
  }

  /**
   * Cleanup - restore all handlers and remove listeners
   */
  cleanup(): void {
    this.unblockThemeButtons()
  }
}
