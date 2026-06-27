import { Modal } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EActionType } from '~/constants/fetcher-keys'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { showToast } from '~/utils/toastEvents'
import useSaveIntegration from '../../hooks/useSaveIntegration'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { TOAST } from '~/constants/toasts'

export default function ModalConfirmUnpublish(props: { active: boolean; setActive: any }) {
  const { active, setActive } = props
  const { t } = useTranslation()

  const { unpublishIntegration, unpublishing } = useSaveIntegration()

  const toggleModalConfirmUnpublish = useCallback(() => setActive(!active), [active, setActive])

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      onClose={toggleModalConfirmUnpublish}
      title={t('confirm-un-publish')}
      primaryAction={{
        content: t('unpublish'),
        loading: unpublishing,
        onAction: async () => {
          await unpublishIntegration()

          showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_UNPUBLISHED))

          // Set publishedAt to null
          IntegrationStore.dispatch({
            type: 'UPDATE_PUBLISHED_AT',
            payload: {
              publishedAt: null,
            },
            skipTrace: true,
          })

          // Send message to max modal
          sendMessageToMainApp(EActionType.UNPUBLISHED_PRODUCT)

          toggleModalConfirmUnpublish()
        },
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: toggleModalConfirmUnpublish,
        },
      ]}
    >
      <Modal.Section>{t('confirm-un-publish-content')}</Modal.Section>
    </Modal>
  )
}
