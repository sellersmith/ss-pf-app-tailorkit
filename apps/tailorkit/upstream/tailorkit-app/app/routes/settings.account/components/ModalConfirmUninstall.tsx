import { /*Banner,*/ BlockStack, Box, /*Button,*/ Checkbox, List, Modal, Text } from '@shopify/polaris'
import { useState } from 'react'
import { /*Trans,*/ useTranslation } from 'react-i18next'
import { /*ELink,*/ EModal } from '~/constants/enum'
import { EActionType } from '~/constants/fetcher-keys'
import { TWO_SECONDS } from '~/constants/time'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useModal } from '~/utils/hooks/useModal'
//import { openInNewTab } from '~/utils/openInNewTab'
import { redirectShopifyAdmin } from '~/utils/redirectShopifyAdmin'
import { sleep } from '~/utils/sleep'
import { showToast } from '~/utils/toastEvents'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { TOAST } from '~/constants/toasts'

const POLICY_UNINSTALL = ['your-templates', 'product-mockups', 'order-data']

const UninstallSecondStepModal = () => {
  const { t } = useTranslation()

  const { state, closeModal } = useModal()
  const [isUnderstand, setIsUnderStand] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)

  const handleCloseModal = () => {
    closeModal(EModal.APP_UNINSTALL_MODAL)
  }

  const handleUninstall = async () => {
    try {
      setUninstalling(true)

      // Request to uninstall app
      const res = await authenticatedFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          action: EActionType.UNINSTALL_APP,
        }),
      })

      // Throw error if not success
      if (!res.success) {
        throw new Error(res.message)
      }

      showToast(t(TOAST.COMMON.UNINSTALLED))

      setUninstalling(false)

      // Sleep 2 second for showing toast
      await sleep(TWO_SECONDS)

      // Redirect to admin - setting screen
      redirectShopifyAdmin('/settings')
    } catch (e) {
      setUninstalling(false)

      // Show toast with error message
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    }
  }

  return (
    // Prevent page scroll when modal is open
    (
      usePreventPageScroll(!!state[EModal.APP_UNINSTALL_MODAL]?.active),
      (
        <Modal
          title={t('confirm-uninstallation')}
          open={state[EModal.APP_UNINSTALL_MODAL]?.active}
          onClose={handleCloseModal}
          primaryAction={{
            content: t('uninstall'),
            disabled: !isUnderstand,
            destructive: true,
            loading: uninstalling,
            onAction: handleUninstall,
          }}
          secondaryActions={[{ content: t('cancel'), onAction: handleCloseModal }]}
          footer={
            <Checkbox
              label={t('i-understand-what-im-doing')}
              checked={isUnderstand}
              onChange={v => setIsUnderStand(v)}
            />
          }
        >
          <Box padding={'400'}>
            <BlockStack gap={'300'}>
              {/*<div style={{ whiteSpace: 'pre-line' }}>
            <Text as="p" variant="bodyMd">
              <Trans
                i18nKey="app-uninstall-policy"
                components={[
                  <Button variant="plain" key={'1'} onClick={() => openInNewTab(ELink.SHOPIFY_POLICY_UNINSTALL)} />,
                ]}
              />
            </Text>
          </div>*/}

              <List>
                {POLICY_UNINSTALL.map((policy, index) => (
                  <List.Item key={index}>{t(policy)}</List.Item>
                ))}
              </List>

              <Text as="p" variant="bodyMd">
                {t('app-uninstall-description-2')}
              </Text>

              {/*<Banner title={t('important-notice-regarding-fulfillment-locations-and-shipping-profiles')} tone="warning">
            <Text as="p" variant="bodyMd">
              <Trans
                i18nKey="important-notice-regarding-fulfillment-locations-and-shipping-profiles-description"
                components={[
                  <Button variant="plain" key={'1'} onClick={() => openInNewTab(ELink.UNINSTALL_TAILORKIT)} />,
                ]}
              />
            </Text>
          </Banner>*/}
            </BlockStack>
          </Box>
        </Modal>
      )
    )
  )
}

export default UninstallSecondStepModal
