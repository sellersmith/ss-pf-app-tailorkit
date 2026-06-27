import { createStore } from '~/libs/external-store'
import { getLayerStoreById } from '~/stores/modules/layer'
import type { OptionSet } from '~/types/psd'

/**
 * Store for caching original optionSet state when entering preview mode.
 * When exiting preview, we restore the optionSet to remove any preview uploads.
 */
export type IUploadedPreview = Map<string, OptionSet[]>

type CacheOptionSetAction = {
  type: 'CACHE_OPTION_SET'
  payload: { layerId: string; optionSet: OptionSet[] }
}

type ResetOptionSetAction = {
  type: 'RESET_OPTION_SET'
  payload: { layerId: string }
}

type ResetAllAction = {
  type: 'RESET_ALL'
}

type UploadedPreviewAction = CacheOptionSetAction | ResetOptionSetAction | ResetAllAction

const initialState: IUploadedPreview = new Map()

export const UploadedPreviewStore = createStore(uploadedPreviewStoreReducer, initialState)

function uploadedPreviewStoreReducer(state: IUploadedPreview, action: UploadedPreviewAction): IUploadedPreview {
  switch (action.type) {
    case 'CACHE_OPTION_SET': {
      const { layerId, optionSet } = action.payload
      // Only cache if not already cached
      if (!state.has(layerId)) {
        state.set(layerId, optionSet)
      }
      return state
    }

    case 'RESET_OPTION_SET': {
      const { layerId } = action.payload
      const cachedOptionSet = state.get(layerId)

      if (cachedOptionSet) {
        const layerStore = getLayerStoreById(layerId)
        if (layerStore) {
          layerStore.dispatch({
            type: 'UPDATE_LAYER',
            payload: { state: { optionSet: cachedOptionSet } },
            skipTrace: true,
          })
        }
        state.delete(layerId)
      }
      return state
    }

    case 'RESET_ALL':
      return initialState

    default:
      return state
  }
}

function cacheOptionSet(layerId: string, optionSet: OptionSet[]) {
  UploadedPreviewStore.dispatch({
    type: 'CACHE_OPTION_SET',
    payload: { layerId, optionSet },
  })
}

function resetOptionSetForLayer(layerId: string) {
  UploadedPreviewStore.dispatch({
    type: 'RESET_OPTION_SET',
    payload: { layerId },
  })
}

export const uploadedPreviewStoreActions = {
  cacheOptionSet,
  resetOptionSetForLayer,
}
