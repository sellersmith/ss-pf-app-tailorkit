import TextField from '../../../components/commons/textfield'
import OptionList from '../../../components/commons/options-list'
import type { Option } from '../../../components/commons/options-list/types'
import Button from '../../../components/commons/button'
import { SuggestionList } from '../../../components/commons/ai-generate/suggestion-list'
import type { TGeneratedImage } from '../../../handlers/event-handlers/generateImageWithAi'

// Types and Interfaces
interface GenerateTextContent {
  content: string
  onMount: (popoverElement: HTMLElement) => void
  cleanupEventListeners: () => void
}

interface ElementIds {
  containerId: string
  textFieldContainerId: string
  textSelectToneBtnId: string
  textSelectToneBtnContainerId: string
  textSelectToneOptionsContainerId: string
  textFieldId: string
  customToneContainerId: string
  suggestionsId: string
  generateButtonId: string
  generateButtonContainerId: string
}

// Constants
export const TONE_OPTIONS = {
  Daring: 'Daring',
  Expert: 'Expert',
  Persuasive: 'Persuasive',
  Playful: 'Playful',
  Professional: 'Professional',
  Sophisticated: 'Sophisticated',
  Supportive: 'Supportive',
} as const

/**
 * Converts tone options into a format suitable for the OptionList component
 * @param toneOptions - Array of tone options to convert
 * @returns Array of Option objects with value and label
 */
const getToneOptions = (toneOptions: string[] = Object.values(TONE_OPTIONS)): Option[] => {
  return toneOptions.map(tone => ({
    value: tone.toLowerCase(),
    label: tone,
  }))
}

/**
 * Generates unique element IDs for a given layer
 * @param layerId - The ID of the layer
 * @returns Object containing all necessary element IDs
 */
const generateElementIds = (layerId: string): ElementIds => ({
  containerId: `emtlkit--container-${layerId}`,
  textFieldContainerId: `emtlkit--text-field-container-${layerId}`,
  textFieldId: `emtlkit--generate-text-textarea-${layerId}`,
  textSelectToneBtnId: `emtlkit--text-select-tone-btn-${layerId}`,
  textSelectToneBtnContainerId: `emtlkit--text-select-tone-btn-container-${layerId}`,
  textSelectToneOptionsContainerId: `emtlkit--text-select-tone-options-container-${layerId}`,
  customToneContainerId: `emtlkit--custom-tone-container-${layerId}`,
  suggestionsId: `emtlkit--suggestions-${layerId}`,
  generateButtonContainerId: `emtlkit--generate-text-btn-container-${layerId}`,
  generateButtonId: `emtlkit--generate-text-btn-${layerId}`,
})

/**
 * Creates and initializes the prompt text field
 * @param container - Container element for the text field
 * @param generateButtonId - ID of the generate button
 * @param layerId - Layer ID
 * @returns TextField instance
 */
const initializePromptField = (container: HTMLElement, generateButtonId: string, id: string): TextField => {
  const promptField = new TextField({
    id,
    label: "What's this text about?",
    placeholder: 'e.g. Generate a playful text that would be perfect for a fun t-shirt',
    maxLength: 500,
    multiline: true,
    rows: 3,
    showCharacterCount: true,
    onChange: value => {
      const generateButton = document.querySelector(`#${generateButtonId}`) as HTMLButtonElement
      if (generateButton) {
        generateButton.disabled = value.trim().length === 0
      }
    },
  })
  promptField.appendTo(container)
  return promptField
}

/**
 * Initializes the tone selector component
 * @param toneBtn - Tone button element
 * @param toneOptionsContainer - Container for tone options
 * @param defaultToneValue - Default selected tone
 */
