/**
 * Custom hook for managing modal states in the AddElementsTools component
 */

import { useCallback } from 'react'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'

/**
 * Hook that manages all modal states for element selection dialogs
 */
export function useElementModals() {
  const { state: modalState, openModal, closeModal } = useModal()

  // Image selector modal
  const openImagesDialog = modalState?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.active
  const toggleOpenImagesDialog = useCallback(() => {
    if (openImagesDialog) {
      closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    }
  }, [openImagesDialog, closeModal, openModal])

  // Clipart selector modal
  const openClipartsDialog = modalState?.[MODAL_ID.CLIPART_SELECTOR_MODAL]?.active
  const toggleOpenClipartsDialog = useCallback(() => {
    if (openClipartsDialog) {
      closeModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    }
  }, [openClipartsDialog, closeModal, openModal])

  // PSD selector modal
  const openPSDDialog = modalState?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL]?.active
  const toggleOpenPSDDialog = useCallback(() => {
    if (openPSDDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    }
  }, [openPSDDialog, closeModal, openModal])

  return {
    // Image modal
    openImagesDialog,
    toggleOpenImagesDialog,

    // Clipart modal
    openClipartsDialog,
    toggleOpenClipartsDialog,

    // PSD modal
    openPSDDialog,
    toggleOpenPSDDialog,
  }
}
