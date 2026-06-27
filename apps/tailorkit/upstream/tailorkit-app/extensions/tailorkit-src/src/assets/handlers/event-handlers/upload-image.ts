/* eslint-disable max-lines */
import type { Layer, LayerIntegration, ExtendedImageOption, OptionSet, ImageOptionSet } from '../../type'
import type { TailorKitProductPersonalizer } from '../../components/product-personalizer'
import {
  createImageFileInput,
  showErrorModal,
  uploadImageToServer,
  validateImageFile,
} from './image-editor/upload-service'
import { showImageEditorModal } from './image-editor/modal'
import { processUploadedImage, updateFieldsetUI } from './image-editor/data-processing'
import type { KonvaEditorState } from './image-editor/types/editor-types'
import { getLayerByFieldset } from '../../utils/query-layer'
import { findViewAndSwitchTo } from '../../utils/query-views'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import Tooltip from '../../components/commons/tooltip'
import { saveOptionSetListToLocalStorage } from '../optionHandlers'
import { handleGenerateImageWithAI } from './generateImageWithAi'
import type { IMaskConfig } from '../../../shared/libraries/konva/core/konva-canvas-manager'
import {
  extractFilterPresetIdFromSvg,
  extractFilterPresetParamsFromSvg,
  extractFillStrokeFromSvg,
  getSvgContent,
} from './ai-generation-helpers'
import { APP_PROXY_PATH } from '../../constants'
import { STORE_FRONT_ACTION } from '../../constants/app-actions'
import { Transmitter } from '../../libraries/transmitter'
import { fetchWithAdminContext } from '../../libraries/fetchWithAdminContext'

export type UploadMode = 'image' | 'vector'

type OptionType = 'image_uploaded' | 'image_generated_by_ai'

/**
 * Get the count of uploaded/generated options in the given option set
 */
export function getImageCount(osl?: OptionSet[], type: OptionType = 'image_uploaded'): number {
  if (!osl) return 0

  const imageOptionSet = osl.find((os: OptionSet) => os.t === 'image_option')
  if (!imageOptionSet) return 0

  const imageOptionSetList = imageOptionSet.ol as unknown as ExtendedImageOption[]
  const images = imageOptionSetList?.filter(option => option.type === type) || []

  return images.length
}

/**
 * Check if the upload limit has been reached for the given option set
 */
export function hasReachedLimit(osl?: OptionSet[], maxUsage: number = 3, type: OptionType = 'image_uploaded'): boolean {
  return getImageCount(osl, type) >= maxUsage
}

const MAX_IMAGE_UPLOAD_USAGE = 3

/**
 * Enhanced mask configuration with proper defaults
 * @param maskOption - The mask option from layer
 * @returns IMaskConfig or undefined
 */
export const getMaskConfigOptimized = (maskOption: any): any => {
  if (!maskOption) return undefined

  return {
    src: maskOption.v,
    invert: maskOption.invert ?? false,
    globalCompositeOperation: maskOption.globalCompositeOperation ?? ('destination-in' as const),
    smoothEdges: maskOption.smoothEdges ?? true,
    smoothingStrength: maskOption.smoothingStrength ?? 0.5,
  }
}

/**
 * Handle image upload from the Upload button click
 *
 * This function handles both new image uploads and image replacements. When replacing an image,
 * it maintains the same option ID and updates the image source and transforms while preserving
 * the option's position in the list.
 *
 * @param target - The clicked upload button element
 * @param instance - The TailorKit product personalizer instance
 * @param replaceImage - Whether this is a replacement operation (default: false)
 * @param optionIdToReplace - The ID of the option to replace (required when replaceImage is true)
 *
 * @example
 * // Regular upload (creates new option)
 * handleUploadImage(buttonElement, instance)
 *
 * @example
 * // Replace existing image (updates existing option)
 * handleUploadImage(buttonElement, instance, true, 'uploaded-123-abc')
 *
 * @workflow
 * 1. Validates fieldset and layer data
 * 2. Checks upload limits (skipped for replacements)
 * 3. Opens file picker for image selection
 * 4. Validates selected image file
 * 5. Opens image editor modal for cropping/positioning
 * 6. Uploads image to server
 * 7. Processes image data (creates new or replaces existing option)
 * 8. Updates UI and triggers canvas re-render
 */