const initializeToneSelector = (
  toneBtn: HTMLElement,
  toneOptionsContainer: HTMLElement,
  defaultToneValue: string
): OptionList => {
  const options: Option[] = getToneOptions()
  const optionList = new OptionList({
    options,
    selected: [defaultToneValue],
    role: 'listbox',
    onChange: selected => {
      if (selected.length > 0) {
        const selectedTone = selected[0]
        toneBtn.textContent = `Tone: ${selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1)}`
        toneBtn.setAttribute('data-selected', selectedTone)
      }
    },
  })

  // Append OptionList and custom tone input
  const toneListContainer = (optionList as any).container
  if (toneListContainer) {
    toneOptionsContainer.appendChild(toneListContainer)
    appendCustomToneInput(toneOptionsContainer, toneBtn, optionList)
  }

  return optionList
}

/**
 * Appends custom tone input field to the tone options container
 * @param container - Container element for the custom tone input
 */
const appendCustomToneInput = (container: HTMLElement, toneBtn: HTMLElement, optionList: OptionList): TextField => {
  const customToneContainer = document.createElement('div')
  customToneContainer.classList.add('emtlkit--tone-selector-footer')

  const customToneField = new TextField({
    id: 'emtlkit--custom-tone-input',
    label: 'Custom Tone',
    placeholder: 'e.g. optimistic',
    onChange: value => {
      if (value) {
        toneBtn.textContent = `Tone: ${value}`
        toneBtn.setAttribute('data-selected', value)
        optionList.setSelected([value])
      }
    },
  })

  customToneField.appendTo(customToneContainer)
  container.appendChild(customToneContainer)

  return customToneField
}

/**
 * Sets up event listeners for the tone selector dropdown
 * @param popoverElement - Main popover element
 * @param toneBtn - Tone button element
 * @returns Cleanup function for event listeners
 */
const setupToneDropdownEvents = (popoverElement: HTMLElement, toneBtn: HTMLElement): (() => void) => {
  const closeAllDropdowns = () => {
    const allDropdowns = popoverElement.querySelectorAll('.emtlkit--tone-listbox')
    allDropdowns.forEach(dropdown => ((dropdown as HTMLElement).style.display = 'none'))
  }

  const handlePopoverClick = (e: MouseEvent) => {
    // Only handle clicks outside the tone button and its options
    if (!toneBtn.contains(e.target as Node) && !(e.target as HTMLElement).closest('#emtlkit--custom-tone-input')) {
      closeAllDropdowns()
    }
  }

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeAllDropdowns()
    }
  }

  // Add event listeners
  popoverElement.addEventListener('click', handlePopoverClick)
  document.addEventListener('keydown', handleEscapeKey)

  // Return cleanup function
  return () => {
    popoverElement.removeEventListener('click', handlePopoverClick)
    document.removeEventListener('keydown', handleEscapeKey)
  }
}

const initializeSuggestions = (
  suggestionsContainerElement: HTMLElement,
  generateButtonContainerElement: HTMLElement,
  generateButton: Button,
  onSuggestionSelect: (selectedOption: string | TGeneratedImage) => void,
  onRegenerate: (regenerateComponent: HTMLElement) => Promise<void>
): SuggestionList => {
  const buttonElement = generateButton.getElement()
  if (!buttonElement) {
    throw new Error('Generate button element not found')
  }

  return new SuggestionList({
    parentElement: suggestionsContainerElement,
    suggestions: [],
    footerRightElement: generateButtonContainerElement,
    originalButtonElement: buttonElement,
    onSuggestionSelect,
    onRegenerate,
    suggestionsType: 'text',
  })
}

/**
 * Initializes the tone button
 * @param toneBtnContainerElement - Tone button container element
 * @param defaultToneValue - Default selected tone
 * @returns HTMLButtonElement instance
 */
const initializeToneButton = (
  toneBtnContainerElement: HTMLElement,
  id: string,
  toneSelected: string,
  toneOptionsContainerId: string,
  popoverElement: HTMLElement
): Button => {
  const toneBtn = new Button({
    id,
    children: `Tone: ${toneSelected}`,
    variant: 'monochromePlain',
    className: 'emtlkit--tone-button emtlkit-button-can-open down',
    attributes: {
      'data-selected': toneSelected,
    },
    onClick: () => {
      const toneOptionsContainer = popoverElement.querySelector(`#${toneOptionsContainerId}`) as HTMLElement
      const isVisible = toneOptionsContainer.style.display !== 'none'
      toneOptionsContainer.style.display = isVisible ? 'none' : 'block'
      toneBtn.getElement()?.classList.toggle('up', !isVisible)
      toneBtn.getElement()?.classList.toggle('down', isVisible)
    },
  })

  toneBtn.appendTo(toneBtnContainerElement)
  return toneBtn
}

