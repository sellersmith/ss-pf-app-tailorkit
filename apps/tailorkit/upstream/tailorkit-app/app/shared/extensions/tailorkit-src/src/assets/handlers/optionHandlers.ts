import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { TEXT_SHAPE_OPTIONS } from '../constants/shape'
import { Transmitter } from '../libraries/transmitter'
import type { DrawLivePreviewFunction } from '../type'
import { getLayerByFieldset } from '../utils/query-layer'
import { deleteImageOption, updateFieldsetUI } from './event-handlers/image-editor/data-processing'
import { localStorage } from '../utils/localStorage'
import { sessionStorage } from '../utils/sessionStorage'
import { getOptionSetLocalStorageKey } from '../utils/restore-option-values'
import { isInTailorKitAdminFrame } from '../libraries/fetchWithAdminContext'
import { debounce } from '../utils'
import { isMobile } from '../utils/devices'
import { StorefrontUndoStack } from '../stores/storefront-undo-stack'

// Single stable debounced draw across calls to avoid per-ref caching issues
const DEBOUNCE_DELAY = 200
const OPTION_SET_DEBOUNCE_MS = isMobile() ? DEBOUNCE_DELAY * 2 : DEBOUNCE_DELAY

let latestDrawLivePreviewRef: DrawLivePreviewFunction | null = null
const debouncedDrawLivePreview = debounce(async () => {
  const fn = latestDrawLivePreviewRef
  if (fn) {
    await fn()
    Transmitter.trigger('tailorkit-set-options')
  }
}, OPTION_SET_DEBOUNCE_MS)

function scheduleDebouncedDraw(drawLivePreview: DrawLivePreviewFunction) {
  latestDrawLivePreviewRef = drawLivePreview
  debouncedDrawLivePreview()
}

function cancelDebouncedDraw() {
  debouncedDrawLivePreview.cancel()
}

// Helper function to save options to storage with incognito mode support
// Uses sessionStorage for image options, localStorage for other options
export const saveToLocalStorage = (
  fieldset: HTMLFieldSetElement,
  option: HTMLInputElement,
  data?: Record<string, string>
) => {
  try {
    const layerId = fieldset.getAttribute('data-layer-id') || ''
    const optionType = fieldset.getAttribute('data-option-type') || ''
    const printAreaId = fieldset.getAttribute('data-print-area-id') || ''
    const optionName = option.name.split('/').pop()?.trim()

    const optionSetId = fieldset.getAttribute('data-id') || optionName

    if (layerId && optionSetId) {
      // Use sessionStorage for image options to prevent stale data issues
      // when admin changes image settings (resize, reposition)
      const storage = optionType === 'image_option' ? sessionStorage : localStorage

      try {
        const testKey = 'tlk_test_storage'
        storage.setItem(testKey, '1')
        storage.removeItem(testKey)

        // Unified key based on option-set id
        const unifiedKey = getOptionSetLocalStorageKey(printAreaId, layerId, optionType, optionSetId)

        const payload = {
          id: option.getAttribute('data-id') || '',
          value: option.value,
          label: option.getAttribute('data-name') || optionName,
          extra: data || undefined,
        }

        storage.setItem(unifiedKey, JSON.stringify(payload))
      } catch (storageError) {
        // In incognito mode, storage might throw quota exceeded errors
        console.warn("Storage is not available, possibly in incognito mode. Option settings won't persist.")
      }
    }
  } catch (error) {
    // Catch any other unexpected errors
    console.error('Error in saveToLocalStorage:', error)
  }
}

export const saveOptionSetListToLocalStorage = (
  instance: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement
) => {
  const { isInAdminApp } = isInTailorKitAdminFrame()

  if (isInAdminApp) {
    return
  }

  // Find the target option set in the product personalizer data
  const { optionSet: targetOptionSet, layer } = getLayerByFieldset(instance, fieldset)

  if (!targetOptionSet) {
    console.error('Target OptionSet not found for data update.')
    return
  }

  const optionSetList = targetOptionSet.ol

  if (!optionSetList) {
    console.error('OptionSetList not found for data update.')
    return
  }

  const optionSetListString = JSON.stringify(optionSetList)

  // Use sessionStorage for image option set lists to prevent stale data issues
  sessionStorage.setItem(`tlk_${layer?.i}_option_set_list`, optionSetListString)
}

/**
 * Restore option set lists from sessionStorage
 * This function retrieves saved option set lists and merges uploaded images back into the option sets
 */
