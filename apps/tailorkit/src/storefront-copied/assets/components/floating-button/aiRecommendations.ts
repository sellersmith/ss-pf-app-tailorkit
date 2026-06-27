import { handleOptionSetClick } from '../../handlers/optionHandlers'
import { getLayerTextCustomerInputSelector } from '../../utils/selectors'

// Apply image option recommendation using TailorKit's proper method
export const applyImageRecommendation = async (rec: any) => {
  console.log(`🖼️ Setting image to: ${rec.recommendedValue}`)

  // Find the image option fieldset by option set ID
  const imageFieldset = document.querySelector(`fieldset[data-id="${rec.optionSetId}"]`) as HTMLFieldSetElement

  if (imageFieldset) {
    console.log(`📦 Found image option fieldset for: ${rec.optionSetId}`)

    // Handle empty recommendedValue by selecting first option as fallback
    let targetValue = rec.recommendedValue
    if (!targetValue || targetValue.trim() === '') {
      console.warn('⚠️ Empty recommendedValue detected, using fallback selection')
      const firstOption = imageFieldset.querySelector('input[type="radio"]') as HTMLInputElement
      if (firstOption) {
        targetValue = firstOption.value
        console.log(`🔄 Fallback: Using first available option: ${targetValue}`)
      } else {
        console.error('❌ No image options found for fallback')
        return
      }
    }

    // Find the radio input with the recommended value (image URL)
    const imageInput = imageFieldset.querySelector(`input[value="${targetValue}"]`) as HTMLInputElement
    const imageContainer = imageInput?.closest('.emtlkit--option-container') as HTMLElement

    if (imageInput && imageContainer) {
      console.log(`✅ Found matching image option for: ${targetValue}`)

      // Get the TailorKit instance
      const productPersonalizer = document.querySelector('tailorkit-product-personalizer') as any

      if (productPersonalizer && productPersonalizer.renderCanvas && productPersonalizer.updateFieldset) {
        console.log("🔧 Using TailorKit's handleOptionSetClick method")

        // Use TailorKit's proper method to handle the option selection
        await handleOptionSetClick(
          imageContainer as HTMLElement,
          imageFieldset as HTMLFieldSetElement,
          imageFieldset as HTMLElement,
          productPersonalizer.renderCanvas.bind(productPersonalizer),
          productPersonalizer.updateFieldset.bind(productPersonalizer),
          true
        )

        console.log('✅ Image option updated successfully using TailorKit method')
      } else {
        console.warn('⚠️ TailorKit instance not found, falling back to manual method')

        // Fallback to simple click simulation
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
        imageContainer.dispatchEvent(event)

        console.log('✅ Image option updated using fallback click simulation')
      }
    } else {
      console.error(`❌ Image option not found for value: ${targetValue}`)

      // Debug: show available image options
      const allImageInputs = imageFieldset.querySelectorAll('input[type="radio"]')
      console.log(
        '🔍 Available image options:',
        Array.from(allImageInputs).map(input => ({
          value: input.getAttribute('value'),
          name: input.getAttribute('data-name'),
          id: input.getAttribute('data-id'),
        }))
      )
    }
  } else {
    console.error(`❌ Image fieldset not found for ID: ${rec.optionSetId}`)

    // Debug: show available fieldsets
    const allFieldsets = document.querySelectorAll('fieldset[data-option-type="image_option"]')
    console.log(
      '🔍 Available image fieldsets:',
      Array.from(allFieldsets).map(fieldset => ({
        id: fieldset.getAttribute('data-id'),
        label: fieldset.getAttribute('data-label'),
        layerId: fieldset.getAttribute('data-layer-id'),
      }))
    )
  }
}

