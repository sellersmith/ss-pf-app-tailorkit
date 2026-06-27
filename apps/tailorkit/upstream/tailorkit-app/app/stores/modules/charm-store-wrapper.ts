/**
 * Charm Store Wrapper
 *
 * Wraps CHARM_NODE layer store dispatch to enhance steps with charm-specific metadata.
 * This keeps charm feature logic out of the core proxyLayerReducer.
 *
 * The wrapper intercepts charm-related actions AFTER they've been processed by the
 * core reducer, then enhances the step that was just added to stage.steps.
 */
import cloneDeep from 'lodash/cloneDeep'
import { stage } from '~/libs/steps.client'
import type { CharmProductRef, CharmTransformInstance, Layer } from '~/types/psd'
import type { TLayerStore } from './layer'
import { getCharmLayerByInstanceId } from './charm-layer-index'

/**
 * Action types that require charm-specific step metadata
 */
const CHARM_STEP_ACTIONS = new Set([
  'INCREMENT_CHARM_QUANTITY',
  'DECREMENT_CHARM_QUANTITY',
  'DELETE_CHARM_INSTANCE',
  'UPDATE_CHARM_MAX',
])

/**
 * Wraps a CHARM_NODE layer store's dispatch to add charm-specific step metadata.
 * Call this once after creating a CHARM_NODE store.
 *
 * @param store - The CHARM_NODE layer store to wrap
 */
export function wrapCharmNodeDispatch(store: TLayerStore): void {
  const originalDispatch = store.dispatch.bind(store)

  store.dispatch = (action: any) => {
    const beforeState = store.getState()

    // Call original dispatch (proxyLayerReducer runs, step is added)
    originalDispatch(action)

    // Post-process: enhance the step that was just added
    if (CHARM_STEP_ACTIONS.has(action.type) && !action.skipTrace) {
      const afterState = store.getState()
      enhanceLastCharmStep(action, beforeState as Layer, afterState as Layer)
    }
  }
}

/**
 * Enhances the most recently added step with charm-specific metadata.
 * This enables proper undo/redo reconstruction of CHARM layers.
 */
function enhanceLastCharmStep(action: { type: string; payload?: any }, beforeState: Layer, afterState: Layer): void {
  const lastStep = stage.steps[stage.steps.length - 1]

  // Verify we're enhancing the correct step
  if (!lastStep || lastStep.type !== action.type) {
    return
  }

  switch (action.type) {
    case 'INCREMENT_CHARM_QUANTITY':
      handleIncrementCharmQuantity(lastStep, action.payload, afterState)
      break
    case 'DECREMENT_CHARM_QUANTITY':
      handleDecrementCharmQuantity(lastStep, action.payload, beforeState)
      break
    case 'DELETE_CHARM_INSTANCE':
      handleDeleteCharmInstance(lastStep, action.payload, beforeState)
      break
    case 'UPDATE_CHARM_MAX':
      handleUpdateCharmMax(lastStep, beforeState, afterState)
      break
  }
}

/**
 * Handles INCREMENT_CHARM_QUANTITY - tracks the newly created transform
 */
function handleIncrementCharmQuantity(step: any, payload: { productId: string }, afterState: Layer): void {
  const linkedProducts = (afterState.settings as any)?.linkedProducts || []
  const product = linkedProducts.find((p: CharmProductRef) => p._id === payload.productId)
  const lastTransform = product?.transforms?.[product.transforms.length - 1]

  if (product && lastTransform) {
    step.charmMeta = {
      createdInstanceIds: [lastTransform.instanceId],
      productId: payload.productId,
      productRef: cloneDeep(product),
      transform: cloneDeep(lastTransform),
      charmNodeId: afterState._id,
    }
  }
}

/**
 * Handles DECREMENT_CHARM_QUANTITY - tracks the removed transform
 */
function handleDecrementCharmQuantity(
  step: any,
  payload: { productId: string; instanceId?: string },
  beforeState: Layer
): void {
  const linkedProducts = (beforeState.settings as any)?.linkedProducts || []
  const product = linkedProducts.find((p: CharmProductRef) => p._id === payload.productId)

  // Find the transform that was removed (either specific instanceId or LIFO)
  const removedTransform = payload.instanceId
    ? product?.transforms?.find((t: CharmTransformInstance) => t.instanceId === payload.instanceId)
    : product?.transforms?.[product.transforms.length - 1]

  // Guard: if product not found in beforeState (e.g., removed between steps),
  // still set charmMeta with available data to prevent orphaned CHARM layers on undo
  if (removedTransform) {
    step.charmMeta = {
      removedInstanceIds: [removedTransform.instanceId],
      productId: payload.productId,
      productRef: product ? cloneDeep(product) : undefined,
      transform: cloneDeep(removedTransform),
      charmNodeId: beforeState._id,
    }
  } else if (payload.instanceId) {
    // Even without finding the transform, record the instanceId so undo can restore the CHARM layer
    step.charmMeta = {
      removedInstanceIds: [payload.instanceId],
      productId: payload.productId,
      productRef: product ? cloneDeep(product) : undefined,
      charmNodeId: beforeState._id,
    }
  }
}

/**
 * Handles DELETE_CHARM_INSTANCE - tracks the deleted instance
 */
function handleDeleteCharmInstance(
  step: any,
  payload: { productId: string; instanceId: string; deletedTransform?: any; productRef?: any },
  beforeState: Layer
): void {
  step.charmMeta = {
    removedInstanceIds: [payload.instanceId],
    productId: payload.productId,
    productRef: payload.productRef ? cloneDeep(payload.productRef) : undefined,
    transform: payload.deletedTransform ? cloneDeep(payload.deletedTransform) : undefined,
    charmNodeId: beforeState._id,
  }
}

/**
 * Handles UPDATE_CHARM_MAX - tracks trimmed transforms and marks CHARM layers as deleted
 */
function handleUpdateCharmMax(step: any, beforeState: Layer, afterState: Layer): void {
  const beforeProducts = ((beforeState.settings as any)?.linkedProducts || []) as CharmProductRef[]
  const afterProducts = ((afterState.settings as any)?.linkedProducts || []) as CharmProductRef[]

  // Find all instanceIds that were trimmed
  const trimmedInstanceIds: string[] = []
  const trimmedTransforms: Array<{ productId: string; transform: CharmTransformInstance }> = []

  for (const beforeProduct of beforeProducts) {
    const afterProduct = afterProducts.find(p => p._id === beforeProduct._id)
    const beforeTransforms = beforeProduct.transforms || []
    const afterTransforms = afterProduct?.transforms || []

    // Find transforms that exist in before but not in after
    for (const bt of beforeTransforms) {
      const stillExists = afterTransforms.some(at => at.instanceId === bt.instanceId)
      if (!stillExists) {
        trimmedInstanceIds.push(bt.instanceId)
        trimmedTransforms.push({ productId: beforeProduct._id, transform: bt })
      }
    }
  }

  if (trimmedInstanceIds.length > 0) {
    step.charmMeta = {
      removedInstanceIds: trimmedInstanceIds,
      trimmedTransforms: cloneDeep(trimmedTransforms),
      charmNodeId: beforeState._id,
    }

    // Mark trimmed CHARM layers as deleted (side effect for data integrity)
    markCharmLayersAsDeleted(trimmedInstanceIds)
  }
}

/**
 * Marks CHARM layers as deleted for the given instanceIds.
 * This ensures data integrity when maxCharms is reduced.
 */
function markCharmLayersAsDeleted(instanceIds: string[]): void {
  for (const instanceId of instanceIds) {
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
