/* eslint-disable max-len */
import { BaseOptionSetElement } from '../../BaseOptionSetElement'

const ELEMENT_NAME = 'tailorkit-image-swatch'
const DEBUG = false

// Max options rendered before the grid collapses behind a "View all" toggle.
// Keeps the picker compact when merchants upload many icons/emojis.
const VISIBLE_THRESHOLD = 8
// Collapse only applies to icon-heavy sets (emoji/icon grids). Mask sets
// typically have <=3 items so the threshold never triggers anyway, but we
// exclude them explicitly in case merchants add many masks.
const COLLAPSIBLE_TYPES = new Set(['image_option'])

/**
 * Debug logging helper
 */
function debug(message: string, ...args: any[]): void {
  if (DEBUG) {
    console.log(`[ImageSwatchElement Debug] ${message}`, ...args)
  }
}

/**
 * Image Swatch Element - Displays images in a grid layout
 */
export class ImageSwatchElement extends BaseOptionSetElement {
  private optionSetType: string = 'image_option'
  private restorationTimeout: number | null = null
  private isExpanded: boolean = false

  connectedCallback() {
    super.connectedCallback()
    debug(`Component connected to DOM, id: ${this.id}`)

    // Get option set type from data attribute
    const optionSetType = this.getAttribute('data-option-set-type')
    if (optionSetType) {
      this.optionSetType = optionSetType
      debug(`Option set type set to: ${optionSetType}`)
    }
  }

