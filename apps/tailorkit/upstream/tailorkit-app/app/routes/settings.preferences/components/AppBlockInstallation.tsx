import { Banner, BlockStack, Box, Button, Card, Divider, InlineStack, Modal, Tabs, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { InstallAppBlockCard } from '~/routes/dashboard/components/InstallAppBlock'
import { useModal } from '~/utils/hooks/useModal'
import { VintageThemeTailorKitInstallation } from './VintageThemeTailorKitInstallation'
import { useSearchParams } from '@remix-run/react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

const MODAL_ID = 'app-block-installation'

function AppBlockInstallation(props: { appConfig: any }) {
  const { t } = useTranslation()
  const { appConfig } = props
  const { productThemeLink } = appConfig || {}
  const { openModal } = useModal()

  const { trackEvent } = useEventsTracking()

  const onOpenModal = useCallback(() => {
    trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK)
    openModal(MODAL_ID)
  }, [openModal, trackEvent])

  return (
    <SettingLayout title={t('app-block-installation')}>
      <BlockStack>
        <Card>
          <BlockStack gap={'400'}>
            <BlockStack gap={'200'}>
              <Text as="span" variant="bodyMd">
                <Trans
                  t={t}
                  components={{
                    b: (
                      <Text as="span" variant="bodyMd" fontWeight="bold">
                        {t('add-block-apps-tailorkit')}
                      </Text>
                    ),
                  }}
                >
                  {t('install-app-block-description')}
                </Trans>
              </Text>
            </BlockStack>
            <InlineStack gap={'200'} align="end">
              <Button
                onClick={() => {
                  trackEvent(EVENTS_TRACKING.VIEW_THEME_EDITOR)
                  window.open(productThemeLink)
                }}
              >
                {t('view-theme-editor')}
              </Button>
              <Button variant="primary" onClick={onOpenModal}>
                {t('install-app-block')}
              </Button>
            </InlineStack>
            <ModalInstallAppBlock appConfig={appConfig} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SettingLayout>
  )
}

export default AppBlockInstallation

export function ModalInstallAppBlock(props: { appConfig: any }) {
  const { t } = useTranslation()
  const { appConfig } = props
  const { productThemeLink } = appConfig || {}
  const { state, openModal, closeModal } = useModal()
  const active = state[MODAL_ID]?.active

  const [selected, setSelected] = useState(0)

  const onCloseModal = useCallback(() => {
    closeModal(MODAL_ID)
  }, [closeModal])

  const handleTabChange = useCallback((selectedTabIndex: number) => setSelected(selectedTabIndex), [])

  const tabs = useMemo(
    () => [
      {
        id: 'os2',
        content: t('os-2-0-theme'),
        accessibilityLabel: t('os-2-0-theme'),
        panelID: 'os2-content-1',
      },
      {
        id: 'vintage-theme-and-page-builder',
        content: t('vintage-theme-and-page-builder'),
        panelID: 'vintage-theme-and-page-builder-content-1',
      },
    ],
    [t]
  )

  const [searchParams] = useSearchParams()
  const featureImageContainer = searchParams.get('featureImageContainer')

  useEffect(() => {
    if (featureImageContainer) {
      setSelected(1)
      openModal(MODAL_ID)
    }
  }, [featureImageContainer, openModal])

  return (
    // Prevent page scroll when modal is open
    (
      usePreventPageScroll(!!active),
      (
        <Modal
          title={t('install-app-block')}
          size="large"
          open={active}
          onClose={onCloseModal}
          secondaryActions={[
            {
              content: t('close'),
              onAction: onCloseModal,
            },
          ]}
        >
          <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
            <Divider />
            <Box padding={'400'}>
              {selected === 0 ? (
                !appConfig?.enabledAppBlock ? (
                  <InstallAppBlockCard t={t} appConfig={appConfig} showCard={false} />
                ) : (
                  <Banner
                    tone="info"
                    title={t('you-have-installed-tailorkit-app-block-already')}
                    action={{
                      content: t('view-theme-editor'),
                      onAction: () => {
                        window.open(productThemeLink)
                      },
                    }}
                  />
                )
              ) : (
                <VintageThemeTailorKitInstallation onCloseModal={onCloseModal} />
              )}
            </Box>
          </Tabs>
        </Modal>
      )
    )
  )
}