/**
 * Initializes the generate button
 * @param generateButtonElement - Generate button element
 * @param id - Button ID
 * @param promptField - TextField instance for accessing prompt value
 * @param toneOptionsList - OptionList instance for accessing selected tone
 * @returns HTMLButtonElement instance
 */
const initializeGenerateButton = (
  generateButtonContainerElement: HTMLElement,
  id: string,
  promptField: TextField,
  toneOptionsList: OptionList,
  onGenerate: (promptValue: string, selectedTone: string) => Promise<void>
): Button => {
  // Initially disable the button if there's no text
  const generateButton = new Button({
    id,
    children: 'Generate',
    variant: 'primary',
    disabled: !promptField.getValue()?.trim(),
    loading: false,
    onClick: async () => {
      try {
        // Set loading state
        generateButton.setLoading(true)
        generateButton.setDisabled(true)

        const promptValue = promptField.getValue() || ''
        const selectedTone = toneOptionsList.getSelected()?.[0] || ''

        await onGenerate(promptValue, selectedTone)
      } catch (error) {
        console.error('Error generating text:', error)
        // Here you could add error handling UI feedback if needed
      } finally {
        // Reset loading state
        generateButton.setLoading(false)
        generateButton.setDisabled(!promptField.getValue()?.trim())
      }
    },
  })
  generateButton.appendTo(generateButtonContainerElement)
  return generateButton
}

/**
 * Generates the content and handlers for the text generation AI popover
 * @param layerId - The ID of the layer
 * @returns Object containing content, mount handler, and cleanup function
 */
