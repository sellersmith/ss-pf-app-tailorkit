import { Liquid } from 'liquidjs'
// import partialImageOptionTemplateString from '../../../../sub-snippets/option-sets/image-options-list.liquid?raw'
import partialImageOptionUploadedTemplateString from '../../../../sub-snippets/option-sets/image-options-uploaded.liquid?raw'
import EmtlkitModal from '../../../components/commons/modal'
import { MODAL_SIZES } from '../../../components/commons/modal/constants'
import type { TailorKitProductPersonalizer } from '../../../components/product-personalizer'
import { type ExtendedImageOption, type OptionSet } from '../../../type'
import { getLayerByFieldset } from '../../../utils/query-layer'
import type { KonvaEditorState } from '.'
import { saveOptionSetListToLocalStorage } from '../../optionHandlers'
import { checkIfButtonIsDisabled } from '../upload-image'

/**
 * Interface for processing a selected image
 */
export interface ProcessImageOptions {
  file: File
  objectUrl: string
  fieldset: HTMLFieldSetElement
  instance: TailorKitProductPersonalizer
  transforms: KonvaEditorState
  uploadedImageUrl?: string
  replaceImage: boolean
  optionIdToReplace?: string
  removedBackground?: boolean
  isGeneratedByAi?: boolean
  /**
   * When true, internal failures do not surface a modal popup to the customer.
   * Used by external callers (e.g. the bulk drawer's live preview hook) that
   * already report status through their own UI and need silent failure
   * semantics matching the text-mirror pattern.
   */
  suppressErrorModal?: boolean
}

/**
 * Process the uploaded image and update the canvas and fieldset
 */
export async function processUploadedImage(options: ProcessImageOptions): Promise<void> {
  const {
    file,
    objectUrl,
    fieldset,
    instance,
    transforms,
    uploadedImageUrl,
    replaceImage,
    optionIdToReplace,
    removedBackground,
    isGeneratedByAi = false,
    suppressErrorModal = false,
  } = options

  if (!instance || !instance.canvasManager) {
    console.error('Canvas manager not available')
    URL.revokeObjectURL(objectUrl)
    return
  }

  const printAreaId = fieldset.dataset.printAreaId
  const layerId = fieldset.dataset.layerId
  const optionSetId = fieldset.dataset.id

  if (!printAreaId || !layerId || !optionSetId) {
    console.error('Missing required attributes (printAreaId, layerId, or optionSetId) on fieldset')
    URL.revokeObjectURL(objectUrl)
    return
  }

  try {
    // Find the target option set in the product personalizer data
    const { optionSet: targetOptionSet, layer } = getLayerByFieldset(instance, fieldset)

    if (!targetOptionSet) {
      console.error('Target OptionSet not found for data update.')
      return
    }

    // Deselect other options and add the new one
    let optionsList = (targetOptionSet.ol as unknown as ExtendedImageOption[]) || []
    if (!Array.isArray(optionsList)) {
      optionsList = []
    }

    // Get overlay data from option or layer settings
    // This allows uploaded images to inherit SVG overlays (clip paths, filters, etc.) from VectorEditor
    // Priority: 1) Preset option with overlay, 2) Layer settings overlay
    const presetWithOverlay = optionsList.find(
      (opt: ExtendedImageOption) =>
        !['image_uploaded', 'image_generated_by_ai'].includes(opt.type) && (opt as any).overlay?.overlaySvg
    )
    const layerOverlay = (layer?.s as any)?.overlay
    const inheritableOverlay
      = (presetWithOverlay as any)?.overlay || (layerOverlay?.overlaySvg ? layerOverlay : undefined)

    let selectedOptionId: string

    if (replaceImage && optionIdToReplace) {
      // Replace existing option with new image data
      const optionIndex = optionsList.findIndex(option => option.i === optionIdToReplace)

      if (optionIndex !== -1) {
        // Update the existing option with new image data
        optionsList[optionIndex] = {
          ...optionsList[optionIndex],
          l: file.name,
          v: uploadedImageUrl || objectUrl,
          ...(removedBackground && { removedBackground }),
          clipGroup: {
            ...transforms,
          },
        }
        selectedOptionId = optionIdToReplace
      } else {
        console.error('Option to replace not found:', optionIdToReplace)
        // Fallback to creating a new option
        const newOption: ExtendedImageOption = {
          l: file.name,
          v: uploadedImageUrl || objectUrl,
          i: `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: isGeneratedByAi ? 'image_generated_by_ai' : 'image_uploaded',
          ...(removedBackground && { removedBackground }),
          clipGroup: {
            ...transforms,
          },
          // Inherit overlay from preset options (SVG clip paths, filters, etc. from VectorEditor)
          ...(inheritableOverlay && { overlay: inheritableOverlay }),
        }
        optionsList.push(newOption)
        selectedOptionId = newOption.i
      }
    } else {
      // Create a new option
      const newOption: ExtendedImageOption = {
        l: file.name,
        v: uploadedImageUrl || objectUrl,
        i: `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: isGeneratedByAi ? 'image_generated_by_ai' : 'image_uploaded',
        ...(removedBackground && { removedBackground }),
        clipGroup: {
          ...transforms,
        },
        // Inherit overlay from preset options (SVG clip paths, filters, etc. from VectorEditor)
        ...(inheritableOverlay && { overlay: inheritableOverlay }),
      }
      optionsList.push(newOption)
      selectedOptionId = newOption.i
    }

    targetOptionSet.ol = optionsList

    saveOptionSetListToLocalStorage(instance, fieldset)

    // Update the UI with the new options
    await updateFieldsetUI(fieldset, targetOptionSet, printAreaId, optionSetId, selectedOptionId, true)
  } catch (error) {
    console.error('Failed to process uploaded image:', error)
    // External callers (e.g. bulk drawer) opt out of the modal so failures
    // stay silent — they handle UX feedback through their own status surface.
    if (!suppressErrorModal) showProcessingErrorModal()
  } finally {
    // If using an objectUrl and we have an uploaded URL, we can revoke the objectUrl
    if (uploadedImageUrl && objectUrl !== uploadedImageUrl) {
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
      }, 1000)
    }
  }
}

