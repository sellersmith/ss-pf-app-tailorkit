import { proxyUndoRedo, stage } from '~/libs/steps.client'
import type { Step } from '~/libs/steps.client'
import { closeSaveBar, openSaveBar } from '~/utils/shopify'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById, getLayerStoreId, getLayerStoreIds, createLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { getSaveBarId } from '~/stores/modules/template/get-save-bar-id'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'

// let selectedElementId = ''
// let timeout = 250

// 50 is the time user can realize the action
// 16 is the time it takes for the user to click on an element
// This is a hack to prevent the undo/redo from being called too quickly
export const USER_INTERACTION_TIME = 50 + 16

/**
 * Check if undo is possible
 */
export const canUndo = (): boolean => {
  return proxyUndoRedo.undo
}

/**
 * Check if redo is possible
 */
export const canRedo = (): boolean => {
  return proxyUndoRedo.redo
}

/**
 * Update undo/redo flags based on current state
 */
const updateUndoRedoFlags = () => {
  proxyUndoRedo.currentStep = stage.currentStep
}

let clickedElementId = ''
let checkedElementIds: string[] = []
const timeout = 50

/**
 * Reset clickedElementId and checkedElementIds
 */
function resetClickedElementIdAndCheckedElementIds() {
  clickedElementId = ''
  checkedElementIds = []
}

/**
 * Update selection with the current element IDs
 */
function updateLayerSelection(clickedId: string, checkedIds: string[]) {
  const resolvedClickedLayerStore = clickedId ? getLayerStoreById(clickedId) : null
  const resolvedCheckedLayerStores = checkedIds.map(id => getLayerStoreById(id)).filter(store => store !== null)

  // Determine the clicked layer store
  const clickedLayerStore = resolvedClickedLayerStore
    ? resolvedClickedLayerStore
    : resolvedCheckedLayerStores.length === 1
      ? resolvedCheckedLayerStores[0]
      : null

  // Only use checked layer stores if there are multiple selections
  const checkedLayerStores = resolvedCheckedLayerStores.length > 1 ? resolvedCheckedLayerStores : []

  setTimeout(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore,
        checkedLayerStores,
      },
    })
  }, timeout)
}

/**
 * Ensure all layer stores exist in the global LayerStores Map.
 * If a store reference exists but is not registered in the Map, recreate it.
 * This is critical for undo/redo operations where stores may have been deleted.
 *
 * @param layerStores - Array of layer store references from step data
 * @returns Array of valid, registered layer stores
 */
function ensureLayerStoresExist(layerStores: TLayerStore[]): TLayerStore[] {
  const ensuredStores: TLayerStore[] = []

  for (let i = 0; i < layerStores.length; i++) {
    const store = layerStores[i]

    if (!store) {
      continue
    }

    try {
      const layerId = getLayerStoreId(store)
      const existingStore = getLayerStoreById(layerId)

      if (existingStore) {
        // Store exists in global Map, use it
        ensuredStores.push(existingStore)
      } else {
        // Store doesn't exist in Map, recreate it from the store's current state
        const layerState = store.getState()
        const recreatedStore = createLayerStore(layerState)
        ensuredStores.push(recreatedStore)
      }
    } catch (error) {
      // Skip invalid stores to prevent crashes
    }
  }

  return ensuredStores
}

/**
 * Find differences between layer store sets and update selection state
 */
function processLayerStoreChanges(fromLayers: TLayerStore[], toLayers: TLayerStore[], isRedo: boolean) {
  // Early return if no difference in layer counts
  if (toLayers.length === fromLayers.length) return

  const isAdding = toLayers.length > fromLayers.length

  // Determine source and target based on addition/removal
  const [sourceLayers, targetLayers] = isAdding ? [fromLayers, toLayers] : [toLayers, fromLayers]

  // Find the layers that differ between source and target
  const sourceIds = getLayerStoreIds(sourceLayers)

  const diff = targetLayers.filter(layerStore => {
    const layerId = getLayerStoreId(layerStore)
    return !sourceIds.includes(layerId)
  })

  // Determine whether to update selection based on redo/undo and add/remove operations
  const shouldUpdateSelection = isRedo ? isAdding : !isAdding

  // Update selection state
  if (shouldUpdateSelection) {
    if (diff.length > 1) {
      checkedElementIds = diff.map(layerStore => getLayerStoreId(layerStore))
      clickedElementId = ''
    } else if (diff.length === 1) {
      clickedElementId = getLayerStoreId(diff[0])
      checkedElementIds = []
    }
  } else {
    checkedElementIds = []
    clickedElementId = ''
  }

  // Update deletion state based on selection
  const isDeleted = !shouldUpdateSelection

  diff.forEach(layerStore => {
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { isDeletedOnEditor: isDeleted } },
      skipTrace: true,
    })
  })

  // If the layer is being removed, we call clearValidationErrors if needed
  if (isDeleted) {
    const layerIds = diff.map(layerStore => getLayerStoreId(layerStore))
    Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, {
      layerIds,
    })
  }
}

