import type { TGeneratedImage } from 'extensions/tailorkit-src/src/assets/handlers/event-handlers/generateImageWithAi'
import Button from '../../button'

/**
 * Interface for event listener tracking
 */
interface EventListenerInfo {
  element: HTMLElement | Document
  type: string
  handler: EventListenerOrEventListenerObject
  options?: boolean | AddEventListenerOptions
}

/**
 * Interface for SuggestionList options
 */
export interface SuggestionListOptions {
  parentElement: HTMLElement
  suggestions: string[] | TGeneratedImage[]
  suggestionsType: 'text' | 'image'
  onSuggestionSelect: (selectedOption: string | TGeneratedImage) => void
  onRegenerate?: (regenerateComponent: HTMLElement) => Promise<void>
  footerRightElement: HTMLElement // Must pass the exact footer right element
  originalButtonElement: HTMLElement // Original button to hide/replace
}

const ids = {
  applyButtonId: 'emtlkit--apply-text-button',
  regenerateButtonId: 'emtlkit--regenerate-button',
}

/**
 * Class responsible for rendering and managing AI-generated text suggestions
 */
export class SuggestionList {
  private options: SuggestionListOptions
  private eventListeners: EventListenerInfo[] = []
  private suggestionsContainer: HTMLElement | null = null
  private actionButtons: {
    applyButtonElement: HTMLElement | null
    regenerateButtonElement: HTMLElement | null
    applyButton: Button | null
    regenerateButton: Button | null
  } = {
    applyButtonElement: null,
    regenerateButtonElement: null,
    applyButton: null,
    regenerateButton: null,
  }
  private selectedSuggestion: string | TGeneratedImage | null = null

  /**
   * @param options Configuration options for the suggestion list
   */
  constructor(options: SuggestionListOptions) {
    this.options = options
    this.render()
  }

  /**
   * Add event listener with tracking for cleanup
   */
  private addEventListenerWithCleanup(
    element: HTMLElement | Document,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!element) return