/**
 * Update the fieldset UI with the new options
 */
export async function updateFieldsetUI(
  fieldset: HTMLFieldSetElement,
  targetOptionSet: OptionSet,
  printAreaId: string,
  optionSetId: string,
  selectedOptionId: string,
  autoClick: boolean = true
): Promise<void> {
  // Set up Liquid engine
  // const imageOptionLiquidContext = {
  //   option_set_ol: targetOptionSet.ol.filter(
  //     option => !['image_uploaded', 'image_generated_by_ai'].includes((option as ExtendedImageOption).type)
  //   ),
  //   current_print_area_id: printAreaId,
  //   current_option_set_id: optionSetId,
  // }

  const imageOptionUploadedLiquidContext = {
    option_set_ol: targetOptionSet.ol.filter(option =>
      ['image_uploaded', 'image_generated_by_ai'].includes((option as ExtendedImageOption).type)
    ),
    current_print_area_id: printAreaId,
    current_option_set_id: optionSetId,
  }

  const engine = new Liquid()
  try {
    // const parsedTemplate = engine.parse(partialImageOptionTemplateString)
    // const newOptionsHtml = await engine.render(parsedTemplate, imageOptionLiquidContext)

    const parsedTemplateUploaded = engine.parse(partialImageOptionUploadedTemplateString)
    const newOptionsHtmlUploaded = await engine.render(parsedTemplateUploaded, imageOptionUploadedLiquidContext)

    const optionsContainer = fieldset.querySelector('.image-uploaded-generated-option-set-container')
    if (optionsContainer) {
      optionsContainer.outerHTML = `
        <div class="image-uploaded-generated-option-set-container emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8">
          <div class="emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap">
          ${newOptionsHtmlUploaded}
          </div>
        </div>
      `

      // Remove shake class from required indicator label (reset validation state)
      const requiredLabel = fieldset.querySelector('label.emtlkit--required-indicator--shake')
      if (requiredLabel) {
        requiredLabel.classList.remove('emtlkit--required-indicator--shake')
      }

      // Programmatically click the newly added and selected radio button
      const newSelectedRadio = fieldset.querySelector(
        `input[type="radio"][data-id="${selectedOptionId}"]`
      ) as HTMLInputElement | null

      if (newSelectedRadio && autoClick) {
        newSelectedRadio.click()
      }
    } else {
      console.error('Options container not found in fieldset for re-rendering.')
    }
  } catch (renderError) {
    console.error('LiquidJS rendering failed:', renderError)
  }
}

/**
 * Delete an image option from the option set
 */
