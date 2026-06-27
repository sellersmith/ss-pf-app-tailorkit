import { createStore } from '~/libs/external-store'

interface ImageLoadingState {
  isLoading: boolean
  progress: number
}

interface PendingToast {
  layerId: string
  newImageUrl: string
  toastType: 'success' | 'error'
}

interface ImageLoadingStoreState {
  [layerId: string]: ImageLoadingState
}

interface PendingToastStoreState {
  [layerId: string]: PendingToast
}

type ImageLoadingAction =
  | { type: 'SET_IMAGE_LOADING'; payload: { layerId: string; isLoading: boolean; progress: number } }
  | { type: 'CLEAR_IMAGE_LOADING'; payload: { layerId: string } }

type PendingToastAction =
  | { type: 'SET_PENDING_TOAST'; payload: PendingToast }
  | { type: 'CLEAR_PENDING_TOAST'; payload: { layerId: string } }

const imageLoadingReducer = (state: ImageLoadingStoreState, action: ImageLoadingAction): ImageLoadingStoreState => {
  switch (action.type) {
    case 'SET_IMAGE_LOADING':
      return {
        ...state,
        [action.payload.layerId]: {
          isLoading: action.payload.isLoading,
          progress: action.payload.progress,
        },
      }
    case 'CLEAR_IMAGE_LOADING':
      const newState = { ...state }
      delete newState[action.payload.layerId]
      return newState
    default:
      return state
  }
}

const pendingToastReducer = (state: PendingToastStoreState, action: PendingToastAction): PendingToastStoreState => {
  switch (action.type) {
    case 'SET_PENDING_TOAST':
      return {
        ...state,
        [action.payload.layerId]: action.payload,
      }
    case 'CLEAR_PENDING_TOAST':
      const newState = { ...state }
      delete newState[action.payload.layerId]
      return newState
    default:
      return state
  }
}

export const ImageLoadingStore = createStore<ImageLoadingStoreState, ImageLoadingAction>(imageLoadingReducer, {})
export const PendingToastStore = createStore<PendingToastStoreState, PendingToastAction>(pendingToastReducer, {})
