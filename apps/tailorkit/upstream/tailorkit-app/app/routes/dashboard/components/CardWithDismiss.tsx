import type { CardProps } from '@shopify/polaris'
import { BlockStack, Box, Button, Card, InlineStack, Link, Popover, Text, Tooltip } from '@shopify/polaris'
import { CheckCircleIcon, XIcon } from '@shopify/polaris-icons'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import FeedbackComponent from '~/modules/Feedback'
import { dismissCardForever } from '../utilities/dismissCardForever'

interface ICardWithDismissProps {
  title?: string | ReactNode
  id?: string
  padding?: CardProps['padding']
  cardName: string
  dismissForever?: boolean
  children: ReactNode
  canDismiss?: boolean
  shouldClearSession?: boolean
  /** Optional background color for the header row (e.g. blue banner) */
  headerBackground?: string
}

export default function CardWithDismiss(props: ICardWithDismissProps) {
  const {
    title,
    children,
    id,
    padding: paddingProp = '400',
    dismissForever = true,
    cardName,
    canDismiss = true,
    shouldClearSession = false,
    headerBackground,
  } = props
  // When headerBackground is set, force padding to '0' so header extends edge-to-edge
  const padding = headerBackground ? ('0' as const) : paddingProp
  const { t } = useTranslation()

  // Create a unique key for sessionStorage based on card name
  const sessionDismissKey = `card-dismissed-session-${cardName}`

  const [popoverActive, setPopoverActive] = useState(false)
  const [isDismiss, setIsDismiss] = useState(false)
  const [closeCard, setCloseCard] = useState(() => {
    // Check if card was dismissed in this session
    return sessionStorage.getItem(sessionDismissKey) === 'true'
  })
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // Clear session storage when shouldClearSession changes to true
  useEffect(() => {
    if (shouldClearSession && closeCard) {
      sessionStorage.removeItem(sessionDismissKey)
      setCloseCard(false)
    }
  }, [shouldClearSession, closeCard, sessionDismissKey])

  // Create a unique key for localStorage based on card name or title
  const feedbackStorageKey = `feedback-submitted-${cardName || title || 'default'}`
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(localStorage.getItem(feedbackStorageKey) === 'true')

  const togglePopover = useCallback(() => setPopoverActive(!popoverActive), [popoverActive])

  const toggleCard = useCallback(() => {
    setIsDismiss(!isDismiss)
  }, [isDismiss])

  const handleCloseCard = useCallback(() => {
    setCloseCard(true)
    // Always save to sessionStorage so the card stays dismissed for this session
    sessionStorage.setItem(sessionDismissKey, 'true')

    if (dismissForever && cardName) {
      dismissCardForever(cardName)
    }
  }, [dismissForever, cardName, sessionDismissKey])

  const handleLeaveFeedback = useCallback(() => {
    // Only allow opening feedback modal if feedback hasn't been submitted yet
    if (!feedbackSubmitted) {
      setShowFeedbackModal(true)
    }
  }, [feedbackSubmitted])

  const handleFeedbackSuccess = useCallback(() => {
    setShowFeedbackModal(false)
    setFeedbackSubmitted(true)
    // Save to localStorage that feedback has been submitted for this card
    localStorage.setItem(feedbackStorageKey, 'true')
    showToast(t(TOAST.FEEDBACK.THANKS))
  }, [t, feedbackStorageKey])

  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false)
  }, [])

  const dismissButton = canDismiss && (
    <Popover
      active={popoverActive}
      activator={
        <div
          style={{
            position: headerBackground ? 'relative' : 'absolute',
            right: !headerBackground && padding === '0' ? '16px' : '0',
            top: !headerBackground && padding === '0' ? '16px' : '0',
          }}
        >
          <Tooltip content={t('dismiss')}>
            <Button variant="tertiary" icon={XIcon} onClick={toggleCard} />
          </Tooltip>
        </div>
      }
      onClose={togglePopover}
    />
  )

  const renderFullCard = headerBackground ? (
    <BlockStack>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          background: headerBackground,
        }}
      >
        {typeof title === 'string' ? (
          <Text as="h4" variant="headingMd" fontWeight="bold">
            {title}
          </Text>
        ) : (
          title
        )}
        {dismissButton}
      </div>
      <Box padding="400">{children}</Box>
    </BlockStack>
  ) : (
    <BlockStack>
      <InlineStack align="space-between">
        {typeof title === 'string' ? (
          <Text as="h4" variant="headingMd" fontWeight="semibold">
            {title}
          </Text>
        ) : (
          title
        )}
        {dismissButton}
      </InlineStack>
      <Box paddingBlockStart={title ? '300' : '0'}>{children}</Box>
    </BlockStack>
  )

  const renderDismissState = (
    <Box padding={padding === '0' ? '400' : undefined}>
      <InlineStack align="space-between">
        <InlineStack blockAlign="center" gap={'100'}>
          <Text as="p" variant="bodyMd">
            {t('you-ve-dismissed-this-card')}
          </Text>
          <Link onClick={toggleCard} removeUnderline>
            {t('undo')}
          </Link>
        </InlineStack>

        <InlineStack align="space-between" blockAlign="center" gap={'200'}>
          <Button
            icon={feedbackSubmitted ? CheckCircleIcon : undefined}
            variant="tertiary"
            onClick={handleLeaveFeedback}
            disabled={feedbackSubmitted}
          >
            {t('leave-feedback')}
          </Button>
          <Button variant="tertiary" icon={XIcon} onClick={handleCloseCard} />
        </InlineStack>
      </InlineStack>
    </Box>
  )

  if (closeCard) {
    return null
  }

  return (
    <>
      <Card padding={padding}>
        <div id={id} style={{ position: 'relative' }}>
          {isDismiss ? renderDismissState : renderFullCard}
        </div>
      </Card>

      {showFeedbackModal && !feedbackSubmitted && (
        <FeedbackComponent
          t={t}
          dataSource={`/api/feedback?formType=${FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK}`}
          displayAs="modal"
          fetchFunction={authenticatedFetch}
          onSuccess={handleFeedbackSuccess}
          onClose={handleFeedbackClose}
          primaryActionContent={t('submit')}
          showSubmitted={false}
          defaultOpen={true}
        />
      )}
    </>
  )
}