export const handleUploadImage = (
  target: HTMLElement,
  instance: TailorKitProductPersonalizer,
  replaceImage: boolean = false,
  optionIdToReplace?: string
) => {
  const fieldset = target.closest('fieldset') as HTMLFieldSetElement
  if (!fieldset) return

  // Find the relevant layer integration and layer
  const layerIntegration = instance.productPersonalizer?.lis?.find(
    (li: LayerIntegration) => li.data?.printAreaId === fieldset.dataset.printAreaId
  )

  if (!layerIntegration) {
    console.error('Layer integration not found for print area ID:', fieldset.dataset.printAreaId)
    return
  }

  const layer = layerIntegration.data?.ls.find((l: Layer) => l.i === fieldset.dataset.layerId)

  if (!layer) {
    console.error('Layer not found for layer ID:', fieldset.dataset.layerId)
    return
  }

  // Auto-detect upload mode based on layer's image source
  const mode = determineUploadMode(layer)

  // Route to vector upload handler if layer is configured for SVG
  if (mode === 'vector') {
    handleVectorUpload(target, instance, layer, fieldset)
    return
  }

  // Check if upload limit has been reached (skip check if replacing an existing image)
  if (!replaceImage && hasReachedLimit(layer.osl, MAX_IMAGE_UPLOAD_USAGE, 'image_uploaded')) {
    // Append class disabled to button upload
    target.classList.add('emtlkit-button-disabled')
    target.setAttribute('disabled', 'true')

    // Hover with delay
    new Tooltip(target, {
      content: `You have uploaded ${MAX_IMAGE_UPLOAD_USAGE} images. Click Edit button below an image to replace it.`,
      trigger: 'hover',
    })

    return
  }

  // Create and trigger the file input
  createImageFileInput(async file => {
    // Validate the file
    const validationResult = validateImageFile(file)

    if (!validationResult.valid) {
      // Show error modal with retry option
      showErrorModal({
        title: 'Image upload error',
        message: validationResult.errorMessage || 'Invalid image file. Large images will be automatically resized.',
        onRetry: () => handleUploadImage(target, instance, replaceImage, optionIdToReplace),
      })
      return
    }

    // Create an object URL for the file
    const objectUrl = URL.createObjectURL(file)
    // Load the image
    const imageElement = new Image()
    imageElement.onload = async () => {
      // Extract layer dimensions from the layer data
      const {
        ds: { w: layerWidth, h: layerHeight, l: layerLeft, t: layerTop, r: layerRotation },
        osl,
      } = layer as Layer

      const transformerConfig = getTransformerConfig(osl)

      // Get mask config from layer's option sets
      let maskConfig: IMaskConfig | undefined
      const maskOption = getMaskOption(layer)
      if (maskOption) {
        maskConfig = getMaskConfigOptimized(maskOption)
      }

      // Show the image editor modal
      await showImageEditorModal({
        file,
        objectUrl,
        imageElement,
        maskConfig,
        layerDimensions: {
          width: layerWidth,
          height: layerHeight,
          left: layerLeft,
          top: layerTop,
          rotation: layerRotation,
        },
        initialState: {
          zoom: 1,
          rotation: 0,
        },
        transformerConfig,
        onCancel: () => {
          URL.revokeObjectURL(objectUrl)
        },
        onReplaceImage: () => {
          URL.revokeObjectURL(objectUrl)
          handleUploadImage(target, instance, replaceImage, optionIdToReplace)
        },
        onSubmit: async (editorState: KonvaEditorState, objectUrl: string, removedBackground?: boolean) => {
          // Upload the image to the server
          let uploadResult = null

          if (removedBackground) {
            uploadResult = {
              success: true,
              url: objectUrl,
            }
          } else {
            uploadResult = await uploadImageToServer(file)
          }

          if (!uploadResult.success) {
            showErrorModal({
              title: 'Upload Error',
              message: uploadResult.error || 'Failed to upload image to server',
              onRetry: () => handleUploadImage(target, instance, replaceImage, optionIdToReplace),
            })
            URL.revokeObjectURL(objectUrl)
            return
          }

          // Process the image with the final URL and transform state
          await processUploadedImage({
            file,
            objectUrl,
            fieldset,
            instance,
            transforms: editorState,
            uploadedImageUrl: uploadResult.url,
            replaceImage,
            optionIdToReplace,
            removedBackground,
          })

          // Find and switch to the appropriate view for this layer
          findViewAndSwitchTo(instance, fieldset)

          checkIfButtonIsDisabled(osl || [], fieldset, MAX_IMAGE_UPLOAD_USAGE, 'image_uploaded')
        },
      })
    }

    imageElement.onerror = () => {
      console.error('Failed to load image for editor')
      URL.revokeObjectURL(objectUrl)
      showErrorModal({
        title: 'Image Error',
        message: 'Failed to load image for editing.',
        onRetry: () => handleUploadImage(target, instance, replaceImage, optionIdToReplace),
      })
    }

    imageElement.src = objectUrl
  })
}

