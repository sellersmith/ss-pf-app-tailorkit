import { createStore, useStore } from '~/libs/external-store'
import type { TLayerStore } from './layer'

export type LayerStoreSelection = {
  /**
   * State's used for editing option set/style for ONE layer
   */
  clickedLayerStore?: null | TLayerStore

  /**
   * State's used for selecting multiple layer stores on the outline
   */
  checkedLayerStores: TLayerStore[]

  /**
   * State's used for enable or disable interaction of layer
   */
  onInteraction: boolean

  /**
   * State's used for checking layer stores is rotating
   */
  rotating: boolean

  /**
   * State's used for checking layer stores is dragging
   */
  dragging?: boolean
  dragData?: any
}

type Action =
  | {
      type: 'SET_LAYER_STORE_SELECTION'
      payload: {
        clickedLayerStore?: TLayerStore | null
        checkedLayerStores?: TLayerStore[]
        rotating?: boolean
        dragging?: boolean
        dragData?: any
      }
    }
  | {
      type: 'ON_INTERACTION'
      payload: {
        onInteraction: boolean
      }
    }
  | { type: 'RESET_STATE' }

export const DEFAULT_LAYER_STORE_SELECTION_STORE: LayerStoreSelection = {
  clickedLayerStore: null,
  checkedLayerStores: [],
  onInteraction: false,
  rotating: false,
  dragging: false,
  dragData: null,
}

export const LayerStoreSelection = createStore(layerStoreSelectionReducers, DEFAULT_LAYER_STORE_SELECTION_STORE)

function layerStoreSelectionReducers(state: LayerStoreSelection, action: Action) {
  switch (action.type) {
    case 'SET_LAYER_STORE_SELECTION': {
      const { clickedLayerStore, checkedLayerStores, ...otherProps } = action.payload

      return {
        ...state,
        ...(clickedLayerStore !== undefined ? { clickedLayerStore } : {}),
        ...(checkedLayerStores !== undefined ? { checkedLayerStores } : {}),
        ...otherProps,
      }
    }

    case 'ON_INTERACTION':
      return {
        ...state,
        onInteraction: action.payload.onInteraction,
      }

    case 'RESET_STATE':
      return DEFAULT_LAYER_STORE_SELECTION_STORE

    default:
      return state
  }
}

export function useLayerStoreSelection() {
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  return { clickedLayerStore, checkedLayerStores }
}

export function getClickedLayerStore() {
  return LayerStoreSelection.getState().clickedLayerStore
}

export function getCheckedLayerStores() {
  return LayerStoreSelection.getState().checkedLayerStores as TLayerStore[]
}

export function clearAllSelectedLayerStores() {
  LayerStoreSelection.dispatch({ type: 'RESET_STATE' })
}
