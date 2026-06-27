/**
 * Centralized CHARM layer deletion helper.
 *
 * When a CHARM layer is deleted from any path (global keyboard, outline, etc.),
 * we must dispatch DELETE_CHARM_INSTANCE on the parent CHARM_NODE store so that
 * the transforms array stays in sync with the panel's qty display.
 *
 * The canvas keyboard handler (CharmNodeCanvasRenderer) already does this correctly;
 * this helper standardizes it for all other deletion paths.
 */

import { ELayerType, type CharmNodeSettings, type CharmSettings } from '~/types/psd'
import { type TLayerStore, getLayerStoreById } from '~/stores/modules/layer'

/**
 * Delete a CHARM layer properly by also dispatching DELETE_CHARM_INSTANCE
 * on the parent CHARM_NODE store.
 *
 * @param charmLayerStore - The CHARM layer store being deleted
 * @returns true if the charm instance was successfully cleaned up
 */
export function deleteCharmInstance(charmLayerStore: TLayerStore): boolean {
  const state = charmLayerStore.getState()
  if (state.type !== ELayerType.CHARM) return false

  const settings = state.settings as CharmSettings | undefined
  if (!settings?.nodeId || !settings?.productRef) return false

  const { nodeId, productRef } = settings
  const { _id: productId, instanceId } = productRef
  if (!productId || !instanceId) return false

  // Look up parent CHARM_NODE store
  const parentStore = getLayerStoreById(nodeId)
  if (!parentStore) return false

  // Find the full transform and product ref from parent (needed for undo/redo)
  const parentSettings = parentStore.getState().settings as CharmNodeSettings | undefined
  const product = parentSettings?.linkedProducts?.find(p => p._id === productId)
  const transform = product?.transforms?.find(t => t.instanceId === instanceId)

  // Dispatch DELETE_CHARM_INSTANCE on parent CHARM_NODE
  parentStore.dispatch({
    type: 'DELETE_CHARM_INSTANCE',
    payload: {
      productId,
      instanceId,
      deletedTransform: transform,
      productRef: product,
    },
  })

  // Mark CHARM layer as deleted (skipTrace since parent dispatch already traced)
  charmLayerStore.dispatch({
    type: 'UPDATE_LAYER',
    payload: { state: { isDeletedOnEditor: true } },
    skipTrace: true,
  })

  return true
}

/**
 * Check if a layer store is a CHARM type layer
 */
export function isCharmLayer(store: TLayerStore): boolean {
  return store.getState().type === ELayerType.CHARM
}

/**
 * Check if a layer store is a CHARM_NODE type layer
 */
export function isCharmNodeLayer(store: TLayerStore): boolean {
  return store.getState().type === ELayerType.CHARM_NODE
}
