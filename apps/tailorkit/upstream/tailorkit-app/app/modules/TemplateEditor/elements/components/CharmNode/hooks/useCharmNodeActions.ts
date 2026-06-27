import { useCallback, useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import type { CharmNodeSettings, CharmProductRef, CharmSlotNode } from '~/types/psd'
const MIN_SLOT_LIMIT = 1
const MAX_SLOT_LIMIT = 3

/**
 * Convenience hooks for charm node layer operations.
 * All dispatches go through proxyLayerReducer, so undo/redo is automatic.
 */
export function useCharmNodeActions(layerStore: TLayerStore) {
  const settings = useStore(layerStore, state => state.settings) as CharmNodeSettings | undefined

  const nodes = useMemo(() => settings?.nodes || [], [settings?.nodes])
  const linkedProducts = useMemo(() => settings?.linkedProducts || [], [settings?.linkedProducts])
  const canAddNode = true

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<CharmSlotNode>) => {
      // Enforce slot limit bounds
      if (updates.slotLimit !== undefined) {
        updates.slotLimit = Math.max(MIN_SLOT_LIMIT, Math.min(MAX_SLOT_LIMIT, updates.slotLimit))
      }
      layerStore.dispatch({ type: 'UPDATE_CHARM_SLOT_NODE', payload: { nodeId, updates } })
    },
    [layerStore]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      layerStore.dispatch({ type: 'DELETE_CHARM_SLOT_NODE', payload: { nodeId } })
    },
    [layerStore]
  )

  const reorderNodes = useCallback(
    (reorderedNodes: CharmSlotNode[]) => {
      layerStore.dispatch({ type: 'REORDER_CHARM_SLOT_NODES', payload: { nodes: reorderedNodes } })
    },
    [layerStore]
  )

  const assignCharm = useCallback(
    (nodeId: string, charm: CharmProductRef) => {
      layerStore.dispatch({ type: 'ASSIGN_DEFAULT_CHARM', payload: { nodeId, charm } })
    },
    [layerStore]
  )

  const unassignCharm = useCallback(
    (nodeId: string) => {
      layerStore.dispatch({ type: 'UNASSIGN_DEFAULT_CHARM', payload: { nodeId } })
    },
    [layerStore]
  )

  const addLinkedProduct = useCallback(
    (product: CharmProductRef) => {
      // Avoid duplicates by product ID (charm identity = product, not variant)
      const exists = linkedProducts.some(p => p.shopifyProductId === product.shopifyProductId)
      if (exists) return
      layerStore.dispatch({ type: 'ADD_LINKED_PRODUCT', payload: { product } })
    },
    [layerStore, linkedProducts]
  )

  const removeLinkedProduct = useCallback(
    (productId: string) => {
      layerStore.dispatch({ type: 'REMOVE_LINKED_PRODUCT', payload: { productId } })
    },
    [layerStore]
  )

  return {
    // State
    settings,
    nodes,
    linkedProducts,
    canAddNode,

    // Actions
    updateNode,
    deleteNode,
    reorderNodes,
    assignCharm,
    unassignCharm,
    addLinkedProduct,
    removeLinkedProduct,
  }
}
