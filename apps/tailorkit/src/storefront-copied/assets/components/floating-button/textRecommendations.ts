import { TEXT_CUSTOMER_INPUT_SELECTOR } from '../../utils/selectors'

// Apply text content recommendation
export const applyTextRecommendation = async (rec: any) => {
  console.log(`📝 Setting text to: "${rec.recommendedValue}"`)
  console.log(`🔍 Looking for option set ID: ${rec.optionSetId}`)

  // Method 1: Try to find text_option fieldset by option set ID
  const textOptionFieldset = document.querySelector(`fieldset[data-id="${rec.optionSetId}"]`)

  if (textOptionFieldset) {
    console.log('📦 Found text_option fieldset, applying selection...')

    // Find the option with the recommended value
    const recommendedOption = textOptionFieldset.querySelector(`input[value="${rec.recommendedValue}"]`)

    if (recommendedOption) {
      // Remove active from current selection
      const currentActive = textOptionFieldset.querySelector('.emtlkit--option-container.active')
      if (currentActive) {
        currentActive.classList.remove('active')
      }

      // Activate the recommended option
      const optionContainer = recommendedOption.closest('.emtlkit--option-container')
      if (optionContainer) {
        optionContainer.classList.add('active')
      }

      // If it's a radio button, check it
      if (recommendedOption instanceof HTMLInputElement) {
        recommendedOption.checked = true
        recommendedOption.dispatchEvent(new Event('change', { bubbles: true }))
      }

      // Update fieldset attributes
      textOptionFieldset.setAttribute('value', rec.recommendedValue)

      console.log('✅ Text option updated')
      return
    }
  }

  // Method 2: Try to find text_customer input by layer ID (fallback)
  // This handles the case where we're setting customer input text
  const textCustomerInputs = document.querySelectorAll(TEXT_CUSTOMER_INPUT_SELECTOR)

  for (const input of textCustomerInputs) {
    const fieldset = input.closest('fieldset')
    const layerId = fieldset?.getAttribute('data-layer-id')

    // Check if this input corresponds to our recommendation
    // We can match by option set ID or layer ID depending on the data structure
    if (
      fieldset?.getAttribute('data-id') === rec.optionSetId
      || layerId === rec.optionSetId
      || input.getAttribute('name')?.includes(rec.optionSetId)
    ) {
      console.log(`📝 Found text_customer input for layer/option: ${rec.optionSetId}`)

      // Focus the input to trigger any focus listeners
      ;(input as HTMLInputElement | HTMLTextAreaElement).focus()

      // Set the value
      ;(input as HTMLInputElement | HTMLTextAreaElement).value = rec.recommendedValue

      // Update character counter if it exists
      const characterCount = fieldset?.querySelector('.character-count')
      if (characterCount) {
        const length = rec.recommendedValue.length
        const limit = characterCount.textContent?.split('/')[1] || '100'
        characterCount.textContent = `${length}/${limit}`
      }

      // Trigger comprehensive events for TailorKit system
      const events = ['input', 'change', 'blur']
      events.forEach(eventType => {
        input.dispatchEvent(new Event(eventType, { bubbles: true }))
      })
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))

      // Trigger events on the fieldset container
      if (fieldset) {
        fieldset.dispatchEvent(
          new CustomEvent('emtlkit:textChanged', {
            bubbles: true,
            detail: { value: rec.recommendedValue, layerId: layerId },
          })
        )
        fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))
      }

      // Blur the input to complete the interaction cycle
      ;(input as HTMLInputElement | HTMLTextAreaElement).blur()

      console.log('✅ Text customer input updated with comprehensive events')
      return
    }
  }

  // Method 3: Fallback - try to find any text input by partial matching
  console.log('🔍 Trying fallback method - searching all text inputs...')
  const allTextInputs = document.querySelectorAll('input[type="text"], textarea')

  for (const input of allTextInputs) {
    const name = input.getAttribute('name')
    const fieldset = input.closest('fieldset')

    // Check if this input might be related to our recommendation
    if (
      name?.includes(rec.optionSetId)
      || fieldset?.getAttribute('data-id') === rec.optionSetId
      || fieldset?.getAttribute('data-layer-id') === rec.optionSetId
    ) {
      console.log(`📝 Found matching text input: ${name}`)

      // Focus the input to trigger any focus listeners
      ;(input as HTMLInputElement | HTMLTextAreaElement).focus()

      // Set the value
      ;(input as HTMLInputElement | HTMLTextAreaElement).value = rec.recommendedValue

      // Update character counter if it exists
      const characterCount = fieldset?.querySelector('.character-count')
      if (characterCount) {
        const length = rec.recommendedValue.length
        const limit = characterCount.textContent?.split('/')[1] || '100'
        characterCount.textContent = `${length}/${limit}`
      }

      // Trigger comprehensive events for TailorKit system
      const events = ['input', 'change', 'blur']
      events.forEach(eventType => {
        input.dispatchEvent(new Event(eventType, { bubbles: true }))
      })
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))

      // Trigger events on the fieldset container
      if (fieldset) {
        fieldset.dispatchEvent(
          new CustomEvent('emtlkit:textChanged', {
            bubbles: true,
            detail: { value: rec.recommendedValue },
          })
        )
        fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))
      }

      // Blur the input to complete the interaction cycle
      ;(input as HTMLInputElement | HTMLTextAreaElement).blur()

      console.log('✅ Text input updated via fallback method with comprehensive events')
      return
    }
  }

  console.error(`❌ No text input found for option set ID: ${rec.optionSetId}`)
  console.log(
    '🔍 Available text inputs:',
    Array.from(allTextInputs).map(input => ({
      name: input.getAttribute('name'),
      dataId: input.closest('fieldset')?.getAttribute('data-id'),
      layerId: input.closest('fieldset')?.getAttribute('data-layer-id'),
    }))
  )
}