/**
 * Handle editing an uploaded image from the Edit button click
 *
 * This function allows users to re-edit previously uploaded images with their existing transforms.
 * It opens the image editor modal with the current image and transform settings, allowing users
 * to modify zoom, rotation, and position while preserving the original uploaded image URL.
 *
 * @param target - The clicked edit button element
 * @param instance - The TailorKit product personalizer instance
 *
 * @example
 * // This handler is automatically called when a user clicks an edit button on an uploaded image:
 * // <button data-option-id="uploaded-123" class="...">Edit</button>
 *
 * @workflow
 * 1. Validates the fieldset and option ID from the edit button
 * 2. Finds the layer integration and layer data
 * 3. Retrieves the existing option with its transform data (clipGroup)
 * 4. Loads the existing image into the editor modal
 * 5. Initializes the editor with existing zoom/rotation values
 * 6. On submit, updates only the transform data (not the image URL)
 * 7. Re-renders the canvas with updated transforms
 */
export const handleEditUploadedImage = (target: HTMLElement, instance: TailorKitProductPersonalizer) => {
  const fieldset = target.closest('fieldset') as HTMLFieldSetElement
  if (!fieldset) return

  // Get the option ID from the button's data attribute
  const optionId = target.getAttribute('data-option-id')
  if (!optionId) {
    console.error('Option ID not found on edit button')
    return
  }

  // Find the relevant layer integration and layer
  const layerIntegration = instance.productPersonalizer?.lis?.find(
    (li: LayerIntegration) => li.data?.printAreaId === fieldset.dataset.printAreaId
  )

  if (!layerIntegration) {
    console.error('Layer integration not found for print area ID:', fieldset.dataset.printAreaId)
    return
  }

  const layer = layerIntegration.data?.ls.find((l: Layer) => l.i === fieldset.dataset.layerId)

  if (!layer) {
    console.error('Layer not found for layer ID:', fieldset.dataset.layerId)
    return
  }

  // Find the target option set and the specific option to edit
  const { optionSet: targetOptionSet } = getLayerByFieldset(instance, fieldset)
  if (!targetOptionSet) {
    console.error('Target OptionSet not found for editing.')
    return
  }

  // Find the specific option by ID
  const optionsList = (targetOptionSet.ol as unknown as ExtendedImageOption[]) || []
  const optionToEdit = optionsList.find(option => option.i === optionId)

  if (!optionToEdit) {
    console.error('Option to edit not found:', optionId)
    return
  }

  // Create a temporary image element to load the existing image
  const imageElement = new Image()
  imageElement.crossOrigin = 'anonymous'

  imageElement.onload = async () => {
    // Extract layer dimensions from the layer data
    const {
      ds: { w: layerWidth, h: layerHeight, l: layerLeft, t: layerTop, r: layerRotation },
      osl,
    } = layer
    const maskOption = getMaskOption(layer)

    // Get existing transform data from clipGroup, or use defaults
    const existingTransforms = optionToEdit.clipGroup || { zoom: 1, rotation: 0 }

    // Check if background was previously removed
    const hasRemovedBackground = optionToEdit.removedBackground === true

    // Ensure zoom is in the correct format (the editor expects percentage values for zoom > 2)
    let zoomValue = existingTransforms.zoom || 1
    // If zoom is stored as decimal (like 1.5), convert to percentage (150)
    if (zoomValue <= 2) {
      zoomValue = zoomValue * 100
    }

    const rotationValue = existingTransforms.rotation || 0

    // Create a complete initial state object with all available data
    const initialState = {
      zoom: zoomValue,
      rotation: rotationValue,
      // Include position and dimension data if available
      ...(existingTransforms.x !== undefined && { x: existingTransforms.x }),
      ...(existingTransforms.y !== undefined && { y: existingTransforms.y }),
      ...(existingTransforms.width !== undefined && { width: existingTransforms.width }),
      ...(existingTransforms.height !== undefined && { height: existingTransforms.height }),
    }

    const transformerConfig = getTransformerConfig(osl)

    // Show the image editor modal with existing transforms
    await showImageEditorModal({
      file: new File([], optionToEdit.l), // Create a dummy file with the original name
      objectUrl: optionToEdit.v, // Use the existing image URL
      imageElement,
      layerDimensions: {
        width: layerWidth,
        height: layerHeight,
        left: layerLeft,
        top: layerTop,
        rotation: layerRotation,
      },
      initialState: initialState,
      transformerConfig,
      initialBackgroundRemoved: hasRemovedBackground,
      maskConfig: maskOption ? getMaskConfigOptimized(maskOption) : undefined,
      onCancel: () => {
        // No cleanup needed for existing images
      },
      onReplaceImage: () => {
        if (optionToEdit.type === 'image_generated_by_ai') {
          handleGenerateImageWithAI(target, instance, true, optionId)
        } else {
          // Allow user to select a new image to replace the current one
          handleUploadImage(target, instance, true, optionId)
        }
      },
      onSubmit: async (editorState: KonvaEditorState, objectUrl: string, removedBackground?: boolean) => {
        // Update the existing option with new transform data and potentially new image URL
        await updateUploadedImageTransforms({
          fieldset,
          instance,
          optionId,
          transforms: editorState,
          newImageUrl: removedBackground ? objectUrl : undefined,
          removedBackground,
        })

        checkIfButtonIsDisabled(osl, fieldset, MAX_IMAGE_UPLOAD_USAGE, optionToEdit.type)
      },
    })
  }

  imageElement.onerror = () => {
    console.error('Failed to load existing image for editing')
    showErrorModal({
      title: 'Image Error',
      message: 'Failed to load existing image for editing.',
      onRetry: () => handleEditUploadedImage(target, instance),
    })
  }

  // Load the existing image
  imageElement.src = optionToEdit.v
}

