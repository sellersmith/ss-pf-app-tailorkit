import { useCallback } from 'react'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { ELink } from '~/constants/enum'
import { Trans, useTranslation } from 'react-i18next'
import type { ButtonProps } from '@shopify/polaris'
import { BlockStack, Box, Button, InlineStack, Modal, Scrollable, Text } from '@shopify/polaris'
import { useModal } from '~/utils/hooks/useModal'
import { InstallAppBlockActivator } from '~/modules/Onboarding/components/InstallAppBlockOnboardingCard'
import { VintageThemeTailorKitInstallation } from '~/routes/settings.preferences/components/VintageThemeTailorKitInstallation'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

export default function InstallAppBlockModal(props: { appConfig: any; revalidate: () => void }) {
  const { appConfig, revalidate } = props
  const { isOS2Theme } = appConfig || {}
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const modalActive = state[MODALS.DASHBOARD.INSTALL_TAILORKIT_APP_BLOCK_MODAL_ID]?.active

  usePreventPageScroll(modalActive)

  const onHide = useCallback(() => {
    closeModal(MODALS.DASHBOARD.INSTALL_TAILORKIT_APP_BLOCK_MODAL_ID)
  }, [closeModal])

  const renderContent = (
    <Box padding={'400'} paddingBlockEnd={'2000'}>
      {isOS2Theme ? (
        <BlockStack gap={'400'}>
          <video
            controls
            style={{ display: 'block', width: '100%', height: '100%', aspectRatio: '16/9' }}
            poster={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS}
          >
            <source src={ELink.INSTALL_TAILORKIT_APP_BLOCK_VIDEO} type="video/mp4" />
            {t('your-browser-does-not-support-the-video-tag')}
          </video>
          <Box>
            <Trans
              t={t}
              components={{
                b: <strong />,
              }}
            >
              {t('install-app-block-modal-steps-description')}
            </Trans>
          </Box>
          <Text as="p" variant="bodyMd">
            {t(
              'make-sure-to-place-the-tailorkit-app-block-inside-a-product-section-so-the-personalization-box-shows-correctly'
            )}
          </Text>
        </BlockStack>
      ) : (
        <VintageThemeTailorKitInstallation onCloseModal={onHide} />
      )}
    </Box>
  )

  const renderFooter = isOS2Theme && (
    <InstallAppBlockActivator
      appConfig={appConfig}
      showDescription={false}
      showContactSupportButton
      showCommonIssues
      buttonProps={
        {
          variant: 'primary',
          children: t('go-to-theme-editor'),
        } as ButtonProps
      }
      revalidate={revalidate}
      onAfterContactSupport={onHide}
    />
  )

  return (
    <Modal
      open={modalActive}
      size="large"
      title={t('learn-how-to-install-tailorkit-app-block')}
      onClose={onHide}
      noScroll={isOS2Theme}
    >
      <BlockStack>
        <Scrollable style={{ maxHeight: 'calc(100vh - 198px)' }}>{renderContent}</Scrollable>
        <div
          style={{
            borderTop: '1px solid var(--p-color-border)',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px',
            backgroundColor: 'white',
            borderEndEndRadius: 'var(--p-border-radius-400)',
            borderEndStartRadius: 'var(--p-border-radius-400)',
          }}
        >
          <InlineStack align="end" gap="200">
            <Button variant="secondary" onClick={onHide}>
              {t('close')}
            </Button>
            {renderFooter}
          </InlineStack>
        </div>
      </BlockStack>
    </Modal>
  )
}
