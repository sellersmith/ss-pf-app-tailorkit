import { useCallback, useContext } from 'react'
import { TemplateEditorContext } from '../context'
import { cleanupDeletedLayersFromConditionalLogic, duplicateLayers } from '../fns'
import { TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { createLayerStore, getLayerStoreById, markLayerStoreAsDeleted } from '~/stores/modules/layer'
import { ELayerType, EOptionSet } from '~/types/psd'
import type { CharmNodeSettings, CharmSettings } from '~/types/psd'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { deleteCharmInstance } from '../utils/charm-deletion-helper'
import type { TLayerStore } from '~/stores/modules/layer'

export function useLayerActions() {
  const { validationErrors, setValidationErrors } = useContext(TemplateEditorContext)
  const shopDomain = TemplateEditorStore.getState().shopDomain

  const onDuplicateItem = useCallback(
    (id: string) => {
      const layerStore = getLayerStoreById(id)
      const layerState = layerStore.getState()

      const clonedLayers = duplicateLayers({
        layers: [layerState],
        shopDomain,
        validationErrorsContext: {
          validationErrors,
          setValidationErrors,
        },
      })

      const clonedLayer = clonedLayers[0]

      // When duplicating a CHARM_NODE, produce an empty copy:
      // keep settings (display style, label, size) but clear placed charms and fix-point nodes.
      if (layerState.type === ELayerType.CHARM_NODE) {
        const originalSettings = clonedLayer.settings as CharmNodeSettings | undefined
        if (originalSettings) {
          clonedLayer.settings = {
            ...originalSettings,
            nodes: [],
            linkedProducts: (originalSettings.linkedProducts || []).map(p => ({ ...p, transforms: [] })),
          }
        }
      }

      const clonedLayerStore = createLayerStore(clonedLayer)
      TemplateEditorStoreActions.addExtractedLayerStores([clonedLayerStore])

      // Set selection to the new layer
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: clonedLayerStore,
          checkedLayerStores: [],
        },
      })

      return clonedLayerStore.getState()
    },
    [shopDomain, validationErrors, setValidationErrors]
  )

  const onDeleteItem = useCallback((id: string) => {
    const layerStore = getLayerStoreById(id)
    const layer = layerStore.getState()
    const { _id, type } = layer

    // CHARM_NODE deletion: cascade delete all child CHARM layers first
    if (type === ELayerType.CHARM_NODE) {
      const allLayerStores = TemplateEditorStore.getState().extractedLayerStores
      const childCharmStores = (allLayerStores || []).filter((s: TLayerStore) => {
        const st = s.getState()
        return st.type === ELayerType.CHARM && (st.settings as CharmSettings)?.nodeId === _id
      })

      for (const childStore of childCharmStores) {
        // Mark each child charm layer as deleted (soft-delete for undo/redo)
        childStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: { isDeletedOnEditor: true } },
          skipTrace: true,
        })
        TemplateEditorStoreActions.deleteExtractedLayerStores([childStore])
      }

      // Clean up any conditional logic references, then delete the CHARM_NODE itself
      cleanupDeletedLayersFromConditionalLogic([_id], allLayerStores)
      markLayerStoreAsDeleted(_id, true, true)
      TemplateEditorStoreActions.deleteExtractedLayerStores([layerStore])

      const currentChecked = LayerStoreSelection.getState().checkedLayerStores.filter(ls => !!ls)
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: null,
          checkedLayerStores: currentChecked.filter(ls => ls.getState()._id !== _id),
        },
      })
      return
    }

    // CHARM layers need special handling: dispatch DELETE_CHARM_INSTANCE on parent CHARM_NODE
    if (type === ELayerType.CHARM) {
      deleteCharmInstance(layerStore)
      TemplateEditorStoreActions.deleteExtractedLayerStores([layerStore])
      const currentChecked = LayerStoreSelection.getState().checkedLayerStores.filter(ls => !!ls)
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: null,
          checkedLayerStores: currentChecked.filter(ls => ls.getState()._id !== _id),
        },
      })
      return
    }

    if (type === 'multi-layout') {
      const multiLayoutOptionSet = layer.optionSet?.find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)
      const multiLayoutOptionSetData = multiLayoutOptionSet?.data
      const layerIds = multiLayoutOptionSetData
        ? multiLayoutOptionSetData.multi_layout.layouts.map(layout => layout.layerIds).flat()
        : []

      layerIds.forEach(layerId => markLayerStoreAsDeleted(layerId, true, true))
    }

    const allLayerStores = TemplateEditorStore.getState().extractedLayerStores
    cleanupDeletedLayersFromConditionalLogic([_id], allLayerStores)

    markLayerStoreAsDeleted(_id, true, true)
    TemplateEditorStoreActions.deleteExtractedLayerStores([layerStore])

    const currentChecked = LayerStoreSelection.getState().checkedLayerStores.filter(ls => !!ls)
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore: null,
        checkedLayerStores: currentChecked.filter(ls => ls.getState()._id !== _id),
      },
    })
  }, [])

  return { onDuplicateItem, onDeleteItem }
}
