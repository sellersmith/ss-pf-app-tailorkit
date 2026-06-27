import { useCallback } from 'react'
import type { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import type { IModal, IModals } from '~/stores/modal'
import { modalStore, modalStoreActions } from '~/stores/modal'

const { closeModal: onCloseModal, openModal: onOpenModal, setModalData: onSetModalData } = modalStoreActions

export const useModal = (): {
  state: IModals
  openModal: Function
  closeModal: Function
  setModalData: Function
} => {
  const state = useStore(modalStore, state => state)

  const openModal = useCallback((key: MODAL_ID, data: IModal): void => {
    if (key) {
      onOpenModal(key, data)
    }
  }, [])

  const closeModal = useCallback((key: MODAL_ID): void => {
    if (key) {
      onCloseModal(key)
    }
  }, [])

  const setModalData = useCallback((key: MODAL_ID, data: IModal): void => {
    onSetModalData(key, data)
  }, [])

  return {
    state,
    openModal,
    closeModal,
    setModalData,
  }
}