// Apply text content recommendation for customer text layers
export const applyTextContentRecommendation = (textRec: any) => {
  console.log(`📝 Setting text content to: "${textRec.recommendedContent}"`)
  console.log(`🔍 Looking for layer ID: ${textRec.layerId}`)

  // Find text input by layer ID
  const textInput = document.querySelector(getLayerTextCustomerInputSelector(textRec.layerId)) as
    | HTMLInputElement
    | HTMLTextAreaElement

  if (textInput) {
    console.log(`📝 Found text input for layer: ${textRec.layerId}`)

    // Focus the input to trigger any focus listeners
    textInput.focus()

    // Set the value
    ;(textInput as HTMLInputElement | HTMLTextAreaElement).value = textRec.recommendedContent

    // Update character counter if it exists
    const fieldset = textInput.closest('fieldset')
    const characterCount = fieldset?.querySelector('.character-count')
    if (characterCount) {
      const length = textRec.recommendedContent.length
      const limit = characterCount.textContent?.split('/')[1] || '100'
      characterCount.textContent = `${length}/${limit}`
    }

    // Trigger comprehensive events for TailorKit system
    textInput.dispatchEvent(new Event('input', { bubbles: true }))
    textInput.dispatchEvent(new Event('change', { bubbles: true }))
    textInput.dispatchEvent(new Event('blur', { bubbles: true }))
    textInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))

    // Trigger events on the fieldset container
    if (fieldset) {
      fieldset.dispatchEvent(
        new CustomEvent('emtlkit:textChanged', {
          bubbles: true,
          detail: { value: textRec.recommendedContent, layerId: textRec.layerId },
        })
      )
      fieldset.dispatchEvent(new CustomEvent('tailorkit:update', { bubbles: true }))
    }

    // Blur the input to complete the interaction cycle
    textInput.blur()

    console.log('✅ Text content updated for layer with comprehensive events:', textRec.layerId)
  } else {
    console.error(`❌ No text input found for layer ID: ${textRec.layerId}`)

    // Debug: show available text inputs
    const allTextInputs = document.querySelectorAll('input[type="text"]')
    console.log(
      '🔍 Available text inputs:',
      Array.from(allTextInputs).map(input => ({
        name: input.getAttribute('name'),
        layerId: input.closest('fieldset')?.getAttribute('data-layer-id'),
        dataId: input.closest('fieldset')?.getAttribute('data-id'),
      }))
    )
  }
}

// Apply color option recommendation
export const applyColorRecommendation = (rec: any) => {
  console.log(`🎨 Setting color to: ${rec.recommendedValue}`)

  // Find the color option by option set ID
  const colorFieldset = document.querySelector(`fieldset[data-id="${rec.optionSetId}"]`)

  if (colorFieldset) {
    // Remove active class from currently selected option
    const currentActive = colorFieldset.querySelector('.emtlkit--option-container.active')
    if (currentActive) {
      currentActive.classList.remove('active')
    }

    // Find and select the recommended color
    const colorInput = colorFieldset.querySelector(`input[value="${rec.recommendedValue}"]`) as HTMLInputElement
    const colorContainer = colorInput?.closest('.emtlkit--option-container')

    if (colorInput && colorContainer) {
      // Add active class to new selection
      colorContainer.classList.add('active')

      // Check the radio button
      colorInput.checked = true

      // Update fieldset attributes
      colorFieldset.setAttribute('value', rec.recommendedValue)
      colorFieldset.setAttribute('data-name', colorInput.getAttribute('data-name') || '')

      // Trigger change events
      colorInput.dispatchEvent(new Event('change', { bubbles: true }))
      ;(colorContainer as HTMLElement).click()

      console.log('✅ Color option updated')
    } else {
      console.error('❌ Color option not found for value:', rec.recommendedValue)
    }
  } else {
    console.error('❌ Color fieldset not found for ID:', rec.optionSetId)
  }
}