export const restoreOptionSetListsFromLocalStorage = async (instance: TailorKitProductPersonalizer) => {
  try {
    const { lis: layerIntegrations } = instance.productPersonalizer

    if (!layerIntegrations) {
      return
    }

    // Process all layer integrations concurrently
    const layerIntegrationPromises = layerIntegrations.map(async (layerIntegration: any) => {
      const { data } = layerIntegration
      if (!data?.ls) return

      // Process all layers in the integration concurrently
      const layerPromises = data.ls.map(async (layer: any) => {
        const layerId = layer.i
        if (!layerId) return

        // Try to restore saved option set list for this layer from sessionStorage
        const savedOptionSetListString = sessionStorage.getItem(`tlk_${layerId}_option_set_list`)

        if (savedOptionSetListString) {
          try {
            const savedOptionSetList = JSON.parse(savedOptionSetListString).filter((option: any) =>
              ['image_uploaded', 'image_generated_by_ai'].includes(option.type)
            )

            // Find the corresponding option set in the layer
            if (layer.osl && Array.isArray(layer.osl)) {
              // Process all option sets concurrently
              const optionSetPromises = layer.osl.map(async (optionSet: any) => {
                // Only restore for image_option type to preserve uploaded images
                if (optionSet.t === 'image_option' && savedOptionSetList.length > 0) {
                  // Get existing preset options (from metafield) - these have overlay data from VectorEditor
                  const existingPresetOptions = (optionSet.ol || []).filter(
                    (opt: any) => !['image_uploaded', 'image_generated_by_ai'].includes(opt.type)
                  )

                  // Merge: saved uploaded/ai options + existing preset options
                  optionSet.ol = [...savedOptionSetList, ...existingPresetOptions]

                  // Update the UI for this restored option set
                  await updateUIAfterRestore(instance, layerId, optionSet, data.printAreaId)
                }
              })

              await Promise.all(optionSetPromises)
            }
          } catch (parseError) {
            console.error(`Failed to parse saved option set list for layer ${layerId}:`, parseError)
          }
        }
      })

      await Promise.all(layerPromises)
    })

    await Promise.all(layerIntegrationPromises)
  } catch (error) {
    console.error('Error restoring option set lists from localStorage:', error)
  }
}

/**
 * Update fieldset UI after restoring option set lists from localStorage
 * Uses the existing updateFieldsetUI function with proper parameters
 */
const updateUIAfterRestore = async (
  instance: TailorKitProductPersonalizer,
  layerId: string,
  optionSet: any,
  printAreaId: string
) => {
  try {
    // Find the corresponding fieldset element
    const fieldset = instance.querySelector(
      `fieldset[data-layer-id="${layerId}"][data-option-type="image_option"]`
    ) as HTMLFieldSetElement

    if (!fieldset) {
      console.warn(`Fieldset not found for layer ${layerId}`)
      return
    }

    const optionSetId = fieldset.dataset.id

    if (!optionSetId) {
      console.warn(`Option set ID not found for layer ${layerId}`)
      return
    }

    // Determine which option should be selected based on sessionStorage
    let selectedOptionId = ''

    // Check sessionStorage for the currently selected option (image options use sessionStorage)
    const printAreaIdFromFieldset = fieldset.getAttribute('data-print-area-id')
    const savedSelection = sessionStorage.getItem(`tlk_${printAreaIdFromFieldset}_${layerId}_image_option`)

    if (savedSelection) {
      // Find the option that matches the saved selection
      const matchingOption = optionSet.ol.find((option: any) => option.v === savedSelection)
      if (matchingOption) {
        selectedOptionId = matchingOption.i
      }
    }

    // If no saved selection or option not found, select the first uploaded image or first option
    if (!selectedOptionId && optionSet.ol.length > 0) {
      const uploadedImage = optionSet.ol.find((option: any) =>
        ['image_uploaded', 'image_generated_by_ai'].includes(option.type)
      )
      selectedOptionId = uploadedImage ? uploadedImage.i : optionSet.ol[0].i
    }

    // Use the existing updateFieldsetUI function
    await updateFieldsetUI(fieldset, optionSet, printAreaId, optionSetId, selectedOptionId, false)
  } catch (error) {
    console.error(`Error updating UI after restore for layer ${layerId}:`, error)
  }
}

export const handleTextShapeChange = (target: HTMLElement, drawLivePreview: DrawLivePreviewFunction) => {
  const fieldset = target.closest('fieldset')
  const selectInput = fieldset?.querySelector('.emtlkit--select-input') as HTMLInputElement
  const selectInputPopover = target.closest('.emtlkit--select-input__popover') as HTMLElement

  if (!fieldset || !selectInput || !selectInputPopover) {
    console.warn('handleTextShapeChange: Missing required elements')
    return
  }

  const option = target.closest('.emtlkit--select-option')?.querySelector('input[type="radio"]') as HTMLInputElement
  if (!option) {
    console.warn('handleTextShapeChange: No radio input found')
    return
  }

  const optionValue = option.value || ''

  // Update UI first for responsiveness
  selectInput.value = optionValue
  selectInput.textContent = `${TEXT_SHAPE_OPTIONS.find(opt => opt.value === optionValue)?.label || '--'}`
  selectInputPopover.style.display = 'none'
  fieldset.setAttribute('value', optionValue)

  saveToLocalStorage(fieldset, option)

  // Debounce the live preview drawing
  scheduleDebouncedDraw(drawLivePreview)
}

