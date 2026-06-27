import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type { LayerDocument } from '~/models/Layer.server'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import { getLayerStoreById, LayerStoreActions } from '~/stores/modules/layer'
import { PSDsStoreActions } from '~/stores/modules/psd'
import { TemplateEditorStoreActions } from '~/stores/modules/template'
import { uuid } from '~/utils/uuid'
import { FILE_UPLOAD_EVENTS } from './constants'
import type { TFileToUpload } from '~/shopify/graphql/files/types'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import {
  prepareLayerImagesForUpload,
  prepareOptionSetImagesForUpload,
} from '~/utils/file-types/prepare-files-to-upload'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { OptionSetActions } from '~/stores/modules/option-set'
import { resetProxyUndoRedo, stage } from '~/libs/steps.client'
import { closeSaveBar } from '~/utils/shopify'
import { getSaveBarId } from '~/stores/modules/template/get-save-bar-id'

const { resetState } = TemplateEditorStoreActions
const { removeAllLayerStore } = LayerStoreActions
const { removeAllOptionSetStore } = OptionSetActions
const { resetState: resetLayerStoreSelectionState } = LayerStoreSelection
const { setProgress, clearProgress } = ProgressStoreActions
const { resetPSDsStore } = PSDsStoreActions

export function resetTemplateEditorStates(skipTrace = false) {
  // Core states
  resetState(skipTrace)
  removeAllLayerStore()
  removeAllOptionSetStore()

  // Other states
  resetLayerStoreSelectionState()
  clearProgress()
  resetPSDsStore()
}

/**
 * Closes the template editor save bar and updates the saved step
 */
export function closeTemplateEditorSaveBarAndUpdateSavedStep(resetUndoRedo = false) {
  closeSaveBar(getSaveBarId())

  stage.savedStep = stage.currentStep

  // Reset undo/redo proxy
  if (resetUndoRedo) {
    resetProxyUndoRedo()
  }
}

export function getControllersOfLayer(layerId: string, allLayers: LayerDocument[]): string[] {
  // Find all layers that control this layer.
  return allLayers.reduce((layerIds: string[], _layer) => {
    const { _id, conditionalLogic } = _layer

    if (conditionalLogic?.controls?.conditions?.find(condition => condition.thenShowOrHideLayers.includes(layerId))) {
      layerIds.push(_id)
    }

    return layerIds
  }, [])
}

/**
 * Clean up references to deleted layers from all conditional logic
 * @param deletedLayerIds - Array of layer IDs that have been deleted
 * @param allLayerStores - All layer stores in the template
 */
export function cleanupDeletedLayersFromConditionalLogic(
  deletedLayerIds: string[],
  allLayerStores: ReturnType<typeof getLayerStoreById>[]
) {
  allLayerStores.forEach(store => {
    const state = store.getState()
    const logic = state.conditionalLogic
    const controls = logic?.controls
    const isControlledBy = logic?.isControlledBy
    let needsUpdate = false
    const updatedLogic: any = { ...logic }

    // Clean up isControlledBy array - remove deleted controllers
    if (logic && isControlledBy?.length) {
      const filteredControlledBy = isControlledBy.filter((id: string) => !deletedLayerIds.includes(id))
      if (filteredControlledBy.length !== isControlledBy.length) {
        updatedLogic.isControlledBy = filteredControlledBy
        needsUpdate = true
      }
    }

    // Clean up thenShowOrHideLayers arrays - remove deleted target layers
    if (controls?.conditions?.length) {
      const updatedConditions = controls.conditions.map((condition: any) => {
        const filteredLayers = condition.thenShowOrHideLayers?.filter(
          (layerId: string) => !deletedLayerIds.includes(layerId)
        )
        if (filteredLayers?.length !== condition.thenShowOrHideLayers?.length) {
          needsUpdate = true
          return {
            ...condition,
            thenShowOrHideLayers: filteredLayers || [],
          }
        }
        return condition
      })

      if (needsUpdate) {
        updatedLogic.controls = {
          ...controls,
          conditions: updatedConditions,
        }
      }
    }

    if (needsUpdate) {
      store.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { conditionalLogic: updatedLogic } },
        skipTrace: true,
      })
    }
  })
}