export async function deleteImageOption(
  fieldset: HTMLFieldSetElement,
  optionIdToDelete: string,
  instance: TailorKitProductPersonalizer,
  suppressErrorModal: boolean = false
): Promise<void> {
  const printAreaId = fieldset.dataset.printAreaId
  const layerId = fieldset.dataset.layerId
  const optionSetId = fieldset.dataset.id

  if (!printAreaId || !layerId || !optionSetId) {
    console.error('Missing required attributes (printAreaId, layerId, or optionSetId) on fieldset')
    return
  }

  try {
    // Find the target option set in the product personalizer data
    const { optionSet: targetOptionSet, layer } = getLayerByFieldset(instance, fieldset)

    if (!targetOptionSet) {
      console.error('Target OptionSet not found for deletion.')
      return
    }

    const updateUploadButtonsState = () => {
      const optionSetList = Array.isArray(layer?.osl) ? (layer?.osl as any) : []

      if (!optionSetList.length) return

      checkIfButtonIsDisabled(optionSetList, fieldset, 3, 'image_uploaded')
      checkIfButtonIsDisabled(optionSetList, fieldset, 3, 'image_generated_by_ai')
    }

    // Get current options list
    let optionsList = (targetOptionSet.ol as unknown as ExtendedImageOption[]) || []
    if (!Array.isArray(optionsList)) {
      optionsList = []
    }

    // Find the option to delete
    const optionIndex = optionsList.findIndex(option => option.i === optionIdToDelete)

    if (optionIndex === -1) {
      console.error('Option to delete not found:', optionIdToDelete)
      return
    }

    // Check if the option being deleted is currently selected
    const currentValue = fieldset.getAttribute('value')
    const deletedOption = optionsList[optionIndex]
    const isDeletedOptionSelected = deletedOption.v === currentValue

    // Clean up blob URLs to prevent memory leaks
    if (deletedOption.v && deletedOption.v.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(deletedOption.v)
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error)
      }
    }

    // Remove the option from the list
    optionsList.splice(optionIndex, 1)

    // Update the option set
    targetOptionSet.ol = optionsList

    // Save updated list to localStorage
    saveOptionSetListToLocalStorage(instance, fieldset)

    // Determine which option to select after deletion
    let selectedOptionId = ''
    let selectedOption: ExtendedImageOption | undefined

    if (isDeletedOptionSelected && optionsList.length > 0) {
      const originalImage = optionsList.find(
        option => !['image_uploaded', 'image_generated_by_ai'].includes(option.type)
      )

      if (originalImage) {
        selectedOptionId = originalImage.i
        selectedOption = originalImage as ExtendedImageOption
      } else {
        const uploadedImage = optionsList.find(option =>
          ['image_uploaded', 'image_generated_by_ai'].includes(option.type)
        )
        selectedOption = (uploadedImage || optionsList[0]) as ExtendedImageOption
        selectedOptionId = selectedOption?.i || ''
      }
    } else {
      selectedOption = optionsList.find(option => option.v === currentValue) as ExtendedImageOption | undefined
      selectedOptionId = selectedOption?.i || ''
    }

    if ((!selectedOptionId || !selectedOption) && optionsList.length > 0) {
      selectedOption = optionsList[0]
      selectedOptionId = selectedOption.i
    }

    if (!selectedOptionId) {
      const component = fieldset
        .closest('.emtlkit--option-set')
        ?.querySelector('tailorkit-image-options-list') as HTMLElement | null
      const rawOptionSet = component?.getAttribute('data-option-set-data')

      if (rawOptionSet) {
        try {
          const parsedOptionSet = JSON.parse(rawOptionSet)
          const fallbackOptions = Array.isArray(parsedOptionSet?.ol) ? parsedOptionSet.ol : []
          if (fallbackOptions.length > 0) {
            const fallbackSelected = fallbackOptions.find((option: any) => option.s === 1)
            selectedOption = (fallbackSelected || fallbackOptions[0]) as ExtendedImageOption
            selectedOptionId = selectedOption.i

            targetOptionSet.ol = [...fallbackOptions] as any
            saveOptionSetListToLocalStorage(instance, fieldset)
          }
        } catch (parseError) {
          console.error('Failed to parse original option set data:', parseError)
        }
      }
    }

    if (!selectedOptionId) {
      fieldset.removeAttribute('value')
      await updateFieldsetUI(fieldset, targetOptionSet, printAreaId, optionSetId, '', false)
      instance.updateFieldset(fieldset, '', '', '')
      updateUploadButtonsState()
      return
    }

    const shouldAutoClick = Boolean(selectedOptionId && isDeletedOptionSelected)

    await updateFieldsetUI(fieldset, targetOptionSet, printAreaId, optionSetId, selectedOptionId, shouldAutoClick)

    const selectedForUpdate = selectedOption || targetOptionSet.ol?.find((option: any) => option.i === selectedOptionId)

    if (selectedForUpdate) {
      instance.updateFieldset(fieldset, selectedForUpdate.i, selectedForUpdate.l || '', selectedForUpdate.v || '')
    } else if (!selectedOptionId) {
      instance.updateFieldset(fieldset, '', '', '')
    }

    updateUploadButtonsState()
  } catch (error) {
    console.error('Failed to delete image option:', error)
    // External callers (e.g. bulk drawer's silent close cleanup) opt out of
    // the popup so a transient delete failure during a background cleanup
    // never surfaces an unexpected modal to the customer.
    if (!suppressErrorModal) showProcessingErrorModal()
  }
}

/**
 * Show an error modal for processing failures
 */
function showProcessingErrorModal(): void {
  const errorModal = new EmtlkitModal({
    header: 'Image Processing Error',
    content: 'Could not apply image to canvas. Please try again.',
    size: MODAL_SIZES.SMALL,
    footer: `<button class="emtlkit-button emtlkit-button-modal emtlkit-button--primary error-modal-ok">OK</button>`,
    closeOnBackdropClick: true,
    closeOnEsc: true,
  })
  errorModal.open()
  setTimeout(() => {
    document.querySelector('.error-modal-ok')?.addEventListener('click', () => errorModal.close())
  }, 100)
}
