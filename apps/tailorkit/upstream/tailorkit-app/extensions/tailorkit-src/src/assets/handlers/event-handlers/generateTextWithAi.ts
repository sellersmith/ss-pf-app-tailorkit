import type { GenerateTextContentOptions } from '../../components/commons/ai-generate/generate-text/generate-text-content-handler'
import { GenerateTextContentAction } from '../../components/commons/ai-generate/generate-text/generate-text-content-handler'
import { getGenerateTextWithAiContent } from '../../utils/renders/popovers-content/generate-text-with-ai'
import type { TailorKitProductPersonalizer } from '../../components/product-personalizer'
import { findViewAndSwitchTo } from '../../utils/query-views'
import { APP_PROXY_PATH } from '../../constants'
import { STORE_FRONT_ACTION } from '../../constants/app-actions'
import { Transmitter } from '../../libraries/transmitter'
import { createSvgIcon, ERROR_ICON_PATH } from '../../icons/editor-icons'
import type { TGeneratedImage } from './generateImageWithAi'
import { fetchWithAdminContext } from '../../libraries/fetchWithAdminContext'
import { FIELDSET_TEXT_COUNTER_SELECTOR, TEXT_CUSTOMER_INPUT_SELECTOR } from '../../utils/selectors'
import { hideAiGenerationUI, markAiCreditsExhausted } from '../../utils/ai-credits'

/**
 * Class that handles text generation with AI functionality
 */
class GenerateTextHandler {
  private generateTextAction: GenerateTextContentAction | null = null
  private instance: TailorKitProductPersonalizer
  private activator: HTMLElement
  private layerId: string
  private characterLimit: string | null

  /**
   * @param activator - The activator element
   * @param instance - The TailorKitProductPersonalizer instance
   */
  constructor(activator: HTMLElement, instance: TailorKitProductPersonalizer) {
    this.activator = activator
    this.instance = instance
    this.layerId = activator.getAttribute('data-layer-id') || ''
    this.characterLimit = activator.getAttribute('data-character-limit')
    this.generateTextAction = null
  }

  /**
   * Handle text generation with AI
   */
  public async handleGenerate(): Promise<void> {
    if (!this.layerId) return

    const popoverOptions = JSON.parse(this.activator.getAttribute('data-popover-options') || '{}')

    // Generate the popover content using the existing function
    const {
      content: popoverContent,
      onMount,
      cleanupEventListeners,
    } = getGenerateTextWithAiContent(this.layerId, this.onGenerate.bind(this), this.onSelectOption.bind(this))

    const contentWrapper = document.createElement('div')
    contentWrapper.innerHTML = popoverContent

    if (onMount) {
      onMount(contentWrapper)
    }

    const textCustomerOptions: Omit<GenerateTextContentOptions, 'cleanupEventListeners'> = {
      triggerElement: this.activator,
      popoverElement: contentWrapper,
      popoverOptions: {
        position: popoverOptions.popoverPosition || 'bottom',
        closeOnClickOutside: true,
        showArrow: false,
      },
    }

    // Create the generate text content action
    this.generateTextAction = new GenerateTextContentAction({
      ...textCustomerOptions,
      cleanupEventListeners,
    })

    // Open the popover
    setTimeout(() => {
      this.generateTextAction?.openPopover()
    }, 100)
  }

  /**
   * Handle text generation
   * @param prompt - The prompt text
   * @param tone - The selected tone
   * @returns Array of generated text contents
   */
  private async onGenerate(prompt: string, tone: string | null): Promise<string[]> {
    const url = `${APP_PROXY_PATH}/app_proxy/storefront`
    const defaultErrorMessage = 'An error occurred while generating the text'
    let errorMessage = ''
    let contents = []

    if (!prompt) {
      errorMessage = 'Please enter a prompt'
    } else {
      const formData = new FormData()
      formData.append('action', STORE_FRONT_ACTION.GENERATE_TEXT)

      const jsonData = {
        tone: tone || '',
        mainTextLabel: 'What is this text about?',
        topic: `Generate for me about ${prompt}`,
        maxContentLength: !isNaN(Number(this.characterLimit)) ? Number(this.characterLimit) : 20,
        optionResponseQuantity: 3,
      }

      formData.append('jsonData', JSON.stringify(jsonData))

      try {
        const response = await fetchWithAdminContext(url, {
          method: 'POST',
          body: formData,
        })
          .then(res => res.json())
          .catch(err => {
            errorMessage = err.message || 'An error occurred while generating the text'
            console.error('Error generating text from request: ', err)
          })

        if (!response.success) {
          // Handle AI credits exhausted - hide all AI generation UI
          if (response.code === 'AI_CREDITS_EXHAUSTED') {
            markAiCreditsExhausted()
            hideAiGenerationUI()
            this.generateTextAction?.closePopover()
            return []
          }
          errorMessage = response.message || defaultErrorMessage
        }

        contents = response.contents || []

        Transmitter.trigger('tailorkit-storefront-usage', { feature: 'AI_GEN_TEXT' })
      } catch (err: any) {
        errorMessage = err.message || defaultErrorMessage
        console.error('Error generating text from catch: ', err)
      }
    }

    // Remove the error message if it exists
    const errorElement = document.querySelector('.emtlkit--error-message')
    if (errorElement) {
      errorElement.remove()
    }

    if (errorMessage) {
      const errorElement = document.createElement('div')
      errorElement.classList.add('emtlkit--error-message')
      errorElement.innerHTML = `
          ${createSvgIcon(ERROR_ICON_PATH, 20, 'xmlns="http://www.w3.org/2000/svg" fill="currentColor"')}
          <span style="width: calc(100% - 24px);">${errorMessage}</span>
        `
      const textAreaElement = document.querySelector('.emtlkit--generate-text-wrapper') as HTMLTextAreaElement
      textAreaElement.appendChild(errorElement)
      return []
    }

    return contents
  }

  /**
   * Handle option selection
   * @param option - The selected option
   */
  private async onSelectOption(option: string | TGeneratedImage): Promise<void> {
    if (typeof option === 'string') {
      // Find related input field
      const fieldSetSelector = `fieldset.emtlkit--option-set[data-layer-id="${this.layerId}"]`
      const fieldSet = this.instance.querySelector(fieldSetSelector) as HTMLFieldSetElement
      const textField = fieldSet?.querySelector(TEXT_CUSTOMER_INPUT_SELECTOR) as HTMLInputElement | HTMLTextAreaElement
      const characterCountElement = fieldSet?.querySelector(FIELDSET_TEXT_COUNTER_SELECTOR) as HTMLElement

      if (textField) {
        // Update the input field with the generated text
        textField.value = option
        fieldSet.setAttribute('value', option)
        characterCountElement.textContent = `${option.length}/${this.characterLimit}`
      }

      // Find and switch to the appropriate view for this layer
      findViewAndSwitchTo(this.instance, fieldSet)

      // Render canvas with new text
      await this.instance.renderCanvas()
      Transmitter.trigger('tailorkit-set-options')

      if (this.generateTextAction) {
        this.generateTextAction.closePopover()
      }
    }
  }
}

/**
 * Handle text generation with AI
 * @param target - The target element
 * @param instance - The TailorKitProductPersonalizer instance
 */
export const handleGenerateTextWithAI = (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
  // Get the activator element
  const activator = target.closest('.emtlkit--generate-text-with-ai') as HTMLElement
  if (!activator) return

  const handler = new GenerateTextHandler(activator, instance)
  handler.handleGenerate()
}