/**
 * Update transforms and optionally image URL for an existing uploaded image
 *
 * This function updates the transform data (zoom, rotation, position) and optionally the image URL
 * for an existing uploaded image option. This is useful when editing an image and applying new
 * transforms, or when the image itself has been processed (e.g., background removal).
 *
 * @param params - Configuration object for updating transforms and image
 * @param params.fieldset - The fieldset containing the image options
 * @param params.instance - The TailorKit product personalizer instance
 * @param params.optionId - The unique ID of the option to update
 * @param params.transforms - The new transform state from the image editor
 * @param params.newImageUrl - Optional new image URL (e.g., after background removal)
 *
 * @returns Promise that resolves when the update is complete
 *
 * @throws Will show an error modal if the option set or option is not found
 *
 * @fires document#image:edited - Custom event fired when transforms are successfully updated
 *
 * @workflow
 * 1. Finds the target option set using the fieldset
 * 2. Locates the specific option by ID in the options list
 * 3. Updates the option's clipGroup with new transform data
 * 4. Updates the image URL if a new one is provided
 * 5. Triggers canvas re-render to apply changes visually
 * 6. Dispatches custom event for other components to react
 */
async function updateUploadedImageTransforms({
  fieldset,
  instance,
  optionId,
  transforms,
  newImageUrl,
  removedBackground,
}: {
  fieldset: HTMLFieldSetElement
  instance: TailorKitProductPersonalizer
  optionId: string
  transforms: KonvaEditorState
  newImageUrl?: string
  removedBackground?: boolean
}): Promise<void> {
  try {
    // Find the target option set and update the specific option
    const { optionSet: targetOptionSet } = getLayerByFieldset(instance, fieldset)
    if (!targetOptionSet) {
      console.error('Target OptionSet not found for updating transforms.')
      return
    }

    const printAreaId = fieldset.dataset.printAreaId
    const layerId = fieldset.dataset.layerId
    const optionSetId = fieldset.dataset.id

    if (!printAreaId || !layerId || !optionSetId) {
      console.error('Missing required attributes (printAreaId, layerId, or optionSetId) on fieldset')
      return
    }

    // Find and update the specific option
    const optionsList = (targetOptionSet.ol as unknown as ExtendedImageOption[]) || []
    const optionIndex = optionsList.findIndex(option => option.i === optionId)

    if (optionIndex === -1) {
      console.error('Option to update not found:', optionId)
      return
    }

    // Update the option's clipGroup with new transforms and optionally the image URL
    optionsList[optionIndex] = {
      ...optionsList[optionIndex],
      clipGroup: {
        ...transforms,
      },
      ...(removedBackground && { removedBackground }),
      // Update the image URL if a new one is provided (e.g., after background removal)
      ...(newImageUrl && { v: newImageUrl }),
    }
    const selectedOptionId = optionsList[optionIndex].i

    // Update the option set
    targetOptionSet.ol = optionsList as any

    saveOptionSetListToLocalStorage(instance, fieldset)

    // Update the UI with the new options
    await updateFieldsetUI(fieldset, targetOptionSet, printAreaId, optionSetId, selectedOptionId, true)

    // Find and switch to the appropriate view for this layer
    findViewAndSwitchTo(instance, fieldset)

    // Trigger canvas re-render to apply the new transforms
    await instance.renderCanvas()
  } catch (error) {
    console.error('Failed to update image transforms:', error)
    showErrorModal({
      title: 'Update Error',
      message: 'Failed to update image transforms. Please try again.',
    })
  }
}

