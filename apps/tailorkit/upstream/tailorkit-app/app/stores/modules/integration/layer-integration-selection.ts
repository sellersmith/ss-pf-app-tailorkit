import { createStore, useStore } from '~/libs/external-store'
import type { TLayerIntegrationStore } from './layerIntegration'

export type LayerIntegrationStoreSelectionType = {
  /**
   * State's used for editing option set/style for ONE layer
   */
  clickedLayerStore: null | TLayerIntegrationStore
}

type Action =
  | {
      type: 'SET_LAYER_STORE_SELECTION'
      payload: {
        clickedLayerStore?: any
      }
    }
  | { type: 'RESET_STATE' }

export const DEFAULT_LAYER_INTEGRATION_STORE_SELECTION_STORE: LayerIntegrationStoreSelectionType = {
  clickedLayerStore: null,
}

export const LayerIntegrationStoreSelection = createStore(
  layerStoreSelectionReducers,
  DEFAULT_LAYER_INTEGRATION_STORE_SELECTION_STORE
)

function layerStoreSelectionReducers(state: LayerIntegrationStoreSelectionType, action: Action) {
  switch (action.type) {
    case 'SET_LAYER_STORE_SELECTION': {
      const { clickedLayerStore } = action.payload

      return {
        ...state,
        ...(clickedLayerStore !== undefined ? { clickedLayerStore } : {}),
      }
    }

    case 'RESET_STATE':
      return DEFAULT_LAYER_INTEGRATION_STORE_SELECTION_STORE

    default:
      return state
  }
}

export function useLayerStoreSelection() {
  const layerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)

  return layerStore
}
