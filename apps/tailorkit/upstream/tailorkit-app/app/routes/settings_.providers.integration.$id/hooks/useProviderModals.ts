import { useState, useCallback } from 'react'

/**
 * Custom hook to manage provider-related modal states
 * @returns Modal states and handlers for provider-related modals
 */

interface IProviderModalsProps {
  importProductsSelector?: boolean
  showUnderstandAboutProvider?: boolean
  confirmChoosePrintify?: boolean
  importWarning?: boolean
  continueImport?: boolean
}

const DEFAULT_MODAL_STATES = {
  importProductsSelector: false,
  showUnderstandAboutProvider: false,
  confirmChoosePrintify: false,
  importWarning: false,
  continueImport: false,
}

export function useProviderModals(props: { initialModalStates?: IProviderModalsProps }) {
  const { initialModalStates } = props
  const [modalStates, setModalStates] = useState({
    ...DEFAULT_MODAL_STATES,
    ...initialModalStates,
  })

  const toggleModal = useCallback((modalKey: keyof typeof modalStates) => {
    setModalStates(prev => ({
      ...prev,
      [modalKey]: !prev[modalKey],
    }))
  }, [])

  return {
    modalStates,
    toggleUnderstandAboutProvider: () => toggleModal('showUnderstandAboutProvider'),
    toggleConfirmChoosePrintify: () => toggleModal('confirmChoosePrintify'),
    toggleImportWarning: () => toggleModal('importWarning'),
    toggleContinueImport: () => toggleModal('continueImport'),
    toggleImportProductSelector: () => toggleModal('importProductsSelector'),
  }
}