    element.addEventListener(type, handler, options)
    this.eventListeners.push({ element, type, handler, options })
  }

  private renderSuggestionsHeader(): void {
    // Create suggestions header
    const suggestionsHeader = document.createElement('p')
    suggestionsHeader.textContent = 'Suggestions'
    suggestionsHeader.className = 'emtlkit--suggestions-header'
    if (this.suggestionsContainer) {
      this.suggestionsContainer.appendChild(suggestionsHeader)
    }
  }

  private renderSuggestionsText(): void {
    const { suggestions } = this.options
    // Create and add each suggestion option
    suggestions.forEach(option => {
      const suggestionElement = document.createElement('div')
      suggestionElement.className = 'emtlkit--suggestion-option'
      suggestionElement.textContent = option as string

      // Add click event to select this option
      this.addEventListenerWithCleanup(suggestionElement, 'click', () => {
        this.selectSuggestion(option as string)
      })

      if (this.suggestionsContainer) {
        this.suggestionsContainer.appendChild(suggestionElement)
      }
    })
  }

  private renderSuggestionsImage(): void {
    const { suggestions } = this.options

    const imagesWrapper = document.createElement('div')
    imagesWrapper.className = 'emtlkit--d-flex emtlkit--gap-8 emtlkit--flex-wrap emtlkit--suggestion-grid-container'

    // Create and add each suggestion option
    suggestions.forEach(option => {
      const _option = option as TGeneratedImage
      const suggestionElement = document.createElement('div')
      suggestionElement.className = 'emtlkit--suggestion-option emtlkit--suggestion-option-image'
      const loadingElement = this.createImageSkeleton()
      suggestionElement.appendChild(loadingElement)

      if (_option.originalSource && !_option.loading) {
        const image = new Image()
        image.src = _option.originalSource
        image.alt = _option.alt
        image.onload = async () => {
          this.removeImageSkeleton(suggestionElement)
          suggestionElement.appendChild(image)
        }
        suggestionElement.setAttribute('value', _option.originalSource)
      }

      // Add click event to select this option
      this.addEventListenerWithCleanup(suggestionElement, 'click', () => {
        this.selectSuggestion(_option)
      })

      if (this.suggestionsContainer) {
        imagesWrapper.appendChild(suggestionElement)
      }
    })

    if (this.suggestionsContainer) {
      this.suggestionsContainer.appendChild(imagesWrapper)
    }
  }

  /**
   * Render the suggestion list and action buttons
   */
  private render(): void {
    const { parentElement, suggestions, suggestionsType = 'text' } = this.options
    // Clear any existing suggestions container
    this.clear()

    if (!suggestions.length) return

    // Create suggestions container
    this.suggestionsContainer = document.createElement('div')
    this.suggestionsContainer.className = 'emtlkit--suggestions-list'

    // Create suggestions header
    this.renderSuggestionsHeader()

    if (suggestionsType === 'text') {
      this.renderSuggestionsText()
    } else {
      this.renderSuggestionsImage()
    }

    // Add suggestions container to the provided parent element
    parentElement.appendChild(this.suggestionsContainer)

    // Create action buttons
    this.createActionButtons()
  }

  /**
   * Create regenerate and apply buttons
   */
  private createActionButtons(): void {
    const { footerRightElement, originalButtonElement } = this.options

    // Hide the original generate button
    if (originalButtonElement) {
      originalButtonElement.style.display = 'none'
    }

    // If no footer right element is found, don't create the buttons
    if (!footerRightElement) return

    // Check if action buttons already exist to prevent duplication
    const existingButtons = footerRightElement.querySelectorAll('.emtlkit--action-button')
    if (existingButtons.length > 0) {
      // Get references to existing buttons
      this.actionButtons.regenerateButtonElement = footerRightElement.querySelector(
        `#${ids.regenerateButtonId}`
      ) as HTMLButtonElement | null
      this.actionButtons.applyButtonElement = footerRightElement.querySelector(
        `#${ids.applyButtonId}`
      ) as HTMLButtonElement | null

      // Make sure buttons are visible
      if (this.actionButtons.regenerateButtonElement) {
        this.actionButtons.regenerateButtonElement.style.display = ''
      }
      if (this.actionButtons.applyButtonElement) {
        this.actionButtons.applyButtonElement.style.display = ''
        this.actionButtons.applyButtonElement.setAttribute('disabled', 'true')
      }
      return
    }

    const regenerateButton = new Button({
      id: ids.regenerateButtonId,
      className: 'emtlkit--action-button emtlkit--regenerate-button',
      children: 'Re-generate',
      onClick: async () => {
        if (this.options.onRegenerate) {
          const regenerateElement = regenerateButton.getElement()

          regenerateElement && (await this.options.onRegenerate(regenerateElement))
        }
      },
    })

    const applyButton = new Button({
      id: ids.applyButtonId,
      attributes: {
        disabled: 'true',
      },
      variant: 'primary',
      className: 'emtlkit--action-button emtlkit--apply-button',
      children: this.options.suggestionsType === 'text' ? 'Apply text' : 'Select image',
      onClick: () => {
        if (this.selectedSuggestion && this.options.onSuggestionSelect) {
          this.options.onSuggestionSelect(this.selectedSuggestion)
        }
      },
    })

    const regenerateElement = regenerateButton.getElement()
    const applyElement = applyButton.getElement()

    // Store references to the buttons
    this.actionButtons.regenerateButton = regenerateButton
    this.actionButtons.applyButton = applyButton
    this.actionButtons.regenerateButtonElement = regenerateElement
    this.actionButtons.applyButtonElement = applyElement

    if (regenerateElement && applyElement) {
      // Add buttons to the footer right
      footerRightElement.appendChild(regenerateElement)
      footerRightElement.appendChild(applyElement)
    }
  }

  /**
   * Select a suggestion option and update UI to show it's selected
   */
  private selectSuggestion(option: string | TGeneratedImage): void {
    if (!this.suggestionsContainer) return

    // Find all suggestion options and remove selected class
    const allOptions = this.suggestionsContainer.querySelectorAll('.emtlkit--suggestion-option')
    allOptions.forEach(el => {
      el.classList.remove('emtlkit--suggestion-option-selected')
    })

    // Add selected class to the clicked option
    const selectedOption = Array.from(allOptions).find(el => {
      const value = typeof option === 'string' ? option : option.originalSource
      return el.textContent === value || el.getAttribute('value') === value
    })
    if (selectedOption) {
      selectedOption.classList.add('emtlkit--suggestion-option-selected')
    }

    // Store the selected option for later use when Apply is clicked
    this.selectedSuggestion = option

    // Enable the Apply button
    if (this.actionButtons.applyButtonElement) {
      this.actionButtons.applyButtonElement.removeAttribute('disabled')
    }
  }

  /**
   * Update the suggestions list with new data
   */
  public update(suggestions: string[] | TGeneratedImage[]): void {
    this.options.suggestions = suggestions
    this.render()
  }

  public createImageSkeleton(): HTMLDivElement {
    const imageSkeleton = document.createElement('div')
    imageSkeleton.className = 'emtlkit--image-skeleton'
    return imageSkeleton as HTMLDivElement
  }

  public removeImageSkeleton(container: HTMLElement): void {
    const imageSkeleton = container.querySelector('.emtlkit--image-skeleton')
    if (imageSkeleton) {
      imageSkeleton.remove()
    }
  }

  /**
   * Get the currently selected suggestion text
   */
  public getSelectedSuggestion(): string | TGeneratedImage | null {
    return this.selectedSuggestion
  }

  public getSuggestions(): string[] | TGeneratedImage[] {
    return this.options.suggestions as string[] | TGeneratedImage[]
  }

  public getApplyButton(): Button | null {
    return this.actionButtons.applyButton || null
  }

  public getRegenerateButton(): Button | null {
    return this.actionButtons.regenerateButton || null
  }

  /**
   * Clear the suggestion list and action buttons
   */
  public clear(): void {
    // Remove suggestions container if it exists
    if (this.suggestionsContainer && this.suggestionsContainer.parentElement) {
      this.suggestionsContainer.parentElement.removeChild(this.suggestionsContainer)
      this.suggestionsContainer = null
    }

    // Reset selected suggestion
    this.selectedSuggestion = null
  }

  /**
   * Hide action buttons (typically used when showing original generate button)
   */
  public hideActionButtons(): void {
    if (this.actionButtons.applyButtonElement) {
      this.actionButtons.applyButtonElement.style.display = 'none'
    }
    if (this.actionButtons.regenerateButtonElement) {
      this.actionButtons.regenerateButtonElement.style.display = 'none'
    }
  }

  /**
   * Show action buttons
   */
  public showActionButtons(): void {
    if (this.actionButtons.applyButtonElement) {
      this.actionButtons.applyButtonElement.style.display = ''
    }
    if (this.actionButtons.regenerateButtonElement) {
      this.actionButtons.regenerateButtonElement.style.display = ''
    }
  }

  /**
   * Clean up resources when component is no longer needed
   */
  public destroy(): void {
    // Remove all registered event listeners
    this.eventListeners.forEach(({ element, type, handler, options }) => {
      element.removeEventListener(type, handler, options)
    })
    this.eventListeners = []

    // Clear DOM elements
    this.clear()

    // Remove the action buttons if they exist
    if (this.actionButtons.applyButtonElement && this.actionButtons.applyButtonElement.parentElement) {
      this.actionButtons.applyButtonElement.parentElement.removeChild(this.actionButtons.applyButtonElement)
    }
    if (this.actionButtons.regenerateButtonElement && this.actionButtons.regenerateButtonElement.parentElement) {
      this.actionButtons.regenerateButtonElement.parentElement.removeChild(this.actionButtons.regenerateButtonElement)
    }

    this.actionButtons.applyButtonElement = null
    this.actionButtons.regenerateButtonElement = null

    // Show the original button again
    if (this.options.originalButtonElement) {
      this.options.originalButtonElement.style.display = ''
    }
  }
}