export function getTransformerConfig(osl?: ImageOptionSet[]): Partial<TransformerConfig> {
  const imageOptionSet = osl?.find((os: ImageOptionSet) => os.t === 'image_option')

  if (!imageOptionSet) {
    console.error('Image option set not found for layer')
    return {}
  }

  const transformerConfig: Partial<TransformerConfig> = {
    rotateEnabled: imageOptionSet.allowCustomerToEditImage?.allowRotate,
    resizeEnabled: imageOptionSet.allowCustomerToEditImage?.allowZoom,
    draggable: imageOptionSet.allowCustomerToEditImage?.allowTransform,
    removeBackgroundEnabled: imageOptionSet.allowCustomerToEditImage?.allowRemoveBackground,
  }

  return transformerConfig
}

export function getMaskOption(layer: Layer): ExtendedImageOption | undefined {
  const { osl } = layer
  let maskOption: ExtendedImageOption | undefined

  // Find the mask option set on the layer
  const maskOptionSet = osl?.find((os: ImageOptionSet) => os.t === 'mask_option')
  if (maskOptionSet) {
    // Find fieldset of mask option set
    const maskFieldset = document.querySelector(`fieldset[data-layer-id="${layer.i}"][data-option-type="mask_option"]`)

    if (maskFieldset) {
      const maskOptionId = maskFieldset.getAttribute('data-option-id')

      // Find the mask option in the mask option set
      maskOption = (maskOptionSet.ol as ExtendedImageOption[])?.find(option => option.i === maskOptionId)
    } else {
      // Fallback: Try to find selected mask option directly
      maskOption = (maskOptionSet.ol as ExtendedImageOption[])?.find(option => option.s === 1)
    }
  }

  // Final check: if no mask option found, try to find any mask option with a valid src
  if (!maskOption && maskOptionSet) {
    maskOption = (maskOptionSet.ol as ExtendedImageOption[])?.find(option => option.v && option.v.length > 0)
  }

  return maskOption
}

export function checkIfButtonIsDisabled(
  osl: ImageOptionSet[],
  fieldset: HTMLFieldSetElement,
  maxUsage: number = 3,
  type: 'image_uploaded' | 'image_generated_by_ai' = 'image_uploaded'
) {
  if (!osl || !osl.length || !fieldset) {
    return
  }

  const isDisabled = hasReachedLimit(osl, maxUsage, type)

  // Query button upload
  const button = fieldset.querySelector(
    `button.${type === 'image_uploaded' ? 'emtlkit-button--upload' : 'ai-generate'}`
  ) as HTMLButtonElement

  if (!button) {
    return
  }

  const className = button.className
  const disabledClassName = 'emtlkit-button-disabled'

  if (!className.includes(disabledClassName) && isDisabled) {
    // Append class disabled to button upload
    button.classList.add(disabledClassName)
    button.setAttribute('disabled', 'true')

    // Hover with delay
    new Tooltip(button, {
      content: `You have uploaded ${maxUsage} images. Click Edit button below an image to replace it.`,
      trigger: 'hover',
    })

    return
  }

  if (className.includes(disabledClassName) && !isDisabled) {
    // Remove class disabled from button upload
    button.classList.remove(disabledClassName)
    button.removeAttribute('disabled')

    // Destroy the tooltip that was created when the button was disabled
    Tooltip.destroyInstance(button)

    return
  }
}

// ===== Vector Upload Support =====

const MAX_SVG_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_SVG_MIME_TYPES = ['image/svg+xml']

/**
 * Determine upload mode based on layer's image source
 * Returns 'vector' if the layer has an SVG image, 'image' otherwise
 */
function determineUploadMode(layer: Layer | undefined): UploadMode {
  if (!layer?.u) return 'image'
  const src = layer.u.toLowerCase()
  // Check for SVG data URI
  if (src.startsWith('data:image/svg+xml')) return 'vector'
  // Strip query string before checking extension
  const urlWithoutQuery = src.split('?')[0]
  return urlWithoutQuery.endsWith('.svg') ? 'vector' : 'image'
}

/**
 * Validate SVG file
 */
function validateSvgFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_SVG_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
    return { valid: false, error: 'Please upload a valid SVG file' }
  }
  if (file.size > MAX_SVG_FILE_SIZE) {
    return { valid: false, error: 'SVG file must be less than 2MB' }
  }
  return { valid: true }
}

/**
 * Read SVG file content
 */
function readSvgContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read SVG file'))
    reader.readAsText(file)
  })
}

/**
 * Validate SVG content for security
 */
function validateSvgContent(content: string): { valid: boolean; error?: string } {
  const dangerousPatterns = [/<script[\s\S]*?>/i, /on\w+\s*=/i, /javascript:/i, /data:/i, /<foreignObject/i]
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return { valid: false, error: 'SVG contains potentially unsafe content' }
    }
  }
  if (!/<svg[\s\S]*>/i.test(content)) {
    return { valid: false, error: 'Invalid SVG structure' }
  }
  return { valid: true }
}

