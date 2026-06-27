import { useNavigate, useSearchParams } from '@remix-run/react'
import { BlockStack, Text } from '@shopify/polaris'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import { ELink } from '~/constants/enum'
import { useAppConfig } from '~/hooks/useAppConfig'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { useModal } from '~/utils/hooks/useModal'
import CardWithDismiss from './CardWithDismiss'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { MODAL_ID } from '~/constants/modal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import type { CreateFlow } from '~/models/Shop'
import { IntentDiscoverySection } from './intent-discovery-section'

/** DOM id assigned to the Playground card so the first-time variant's tip
 *  link can smooth-scroll the merchant to it. Kept in sync via this constant
 *  rather than a hard-coded string in two places. */
export const PLAYGROUND_CARD_ANCHOR_ID = 'dashboard-playground'

interface SetupGuideCardProps {
  appConfig: {
    userFirstActions?: {
      firstIntegrationPublishedAt?: string
      firstTemplateCreatedAt?: string
    }
    occurredEvents?: Record<string, unknown>
    lastCreateFlow?: CreateFlow | null
  }
}

export default function SetupGuideCard({ appConfig: appConfigProps }: SetupGuideCardProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const tracking = useFeatureTracking('setup_guide_card')

  const { appConfig, fetched } = useAppConfig(appConfigProps)
  const occurredEvents = appConfig?.occurredEvents

  const [searchParams, setSearchParams] = useSearchParams()
  const { state: modalState, openModal } = useModal()

  const modalVideoTutorialActive = modalState[MODAL_ID.SETUP_GUIDE_VIDEO_MODAL]?.active
  const firstIntegrationPublishedAt = occurredEvents?.[CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION]
  const hasCreatedProduct = Boolean(firstIntegrationPublishedAt)

  const handleBeforeFlowInvoke = useCallback(() => {
    trackEvent(EVENTS_TRACKING.SETUP_GUIDE_CREATE_TEMPLATE)
  }, [trackEvent])

  useEffect(() => {
    const shouldOpen = searchParams.get('activeModalVideoTutorial') === 'true'
    if (shouldOpen && !modalVideoTutorialActive) {
      openModal(MODAL_ID.SETUP_GUIDE_VIDEO_MODAL)
      searchParams.delete('activeModalVideoTutorial')
      setSearchParams(searchParams, { replace: true })
    }
  }, [modalVideoTutorialActive, openModal, searchParams, setSearchParams])

  useEffect(() => {
    tracking.trackDiscovered(hasCreatedProduct ? 'returning_variant' : 'intent_discovery_variant')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCreatedProduct])

  return (
    <Fragment>
      <CardWithDismiss
        cardName={OCCURRED_EVENTS.GET_STARTED_CARD_DASHBOARD_DISMISSED}
        dismissForever={false}
        canDismiss={hasCreatedProduct}
        shouldClearSession={fetched && !hasCreatedProduct}
      >
        {hasCreatedProduct ? (
          <ReturningVariant t={t} onBeforeInvoke={handleBeforeFlowInvoke} />
        ) : (
          <FirstTimeVariant t={t} onBeforeInvoke={handleBeforeFlowInvoke} />
        )}
      </CardWithDismiss>

      <VideoModal id={MODAL_ID.SETUP_GUIDE_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS_YOUTUBE)}
          title="Setup Guide Video"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
    </Fragment>
  )
}

// ============================================================================
// Variants
// ============================================================================

interface VariantProps {
  t: (key: string, options?: Record<string, unknown>) => string
  onBeforeInvoke: () => void
}

function FirstTimeVariant({ t, onBeforeInvoke }: VariantProps) {
  const navigate = useNavigate()

  const handleIntentSelect = useCallback(
    (flow: CreateFlow) => {
      onBeforeInvoke()
      navigate(`/dashboard?openCreateFlow=${flow}`)
    },
    [navigate, onBeforeInvoke]
  )

  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h3" variant="headingLg" fontWeight="bold">
          {t('create-your-first-personalized-product')}
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('choose-how-to-get-started-first-product-minutes-away')}
        </Text>
      </BlockStack>
      <IntentDiscoverySection onSelect={handleIntentSelect} />
    </BlockStack>
  )
}

function ReturningVariant({ t, onBeforeInvoke }: VariantProps) {
  const navigate = useNavigate()

  const handleIntentSelect = useCallback(
    (flow: CreateFlow) => {
      onBeforeInvoke()
      navigate(`/dashboard?openCreateFlow=${flow}`)
    },
    [navigate, onBeforeInvoke]
  )

  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h3" variant="headingLg" fontWeight="bold">
          {t('create-another-personalized-product')}
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('what-would-you-like-to-build-next')}
        </Text>
      </BlockStack>
      <IntentDiscoverySection onSelect={handleIntentSelect} />
    </BlockStack>
  )
}
