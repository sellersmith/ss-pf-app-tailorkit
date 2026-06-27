import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { capitalizeFirstLetter } from '../fns/capitalize-first-letter'
import { localStorage } from './localStorage'

export const reuseOptionValuesFromLocalStorage = (element: TailorKitProductPersonalizer) => {
  // Reuse option values stored in local storage
  let drawLivePreviewImmediately = false
  const inputs: NodeListOf<HTMLInputElement> = element.querySelectorAll('input[type="text"], input[type="radio"]')
  const values: any = {}

  inputs.forEach(input => {
    const fieldset = input.closest('fieldset')!
    const optionId = input.name?.split('/').pop()?.trim()
    const layerId = fieldset.getAttribute('data-layer-id')
    const printAreaId = fieldset.getAttribute('data-print-area-id')
    const optionType = fieldset.getAttribute('data-option-type')
    const dataKey = `tlk_${printAreaId}_${layerId}_${optionType}_${optionId}`

    if (optionId) {
      let savedValue
      const storedValue = localStorage?.getItem(dataKey)

      if (typeof storedValue === 'string') {
        savedValue = storedValue
      } else if (input.type === 'text') {
        savedValue = input.value
      } else if (element.settings.always_render_live_preview) {
        if (input.name !== 'shape') {
          if (!values[dataKey]) {
            // Automatically select the first option to render live preview immediately
            values[dataKey] = input.value
          }

          savedValue = values[dataKey]
        }
      }

      if (typeof savedValue !== 'undefined') {
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
        } else if (input.value === savedValue) {
          // Update value and UI checked option for option set
          input.checked = true
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
