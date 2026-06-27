import { Modal } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useNavigate } from '@remix-run/react'
import { EPROVIDER } from '~/constants/fulfillment-providers'

const PROVIDER_TOUR_CONGRATULATIONS_MODAL_KEY = MODAL_ID.PROVIDER_TOUR_CONGRATULATIONS_MODAL

export function ModalProviderTourNavigateToDiscovery() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const navigate = useNavigate()

  const isProviderTourCongratulationsModalActive = state[PROVIDER_TOUR_CONGRATULATIONS_MODAL_KEY]?.active

  const onClose = useCallback(() => {
    closeModal(PROVIDER_TOUR_CONGRATULATIONS_MODAL_KEY)
  }, [closeModal])

  const onImportProducts = useCallback(() => {
    // Close modal
    onClose()

    // Navigate to import products page
    const importProductsBtn = document.getElementById(`import-${EPROVIDER.PRINTIFY.toLowerCase()}-products-btn`)
    if (importProductsBtn) {
      importProductsBtn.click()
    }
  }, [onClose])

  const onDiscoveryMore = useCallback(() => {
    // Close modal
    onClose()

    // Navigate to discovery more page
    navigate('/dashboard?goto=tutorials')
  }, [onClose, navigate])

  return (
    <Modal
      title={t('provider-tour-congratulation-title')}
      open={isProviderTourCongratulationsModalActive}
      onClose={onClose}
      primaryAction={{
        content: t('import-products'),
        onAction: onImportProducts,
      }}
      secondaryActions={[
        {
          content: t('discovery-more'),
          onAction: onDiscoveryMore,
        },
      ]}
    >
      <Modal.Section>
        <p>{t('provider-tour-congratulation-description')}</p>
      </Modal.Section>
    </Modal>
  )
}