  protected renderOptionSet(): void {
    debug(`Starting renderOptionSet()`)

    const container = this.getContainer()
    const optionSet = this.getOptionSet()
    const { printAreaId, optionSetId } = this.getIds()

    debug(`Rendering option set: printAreaId=${printAreaId}, optionSetId=${optionSetId}`)

    if (!optionSet) {
      console.warn('No option set data available')
      debug(`No option set data available, aborting render`)
      return
    }

    // Check if any option is selected
    const selectedOption = this.getSelectedOption()
    debug(`Selected option:`, selectedOption)

    // Decide whether to collapse the grid behind a "View all" toggle.
    const totalOptions = optionSet.ol.length
    const canCollapse = COLLAPSIBLE_TYPES.has(this.optionSetType) && totalOptions > VISIBLE_THRESHOLD
    // Auto-expand if the currently selected option would be hidden by collapse.
    if (canCollapse && !this.isExpanded && selectedOption?.i) {
      const selectedIndex = optionSet.ol.findIndex((o: any) => o?.i === selectedOption.i)
      if (selectedIndex >= VISIBLE_THRESHOLD) {
        this.isExpanded = true
      }
    }
    const visibleOptions = canCollapse && !this.isExpanded ? optionSet.ol.slice(0, VISIBLE_THRESHOLD) : optionSet.ol

    // Log options being rendered
    debug(`Rendering ${visibleOptions.length}/${totalOptions} options (collapsed=${canCollapse && !this.isExpanded})`)

    // Create HTML using template literal
    const html = `
      <div class="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap">
        ${visibleOptions
          .map((option, index) => {
            if (!option) return ''

            // Check if this option is selected (first option by default or option with selecting === true)
            const isSelected = option?.i === selectedOption?.i
            const radioName = `${printAreaId} / ${optionSetId}`
            const additionalPricing = option.additionalPricing
              ? `data-pricing='${JSON.stringify(option.additionalPricing)}'`
              : ''
            const width = 60
            const height = 60
            // Handle image URL optimization
            // Use pre-composited thumbnail if available (for overlay-edited images)
            const imageSource = option?.compositedThumbnailSrc || option?.v
            const isDataUrl = imageSource?.startsWith('data:')
            const isShopifyCdn
              = !isDataUrl && (imageSource?.includes('cdn.shopify.com') || imageSource?.includes('cdn/shop/files'))
            const optionUrl = isShopifyCdn ? `${imageSource}&width=${width * 2}` : imageSource
            const optionClass = `${this.optionSetType === 'mask_option' ? 'emtlkit-mask-option' : 'emtlkit-image-option'}${isSelected ? ' active' : ''}`

            debug(`Creating option element: id=${option.i}, label=${option.l}, selected=${isSelected}`)

            return `
            <div class="emtlkit--option-container ${optionClass}" data-item-id="${option.i}">
              <img width=${width} height=${height} alt="${option.l}" src="${optionUrl}" loading="lazy" />
              <input
                type="radio"
                name="${radioName}"
                value="${option.v}"
                data-id="${option.i}"
                data-name="${option.l}"
                defaultChecked=${isSelected}
                ${additionalPricing}
              />
            </div>
          `
          })
          .join('')}
      </div>
      ${
        canCollapse
          ? `<button type="button" class="emtlkit-view-all-toggle">${
              this.isExpanded ? 'Show less' : `View all (${totalOptions})`
            }</button>`
          : ''
      }
    `

    // Hide fieldset if there is only one option and the option set type is mask_option.
    // Skip hiding in admin preview mode (data-preview-mode="true") so merchants can
    // always see their masks regardless of count.
    const isPreviewMode = this.getAttribute('data-preview-mode') === 'true'
    const hiddenTypes = ['mask_option']
    if (!isPreviewMode && optionSet.ol.length === 1 && hiddenTypes.includes(optionSet.t)) {
      const optionSetContainer = container.closest('.emtlkit--option-set-container') as HTMLElement
      if (optionSetContainer) {
        const marginBottom = getComputedStyle(optionSetContainer).marginBottom
        optionSetContainer.style.display = 'none'
        optionSetContainer.style.marginBottom = `-${marginBottom}`
      }
    }

    // Set the HTML
    container.innerHTML = html
    debug(`Container HTML set, now adding event listeners`)

    // Add click handlers after rendering
    container.querySelectorAll('.emtlkit--option-container').forEach(optionContainer => {
      optionContainer.addEventListener('click', e => {
        const itemId = (optionContainer as HTMLElement).dataset.itemId
        if (itemId) {
          debug(`Option container clicked: itemId=${itemId}`)
          this.handleSelect(itemId, e)
        }
      })
    })

    // Wire up the collapse toggle. Re-render preserves expanded state via
    // `this.isExpanded` so selected options stay selected across toggles.
    const toggleBtn = container.querySelector('.emtlkit-view-all-toggle') as HTMLButtonElement | null
    if (toggleBtn) {
      toggleBtn.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        this.isExpanded = !this.isExpanded
        this.renderOptionSet()
      })
    }

    // Add a post-render check to ensure radio inputs exist
    debug(`Scheduling radio input check`)
    this.scheduleRadioInputCheck()

    super.renderOptionSet()
    debug(`renderOptionSet() complete`)
  }

  /**
   * Schedules a check to ensure all option containers have radio inputs
   */
  private scheduleRadioInputCheck(): void {
    // Clear any existing timeout
    if (this.restorationTimeout) {
      window.clearTimeout(this.restorationTimeout)
      debug(`Cleared existing restoration timeout`)
    }

    // Schedule a check shortly after rendering
    this.restorationTimeout = window.setTimeout(() => {
      debug(`Timeout triggered, checking for radio inputs`)
      this.ensureRadioInputsExist()
    }, 100) // Check after 100ms
  }

  /**
   * Cleanup on disconnect
   */
  disconnectedCallback() {
    super.disconnectedCallback()
    debug(`Component disconnected from DOM, id: ${this.id}`)

    // Clear any pending restoration timeout to prevent memory leaks
    if (this.restorationTimeout) {
      window.clearTimeout(this.restorationTimeout)
      this.restorationTimeout = null
      debug(`Cleared restoration timeout on disconnect`)
    }
  }

  /**
   * Ensures radio inputs exist in all option containers
   */
  private ensureRadioInputsExist(): void {
    const container = this.getContainer()
    if (!container) {
      debug(`No container found, cannot check for radio inputs`)
      return
    }

    debug(`Checking for radio inputs in container`)

    // Check each option container
    const optionContainers = container.querySelectorAll('.emtlkit--option-container')
    debug(`Found ${optionContainers.length} option containers to check`)

    let restoredCount = 0

    optionContainers.forEach((optionContainer: Element, index: number) => {
      // If radio input is missing, create and append it
      if (!optionContainer.querySelector('input[type="radio"]')) {
        console.log('[TailorKit] Restoring missing radio input in ImageSwatchElement')
        debug(`Option container ${index} missing radio input, restoring...`)

        // Create a new radio input
        const { printAreaId, optionSetId } = this.getIds()
        const radioName = `${printAreaId} / ${optionSetId}`
        const itemId = (optionContainer as HTMLElement).dataset.itemId || ''
        const isSelected = optionContainer.classList.contains('active')

        debug(`Creating radio input: name=${radioName}, id=${itemId}, selected=${isSelected}`)

        const input = document.createElement('input')
        input.type = 'radio'
        input.name = radioName

        // Get image src and alt for value and data-name
        const img = optionContainer.querySelector('img')
        if (img) {
          const imgSrc = img.getAttribute('src') || ''
          const imgAlt = img.getAttribute('alt') || ''
          input.value = imgSrc
          input.setAttribute('data-name', imgAlt)
          debug(`Set input value from image: src=${imgSrc}, alt=${imgAlt}`)
        } else {
          debug(`No image found in container, radio input may have incomplete data`)
        }

        input.setAttribute('data-id', itemId)
        if (isSelected) {
          input.defaultChecked = true
          debug(`Set radio input as checked`)
        }

        // Append to container
        optionContainer.appendChild(input)
        restoredCount++
        debug(`Radio input appended to container`)
      } else {
        debug(`Option container ${index} already has radio input, skipping`)
      }
    })

    if (restoredCount > 0) {
      console.log(`[TailorKit] Restored ${restoredCount} radio inputs in ImageSwatchElement`)
    }

    debug(`Radio input check complete: ${restoredCount} inputs restored`)
  }
}

// Register the web component if it hasn't been registered yet
if (!customElements.get(ELEMENT_NAME)) {
  debug(`Registering ${ELEMENT_NAME} custom element`)
  customElements.define(ELEMENT_NAME, ImageSwatchElement)
}