/**
 * Handle charm-specific actions during undo
 * Returns true if the action was handled, false otherwise
 */
function handleCharmUndo(step: Step): boolean {
  const { type, fromData, charmMeta } = step

  // Handle INCREMENT_CHARM_QUANTITY undo - need to remove the created CHARM layer
  if (type === 'INCREMENT_CHARM_QUANTITY' && charmMeta?.createdInstanceIds?.length) {
    const charmNodeStore = getLayerStoreById(fromData._id)
    if (charmNodeStore) {
      // Restore the CHARM_NODE to its previous state
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: fromData },
        skipTrace: true,
      })

      // Remove the created CHARM layers
      for (const instanceId of charmMeta.createdInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: true } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  // Handle DECREMENT_CHARM_QUANTITY or DELETE_CHARM_INSTANCE undo - need to recreate the CHARM layer
  if (
    (type === 'DECREMENT_CHARM_QUANTITY' || type === 'DELETE_CHARM_INSTANCE')
    && charmMeta?.removedInstanceIds?.length
  ) {
    const charmNodeStore = getLayerStoreById(fromData._id)
    if (charmNodeStore) {
      // Restore the CHARM_NODE to its previous state
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: fromData },
        skipTrace: true,
      })

      // Restore the removed CHARM layers
      for (const instanceId of charmMeta.removedInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: false } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  // Handle UPDATE_CHARM_MAX undo - restore trimmed CHARM layers (C1 fix)
  if (type === 'UPDATE_CHARM_MAX' && charmMeta?.removedInstanceIds?.length) {
    const charmNodeStore = getLayerStoreById(fromData._id)
    if (charmNodeStore) {
      // Restore the CHARM_NODE to its previous state (with original maxCharms and transforms)
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: fromData },
        skipTrace: true,
      })

      // Restore the trimmed CHARM layers
      for (const instanceId of charmMeta.removedInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: false } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  return false
}

/**
 * Handle charm-specific actions during redo
 * Returns true if the action was handled, false otherwise
 */
function handleCharmRedo(step: Step): boolean {
  const { type, toData, charmMeta } = step

  // Handle INCREMENT_CHARM_QUANTITY redo - restore the created CHARM layer
  if (type === 'INCREMENT_CHARM_QUANTITY' && charmMeta?.createdInstanceIds?.length) {
    const charmNodeStore = getLayerStoreById(toData._id)
    if (charmNodeStore) {
      // Apply the CHARM_NODE state after increment
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: toData },
        skipTrace: true,
      })

      // Restore the created CHARM layers
      for (const instanceId of charmMeta.createdInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: false } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  // Handle DECREMENT_CHARM_QUANTITY or DELETE_CHARM_INSTANCE redo - remove the CHARM layer again
  if (
    (type === 'DECREMENT_CHARM_QUANTITY' || type === 'DELETE_CHARM_INSTANCE')
    && charmMeta?.removedInstanceIds?.length
  ) {
    const charmNodeStore = getLayerStoreById(toData._id)
    if (charmNodeStore) {
      // Apply the CHARM_NODE state after decrement
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: toData },
        skipTrace: true,
      })

      // Remove the CHARM layers again
      for (const instanceId of charmMeta.removedInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: true } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  // Handle UPDATE_CHARM_MAX redo - re-trim the CHARM layers (C1 fix)
  if (type === 'UPDATE_CHARM_MAX' && charmMeta?.removedInstanceIds?.length) {
    const charmNodeStore = getLayerStoreById(toData._id)
    if (charmNodeStore) {
      // Apply the CHARM_NODE state after maxCharms reduction
      charmNodeStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: toData },
        skipTrace: true,
      })

      // Re-mark the trimmed CHARM layers as deleted
      for (const instanceId of charmMeta.removedInstanceIds) {
        const charmLayer = getCharmLayerByInstanceId(instanceId)
        if (charmLayer) {
          charmLayer.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { isDeletedOnEditor: true } },
            skipTrace: true,
          })
        }
      }
    }
    return true
  }

  return false
}

/**
 * Redo the last step
 */