/**
 * Calculate the rotated bounding box for a single layer
 * When a layer is rotated, we need to find the axis-aligned bounding box
 * that contains all 4 corners of the rotated rectangle
 */
function getRotatedBoundingBox(layerState: LayerDocument): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const { top = 0, left = 0, width = 0, height = 0, rotate = 0 } = layerState

  // If no rotation, return simple bounds
  if (rotate === 0) {
    return {
      minX: left,
      minY: top,
      maxX: left + width,
      maxY: top + height,
    }
  }

  // Calculate center of the layer
  const centerX = left + width / 2
  const centerY = top + height / 2

  // Convert rotation to radians
  const radians = (rotate * Math.PI) / 180

  // Define the 4 corners relative to center
  const corners = [
    { x: left, y: top }, // top-left
    { x: left + width, y: top }, // top-right
    { x: left + width, y: top + height }, // bottom-right
    { x: left, y: top + height }, // bottom-left
  ]

  // Rotate each corner around the center
  const rotatedCorners = corners.map(corner => {
    const dx = corner.x - centerX
    const dy = corner.y - centerY
    return {
      x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
    }
  })

  // Find min/max coordinates
  const xs = rotatedCorners.map(c => c.x)
  const ys = rotatedCorners.map(c => c.y)

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export function getBoundaryOfSelectedLayers(layers: LayerDocument[]): {
  top: number
  left: number
  width: number
  height: number
} {
  const nonGroupLayers = layers.filter((layerState: LayerDocument) => layerState.type !== 'group')

  if (nonGroupLayers.length === 0) {
    return { top: 0, left: 0, width: 0, height: 0 }
  }

  // Calculate rotated bounding box for each layer
  const boundingBoxes = nonGroupLayers.map(getRotatedBoundingBox)

  // Find overall min/max across all layers (using reduce to avoid stack overflow with many layers)
  const minX = boundingBoxes.reduce((min, b) => Math.min(min, b.minX), Infinity)
  const minY = boundingBoxes.reduce((min, b) => Math.min(min, b.minY), Infinity)
  const maxX = boundingBoxes.reduce((max, b) => Math.max(max, b.maxX), -Infinity)
  const maxY = boundingBoxes.reduce((max, b) => Math.max(max, b.maxY), -Infinity)

  return {
    top: minY,
    left: minX,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function refineTopLeftShiftToPreventOffCanvas(params: {
  top: number
  left: number
  topShift: number
  leftShift: number
}) {
  const { top, left } = params
  let { topShift, leftShift } = params

  if (top - topShift < 0) {
    topShift = top
  }

  if (left - leftShift < 0) {
    leftShift = left
  }

  return { topShift, leftShift }
}

export function getTopLeftShiftToCentralizeLayersInCanvas(
  layers: LayerDocument[],
  canvasWidth: number,
  canvasHeight: number
): {
  topShift: number
  leftShift: number
} {
  const { top, left, width, height } = getBoundaryOfSelectedLayers(layers)

  const centralizedLeft = width && Math.max(0, (canvasWidth - width) / 2)
  const centralizedTop = height && Math.max(0, (canvasHeight - height) / 2)

  const topShift = top - centralizedTop
  const leftShift = left - centralizedLeft

  return refineTopLeftShiftToPreventOffCanvas({ top, left, topShift, leftShift })
}

export function getTopLeftShiftToEnsureLayersInsideCanvas(
  layers: LayerDocument[],
  canvasWidth: number,
  canvasHeight: number
): {
  topShift: number
  leftShift: number
} {
  const { top, left, width, height } = getBoundaryOfSelectedLayers(layers)

  const topShift = top + height > canvasHeight ? top + height - canvasHeight : 0
  const leftShift = left + width > canvasWidth ? left + width - canvasWidth : 0

  return refineTopLeftShiftToPreventOffCanvas({ top, left, topShift, leftShift })
}

/**
 * Scales a set of layers uniformly so that their bounding box fits within the canvas.
 * - Only scales down (never scales up)
 * - Optionally recenters the content after scaling
 */
export function scaleLayersToFitCanvas(
  layers: LayerDocument[],
  canvasWidth: number,
  canvasHeight: number,
  options: { centerAfterScale?: boolean } = { centerAfterScale: true }
): LayerDocument[] {
  if (!layers?.length || !canvasWidth || !canvasHeight) return layers

  const { top, left, width, height } = getBoundaryOfSelectedLayers(layers)
  if (!width || !height) return layers

  const scaleX = canvasWidth / width
  const scaleY = canvasHeight / height
  const scaleFactor = Math.min(scaleX, scaleY)

  // Do not scale up if already smaller than canvas
  if (scaleFactor >= 1) {
    // Still make sure content is inside the canvas by centralizing if requested
    if (options.centerAfterScale) {
      const { topShift, leftShift } = getTopLeftShiftToCentralizeLayersInCanvas(layers, canvasWidth, canvasHeight)
      if (topShift !== 0 || leftShift !== 0) {
        return layers.map(layer => ({
          ...layer,
          top: (layer.top || 0) - topShift,
          left: (layer.left || 0) - leftShift,
        }))
      }
    }
    return layers
  }

  // Scale around the bounding box top-left to preserve relative positions,
  // then optionally center the result within the canvas
  const scaled = layers.map(layer => {
    const lt = (layer.top || 0) - top
    const ll = (layer.left || 0) - left
    return {
      ...layer,
      top: top + lt * scaleFactor,
      left: left + ll * scaleFactor,
      width: (layer.width || 0) * scaleFactor,
      height: (layer.height || 0) * scaleFactor,
    }
  })

  if (!options.centerAfterScale) return scaled

  const { topShift, leftShift } = getTopLeftShiftToCentralizeLayersInCanvas(scaled, canvasWidth, canvasHeight)
  if (topShift === 0 && leftShift === 0) return scaled

  return scaled.map(layer => ({
    ...layer,
    top: (layer.top || 0) - topShift,
    left: (layer.left || 0) - leftShift,
  }))
}

/**
 * Removes transform fields (width/height/left/top/rotate) from IMAGE_OPTION files
 * inside each layer's optionSet. Useful after importing or cloning to ensure
 * option-set transforms do not override freshly scaled/positioned layers.
 */
export function clearImageOptionSetTransforms(layers: LayerDocument[]): LayerDocument[] {
  const imageOptionDataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]

  return layers.map(layer => {
    const optionSets = layer.optionSet as Array<any> | undefined
    if (!optionSets?.length) return layer

    const ioIndex = optionSets.findIndex(os => os.type === EOptionSet.IMAGE_OPTION)
    if (ioIndex === -1) return layer

    const imageOption = optionSets[ioIndex]
    const files = imageOption?.data?.[imageOptionDataKey]
    if (!Array.isArray(files)) return layer

    const clearedFiles = files.map(f => {
      const { width, height, left, top, rotate, ...rest } = f || {}
      return rest
    })

    const nextImageOption = {
      ...imageOption,
      data: {
        ...(imageOption?.data || {}),
        [imageOptionDataKey]: clearedFiles,
      },
    }

    const nextOptionSets = [...optionSets]
    nextOptionSets[ioIndex] = nextImageOption

    return { ...layer, optionSet: nextOptionSets }
  })
}

// Interfaces
interface LayerMapping {
  [key: string]: string
}

interface MultiLayoutData {
  layoutSelected: string
  layouts: Array<{
    layerIds: string[]
    [key: string]: any
  }>
}

interface DuplicateLayersArgs {
  layers: LayerDocument[]
  shopDomain: string
  topShift?: number
  leftShift?: number
  shouldUploadImageToShopify?: boolean
  newId?: string
  /**
   * When true (default), generate new option set IDs so the duplicate is fully independent.
   * Pass false to share option set IDs with the source — only legitimate for explicit
   * "share / link" flows. Merchants generally expect duplicate to mean a fresh copy
   * rather than two layers controlled by one shared option set.
   */
  forceNewOptionSetIds?: boolean
  validationErrorsContext?: {
    validationErrors: any
    setValidationErrors: (id: string, dataKey: string, message: string | null) => void
  }
}

/**
 * Handles the processing of multi-layout layers
 * @param optionSet - The option set to process
 * @param layerMapping - Mapping of old to new layer IDs
 * @param layersInMultiLayouts - Array to track layers in multi-layouts
 * @param shopDomain - Current shop domain
 * @returns Processed option set
 */
function processMultiLayout(
  optionSet: any[],
  layerMapping: LayerMapping,
  layersInMultiLayouts: string[],
  shopDomain: string
): any[] {
  return optionSet.map(os => {
    if (!os?.data?.multi_layout) return os

    const newId = uuid()
    layerMapping[os._id] = newId

    const multiLayout = os.data.multi_layout as MultiLayoutData
    return {
      ...os,
      _id: newId,
      shopDomain,
      data: {
        ...os.data,
        multi_layout: {
          ...multiLayout,
          layoutSelected: layerMapping[multiLayout.layoutSelected] || multiLayout.layoutSelected,
          layouts: multiLayout.layouts.map(layout => ({
            ...layout,
            layerIds: layout.layerIds.map(layerId => {
              const newLayerId = layerMapping[layerId] || layerId
              layersInMultiLayouts.push(newLayerId)
              return newLayerId
            }),
          })),
        },
      },
    }
  })
}

/**
 * Handles image processing and upload preparation
 * @param layer - Layer containing image data
 * @param shouldUploadImageToShopify - Whether to upload images
 * @returns Processed image data and files to upload
 */
function processLayerImages(
  layer: LayerDocument,
  shouldUploadImageToShopify: boolean
): { imageData: any; imagesToUpload: TFileToUpload[] } {
  if (!shouldUploadImageToShopify) {
    return { imageData: layer.image, imagesToUpload: [] }
  }

  const { imagesLayerToUpload, imageUpdated } = prepareLayerImagesForUpload({
    layer: { ...layer, image: layer.image },
  })

  return {
    imageData: imageUpdated,
    imagesToUpload: imagesLayerToUpload,
  }
}

/**
 * Duplicates a set of layers while maintaining their relationships and properties
 * @param args - Configuration for layer duplication
 * @returns Array of duplicated layers
 * @throws Error if invalid input is provided
 */
export function duplicateLayers({
  layers,
  shopDomain,
  topShift = 0,
  leftShift = 0,
  shouldUploadImageToShopify = false,
  newId,
  forceNewOptionSetIds = true,
  validationErrorsContext,
}: DuplicateLayersArgs): LayerDocument[] {
  if (!layers?.length || !shopDomain) {
    return []
  }

  const layerMapping: LayerMapping = {}
  const duplicatedLayers: (LayerDocument & { oldId: string })[] = []
  const imagesToUpload: TFileToUpload[] = []
  const layersInMultiLayouts: string[] = []

  layers.forEach((layer: LayerDocument) => {
    layerMapping[layer._id] = uuid()
  })

  // First pass: Create new layers with basic properties
  layers.forEach(({ _id, top = 0, left = 0, label, legacyName, parent, ...rest }) => {
    if (parent && !layerMapping[parent] && newId) {
      layerMapping[parent] = newId
    }

    duplicatedLayers.push({
      ...rest,
      label,
      legacyName,
      _id: layerMapping[_id],
      parent: (parent && layerMapping[parent]) || newId,
      top: top - topShift,
      left: left - leftShift,
      oldId: _id,
    })
  })

  // Second pass: Process relationships and complex properties
  const processedLayers = duplicatedLayers.map(layer => {
    const {
      type,
      optionSet = [],
      conditionalLogic = {},
      image,
      width = 0,
      height = 0,
      oldId: oldLayerId,
      ...rest
    } = layer

    let layerErrors: string[] = []
    let optionSetErrors: string[] = []
    const { validationErrors, setValidationErrors } = validationErrorsContext || {}

    if (validationErrors) {
      const errorKeys = Object.keys(validationErrors)
      layerErrors = errorKeys.filter(key => key.includes(`${oldLayerId}-`) && !key.includes(`${oldLayerId}-optionSet-`))
      optionSetErrors = errorKeys.filter(key => key.includes(`${oldLayerId}-optionSet-`))
    }

    if (layerErrors.length > 0 && typeof setValidationErrors === 'function') {
      layerErrors.forEach(errorKey => {
        const errorMsg = validationErrors[errorKey]
        const prefixPattern = `${oldLayerId}-`

        if (errorKey.startsWith(prefixPattern)) {
          const _errorKey = errorKey.replace(prefixPattern, '')
          setValidationErrors(layer._id, _errorKey, errorMsg)
        }
      })
    }

    // Process option sets
    const processedOptionSet = optionSet.map((os: any) => {
      if (shouldUploadImageToShopify && [EOptionSet.IMAGE_OPTION, EOptionSet.MASK_OPTION].includes(os.type)) {
        const { imagesOptionSetToUpload } = prepareOptionSetImagesForUpload({ optionSet: os })
        imagesToUpload.push(...imagesOptionSetToUpload)
      }
      const optionSetId = os?._id
      const shouldGenerateNewId
        = forceNewOptionSetIds || os?.shopDomain !== shopDomain || layer?.optionSetEditingState?.[os.type]?.editMode
      const newOptionSetId = shouldGenerateNewId ? uuid() : optionSetId

      if (optionSetErrors.length > 0 && typeof setValidationErrors === 'function') {
        optionSetErrors.forEach(errorKey => {
          // The function setValidationErrors auto add the layerId to the error key
          // So we need to remove the old layerId from the error key
          if (errorKey.includes(optionSetId)) {
            const errorMsg = validationErrors[errorKey]
            const _errorKey = errorKey.replaceAll(`${oldLayerId}-`, '').replaceAll(optionSetId, newOptionSetId)
            setValidationErrors(layer._id, _errorKey, errorMsg)
          }
        })
      }

      return {
        ...os,
        shopDomain,
        _id: newOptionSetId,
      }
    })

    // Process multi-layout if applicable
    const finalOptionSet
      = type === 'multi-layout'
        ? processMultiLayout(processedOptionSet, layerMapping, layersInMultiLayouts, shopDomain)
        : processedOptionSet

    // Process images
    const { imageData, imagesToUpload: newImagesToUpload } = processLayerImages(layer, shouldUploadImageToShopify)
    imagesToUpload.push(...newImagesToUpload)

    // Process conditional logic — only keep references to layers that exist in the copy batch.
    // When duplicating a partial chain, stale references to non-duplicated layers must be dropped
    // to prevent "dual controller" conflicts where both original and duplicate control the same target.
    const { controls = {}, isControlledBy = [] } = conditionalLogic as any
    const processedConditions
      = controls.conditions
        ?.map((condition: any) => ({
          ...condition,
          // ifOptionSelected is an option item ID (not a layer ID) — keep as-is
          ifOptionSelected: condition.ifOptionSelected,
          // Only keep target layers that are in the copy batch (remapped to new IDs)
          thenShowOrHideLayers: (condition.thenShowOrHideLayers || [])
            .map((layerId: string) => layerMapping[layerId])
            .filter((id: string | undefined): id is string => !!id),
        }))
        // Drop conditions where all target layers were outside the batch
        .filter((c: any) => c.thenShowOrHideLayers.length > 0) || []
    const processedControls = {
      ...controls,
      conditions: processedConditions,
    }

    // Deep clone settings to avoid shared references between original and duplicated layers
    // This is especially important for overlay data from VectorEditor.
    // For text-customer layers, also reset storefrontOptionSetLabels.text_customer to match
    // the current storefrontLabel — otherwise the duplicate inherits the source layer's
    // option-set label override, which wins at publish time
    // (app/routes/api.integration/layer-preparation-helpers.server.ts:319-326) and ignores
    // any rename the merchant does via the Text inspector on the duplicate.
    const isTextCustomer = type === 'text' && rest.settings?.textCreatedBy === 'customers'
    const clonedSettings = rest.settings
      ? {
          ...rest.settings,
          // Deep clone overlay if it exists
          ...(rest.settings.overlay && {
            overlay: {
              ...rest.settings.overlay,
              // Clone metadata object as well
              ...(rest.settings.overlay.overlayMetadata && {
                overlayMetadata: { ...rest.settings.overlay.overlayMetadata },
              }),
            },
          }),
          ...(isTextCustomer
            && rest.settings.storefrontOptionSetLabels?.text_customer
            && rest.settings.storefrontLabel && {
              storefrontOptionSetLabels: {
                ...rest.settings.storefrontOptionSetLabels,
                text_customer: rest.settings.storefrontLabel,
              },
            }),
        }
      : rest.settings

    return {
      ...rest,
      type,
      optionSet: finalOptionSet,
      conditionalLogic: {
        ...conditionalLogic,
        controls: processedControls,
        // Only keep controller references that are in the copy batch
        isControlledBy: isControlledBy
          .map((layerId: string) => layerMapping[layerId])
          .filter((id: string | undefined): id is string => !!id),
      },
      shopDomain,
      width,
      height,
      image: imageData,
      // Use the deep-cloned settings
      settings: clonedSettings,
    }
  })

  // Handle image upload progress
  if (shouldUploadImageToShopify && imagesToUpload.length > 0) {
    imagesToUpload.forEach((file, index) => {
      Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
        files: [
          {
            _id: file._id,
            file: file,
          },
        ],
      })
      setProgress({ index, total: imagesToUpload.length })
    })

    setTimeout(() => clearProgress(), 50)
  }

  return processedLayers
}

