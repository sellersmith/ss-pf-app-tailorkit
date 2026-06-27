import { Banner, BlockStack, Button, Checkbox, Modal, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { EActionType } from '~/constants/fetcher-keys'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { Integration } from '~/types/integration'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { sendMessageToMainApp } from '~/utils/modalEvents'

export default function ModalConfirmPublish(props: {
  modalConfirmPublishActive: boolean
  setModalConfirmPublishActive: any
  publishing: boolean
  onPublish: () => Promise<void>
  draftProducts: any[]
}) {
  const { modalConfirmPublishActive, setModalConfirmPublishActive, publishing, onPublish, draftProducts } = props

  const { t } = useTranslation()
  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  const toggleModalConfirmPublishActive = useCallback(
    () => setModalConfirmPublishActive(!modalConfirmPublishActive),
    [modalConfirmPublishActive, setModalConfirmPublishActive]
  )

  const handleCloseModal = useCallback(() => {
    if (isInTour) return
    toggleModalConfirmPublishActive()
  }, [toggleModalConfirmPublishActive, isInTour])

  const handleCancelPublish = useCallback(() => {
    handleCloseModal()
  }, [handleCloseModal])

  // Prevent page scroll when modal is open
  usePreventPageScroll(modalConfirmPublishActive)

  return (
    <Modal
      open={modalConfirmPublishActive}
      onClose={handleCloseModal}
      title={t('confirm-publish')}
      primaryAction={{
        content: t('publish'),
        id: 'integration-confirm-publish-modal-publish-btn',
        loading: publishing,
        onAction: async () => {
          await onPublish()

          sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)

          toggleModalConfirmPublishActive()
        },
      }}
      secondaryActions={[
        {
          id: 'integration-confirm-publish-modal-cancel-btn',
          content: t('cancel'),
          onAction: handleCancelPublish,
        },
      ]}
      footer={<CheckboxShouldNotShowModalConfirmAgain modalConfirmKey="shouldNotShowModalConfirmPublishAgain" />}
    >
      <Modal.Section>
        <BlockStack id="integration-confirm-publish-modal" gap="200">
          {t('confirm-publish-content-1')}
          {draftProducts.length > 0 && (
            <Banner tone="warning">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {t('fyi-this-integration-has-num-draft-products-these-won-t-be-shown-on-your-storefront', {
                  num: draftProducts.length,
                })}
              </Text>
            </Banner>
          )}
        </BlockStack>
        <div style={{ display: 'none' }}>
          <Button
            id="close-confirm-publish-modal-publish-btn"
            role={TRIGGER_ELEMENT}
            disabled={publishing}
            onClick={() => {
              setModalConfirmPublishActive(false)
            }}
          ></Button>
        </div>
      </Modal.Section>
    </Modal>
  )
}

export function CheckboxShouldNotShowModalConfirmAgain(props: { modalConfirmKey: keyof Integration['config'] }) {
  const { modalConfirmKey } = props

  const { t } = useTranslation()

  const shouldNotShowModalConfirmAgain = useStore(IntegrationStore, state => state.config[modalConfirmKey])

  const handleChange = useCallback(
    (newChecked: boolean) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_SHOULD_NOT_SHOW_MODAL_AGAIN',
        payload: {
          [modalConfirmKey]: newChecked,
        },
        skipTrace: true,
      })
    },
    [modalConfirmKey]
  )

  return <Checkbox label={t('do-not-show-again')} checked={shouldNotShowModalConfirmAgain} onChange={handleChange} />
}