// Apply font option recommendation
export const applyFontRecommendation = (rec: any) => {
  console.log(`🔤 Setting font to: ${rec.recommendedValue}`)
  console.log(`🔤 Font details from AI:`, { family: rec.fontFamily, src: rec.fontSrc })

  // Find the font option by option set ID
  const fontFieldset = document.querySelector(`fieldset[data-id="${rec.optionSetId}"]`)

  if (fontFieldset) {
    // Use font details from AI recommendation if available (check for non-empty strings)
    if (rec.fontFamily && rec.fontSrc && rec.fontFamily.trim() !== '' && rec.fontSrc.trim() !== '') {
      console.log(`✅ Using font details from AI recommendation`)

      const fontFamily = rec.fontFamily
      const fontSrc = rec.fontSrc

      // Try to find and select the matching font option in the DOM
      const fontOption = fontFieldset.querySelector(
        `input[data-name="${fontFamily}"], input[data-family="${fontFamily}"]`
      ) as HTMLInputElement

      if (fontOption) {
        // Check the radio button for the recommended font
        fontOption.checked = true

        // Trigger change event on the selected font option
        fontOption.dispatchEvent(new Event('change', { bubbles: true }))
      }

      // Update the displayed font name
      const selectedFont = fontFieldset.querySelector('.emtlkit--selected-font')
      if (selectedFont) {
        selectedFont.textContent = fontFamily
      }

      // Update fieldset attributes with the AI recommended font
      fontFieldset.setAttribute('data-family', fontFamily)
      fontFieldset.setAttribute('value', fontSrc)
      fontFieldset.setAttribute('data-name', fontFamily)
      fontFieldset.removeAttribute('data-default')

      // Create and dispatch a custom font change event
      const fontChangeEvent = new CustomEvent('fontChange', {
        detail: {
          family: fontFamily,
          src: fontSrc,
          optionSetId: rec.optionSetId,
        },
        bubbles: true,
      })

      fontFieldset.dispatchEvent(fontChangeEvent)

      console.log(`✅ Font option updated to: ${fontFamily} (${fontSrc})`)
    } else {
      // Fallback: try to find the font in available DOM options by name
      console.warn(`⚠️ Font details not provided by AI, searching in DOM options`)

      const fontOption = fontFieldset.querySelector(
        `input[data-name="${rec.recommendedValue}"], input[data-family="${rec.recommendedValue}"]`
      ) as HTMLInputElement

      if (fontOption) {
        // Use the font found in DOM
        const fontFamily
          = fontOption.getAttribute('data-family') || fontOption.getAttribute('data-name') || rec.recommendedValue
        const fontSrc = fontOption.getAttribute('value') || fontOption.value

        // Update the displayed font name
        const selectedFont = fontFieldset.querySelector('.emtlkit--selected-font')
        if (selectedFont) {
          selectedFont.textContent = fontFamily
        }

        // Check the radio button for the recommended font
        fontOption.checked = true

        // Update fieldset attributes with the found font
        fontFieldset.setAttribute('data-family', fontFamily)
        fontFieldset.setAttribute('value', fontSrc)
        fontFieldset.setAttribute('data-name', fontFamily)
        fontFieldset.removeAttribute('data-default')

        // Trigger change event on the selected font option
        fontOption.dispatchEvent(new Event('change', { bubbles: true }))

        // Create and dispatch a custom font change event
        const fontChangeEvent = new CustomEvent('fontChange', {
          detail: {
            family: fontFamily,
            src: fontSrc,
            optionSetId: rec.optionSetId,
          },
          bubbles: true,
        })

        fontFieldset.dispatchEvent(fontChangeEvent)

        console.log(`✅ Font option updated to: ${fontFamily}`)
      } else {
        console.warn(`⚠️ Font "${rec.recommendedValue}" not found in available options, using first available font`)

        // Final fallback: use the first available font option
        const firstFontOption = fontFieldset.querySelector('input[type="radio"]') as HTMLInputElement
        if (firstFontOption) {
          const fallbackFamily
            = firstFontOption.getAttribute('data-family') || firstFontOption.getAttribute('data-name') || 'Default'
          const fallbackSrc = firstFontOption.getAttribute('value') || firstFontOption.value

          // Update the displayed font name
          const selectedFont = fontFieldset.querySelector('.emtlkit--selected-font')
          if (selectedFont) {
            selectedFont.textContent = fallbackFamily
          }

          // Check the fallback font option
          firstFontOption.checked = true

          // Update fieldset attributes
          fontFieldset.setAttribute('data-family', fallbackFamily)
          fontFieldset.setAttribute('value', fallbackSrc)
          fontFieldset.setAttribute('data-name', fallbackFamily)
          fontFieldset.removeAttribute('data-default')

          // Trigger change event
          firstFontOption.dispatchEvent(new Event('change', { bubbles: true }))

          // Create and dispatch a custom font change event
          const fontChangeEvent = new CustomEvent('fontChange', {
            detail: {
              family: fallbackFamily,
              src: fallbackSrc,
              optionSetId: rec.optionSetId,
            },
            bubbles: true,
          })

          fontFieldset.dispatchEvent(fontChangeEvent)

          console.log(`✅ Font option updated to fallback: ${fallbackFamily}`)
        } else {
          console.error('❌ No font options found in fieldset')
        }
      }
    }
  } else {
    console.error('❌ Font fieldset not found for ID:', rec.optionSetId)
  }
}

// Trigger product update to refresh preview
export const triggerProductUpdate = () => {
  console.log('🔄 Triggering product update events...')

  // Use a more conservative approach to avoid visual artifacts
  setTimeout(() => {
    // Trigger the main product update event
    const productPersonalizer = document.querySelector('tailorkit-product-personalizer')
    if (productPersonalizer) {
      const updateEvent = new CustomEvent('emtlkit:update', {
        detail: { source: 'ai-recommendations' },
        bubbles: true,
      })
      productPersonalizer.dispatchEvent(updateEvent)
      console.log('🎯 Dispatched emtlkit:update on product personalizer')
    }

    // Trigger window event for global listeners
    window.dispatchEvent(
      new CustomEvent('emtlkit:update', {
        detail: { source: 'ai-recommendations' },
      })
    )
    console.log('🌐 Dispatched emtlkit:update on window')

    // Force trigger a manual update if TailorKit global object exists
    if (typeof (window as any).TailorKit !== 'undefined') {
      const tailorkit = (window as any).TailorKit
      if (tailorkit.update) {
        tailorkit.update()
        console.log('🎯 Called TailorKit.update()')
      }
    }

    // Show visual feedback after updates are processed
    setTimeout(() => {
      console.log('✅ Product update completed successfully')
    }, 200)
  }, 100)
}