export function getTemplateElementsIncludingMultiLayout(elements: LayerDocument[]) {
  if (elements.length) {
    // Get all layers in multi-layouts if copying multi-layout elements
    const multiLayoutElements: LayerDocument[] = []

    elements.forEach((element: LayerDocument) => {
      const { type, optionSet } = element || {}

      if (type === 'multi-layout') {
        // Get all elements belonging to this multi-layout
        optionSet?.forEach(os => {
          // @ts-ignore
          if (os?.data?.multi_layout) {
            // @ts-ignore
            os.data.multi_layout.layouts.forEach(layout =>
              layout.layerIds.forEach((layerId: string) => {
                if (!elements.find((ls: LayerDocument) => ls._id === layerId)) {
                  multiLayoutElements.push(getLayerStoreById(layerId).getState())
                }
              })
            )
          }
        })
      }
    })

    return Array.from(new Set([...elements, ...multiLayoutElements])).filter(Boolean)
  }

  return elements
}

/**
 * Determines if a layer is visible by checking its visibility and all its parent layers.
 * @param layer - The layer to check
 * @param allLayers - All layers in the template
 * @returns boolean - false if layer or any parent is invisible, true only if all are visible
 */
export const isLayerOfTemplateVisible = (layer: LayerDocument, allLayers: LayerDocument[]): boolean => {
  // Input validation
  if (!layer) {
    return false
  }

  const layerMap = new Map(allLayers.map(l => [l._id, l]))
  const visited = new Set<string>()
  let currentLayer = layer

  while (true) {
    // Check current layer visibility
    if (!currentLayer.visible) {
      return false
    }

    // Reached root layer (no parent) and it's visible
    if (!currentLayer.parent) {
      return true
    }

    // Detect circular reference
    if (visited.has(currentLayer._id)) {
      console.warn(`Circular reference detected in layer hierarchy: ${currentLayer._id}`)
      return false
    }

    visited.add(currentLayer._id)

    // Get and validate parent
    const parentLayer = layerMap.get(currentLayer.parent)
    if (!parentLayer) {
      console.warn(`Parent layer ${currentLayer.parent} not found for layer ${currentLayer._id}`)

      // Initially we return false, but layer can be visible without parent root.
      // It's side effect of the previous implementation.
      // return false
      return true
    }

    currentLayer = parentLayer
  }
}
