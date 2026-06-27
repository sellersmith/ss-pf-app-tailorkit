import { useEffect } from 'react'
import type { CharmNodeSettings } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { CharmInstance } from './charm-canvas-types'

interface UseCharmKeyboardHandlerParams {
  previewMode?: boolean
  selectedInstanceIds: Set<string>
  primaryInstanceId: string | null
  charmInstances: CharmInstance[]
  layerStore: TLayerStore
  selectThisLayer: () => void
  selectedImageNodeRef: React.MutableRefObject<any>
}

/** Keyboard navigation (arrows) and delete (Backspace/Delete) for selected charms */
export function useCharmKeyboardHandler({
  previewMode,
  selectedInstanceIds,
  primaryInstanceId,
  charmInstances,
  layerStore,
  selectThisLayer,
  selectedImageNodeRef,
}: UseCharmKeyboardHandlerParams) {
  useEffect(() => {
    if (previewMode || selectedInstanceIds.size === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.stopPropagation()
        const currentSettings = layerStore.getState().settings as CharmNodeSettings
        for (const instanceId of selectedInstanceIds) {
          const product = currentSettings?.linkedProducts?.find(p =>
            p.transforms?.some(t => t.instanceId === instanceId)
          )
          if (!product) continue
          const transform = product.transforms?.find(t => t.instanceId === instanceId)
          layerStore.dispatch({
            type: 'DELETE_CHARM_INSTANCE',
            payload: { productId: product._id, instanceId, deletedTransform: transform, productRef: product },
          })
          const charmLayer = getCharmLayerByInstanceId(instanceId)
          if (charmLayer) {
            charmLayer.dispatch({
              type: 'UPDATE_LAYER',
              payload: { state: { isDeletedOnEditor: true } },
              skipTrace: true,
            })
          }
        }
        selectThisLayer()
        selectedImageNodeRef.current = null
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && primaryInstanceId) {
        e.preventDefault()
        e.stopPropagation()
        const currentIndex = charmInstances.findIndex(c => c.instanceId === primaryInstanceId)
        if (currentIndex === -1) return
        let nextIndex = currentIndex
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % charmInstances.length
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIndex = (currentIndex - 1 + charmInstances.length) % charmInstances.length
        }
        const nextCharm = charmInstances[nextIndex]
        if (!nextCharm) return
        const charmLayer = getCharmLayerByInstanceId(nextCharm.instanceId)
        if (!charmLayer) return
        if (e.shiftKey) {
          const { checkedLayerStores: checked, clickedLayerStore: clicked } = LayerStoreSelection.getState()
          const newChecked = clicked && clicked !== layerStore ? [...checked, clicked] : [...checked]
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: charmLayer, checkedLayerStores: newChecked },
          })
        } else {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: charmLayer, checkedLayerStores: [] },
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    previewMode,
    selectedInstanceIds,
    primaryInstanceId,
    charmInstances,
    layerStore,
    selectThisLayer,
    selectedImageNodeRef,
  ])
}