/**
 * Extract filter definition from source SVG and apply it to target SVG.
 * This transfers the filter preset (including all primitives and data attributes)
 * from the layer's original SVG to a newly uploaded SVG.
 *
 * @param targetSvg - The SVG content to add the filter to
 * @param sourceSvg - The source SVG containing the filter definition
 * @returns The modified target SVG with the filter applied, or the original if no filter found
 */
export function transferFilterFromSourceSvg(targetSvg: string, sourceSvg: string): string {
  // Parse the source SVG to find filter definitions
  const parser = new DOMParser()
  const sourceDoc = parser.parseFromString(sourceSvg, 'image/svg+xml')
  const sourceEl = sourceDoc.querySelector('svg')
  if (!sourceEl) return targetSvg

  // Find preset filter in source SVG (filters with id starting with "preset-filter-")
  const sourceFilter = sourceEl.querySelector('filter[id^="preset-filter-"]')
  if (!sourceFilter) return targetSvg

  const filterId = sourceFilter.getAttribute('id')
  if (!filterId) return targetSvg

  // Parse target SVG
  const targetDoc = parser.parseFromString(targetSvg, 'image/svg+xml')
  const targetEl = targetDoc.querySelector('svg')
  if (!targetEl) return targetSvg

  // Check if target already has this filter
  if (targetEl.querySelector(`filter[id="${filterId}"]`)) {
    // Filter already exists, just apply it to paths
    return applyFilterToPaths(targetSvg, filterId)
  }

  // Find or create defs element in target
  let targetDefs = targetEl.querySelector('defs')
  if (!targetDefs) {
    targetDefs = targetDoc.createElementNS('http://www.w3.org/2000/svg', 'defs')
    targetEl.insertBefore(targetDefs, targetEl.firstChild)
  }

  // Import and append the filter to target defs
  const importedFilter = targetDoc.importNode(sourceFilter, true)
  targetDefs.appendChild(importedFilter)

  // Serialize the modified target SVG
  let modifiedSvg = new XMLSerializer().serializeToString(targetDoc)

  // Apply filter to all paths in the target SVG
  modifiedSvg = applyFilterToPaths(modifiedSvg, filterId)

  return modifiedSvg
}

/**
 * Apply a filter reference to all path elements in an SVG
 */
function applyFilterToPaths(svgContent: string, filterId: string): string {
  return svgContent.replace(/<path([^>]*?)(\s*\/?>)/gi, (match, attrs, closing) => {
    // Check if path already has this filter
    if (attrs.includes(`filter="url(#${filterId})"`)) {
      return match
    }
    // Replace existing filter or add new one
    if (/\sfilter\s*=/i.test(attrs)) {
      attrs = attrs.replace(/\sfilter\s*=\s*["'][^"']*["']/i, ` filter="url(#${filterId})"`)
    } else {
      attrs += ` filter="url(#${filterId})"`
    }
    return `<path${attrs}${closing}`
  })
}

/**
 * Upload SVG to server
 */
export async function uploadSvgToServer(
  svgContent: string,
  fileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = `${APP_PROXY_PATH}/app_proxy/storefront`
    const formData = new FormData()
    formData.append('action', STORE_FRONT_ACTION.UPLOAD_IMAGE)

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const file = new File([blob], fileName, { type: 'image/svg+xml' })
    formData.append('files', file)

    const response = await fetchWithAdminContext(url, { method: 'POST', body: formData })

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Upload failed')
    }

    const uploadedFiles = result.data?.uploadedFiles || []
    if (uploadedFiles.length === 0) {
      throw new Error('No files were uploaded')
    }

    return {
      success: true,
      url: uploadedFiles[0].image?.originalSrc || uploadedFiles[0].url,
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to upload SVG' }
  }
}

/**
 * Style transfer options for SVG upload
 */
export interface SvgStyleTransferOptions {
  filterPresetId?: string
  filterPresetParams?: Record<string, number>
  fill?: string
  stroke?: string
  strokeWidth?: number
}

/**
 * Upload SVG file with style transfer applied server-side
 * Uses UPLOAD_SVG action which applies filter and fill/stroke using applyStyleTransferToSvg on backend
 */
