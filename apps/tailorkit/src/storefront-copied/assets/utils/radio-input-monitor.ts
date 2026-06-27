/**
 * Radio Input Monitor - Ensures radio inputs are preserved in option containers
 *
 * This utility monitors DOM mutations to detect when radio inputs inside option containers
 * are removed, and automatically restores them to prevent theme conflicts
 * from breaking the TailorKit functionality.
 */

const DEBUG = false

/**
 * Configuration for radio input restoration
 * This can be updated if the DOM structure or attributes change
 */
export interface RadioInputConfig {
  containerSelector: string
  containerDataAttribute: string
  parentSelector: string
  printAreaAttribute: string
  optionSetAttribute: string
  imageSelector: string
  imageValueAttribute: string
  imageLabelAttribute: string
  activeClass: string
  radioNameFormat: (printAreaId: string, optionSetId: string) => string
  getAdditionalAttributes?: (container: HTMLElement) => Record<string, string>
}

/**
 * Default configuration - can be updated without changing core logic
 */
const defaultConfig: RadioInputConfig = {
  containerSelector: '.emtlkit--option-container',
  containerDataAttribute: 'data-item-id',
  parentSelector: '[data-print-area-id][data-option-set-id]',
  printAreaAttribute: 'data-print-area-id',
  optionSetAttribute: 'data-option-set-id',
  imageSelector: 'img',
  imageValueAttribute: 'src',
  imageLabelAttribute: 'alt',
  activeClass: 'active',
  radioNameFormat: (printAreaId: string, optionSetId: string) => `${printAreaId} / ${optionSetId}`,
  getAdditionalAttributes: (container: HTMLElement): Record<string, string> => {
    // Check for pricing data
    const pricingElement = container.querySelector('[data-pricing]')
    if (pricingElement) {
      const pricing = pricingElement.getAttribute('data-pricing')
      if (pricing) {
        return { 'data-pricing': pricing }
      }
    }
    return {}
  },
}

/**
 * Log helper that only prints when debugging is enabled
 */
function debug(message: string, ...args: any[]): void {
  if (DEBUG) {
    console.log(`[TailorKit Debug] ${message}`, ...args)
  }
}

/**
 * Radio Input Restoration Factory
 * Uses configuration to create radio inputs that match the current structure
 */
class RadioInputFactory {
  // eslint-disable-next-line no-useless-constructor
  constructor(private config: RadioInputConfig = defaultConfig) {}

  /**
   * Updates the configuration
   */
  updateConfig(newConfig: Partial<RadioInputConfig>): void {
    this.config = { ...this.config, ...newConfig }
    debug('Configuration updated:', this.config)
  }

  /**
   * Checks if a container has a radio input element
   */
  hasRadioInput(container: Element): boolean {
    const hasInput = container.querySelector('input[type="radio"]') !== null
    if (DEBUG && !hasInput) {
      debug(`No radio input found in container:`, container)
    }
    return hasInput
  }

  /**
   * Creates a new radio input based on container and configuration
   */
  createRadioInput(container: HTMLElement): HTMLInputElement {
    const itemId = container.getAttribute(this.config.containerDataAttribute) || ''
    const isSelected = container.classList.contains(this.config.activeClass)

    // Find the container's parent to determine the radio name
    const optionSetContainer = container.closest(this.config.parentSelector)

    let radioName = 'tailorkit-option'
    if (optionSetContainer) {
      const printAreaId = optionSetContainer.getAttribute(this.config.printAreaAttribute) || ''
      const optionSetId = optionSetContainer.getAttribute(this.config.optionSetAttribute) || ''
      radioName = this.config.radioNameFormat(printAreaId, optionSetId)
      debug(`Creating radio with name "${radioName}" from container attributes`, { printAreaId, optionSetId })
    } else {
      debug(`Could not find option set container, using default name "${radioName}"`)
    }

    // Create the input element
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = radioName

    // Try to get the value from the image or container
    const img = container.querySelector(this.config.imageSelector)
    if (img) {
      const imgValue = img.getAttribute(this.config.imageValueAttribute) || ''
      const imgLabel = img.getAttribute(this.config.imageLabelAttribute) || ''
      input.value = imgValue
      input.setAttribute('data-name', imgLabel)
      debug(`Setting radio input from image:`, { value: imgValue, label: imgLabel })
    } else {
      debug(`No image found in container, radio input may have incomplete data`)
    }

    // Set the item ID
    input.setAttribute('data-id', itemId)

    // Set checked state
    if (isSelected) {
      input.defaultChecked = true
      debug(`Setting radio as checked (selected)`)
    }

    // Add any additional attributes from configuration
    if (this.config.getAdditionalAttributes) {
      const additionalAttrs = this.config.getAdditionalAttributes(container)
      Object.entries(additionalAttrs).forEach(([key, value]) => {
        input.setAttribute(key, value)
      })
      debug(`Added additional attributes:`, additionalAttrs)
    }

    debug(`Created new radio input:`, input)
    return input
  }

