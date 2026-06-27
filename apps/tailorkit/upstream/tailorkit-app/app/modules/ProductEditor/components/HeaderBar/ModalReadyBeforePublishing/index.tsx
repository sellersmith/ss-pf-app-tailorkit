import { BlockStack, Box, Button, Divider, Icon, InlineStack, Modal, Text } from '@shopify/polaris'
import { Trans, useTranslation } from 'react-i18next'
import ProviderConnectionComponent from './ProviderConnectionComponent'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { EActionType } from '~/constants/fetcher-keys'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { CheckCircleIcon, ConnectIcon, InfoIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback } from 'react'
import { useInstallAppBlock } from '~/hooks/useInstallAppBlock'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'

interface IModalReadyBeforePublishingProps {
  active: boolean
  appConfig?: any
  providerConnectionData: any | null
  loadingContinue: boolean
  setActive: (active: boolean) => void
  revalidateAppConfig: () => void
  onContinue: () => Promise<boolean>
}

export default function ModalReadyBeforePublishing(props: IModalReadyBeforePublishingProps) {
  const {
    active,
    setActive,
    appConfig = {},
    revalidateAppConfig,
    loadingContinue,
    providerConnectionData,
    onContinue,
  } = props
  const { t } = useTranslation()

  const { enabledAppBlock, enabledAppEmbed, customizerLink } = appConfig

  // Use install app block hook
  const { showCountdown, countdown, isChecking, installFailed, onInstallingAppBlock } = useInstallAppBlock({
    customizerLink,
    enabledAppBlock,
    revalidate: revalidateAppConfig,
    appBlockDiagnostics: appConfig.appBlockDiagnostics,
  })

  const onClose = useCallback(() => {
    setActive(false)
    sendMessageToMainApp(EActionType.ABORT_ACTION)
    Transmitter.trigger(EActionType.ABORT_ACTION)
  }, [setActive])

  usePreventPageScroll(active)

  return (
    <Modal
      size="large"
      open={active}
      onClose={onClose}
      title={t('set-up-your-storefront')}
      primaryAction={{
        content: t('continue-to-publish'),
        loading: loadingContinue,
        disabled: !enabledAppEmbed && !enabledAppBlock,
        onAction: onContinue,
      }}
      secondaryActions={[{ content: t('cancel'), onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Step 1: Enable theme extension */}
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {enabledAppEmbed ? t('step-1-theme-extension-enabled') : t('step-1-enable-theme-extension')}
              </Text>
              {!enabledAppEmbed && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t('this-lets-your-store-display-the-personalization-panel-on-product-pages')}
                </Text>
              )}
            </BlockStack>
            <InstallAppEmbedActivator
              appConfig={appConfig}
              showDescription={false}
              revalidate={revalidateAppConfig}
              buttonProps={
                enabledAppEmbed
                  ? undefined
                  : {
                      children: t('enable-theme-extension'),
                    }
              }
            />
          </BlockStack>

          <Divider />

          {/* Step 2: Install app block (optional) */}
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {enabledAppBlock ? t('step-2-app-block-installed') : t('step-2-install-app-block-optional')}
              </Text>
              {!enabledAppBlock && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t(
                    'For the best experience, add the app block to your product page. '
                      + 'If skipped, buyers will see a "Personalize" button instead.'
                  )}
                </Text>
              )}
            </BlockStack>

            {!enabledAppBlock ? (
              <InlineStack gap="200" align="start" blockAlign="center">
                <Button onClick={onInstallingAppBlock} disabled={!customizerLink}>
                  {t('install-app-block')}
                </Button>
                {showCountdown && (
                  <Button variant="monochromePlain" loading={isChecking} disabled>
                    {isChecking
                      ? t('installing')
                      : countdown > 0
                        ? t('installing-countdown-s', { countdown })
                        : t('installing')}
                  </Button>
                )}
                {installFailed && (
                  <Text as="span" variant="bodyMd" tone="caution">
                    {t('could-not-verify-installation-you-can-skip-this-step')}
                  </Text>
                )}
              </InlineStack>
            ) : (
              <InlineStack align="start">
                <Button icon={CheckCircleIcon} disabled variant="primary">
                  {t('installed')}
                </Button>
              </InlineStack>
            )}
          </BlockStack>

          <Divider />

          {/* Info Banner */}
          <Box background="bg-surface-info" padding="300" borderRadius="200" borderColor="border" borderWidth="025">
            <InlineStack gap="200" align="start" wrap={false}>
              <Box>
                <Icon source={InfoIcon} tone="info" />
              </Box>
              <Text as="span" variant="bodyMd">
                <Trans t={t} components={{ b: <strong /> }}>
                  {t(
                    'After publishing, you can unpublish anytime to hide the personalization from your product page. '
                      + "If you duplicated the product, publishing won't affect your original live product."
                  )}
                </Trans>
              </Text>
            </InlineStack>
          </Box>

          {/* Provider Connection Section */}
          {providerConnectionData && (
            <BlockStack gap="200">
              <Divider borderWidth="025" borderColor="border" />
              <InlineStack gap="300" align="start" wrap={false}>
                <Box width="20px">
                  <Icon source={ConnectIcon} />
                </Box>
                <ProviderConnectionComponent
                  required={false}
                  providerConnectionData={providerConnectionData}
                  infoBanner={
                    <Trans t={t} components={{ b: <strong /> }}>
                      {t(
                        'connect-to-printify-now-for-b-automatic-fulfillment-b-of-orders-if-you-don-t-you-ll-need-to-do-it-when-an-order-comes-in'
                      )}
                    </Trans>
                  }
                />
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