export async function uploadSvgWithFilterPreset(
  svgFile: File,
  filterPresetId?: string,
  filterPresetParams?: Record<string, number>,
  styleOptions?: { fill?: string; stroke?: string; strokeWidth?: number }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = `${APP_PROXY_PATH}/app_proxy/storefront`
    const formData = new FormData()
    formData.append('action', STORE_FRONT_ACTION.UPLOAD_SVG)
    formData.append('svgFile', svgFile)

    // Pass style transfer data as JSON if any style options are present
    const hasStyles = filterPresetId || styleOptions?.fill || styleOptions?.stroke
    if (hasStyles) {
      formData.append(
        'jsonData',
        JSON.stringify({
          filterPresetId,
          filterPresetParams,
          fill: styleOptions?.fill,
          stroke: styleOptions?.stroke,
          strokeWidth: styleOptions?.strokeWidth,
        })
      )
    }

    const response = await fetchWithAdminContext(url, { method: 'POST', body: formData })

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData?.message) {
          errorMessage = errorData.message
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Upload failed')
    }

    const uploadedFiles = result.data?.uploadedFiles || []
    if (uploadedFiles.length === 0) {
      throw new Error('No files were uploaded')
    }

    return {
      success: true,
      url: uploadedFiles[0].image?.originalSrc || uploadedFiles[0].url,
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to upload SVG' }
  }
}

/**
 * Transfer filter preset from layer's SVG to target SVG and upload to server.
 * This is a high-level utility that combines filter transfer and upload.
 *
 * @param svgUrl - The URL or data URI of the target SVG
 * @param fileName - The file name for the uploaded SVG
 * @param layerSvgUrl - The layer's original SVG URL (to extract filter from)
 * @returns Upload result with CDN URL
 */
