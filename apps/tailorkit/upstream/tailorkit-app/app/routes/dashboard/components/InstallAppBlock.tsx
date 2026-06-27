import { BlockStack, Box, Button, Card, InlineGrid, InlineStack, Modal, Text, VideoThumbnail } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { Fragment, useCallback, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { ELink } from '~/constants/enum'
//import { openInNewTab } from '~/utils/openInNewTab'

interface IInstallAppBlockCardProps {
  t: TFunction
  appConfig: any
  showCard?: boolean
}

export function InstallAppBlockCard(props: IInstallAppBlockCardProps) {
  const { t, appConfig = {}, showCard = true } = props
  const { enabledAppBlock } = appConfig

  const [active, setActive] = useState(false)

  const handleOpenModal = useCallback(() => setActive(true), [])

  const Wrapper = showCard ? Card : Fragment

  return (
    !enabledAppBlock && (
      <Wrapper>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {t('tailorkit-app-block')}
          </Text>

          <InlineGrid columns={{ xs: 1, sm: 1, md: '1.2fr 1fr' }} gap={'400'}>
            <VideoThumbnail
              videoLength={19}
              onClick={handleOpenModal}
              thumbnailUrl={ELink.INSTALL_TAILORKIT_APP_BLOCK_THUMBNAIL}
            />
            <VideoModalStartedCard active={active} setActive={setActive} />

            <InstallAppBlockDescription appConfig={appConfig} />
          </InlineGrid>
        </BlockStack>
      </Wrapper>
    )
  )
}

export function InstallAppBlockDescription(props: { appConfig: any }) {
  const { appConfig = {} } = props
  const { customizerLink, productThemeLink } = appConfig

  const { t } = useTranslation()

  const { trackEvent } = useEventsTracking()

  return (
    <Box>
      <BlockStack gap={'400'}>
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

        <InlineStack gap={'300'}>
          <Button
            variant="primary"
            onClick={() => {
              trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK)
              window.open(customizerLink)
            }}
          >
            {t('install-app-block')}
          </Button>

          <Button
            onClick={() => {
              trackEvent(EVENTS_TRACKING.VIEW_THEME_EDITOR)
              window.open(productThemeLink)
            }}
          >
            {t('view-theme-editor')}
          </Button>

          {/*<Button onClick={() => openInNewTab(ELink.INSTALL_TAILORKIT_APP_BLOCK)} variant="plain">
        {t('learn-more')}
      </Button>*/}
        </InlineStack>
      </BlockStack>
    </Box>
  )
}

export function VideoModalStartedCard(props: { active: boolean; setActive: (active: boolean) => void }) {
  const { active, setActive } = props

  const { t } = useTranslation()

  const handleCloseModal = useCallback(() => setActive(!active), [active, setActive])

  return (
    <Modal
      noScroll
      open={active}
      titleHidden={true}
      onClose={handleCloseModal}
      title={t('install-tailorkit-app-block-video')}
      size="large"
    >
      <Box minHeight="fit-content" key={t('install-tailorkit-app-block-video')} paddingBlockStart={'1200'}>
        <video controls style={{ display: 'block', width: '100%', height: '100%', aspectRatio: '16/9' }}>
          <source src={ELink.INSTALL_TAILORKIT_APP_BLOCK_VIDEO} type="video/mp4" />
          {t('your-browser-does-not-support-the-video-tag')}
        </video>
      </Box>
    </Modal>
  )
}
