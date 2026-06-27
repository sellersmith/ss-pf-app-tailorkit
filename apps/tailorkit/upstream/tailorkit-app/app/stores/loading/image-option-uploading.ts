import { createStore } from '~/libs/external-store'

export type IImageOptionUploading = {
  imagesUploading: boolean | string
  imageUploading: {
    id: string
    loading: boolean
  }
}

type ImageOptionUploadingActionTypes = 'SET_LOAD_IMAGES' | 'SET_UNLOAD_IMAGES' | 'SET_LOAD_IMAGE' | 'SET_UNLOAD_IMAGE'

interface ImageOptionUploadingAction<T> {
  type: T
  payload?: any
}

export const ImageOptionUploadingStore = createStore(imageOptionUploadingReducer, {
  imagesUploading: false,
  imageUploading: {
    id: '',
    loading: false,
  },
})

function imageOptionUploadingReducer(
  state: IImageOptionUploading,
  action: ImageOptionUploadingAction<ImageOptionUploadingActionTypes>
) {
  const payload = action.payload

  switch (action.type) {
    case 'SET_LOAD_IMAGES':
      return {
        ...state,
        imagesUploading: payload.id,
      }
    case 'SET_UNLOAD_IMAGES':
      return {
        ...state,
        imagesUploading: false,
      }
    case 'SET_LOAD_IMAGE': {
      const id = payload.id
      return {
        ...state,
        imageUploading: {
          id,
          loading: true,
        },
      }
    }

    case 'SET_UNLOAD_IMAGE': {
      const id = payload.id
      return {
        ...state,
        imageUploading: {
          id,
          loading: false,
        },
      }
    }

    default:
      return state
  }
}

function setLoadImages(optionSetId: string) {
  ImageOptionUploadingStore.dispatch({ type: 'SET_LOAD_IMAGES', payload: { id: optionSetId } })
}

function setUnloadImages() {
  ImageOptionUploadingStore.dispatch({ type: 'SET_UNLOAD_IMAGES' })
}

function setLoadImage(id: string) {
  ImageOptionUploadingStore.dispatch({ type: 'SET_LOAD_IMAGE', payload: { id } })
}

function setUnloadImage(id: string) {
  ImageOptionUploadingStore.dispatch({ type: 'SET_UNLOAD_IMAGE', payload: { id } })
}

export const imageOptionUploadingActions = {
  setLoadImages,
  setUnloadImages,
  setLoadImage,
  setUnloadImage,
}
