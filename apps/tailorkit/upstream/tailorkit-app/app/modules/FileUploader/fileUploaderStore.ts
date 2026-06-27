import { createStore } from '~/libs/external-store'
import type { InvalidFileError, TUploadType } from './constants'

interface State {
  files: File[]
  invalidFiles: InvalidFileError[]
  isUploading: boolean
  fileUploaded: number
  errorMessage: string
}

const initialFileUploadState: State = {
  files: [],
  invalidFiles: [],
  isUploading: false,
  fileUploaded: 0,
  errorMessage: '',
}

const initialState: { [key in TUploadType]: State } = {
  images: {
    ...initialFileUploadState,
  },
  fonts: {
    ...initialFileUploadState,
  },
  masks: {
    ...initialFileUploadState,
  },
}

type Action =
  | { type: 'CLEAR_STATE'; uploadType: TUploadType }
  | { type: 'SET_FILES'; uploadType: TUploadType; files: File[] }
  | { type: 'SET_INVALID_FILES'; uploadType: TUploadType; files: InvalidFileError[]; message: string }
  | { type: 'SET_UPLOAD_PROGRESS'; uploadType: TUploadType; count: number }
  | { type: 'SET_ERROR'; uploadType: TUploadType; message: string }
  | { type: 'SET_UPLOADING'; uploadType: TUploadType; isUploading: boolean }

function reducer(state: { [key in TUploadType]: State }, action: Action): { [key in TUploadType]: State } {
  const { uploadType } = action
  const currentState = state[uploadType]

  switch (action.type) {
    case 'CLEAR_STATE':
      return { ...state, [uploadType]: initialFileUploadState }
    case 'SET_FILES':
      return { ...state, [uploadType]: { ...currentState, files: action.files } }
    case 'SET_INVALID_FILES':
      return {
        ...state,
        [uploadType]: { ...currentState, invalidFiles: action.files, errorMessage: action.message },
      }
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, [uploadType]: { ...currentState, fileUploaded: action.count } }
    case 'SET_ERROR':
      return { ...state, [uploadType]: { ...currentState, errorMessage: action.message } }
    case 'SET_UPLOADING':
      return { ...state, [uploadType]: { ...currentState, isUploading: action.isUploading } }
    default:
      return state
  }
}

export const fileUploadStateStore = createStore(reducer, initialState)