  /**
   * Gets all containers that should have radio inputs
   */
  getContainers(): NodeListOf<Element> {
    return document.querySelectorAll(this.config.containerSelector)
  }
}

// Global factory instance
const radioFactory = new RadioInputFactory()

/**
 * Updates the radio input restoration configuration
 * Call this if your DOM structure or attributes change
 */
export function updateRadioInputConfig(config: Partial<RadioInputConfig>): void {
  radioFactory.updateConfig(config)
  console.log('[TailorKit] Radio input configuration updated')
}

/**
 * Starts monitoring for removed radio inputs in option containers
 */
export function startRadioInputMonitor(): void {
  console.log('[TailorKit] Starting radio input monitor...')
  debug('Radio input monitor initialized with debugging enabled')

  // Create a mutation observer to watch for DOM changes
  const observer = new MutationObserver(mutations => {
    // Process all mutations
    mutations.forEach(mutation => {
      // Check if the target is or contains our option containers
      const target = mutation.target as Element

      // If nodes were removed, check if any was a radio input
      if (mutation.removedNodes.length > 0) {
        debug(`Mutation detected: ${mutation.removedNodes.length} nodes removed from`, target)

        // Check if any removed node was a radio input
        mutation.removedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.nodeName === 'INPUT' && node.getAttribute('type') === 'radio') {
            debug(`Radio input was removed:`, node)
          }
        })

        // Check if this mutation happened within an option container
        if (target.matches?.(defaultConfig.containerSelector) || target.closest(defaultConfig.containerSelector)) {
          const container = target.matches?.(defaultConfig.containerSelector)
            ? target
            : target.closest(defaultConfig.containerSelector)

          // If container exists and has no radio input, restore it
          if (container && !radioFactory.hasRadioInput(container)) {
            debug(`Restoring radio input in container:`, container)

            const newInput = radioFactory.createRadioInput(container as HTMLElement)
            container.appendChild(newInput)
            debug(`Radio input restored successfully:`, newInput)
          }
        }
      }
    })
  })

  // Configuration for the observer
  const config = {
    childList: true, // Watch for changes in child elements
    subtree: true, // Watch the entire subtree
    attributes: false,
    characterData: false,
  }

  debug(`Starting mutation observer with config:`, config)

  // Start observing the document
  observer.observe(document.body, config)
  debug(`Observer attached to document.body`)

  // Also run an initial check to restore any already-missing inputs
  function initialCheck() {
    const containers = radioFactory.getContainers()
    debug(`Initial check: found ${containers.length} option containers`)

    containers.forEach(container => {
      if (!radioFactory.hasRadioInput(container)) {
        console.log('[TailorKit] Restoring missing radio input on initial check')
        debug(`Initial check: container missing radio input:`, container)

        const newInput = radioFactory.createRadioInput(container as HTMLElement)
        container.appendChild(newInput)

        debug(`Initial check: radio input restored:`, newInput)
      }
    })
  }

  // Run initial check when DOM is loaded
  if (document.readyState === 'loading') {
    debug(`DOM still loading, scheduling initial check for DOMContentLoaded event`)
    document.addEventListener('DOMContentLoaded', initialCheck)
  } else {
    debug(`DOM already loaded, running initial check now`)
    initialCheck()
  }
}
