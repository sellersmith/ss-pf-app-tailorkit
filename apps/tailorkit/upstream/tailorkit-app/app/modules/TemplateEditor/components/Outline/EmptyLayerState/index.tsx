import { useCallback } from 'react'
import { LogoYoutubeIcon, PlusCircleIcon } from '@shopify/polaris-icons'
import { BlockStack, Box, Button, Text } from '@shopify/polaris'
import { ELink } from '~/constants/enum'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { MODAL_ID } from '~/constants/modal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'
import { useModal } from '~/utils/hooks/useModal'
import { SocialVideo } from '~/components/.client/SocialVideoThumbnail'
import { openInNewTab } from '~/utils/openInNewTab'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import styles from './empty-layer-state.module.css'

export function EmptyLayerState(props: { t: any }) {
  const { t } = props

  const { openModal } = useModal()
  const { openChatBotAndSendUserMessage } = useLiveChat()

  const handleWatchTutorial = useCallback(
    () => openModal(MODAL_ID.TEMPLATE_EDITOR_EMPTY_LAYER_STATE_VIDEO_MODAL),
    [openModal]
  )

  const handleContactUs = useCallback(() => {
    openChatBotAndSendUserMessage("I'd like you to guide me on how to add elements.")
  }, [openChatBotAndSendUserMessage])

  const onAddElements = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
      toolId: 'elements',
    })
  }, [])

  return (
    <>
      <Box paddingBlockStart="400" paddingInline="400">
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('add-elements-to-start-personalizing')}{' '}
            <button className={styles.linkButton} onClick={handleWatchTutorial} type="button">
              {t('watch-tutorial')}
            </button>{' '}
            {t('or')}{' '}
            <button className={styles.linkButton} onClick={handleContactUs} type="button">
              {t('contact-us')}
            </button>{' '}
            {t('for-detailed-guidance')}
          </Text>
          <Button icon={PlusCircleIcon} variant="primary" fullWidth onClick={onAddElements}>
            {t('add-elements')}
          </Button>
        </BlockStack>
      </Box>

      <VideoModal id={MODAL_ID.TEMPLATE_EDITOR_EMPTY_LAYER_STATE_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(ELink.TUTORIAL_ELEMENTS_YOUTUBE)}
          title="Elements Tutorial Video"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
    </>
  )
}

export function VideoCreateTemplateThumbnailWithSocialAction() {
  const onOpenYoutube = useCallback(() => {
    openInNewTab(ELink.LEARN_HOW_TO_CREATE_TEMPLATE_YOUTUBE)
  }, [])

  return (
    <SocialVideo
      videoUrl={ELink.LEARN_HOW_TO_CREATE_TEMPLATE_VIDEO}
      socialAction={{
        label: 'Youtube',
        icon: LogoYoutubeIcon,
        onClick: onOpenYoutube,
      }}
      videoLength={125}
      thumbnailUrl={ELink.LEARN_HOW_TO_CREATE_TEMPLATE}
    />
  )
}