export const handleMultiLayoutOptionChange = async (
  target: HTMLElement,
  fieldset: HTMLFieldSetElement | undefined,
  optionSet: HTMLElement,
  drawLivePreview: DrawLivePreviewFunction,
  updateFieldset: (fieldset: HTMLFieldSetElement, optionId: string, optionName: string, optionValue: string) => void,
  stored: boolean = true
) => {
  if (!fieldset || !optionSet) {
    console.warn('handleMultiLayoutOptionChange: Missing required elements')
    return
  }

  const processMultiLayoutTask = async () => {
    const selectedOption = optionSet.querySelector('.emtlkit--option-container.active') as HTMLElement | undefined
    selectedOption?.classList.remove('active')

    const optionContainer = target.closest('.emtlkit--option-container') as HTMLElement
    if (!optionContainer) {
      console.warn('handleMultiLayoutOptionChange: No option container found')
      return
    }

    const option = optionContainer.querySelector('input[type="radio"]') as HTMLInputElement
    if (!option) {
      console.warn('handleMultiLayoutOptionChange: No radio input found')
      return
    }

    optionContainer.classList.add('active')

    // Prevent revaluate if option is being selected
    if (fieldset.getAttribute('value') === option.value) return

    // Update the fieldset
    updateFieldset(fieldset, option.getAttribute('data-id') || '', option.getAttribute('data-name') || '', option.value)

    if (stored) {
      saveToLocalStorage(fieldset, option)
    }

    // Cancel any pending debounced draw since layout is changing
    cancelDebouncedDraw()

    // Multi-layout changes are significant, so render immediately
    try {
      await drawLivePreview()

      // Refresh live preview and notify others
      Transmitter.trigger('tailorkit-set-options')

      // Signal that multi-layout processing is complete for reinitializing
      Transmitter.trigger('tailorkit-multi-layout-complete')
    } catch (error) {
      console.error('handleMultiLayoutOptionChange: Error rendering preview:', error)
    }
  }

  // Process immediately with debounce-aware cancellation above
  await processMultiLayoutTask()
}

