import { Banner, BlockStack, Modal, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EActionType } from '~/constants/fetcher-keys'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { CheckboxShouldNotShowModalConfirmAgain } from './ModalConfirmPublish'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

export default function ModalConfirmRepublishing(props: {
  active: boolean
  setActive: any
  publishing: boolean
  onPublish: () => Promise<void>
  draftProducts: any[]
}) {
  const { onPublish, publishing, draftProducts } = props
  const { t } = useTranslation()

  const { active, setActive } = props

  const toggleModalConfirmRepublishing = useCallback(() => setActive(!active), [active, setActive])

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      onClose={toggleModalConfirmRepublishing}
      title={t('confirm-republish')}
      footer={<CheckboxShouldNotShowModalConfirmAgain modalConfirmKey={'shouldNotShowModalConfirmRePublishAgain'} />}
      primaryAction={{
        content: t('republish'),
        loading: publishing,
        onAction: async () => {
          await onPublish()

          // Send message to max modal
          sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)

          toggleModalConfirmRepublishing()
        },
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: toggleModalConfirmRepublishing,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          {t('confirm-publish-content-3')}
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
      </Modal.Section>
    </Modal>
  )
}
