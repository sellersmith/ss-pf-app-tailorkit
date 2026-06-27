import { useTranslation } from 'react-i18next'
import CardWithDismiss from './CardWithDismiss'
import { BlockStack, Box, Button, InlineStack, Text } from '@shopify/polaris'
import type { ButtonProps } from '@shopify/polaris'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { TOAST } from '~/constants/toasts'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { ELink } from '~/constants/enum'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useCallback, useMemo, useState } from 'react'
import { isWithinWorkingHours } from '~/utils/is-within-working-hours'
import FeedbackComponent from '~/modules/Feedback'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'
import useDevices from '~/utils/hooks/useDevice'

interface IHelpItem {
  thumbnail: string
  title: string
  ctaButton: {
    buttonProps: ButtonProps
  }
}

export default function NeedHelpCard() {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const { openChatBox, openChatBotAndSendUserMessage } = useLiveChat()
  const { isSmallMobileView } = useDevices()

  const expertsOnline = useMemo(() => isWithinWorkingHours(), [])
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const handleOpenFeedbackModal = useCallback(() => {
    setShowFeedbackModal(true)
  }, [])

  const handleCloseFeedbackModal = useCallback(() => {
    setShowFeedbackModal(false)
  }, [])

  const handleFeedbackSuccess = useCallback(() => {
    setShowFeedbackModal(false)
    showToast(t(TOAST.FEEDBACK.THANKS))
  }, [t])

  const helpItems: IHelpItem[] = useMemo<IHelpItem[]>(
    () => [
      {
        thumbnail: ELink.NEED_HELP_CARD_LIVE_PRODUCT_DEMO_THUMBNAIL,
        title: t('live-product-demo'),
        ctaButton: {
          buttonProps: expertsOnline
            ? {
                children: t('contact-expert'),
                variant: 'secondary' as const,
                onClick: () =>
                  openChatBotAndSendUserMessage(t('hi-i-d-like-to-request-a-live-product-demo-for-tailorkit')),
              }
            : {
                children: t('book-a-call'),
                variant: 'secondary' as const,
                url: ELink.BOOK_DEMO_CALL_CALENDLY,
                target: '_blank',
                onClick: () =>
                  trackEvent(EVENTS_TRACKING.BOOK_DEMO_CALL, {
                    [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'need-help-card',
                  }),
              },
        },
      },
      {
        thumbnail: ELink.NEED_HELP_CARD_24_7_LIVE_CHAT_THUMBNAIL,
        title: t('24-7-live-chat'),
        ctaButton: {
          buttonProps: {
            children: t('chat-now'),
            variant: 'secondary',
            onClick: openChatBox,
          },
        },
      },
      {
        thumbnail: ELink.NEED_HELP_CARD_TUTORIALS_THUMBNAIL,
        title: t('tutorials'),
        ctaButton: {
          buttonProps: {
            children: t('watch-now'),
            url: ELink.TAILORKIT_OFFICIAL_YOUTUBE,
            target: '_blank',
            variant: 'secondary',
            onClick: () =>
              trackEvent(EVENTS_TRACKING.VIEW_TUTORIAL, {
                [EVENTS_PARAMETERS_NAME.TUTORIAL_NAME]: 'youtube-channel',
              }),
          },
        },
      },
      {
        thumbnail: ELink.NEED_HELP_CARD_FEEDBACK_AND_REQUEST_THUMBNAIL,
        title: t('feedback-and-request'),
        ctaButton: {
          buttonProps: {
            children: t('submit-now'),
            variant: 'secondary',
            onClick: handleOpenFeedbackModal,
          },
        },
      },
    ],
    [t, trackEvent, openChatBox, handleOpenFeedbackModal, openChatBotAndSendUserMessage, expertsOnline]
  )

  const WrapperComponent = isSmallMobileView ? BlockStack : InlineStack

  return (
    <CardWithDismiss
      title={t('need-help-we-re-here')}
      cardName={OCCURRED_EVENTS.NEED_HELP_CARD_DASHBOARD_DISMISSED}
      dismissForever
    >
      <WrapperComponent align="space-between" wrap={false} gap="300">
        {helpItems.map(item => (
          <InlineStack key={item.title} gap="200">
            <img
              src={item.thumbnail}
              alt={item.title}
              width="60px"
              height="60px"
              style={{ objectFit: 'cover', borderRadius: '50%' }}
            />
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p" fontWeight="semibold">
                {item.title}
              </Text>
              <Box>
                <Button {...item.ctaButton.buttonProps} />
              </Box>
            </BlockStack>
          </InlineStack>
        ))}
      </WrapperComponent>
      {showFeedbackModal && (
        <FeedbackComponent
          t={t}
          dataSource={`/api/feedback?formType=${FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK}`}
          displayAs="modal"
          fetchFunction={authenticatedFetch}
          onSuccess={handleFeedbackSuccess}
          onClose={handleCloseFeedbackModal}
          primaryActionContent={t('submit')}
          showSubmitted={false}
          defaultOpen={true}
          activator={null}
        />
      )}
    </CardWithDismiss>
  )
}
