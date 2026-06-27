import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { capitalizeFirstLetter } from '../fns/capitalize-first-letter'
import { localStorage } from './localStorage'
import { getOptionSetLocalStorageKey } from './restore-option-values'

export const reuseOptionValuesFromLocalStorage = async (element: TailorKitProductPersonalizer) => {
  // Reuse option values stored in local storage
  let drawLivePreviewImmediately = false
  const inputs: NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>
    = element.querySelectorAll('input, textarea')
  const values: any = {}

  inputs.forEach(async input => {
    const fieldset = input.closest('fieldset')!
    const optionId = (input.name || input.getAttribute('data-name'))?.split('/').pop()?.trim()
    const layerId = fieldset.getAttribute('data-layer-id') || ''
    const printAreaId = fieldset.getAttribute('data-print-area-id') || ''
    const optionSetType = fieldset.getAttribute('data-option-type') || ''

    const valueKey = getOptionSetLocalStorageKey(printAreaId, layerId, optionSetType, optionId || '')

    if (optionId) {
      let savedValue
      let storedValue = localStorage?.getItem(valueKey)
      try {
        const { value } = JSON.parse(storedValue || '{}')
        storedValue = value
      } catch (error) {
        console.warn('Error parsing stored value:', error)
      }

      if (typeof storedValue === 'string') {
        savedValue = storedValue
      } else if (input.type === 'text') {
        savedValue = input.value
      } else if (element.settings.always_render_live_preview) {
        if (input.name !== 'shape') {
          if (!values[valueKey]) {
            // Automatically select the first option to render live preview immediately
            values[valueKey] = input.value
          }

          savedValue = values[valueKey]
        }
      }

      if (typeof savedValue !== 'undefined' && savedValue) {
        drawLivePreviewImmediately = true

        if (input.type === 'text') {
          input.value = `${savedValue}`

          // Update fieldset
          element.updateFieldset(
            fieldset,
            input.getAttribute('data-id') as string,
            input.getAttribute('data-name') as string,
            savedValue
          )

          // Update UI for option
          updateOptionUI(fieldset, input)
        } else if (input.value === savedValue) {
          // Update value and UI checked option for option set
          if (input instanceof HTMLInputElement) {
            input.checked = true
          }
          const container = input.closest('.emtlkit--option-container')

          if (container) {
            container.parentNode?.querySelector('.emtlkit--option-container.active')?.classList.remove('active')
            container.classList.add('active')
          }

          // Update value and UI for selection shape
          const buttonSelectShape = fieldset.querySelector('.emtlkit--select-input') as HTMLButtonElement

          if (buttonSelectShape) {
            buttonSelectShape.value = savedValue
            buttonSelectShape.innerHTML = !savedValue ? '--' : capitalizeFirstLetter(savedValue)
          }

          // Update fieldset
          element.updateFieldset(
            fieldset,
            input.getAttribute('data-id') || '',
            input.getAttribute('data-name') as string,
            savedValue
          )
        }
      }
    }
  })

  return drawLivePreviewImmediately
}

const updateOptionUI = (fieldset: HTMLFieldSetElement, input: HTMLInputElement | HTMLTextAreaElement) => {
  // Update UI for text character count
  if (fieldset.getAttribute('data-option-type') === 'text_customer') {
    if (input.nextElementSibling) {
      const [, maxLength] = (input.nextElementSibling?.textContent?.split('/') || [0, 0]).map(Number)
      let value = input.value

      if (input.value.length > maxLength) {
        value = input.value.substring(0, maxLength)

        input.value = value
      }

      input.nextElementSibling.textContent = `${input.value.length}/${maxLength}`
    }
  }
}