export async function transferFilterToSvg(
  svgUrl: string,
  fileName: string,
  layerSvgUrl: string | undefined
): Promise<{ success: boolean; url?: string; filterPresetId?: string; error?: string }> {
  try {
    // Get SVG content from the target URL
    const targetSvgContent = await getSvgContent(svgUrl)
    if (!targetSvgContent) {
      return { success: false, error: 'Could not fetch target SVG content' }
    }

    let processedSvgContent = targetSvgContent
    let filterPresetId: string | undefined

    // Transfer filter from layer's original SVG if available
    if (layerSvgUrl) {
      const layerSvgContent = await getSvgContent(layerSvgUrl)
      if (layerSvgContent) {
        filterPresetId = extractFilterPresetIdFromSvg(layerSvgContent) ?? undefined

        if (filterPresetId) {
          processedSvgContent = transferFilterFromSourceSvg(targetSvgContent, layerSvgContent)
        }
      }
    }

    // Upload the processed SVG
    const uploadResult = await uploadSvgToServer(processedSvgContent, fileName)

    return {
      ...uploadResult,
      filterPresetId,
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to process and upload SVG' }
  }
}

/**
 * Upload SVG with filter transfer in one step.
 * Convenience function that handles both filter transfer and upload.
 *
 * @param svgUrl - The URL or data URI of the SVG to upload
 * @param fileName - The file name for the uploaded SVG
 * @param layerSvgUrl - The layer's original SVG URL (to extract filter from)
 * @returns Upload result with CDN URL and filter preset ID
 */
export async function uploadSvgWithFilter(
  svgUrl: string,
  fileName: string,
  layerSvgUrl: string | undefined
): Promise<{ success: boolean; url?: string; filterPresetId?: string; error?: string }> {
  return transferFilterToSvg(svgUrl, fileName, layerSvgUrl)
}

/** Track storefront events via app proxy */
function trackStorefrontEvent(eventName: string, properties: Record<string, any>) {
  const formData = new FormData()
  formData.append('action', STORE_FRONT_ACTION.TRACK_EVENT)
  formData.append('eventName', eventName)
  formData.append('properties', JSON.stringify(properties))
  fetchWithAdminContext(`${APP_PROXY_PATH}/app_proxy/storefront`, { method: 'POST', body: formData }).catch(
    console.error
  )
}

/**
 * Handle vector (SVG) file upload
 * Applies merchant-defined filter presets to uploaded SVGs using server-side applyFilterPresetToSvg
 */
async function handleVectorUpload(
  target: HTMLElement,
  instance: TailorKitProductPersonalizer,
  layer: Layer,
  fieldset: HTMLFieldSetElement
): Promise<void> {
  // Create file input for SVG files
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.svg,image/svg+xml'
  input.style.display = 'none'
  document.body.appendChild(input)

  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    document.body.removeChild(input)

    if (!file) return

    // Set loading state on the Upload button right after file selection
    // Uses the same pattern as the Generate image button (emtlkit-button--loading)
    const uploadButton = target.closest('button') || target
    const wasDisabled = uploadButton.hasAttribute('disabled')
    uploadButton.setAttribute('disabled', 'true')
    uploadButton.classList.add('emtlkit-button--loading')

    // Add spinner element if it doesn't exist
    if (!uploadButton.querySelector('.emtlkit-button__spinner')) {
      const spinner = document.createElement('span')
      spinner.className = 'emtlkit-button__spinner'
      uploadButton.appendChild(spinner)
    }

    // Helper to reset button state
    const resetButton = () => {
      uploadButton.classList.remove('emtlkit-button--loading')
      // Remove spinner
      const spinner = uploadButton.querySelector('.emtlkit-button__spinner')
      if (spinner) {
        spinner.remove()
      }
      if (!wasDisabled) {
        uploadButton.removeAttribute('disabled')
      }
    }

    // Validate file
    const validation = validateSvgFile(file)
    if (!validation.valid) {
      resetButton()
      showErrorModal({
        title: 'SVG upload error',
        message: validation.error || 'Invalid SVG file',
        onRetry: () => handleVectorUpload(target, instance, layer, fieldset),
      })
      return
    }

    // Read file content for validation
    let svgContent: string
    try {
      svgContent = await readSvgContent(file)
    } catch {
      resetButton()
      showErrorModal({
        title: 'Read error',
        message: 'Failed to read SVG file',
        onRetry: () => handleVectorUpload(target, instance, layer, fieldset),
      })
      return
    }

    // Validate content
    const contentValidation = validateSvgContent(svgContent)
    if (!contentValidation.valid) {
      resetButton()
      showErrorModal({
        title: 'SVG validation error',
        message: contentValidation.error || 'Invalid SVG content',
        onRetry: () => handleVectorUpload(target, instance, layer, fieldset),
      })
      return
    }

    // Extract filter preset ID, params, and fill/stroke from layer's original SVG
    // These will be passed to backend which uses applyStyleTransferToSvg to apply styles and filter
    let filterPresetId: string | undefined
    let filterPresetParams: Record<string, number> | undefined
    let styleOptions: { fill?: string; stroke?: string; strokeWidth?: number } | undefined

    if (layer.u) {
      const layerSvgContent = await getSvgContent(layer.u)
      if (layerSvgContent) {
        // Extract filter preset ID (e.g., 'debossing', 'embossing')
        filterPresetId = extractFilterPresetIdFromSvg(layerSvgContent) ?? undefined
        // Extract filter preset params if present (e.g., { depth: 0.5, angle: 45 })
        filterPresetParams = extractFilterPresetParamsFromSvg(layerSvgContent) ?? undefined
        // Extract fill/stroke colors from the layer's SVG
        const fillStroke = extractFillStrokeFromSvg(layerSvgContent)
        if (fillStroke) {
          styleOptions = {
            fill: fillStroke.fill,
            stroke: fillStroke.stroke,
            strokeWidth: fillStroke.strokeWidth,
          }
        }
      }
    }

    // Upload SVG with complete style transfer (fill/stroke + filter) applied server-side
    const uploadResult = await uploadSvgWithFilterPreset(file, filterPresetId, filterPresetParams, styleOptions)

    // Reset button state after upload
    resetButton()

    if (!uploadResult.success) {
      showErrorModal({
        title: 'Upload error',
        message: uploadResult.error || 'Failed to upload SVG',
        onRetry: () => handleVectorUpload(target, instance, layer, fieldset),
      })
      return
    }

    const printAreaId = fieldset.dataset.printAreaId
    const optionSetId = fieldset.dataset.id

    if (!printAreaId || !optionSetId) {
      console.error('Missing required fieldset attributes')
      return
    }

    // Find the target option set in the product personalizer data
    const { optionSet: targetOptionSet } = getLayerByFieldset(instance, fieldset)

    if (!targetOptionSet) {
      console.error('Target OptionSet not found for vector update.')
      return
    }

    // Get current options list
    let optionsList = (targetOptionSet.ol as unknown as ExtendedImageOption[]) || []
    if (!Array.isArray(optionsList)) {
      optionsList = []
    }

    // Create a new option for the uploaded vector (reuse image_uploaded type)
    const newOptionId = `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const newOption: ExtendedImageOption = {
      l: file.name,
      v: uploadResult.url!,
      i: newOptionId,
      type: 'image_uploaded',
    }

    // Add to options list
    optionsList.push(newOption)
    targetOptionSet.ol = optionsList

    // Save to localStorage
    saveOptionSetListToLocalStorage(instance, fieldset)

    // Update the UI with the new options
    await updateFieldsetUI(fieldset, targetOptionSet, printAreaId, optionSetId, newOptionId, true)

    // Re-render canvas to show the new vector
    await instance.renderCanvas()

    // Trigger set-options event to notify other components
    Transmitter.trigger('tailorkit-set-options')

    // Track event
    trackStorefrontEvent('storefront_upload_vector', {
      file_name: file.name,
      filter_preset: filterPresetId,
      session_id: (window as any).TailorKitPersonalizationSession?.sessionId || '',
    })

    // Find and switch to the appropriate view for this layer
    findViewAndSwitchTo(instance, fieldset)
  }

  input.click()
}
