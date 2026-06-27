import type { MODAL_ID } from '~/constants/modal'
import { createStore } from '~/libs/external-store'

export type IModal = {
  active: boolean
  data?: any
}

export interface IModals {
  [key: string]: IModal
}

type ModalActionTypes = 'OPEN_MODAL' | 'CLOSE_MODAL' | 'SET_MODAL_DATA'

interface ModalAction<T extends ModalActionTypes> {
  type: T
  payload?: any
}

export const modalStore = createStore(modalStoreReducer, {})

function modalStoreReducer(state: IModals, action: ModalAction<ModalActionTypes>) {
  const payload = action.payload

  switch (action.type) {
    case 'OPEN_MODAL':
      return {
        ...state,
        [payload.key]: {
          active: true,
          data: payload.data,
        },
      }
    case 'CLOSE_MODAL':
      return {
        ...state,
        [payload.key]: {
          active: false,
          data: null,
        },
      }
    case 'SET_MODAL_DATA':
      return {
        ...state,
        [payload.key]: {
          ...state[payload.key],
          data: payload.data,
        },
      }
    default:
      return state
  }
}

function openModal(key: MODAL_ID, data?: any) {
  modalStore.dispatch({ type: 'OPEN_MODAL', payload: { key, data } })
}

function closeModal(key: MODAL_ID) {
  modalStore.dispatch({ type: 'CLOSE_MODAL', payload: { key } })
}

function setModalData(key: MODAL_ID, data?: any) {
  modalStore.dispatch({ type: 'SET_MODAL_DATA', payload: { key, data } })
}

export const modalStoreActions = {
  openModal,
  closeModal,
  setModalData,
}