export const redo = () => {
  if (!stage.steps[stage.currentStep + 1]) {
    proxyUndoRedo.currentStep = stage.currentStep
    return
  }

  proxyUndoRedo.isPlayback = true

  let continueProcessing = true
  while (continueProcessing) {
    const step = stage.steps[stage.currentStep + 1]
    if (!step) break

    switch (step.type) {
      case 'SET_EXTRACTED_LAYER_IDS': {
        const { fromData, toData } = step
        const toExtractedLayerStores = toData.extractedLayerStores as TLayerStore[]
        const fromExtractedLayerStores = fromData.extractedLayerStores as TLayerStore[]

        // Ensure all layer stores exist in the global Map before processing
        const ensuredFromStores = ensureLayerStoresExist(fromExtractedLayerStores)
        const ensuredToStores = ensureLayerStoresExist(toExtractedLayerStores)

        processLayerStoreChanges(ensuredFromStores, ensuredToStores, true)

        TemplateEditorStore.dispatch({
          type: 'SET_EXTRACTED_LAYER_IDS',
          payload: {
            extractedLayerStores: ensuredToStores,
          },
          skipTrace: true,
        })

        updateLayerSelection(clickedElementId, checkedElementIds)
        break
      }

      case 'UPDATE_LAYER': {
        const { fromData, toData } = step
        const fromElementId = fromData._id
        const fromStore = getLayerStoreById(fromElementId)

        if (fromStore) {
          fromStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: toData,
            },
            skipTrace: true,
          })

          const layerStoreId = getLayerStoreId(fromStore)
          if (!checkedElementIds.includes(layerStoreId)) {
            checkedElementIds.unshift(layerStoreId)
          }
        }
        break
      }

      case 'SET_NAME': {
        const { toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_NAME',
          payload: { name: toData.name },
          skipTrace: true,
        })
        break
      }

      case 'SET_DIMENSION': {
        const { toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_DIMENSION',
          payload: { dimension: toData.dimension },
          skipTrace: true,
        })
        break
      }

      case 'SET_VIEW_PORT_AND_DIMENSION': {
        const { toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_VIEW_PORT_AND_DIMENSION',
          payload: {
            dimension: toData.dimension,
            viewport: toData.viewport,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_MEASUREMENT_UNIT': {
        const { fromData, toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_MEASUREMENT_UNIT',
          payload: {
            fromUnit: fromData.dimension.measurementUnit,
            toUnit: toData.dimension.measurementUnit,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_RESOLUTION': {
        const { toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_RESOLUTION',
          payload: {
            toResolution: toData.dimension.resolution,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_TEMPLATE_GENERATED_DATA':
      case 'SET_CLIPARTS': {
        const { fromData, toData } = step

        const fromExtractedLayerStores = fromData.extractedLayerStores as TLayerStore[]
        const toExtractedLayerStores = toData.extractedLayerStores as TLayerStore[]

        processLayerStoreChanges(fromExtractedLayerStores, toExtractedLayerStores, true)

        TemplateEditorStore.dispatch({
          type: step.type,
          payload: toData,
          skipTrace: true,
        })

        updateLayerSelection(clickedElementId, checkedElementIds)
        break
      }

      case 'SET_PREVIEW_PRODUCT_IMAGE': {
        const { toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_TEMPLATE_GENERATED_DATA',
          payload: { state: { previewProductImage: toData.previewProductImage } },
          skipTrace: true,
        })
        break
      }

      // Charm Builder actions
      case 'INCREMENT_CHARM_QUANTITY':
      case 'DECREMENT_CHARM_QUANTITY':
      case 'DELETE_CHARM_INSTANCE':
      case 'UPDATE_CHARM_MAX': {
        handleCharmRedo(step)
        break
      }

      default:
        break
    }

    stage.currentStep++
    proxyUndoRedo.currentStep++

    if (stage.currentStep >= 0) {
      const currentStep = stage.steps[stage.currentStep]
      const nextStep = stage.steps[stage.currentStep + 1]

      if (nextStep && Math.abs(nextStep.timeStamp - currentStep.timeStamp) < USER_INTERACTION_TIME) {
        continueProcessing = true
      } else {
        continueProcessing = !nextStep ? false : false
        updateLayerSelection(clickedElementId, checkedElementIds)

        // Reset clickedElementId and checkedElementIds
        resetClickedElementIdAndCheckedElementIds()
      }
    } else {
      continueProcessing = false

      if (stage.savedStep === stage.currentStep) {
        // Close contextual save bar
        closeSaveBar(getSaveBarId())
      } else {
        openSaveBar(getSaveBarId())
      }
    }
  }

  updateUndoRedoFlags()
}

export const undo = () => {
  const step = stage.steps[stage.currentStep]
  if (!step) {
    proxyUndoRedo.currentStep = -1
    return
  }

  proxyUndoRedo.isPlayback = true

  let continueProcessing = true
  while (continueProcessing && stage.currentStep >= 0) {
    const step = stage.steps[stage.currentStep]
    if (!step) break

    switch (step.type) {
      case 'SET_EXTRACTED_LAYER_IDS': {
        const { fromData, toData } = step
        const fromExtractedLayerStores = fromData.extractedLayerStores as TLayerStore[]
        const toExtractedLayerStores = toData.extractedLayerStores as TLayerStore[]

        // Ensure all layer stores exist in the global Map before processing
        const ensuredFromStores = ensureLayerStoresExist(fromExtractedLayerStores)
        const ensuredToStores = ensureLayerStoresExist(toExtractedLayerStores)

        processLayerStoreChanges(ensuredFromStores, ensuredToStores, false)

        TemplateEditorStore.dispatch({
          type: 'SET_EXTRACTED_LAYER_IDS',
          payload: {
            extractedLayerStores: ensuredFromStores,
          },
          skipTrace: true,
        })

        updateLayerSelection(clickedElementId, checkedElementIds)
        break
      }

      case 'UPDATE_LAYER': {
        const { fromData, toData } = step
        const toElementId = toData._id
        const toStore = getLayerStoreById(toElementId)

        if (toStore) {
          toStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: {
              state: fromData,
            },
            skipTrace: true,
          })

          const layerStoreId = getLayerStoreId(toStore)
          if (!checkedElementIds.includes(layerStoreId)) {
            checkedElementIds.push(layerStoreId)
          }
        }
        break
      }

      case 'SET_NAME': {
        const { fromData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_NAME',
          payload: { name: fromData.name },
          skipTrace: true,
        })
        break
      }

      case 'SET_DIMENSION': {
        const { fromData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_DIMENSION',
          payload: { dimension: fromData.dimension },
          skipTrace: true,
        })
        break
      }

      case 'SET_VIEW_PORT_AND_DIMENSION': {
        const { fromData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_VIEW_PORT_AND_DIMENSION',
          payload: {
            dimension: fromData.dimension,
            viewport: fromData.viewport,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_MEASUREMENT_UNIT': {
        const { fromData, toData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_MEASUREMENT_UNIT',
          payload: {
            fromUnit: toData.dimension.measurementUnit,
            toUnit: fromData.dimension.measurementUnit,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_RESOLUTION': {
        const { fromData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_RESOLUTION',
          payload: {
            toResolution: fromData.dimension.resolution,
          },
          skipTrace: true,
        })
        break
      }

      case 'SET_TEMPLATE_GENERATED_DATA':
      case 'SET_CLIPARTS': {
        const { fromData, toData } = step

        const fromExtractedLayerStores = fromData.extractedLayerStores as TLayerStore[]
        const toExtractedLayerStores = toData.extractedLayerStores as TLayerStore[]

        processLayerStoreChanges(fromExtractedLayerStores, toExtractedLayerStores, false)

        TemplateEditorStore.dispatch({
          type: step.type,
          payload: fromData,
          skipTrace: true,
        })

        updateLayerSelection(clickedElementId, checkedElementIds)

        break
      }

      case 'SET_PREVIEW_PRODUCT_IMAGE': {
        const { fromData } = step
        TemplateEditorStore.dispatch({
          type: 'SET_TEMPLATE_GENERATED_DATA',
          payload: { state: { previewProductImage: fromData.previewProductImage } },
          skipTrace: true,
        })
        break
      }

      // Charm Builder actions
      case 'INCREMENT_CHARM_QUANTITY':
      case 'DECREMENT_CHARM_QUANTITY':
      case 'DELETE_CHARM_INSTANCE':
      case 'UPDATE_CHARM_MAX': {
        handleCharmUndo(step)
        break
      }

      default:
        break
    }

    stage.currentStep--
    proxyUndoRedo.currentStep--

    if (stage.currentStep >= 0) {
      const previousStep = stage.steps[stage.currentStep]
      const currentStep = stage.steps[stage.currentStep + 1]

      if (previousStep && Math.abs(currentStep.timeStamp - previousStep.timeStamp) < USER_INTERACTION_TIME) {
        continueProcessing = true
      } else {
        continueProcessing = false
        updateLayerSelection(clickedElementId, checkedElementIds)

        // Reset clickedElementId and checkedElementIds
        resetClickedElementIdAndCheckedElementIds()
      }
    } else {
      continueProcessing = false

      if (stage.savedStep === stage.currentStep) {
        // Close contextual save bar
        closeSaveBar(getSaveBarId())
      } else {
        openSaveBar(getSaveBarId())
      }
    }
  }

  updateUndoRedoFlags()
}

if (typeof window !== 'undefined') {
  window.proxy = proxyUndoRedo
  window.stage = stage

  window.undo = undo
  window.redo = redo
}
