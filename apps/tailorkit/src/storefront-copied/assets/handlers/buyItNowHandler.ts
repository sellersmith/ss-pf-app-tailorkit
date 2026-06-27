/**
 * Buy It Now Handler for TailorKit
 * Prevents default Buy It Now behavior for customized products
 * and uses Add to Cart + Redirect flow instead
 */

import { FormManager } from '../components/form-manager'
import { dispatchTailorKitEvent, TAILORKIT_EVENTS, type TailorKitPrepareCartEventDetail } from '../events'
import { EXPRESS_CHECKOUT_SELECTORS } from '../constants/selectors'

// Re-export for backward compatibility
export { EXPRESS_CHECKOUT_SELECTORS }

interface BuyItNowConfig {
  enabled: boolean
  debugMode: boolean
  redirectDelay: number // ms to wait before redirect
}

const defaultConfig: BuyItNowConfig = {
  enabled: true,
  debugMode: false,
  redirectDelay: 100,
}

/**
 * Check if current product has TailorKit customizations
 */
const hasCustomizations = (): boolean => {
  return window.__tailorkit__?.['product_personalizer']?.lis?.length > 0
}

/**
 * Set button loading state using TailorKit styles
 */
const setButtonLoading = (button: HTMLElement, loading: boolean): void => {
  if (loading) {
    // Add loading class
    button.classList.add('emtlkit-button--loading')

    // Create spinner element if it doesn't exist
    if (!button.querySelector('.emtlkit-button__spinner')) {
      const spinner = document.createElement('div')
      spinner.className = 'emtlkit-button__spinner'
      button.appendChild(spinner)
    }

    // Disable the button
    button.setAttribute('disabled', 'true')
  } else {
    // Remove loading class
    button.classList.remove('emtlkit-button--loading')

    // Remove spinner
    const spinner = button.querySelector('.emtlkit-button__spinner')
    if (spinner) {
      spinner.remove()
    }

    // Re-enable the button
    button.removeAttribute('disabled')
  }
}

/**
 * Handle Buy It Now button click
 */
const handleBuyItNowClick = async (event: Event, config: BuyItNowConfig): Promise<void> => {
  // Prefer the element the listener was attached to (currentTarget) because with
  // Shopify's web-component implementation, `event.target` might be a node deep
  // inside a shadow DOM which we cannot style or disable directly.
  const button = (event.currentTarget as HTMLElement) || (event.target as HTMLElement)

  if (config.debugMode) {
    console.log('[TailorKit] Buy It Now clicked:', button)
  }

  // Check if product has customizations
  if (!hasCustomizations()) {
    if (config.debugMode) {
      console.log('[TailorKit] No customizations detected, allowing default behavior')
    }
    return // Allow default behavior for non-customized products
  }

  // Prevent default Buy It Now behavior
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  if (config.debugMode) {
    console.log('[TailorKit] Intercepted Buy It Now for customized product')
  }

  // Set button to loading state
  setButtonLoading(button, true)

  try {
    // Find the product form
    const productForm = button.closest('form[action*="/cart/add"]') as HTMLFormElement

    if (!productForm) {
      console.warn('[TailorKit] Could not find product form for Buy It Now')
      setButtonLoading(button, false)
      return
    }

    // Validate required text-customer fields before proceeding
    if (!FormManager.validateRequiredTextCustomers()) {
      // Highlight/scroll handled by validator – just stop and reset button state
      setButtonLoading(button, false)
      return
    }

    // Validate required image upload fields before proceeding
    if (!FormManager.validateRequiredImageUploads()) {
      // Scroll/shake handled by validator – just stop and reset button state
      setButtonLoading(button, false)
      return
    }

    // Validate confirmation checkbox before proceeding
    if (!FormManager.validateConfirmationCheckbox()) {
      // Scroll/shake handled by validator – just stop and reset button state
      setButtonLoading(button, false)
      return
    }

    // Trigger the customizer to set options
    const customizer = document.querySelector('tailorkit-print-area-customizer')
    if (customizer) {
      const event = new CustomEvent('tailorkit-set-options')
      customizer.dispatchEvent(event)
    }

    // Give a brief moment for the customizer to process
    await new Promise(resolve => setTimeout(resolve, 50))

    // Add confirmation checkbox input to form (since we bypass the submit handler)
    FormManager.addConfirmationCheckboxInputToForm(productForm)

    // Submit the form (this will trigger our Add to Cart middleware)
    const formData = new FormData(productForm)
    const variantId = formData.get('id') as string

    // Dispatch event for other apps (e.g., OneTick) to inject data into formData
    if (variantId) {
      dispatchTailorKitEvent<TailorKitPrepareCartEventDetail>(TAILORKIT_EVENTS.PREPARE_CART_DATA, {
        formData,
        variantId,
      })
    }

    const response = await fetch('/cart/add.js', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (config.debugMode) {
      console.log('[TailorKit] Successfully added to cart:', result)
    }

    // Keep loading state during redirect
    setTimeout(() => {
      window.location.href = '/checkout'
    }, config.redirectDelay)
  } catch (error) {
    console.error('[TailorKit] Error in Buy It Now handler:', error)
    // Remove loading state on error
    setButtonLoading(button, false)
  }
}

/**
 * Initialize Buy It Now handler
 */
export const initializeBuyItNowHandler = (config: Partial<BuyItNowConfig> = {}): void => {
  const finalConfig = { ...defaultConfig, ...config }

  if (!finalConfig.enabled) {
    console.log('[TailorKit] Buy It Now handler disabled')
    return
  }

  if (finalConfig.debugMode) {
    console.log('[TailorKit] Initializing Buy It Now handler with config:', finalConfig)
  }

  // Function to attach event listeners
  const attachEventListeners = (): void => {
    EXPRESS_CHECKOUT_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        if (button.hasAttribute('data-tailorkit-handler')) {
          return // Already handled
        }

        button.setAttribute('data-tailorkit-handler', 'true')
        button.addEventListener('click', event => handleBuyItNowClick(event, finalConfig), true)

        if (finalConfig.debugMode) {
          console.log(`[TailorKit] Attached handler to button:`, selector, button)
        }
      })
    })
  }

  // Initial attachment
  attachEventListeners()

  // Re-attach when new buttons are added (for dynamic content)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any new buttons were added
        const hasNewButtons = Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            return EXPRESS_CHECKOUT_SELECTORS.some(
              selector => element.matches(selector) || element.querySelector(selector)
            )
          }
          return false
        })

        if (hasNewButtons) {
          setTimeout(attachEventListeners, 100) // Small delay to ensure DOM is ready
        }
      }
    })
  })

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  if (finalConfig.debugMode) {
    console.log('[TailorKit] Buy It Now handler initialized successfully')
  }
}

// Export for global access if needed
if (typeof window !== 'undefined') {
  ;(window as any).TailorKit = {
    ...(window as any).TailorKit,
    initializeBuyItNowHandler,
  }
}