export const getGenerateTextWithAiContent = (
  layerId: string,
  onGenerate: (promptValue: string, selectedTone: string) => Promise<string[]>,
  onSuggestionSelect: (selectedOption: string | TGeneratedImage) => void
): GenerateTextContent => {
  const ids = generateElementIds(layerId)
  const { label: defaultToneLabel, value: defaultToneValue } = getToneOptions()[1]
  let promptField: TextField | null = null
  let toneButton: Button | null = null
  let toneOptionsList: OptionList | null = null
  let suggestionList: SuggestionList | null = null
  // let lastGeneratedText: string | null = null
  let generateButton: Button | null = null

  return {
    content: `
      <div class="emtlkit--popover-title">Generate Text with AI</div>

      <div class="emtlkit--popover-content-wrapper">
        <div id="${ids.containerId}" class="emtlkit--generate-text-wrapper">
          <div id="${ids.textFieldContainerId}"></div>
          <div id="${ids.suggestionsId}" class="emtlkit--suggestions-container"></div>
        </div>
      </div>

      <div class="emtlkit--popover-footer">
        <div class="emtlkit--popover-footer-left">
          <div class="emtlkit--dropdown-wrapper" style="width: 164px;">
            <div id="${ids.textSelectToneBtnContainerId}"></div>
            <div
              id="${ids.textSelectToneOptionsContainerId}"
              class="emtlkit--tone-listbox"
              style="display: none;"
            >
            </div>
          </div>
        </div>
        <div class="emtlkit--popover-footer-right">
          <div id="${ids.generateButtonContainerId}">
          </div>
        </div>
      </div>
    `,
    onMount: (popoverElement: HTMLElement) => {
      const textFieldContainerElement = popoverElement.querySelector(`#${ids.textFieldContainerId}`) as HTMLElement
      const toneButtonContainerElement = popoverElement.querySelector(
        `#${ids.textSelectToneBtnContainerId}`
      ) as HTMLElement
      const toneOptionsContainerElement = popoverElement.querySelector(
        `#${ids.textSelectToneOptionsContainerId}`
      ) as HTMLElement
      const generateButtonContainerElement = popoverElement.querySelector(
        `#${ids.generateButtonContainerId}`
      ) as HTMLElement
      const suggestionsContainerElement = popoverElement.querySelector(`#${ids.suggestionsId}`) as HTMLElement

      // Initialize promptField first
      if (textFieldContainerElement) {
        promptField = initializePromptField(textFieldContainerElement, ids.generateButtonId, ids.textFieldId)
      }

      if (toneButtonContainerElement) {
        toneButton = initializeToneButton(
          toneButtonContainerElement,
          ids.textSelectToneBtnId,
          defaultToneLabel,
          ids.textSelectToneOptionsContainerId,
          popoverElement
        )

        const toneBtnElement = toneButton.getElement()
        if (toneBtnElement) {
          toneOptionsList = initializeToneSelector(
            toneBtnElement,
            toneOptionsContainerElement,
            toneBtnElement.getAttribute('data-selected') || ''
          )
        }
      }
      // Finally initialize generate button
      if (generateButtonContainerElement && promptField && toneOptionsList) {
        generateButton = initializeGenerateButton(
          generateButtonContainerElement,
          ids.generateButtonId,
          promptField,
          toneOptionsList,
          async (promptValue: string, selectedTone: string) => {
            try {
              // Save the current text for later comparison
              // lastGeneratedText = promptValue

              // Call the onGenerate callback to get suggestions
              const suggestions = await onGenerate(promptValue, selectedTone)

              // Initialize suggestion list if not already initialized
              if (!suggestionList && generateButton) {
                suggestionList = initializeSuggestions(
                  suggestionsContainerElement,
                  generateButtonContainerElement,
                  generateButton,
                  onSuggestionSelect,
                  async (regenerateComponent: HTMLElement) => {
                    // Check if the content of the textarea has changed from the last generated text
                    const currentText = promptField?.getValue()?.trim() || ''
                    // const textHasChanged = currentText !== lastGeneratedText

                    // if (currentText) {
                    // The text has changed and is not empty, so we should generate new suggestions
                    regenerateComponent.classList.add('emtlkit--generating')
                    regenerateComponent.textContent = 'Re-generating...'
                    regenerateComponent.setAttribute('disabled', 'true')

                    // Save the current text for later comparison
                    // lastGeneratedText = currentText

                    // Use the selected tone
                    const selectedTone = toneOptionsList?.getSelected()?.[0] || defaultToneValue
                    const newSuggestions = await onGenerate(currentText, selectedTone)

                    // Update the suggestions list
                    if (suggestionList) {
                      suggestionList.update(newSuggestions)
                    }

                    regenerateComponent.classList.remove('emtlkit--generating')
                    regenerateComponent.textContent = 'Re-generate'
                    regenerateComponent.removeAttribute('disabled')
                    // }
                    // else {
                    //   // The text hasn't changed or is empty, clear everything
                    //   if (promptField) {
                    //     promptField.setValue('')
                    //   }

                    //   // Show the generate button
                    //   if (generateButton) {
                    //     const buttonElement = generateButton.getElement()
                    //     if (buttonElement) {
                    //       buttonElement.style.display = ''
                    //     }
                    //   }

                    //   // Clear suggestions
                    //   if (suggestionList) {
                    //     suggestionList.destroy()
                    //     suggestionList = null
                    //   }

                    //   // Focus the textarea for new input
                    //   if (promptField) {
                    //     promptField.focus()
                    //   }
                    // }
                  }
                )
              }

              // Update suggestions
              if (suggestionList) {
                suggestionList.update(suggestions)
              }
            } catch (error) {
              console.error('Error generating text:', error)
            }
          }
        )
      }
      setupToneDropdownEvents(popoverElement, toneButtonContainerElement)
    },
    cleanupEventListeners: () => {
      promptField?.setValue('')
      if (suggestionList) {
        suggestionList.destroy()
      }
    },
  }
}