export const handleOptionSetClick = async (
  target: HTMLElement,
  fieldset: HTMLFieldSetElement,
  optionSet: HTMLElement | undefined,
  drawLivePreview: DrawLivePreviewFunction,
  updateFieldset: (fieldset: HTMLFieldSetElement, optionId: string, optionName: string, optionValue: string) => void,
  stored: boolean = true
) => {
  if (!fieldset) {
    console.warn('handleOptionSetClick: Missing fieldset element')
    return
  }

  const processOptionTask = async () => {
    // Safety check for optionSet (it's optional in the function signature)
    if (!optionSet) {
      console.warn('handleOptionSetClick: Missing optionSet element')
      return
    }

    // Capture "before" state for undo support
    const beforeOptionId = fieldset.getAttribute('data-option-id') || ''
    const beforeValue = fieldset.getAttribute('value') || ''
    const beforeName = fieldset.getAttribute('data-name') || ''
    const layerId = fieldset.getAttribute('data-layer-id') || ''

    const selectedOption = optionSet.querySelector('.emtlkit--option-container.active') as HTMLElement | undefined
    selectedOption?.classList.remove('active')

    const optionContainer = target.closest('.emtlkit--option-container') as HTMLElement
    if (!optionContainer) {
      console.warn('handleOptionSetClick: No option container found')
      return
    }

    const option = optionContainer.querySelector('input[type="radio"]') as HTMLInputElement
    if (!option) {
      console.warn('handleOptionSetClick: No radio input found')
      return
    }

    optionContainer.classList.add('active')

    const newOptionId = option.getAttribute('data-id') || ''
    const newOptionName = option.getAttribute('data-name') || ''
    const currentOptionId = fieldset.getAttribute('data-option-id')

    // Prevent revaluate if option is being selected (compare by option ID, not value)
    // Note: The Web Component may have already updated the fieldset value before this handler runs,
    // so we compare option IDs instead of values to detect actual changes
    if (currentOptionId === newOptionId) {
      return
    }

    // Update the fieldset with common attrs
    // Note: This may be redundant if the Web Component already updated the fieldset,
    // but we call it anyway to ensure consistency
    updateFieldset(fieldset, newOptionId, newOptionName, option.value)

    // Push CONTENT delta for undo/redo support
    if (layerId && beforeOptionId !== newOptionId) {
      const afterValue = option.value
      const afterName = newOptionName
      const afterOptionId = newOptionId
      // Capture only stable values + the fieldset element ref (stays in DOM)
      // Do NOT capture option container refs — they can become stale if the sidebar re-renders.
      // Instead, query them dynamically inside undoFn/redoFn.
      const snapFieldset = fieldset
      const snapDrawLivePreview = drawLivePreview

      /**
       * Find the .emtlkit--option-container that holds an input with the given data-id.
       * Falls back to matching by value if data-id lookup fails — handles cases where
       * the admin changes option IDs while the customer has pending undo steps.
       */
      const findOptionContainer = (id: string, valueFallback?: string): HTMLElement | null => {
        let container
          = snapFieldset
            .querySelector<HTMLInputElement>(`input[data-id="${id}"]`)
            ?.closest<HTMLElement>('.emtlkit--option-container') ?? null
        if (!container && valueFallback) {
          // Fallback: match by input value (covers case where admin changed data-id)
          container
            = snapFieldset
              .querySelector<HTMLInputElement>(`input[value="${CSS.escape(valueFallback)}"]`)
              ?.closest<HTMLElement>('.emtlkit--option-container') ?? null
        }
        return container
      }

      /** Update fieldset attrs and sidebar active state, then re-render */
      const applyOptionState = (optionId: string, value: string, name: string) => {
        snapFieldset.setAttribute('data-option-id', optionId)
        snapFieldset.setAttribute('value', value)
        snapFieldset.setAttribute('data-name', name)

        // Refresh sidebar active state with fresh DOM lookups (avoids stale refs)
        snapFieldset
          .querySelectorAll<HTMLElement>('.emtlkit--option-container.active')
          .forEach(el => el.classList.remove('active'))
        findOptionContainer(optionId, value)?.classList.add('active')

        snapDrawLivePreview().catch(() => {})
        Transmitter.trigger('tailorkit-set-options')
      }

      StorefrontUndoStack.push({
        type: 'CONTENT',
        layerId,
        before: {},
        after: {},
        undoFn: () => applyOptionState(beforeOptionId, beforeValue, beforeName),
        redoFn: () => applyOptionState(afterOptionId, afterValue, afterName),
      })
    }

    // Font option requires extra metadata on fieldset for downstream logic
    if (fieldset.getAttribute('data-option-type') === 'font_option') {
      const fontFamily = option.getAttribute('data-family') || ''
      const isDefault = optionContainer.getAttribute('data-default') || 'false'

      const pricingData = option.getAttribute('data-pricing')

      if (stored) {
        saveToLocalStorage(fieldset, option, {
          type: 'font',
          family: fontFamily,
          value: option.value,
          src: option.value,
          isDefault,
          name: option.getAttribute('data-name') || '',
          ...(pricingData ? { additionalPricing: JSON.parse(pricingData) } : {}),
        })
      }
    } else {
      // Non-font options – fall back to default behaviour
      if (stored) {
        saveToLocalStorage(fieldset, option, {
          isBuyerOption: option.closest('.image-uploaded-generated-option-set-container') ? 'true' : 'false',
        })
      }
    }

    try {
      // Debounce the drawLivePreview call
      scheduleDebouncedDraw(drawLivePreview)
    } catch (error) {
      console.error('handleOptionSetClick: Error rendering preview:', error)
    }
  }

  // Process immediately; rendering is debounced above
  await processOptionTask()
}

/**
 * Handle deletion of an uploaded/generated image option
 */
export const handleImageOptionDelete = async (
  target: HTMLElement,
  fieldset: HTMLFieldSetElement,
  instance: TailorKitProductPersonalizer,
  drawLivePreview: DrawLivePreviewFunction
) => {
  if (!fieldset) {
    console.warn('handleImageOptionDelete: Missing fieldset element')
    return
  }

  const deleteButton = target.closest('.emtlkit-image-option-delete-btn') as HTMLElement
  if (!deleteButton) {
    console.warn('handleImageOptionDelete: Delete button not found')
    return
  }

  const optionId = deleteButton.getAttribute('data-option-id')
  if (!optionId) {
    console.warn('handleImageOptionDelete: Option ID not found')
    return
  }

  try {
    // Delete the image option
    await deleteImageOption(fieldset, optionId, instance)

    // Cancel any pending debounced draw
    cancelDebouncedDraw()

    // Redraw the live preview after deletion
    await drawLivePreview()

    // Refresh live preview and notify others
    Transmitter.trigger('tailorkit-set-options')
  } catch (error) {
    console.error('handleImageOptionDelete: Error during deletion:', error)
  }
}
