import { useCallback, useEffect, useRef, useState } from 'react'
import { BlockStack, Button, InlineStack, Text } from '@shopify/polaris'
import { Crisp } from 'crisp-sdk-web'
import { useTranslation } from 'react-i18next'
import CardWithDismiss from '~/routes/dashboard/components/CardWithDismiss'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useReview } from './hooks/useReview'

interface ReviewProps {
  visible?: boolean
  /** @deprecated kept for caller compatibility; no longer rendered. */
  memeImage?: string
  /** Optional source page for tracking; defaults to current pathname. */
  page?: string
}

const APP_STORE_REVIEW_URL = 'https://apps.shopify.com/tailorkit?#modal-show=ReviewListingModal'

const RESULT_CODES_FALLBACK_TO_APP_STORE = new Set([
  'mobile-app',
  'cooldown-period',
  'annual-limit-reached',
  'merchant-ineligible',
  'recently-installed',
  'error',
])

/**
 * In-app App Store review prompt. Uses App Bridge native review modal
 * with App Store URL fallback when native modal is unavailable.
 *
 * Direct neutral CTA, no star/satisfaction gate. Compliant with Shopify
 * review request guidelines.
 */
export default function Review({ visible = true, page }: ReviewProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const {
    shouldShowReviewCard,
    isSubmitting,
    trigger,
    publishedCount,
    hasFirstSale,
    requestShopifyReview,
    markNotNow,
    markNeedHelp,
  } = useReview()
  const [hidden, setHidden] = useState(false)
  const impressionTrackedRef = useRef(false)

  const showCard = shouldShowReviewCard && visible && !hidden
  const sourcePage = page || (typeof window !== 'undefined' ? window.location.pathname : 'unknown')

  useEffect(() => {
    if (!showCard || impressionTrackedRef.current) return
    impressionTrackedRef.current = true
    trackEvent(EVENTS_TRACKING.REVIEW_CARD_SHOWN, {
      trigger,
      published_count: publishedCount,
      has_first_sale: hasFirstSale,
      page: sourcePage,
    })
  }, [showCard, trigger, publishedCount, hasFirstSale, sourcePage, trackEvent])

  const openAppStoreFallback = useCallback(() => {
    trackEvent(EVENTS_TRACKING.REVIEW_FALLBACK_APP_STORE_OPENED, { page: sourcePage })
    window.open(APP_STORE_REVIEW_URL, '_blank', 'noopener,noreferrer')
  }, [sourcePage, trackEvent])

  const handleWriteReview = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.REVIEW_CARD_WRITE_REVIEW_CLICKED, {
      trigger,
      page: sourcePage,
    })
    const result = await requestShopifyReview()
    trackEvent(EVENTS_TRACKING.REVIEW_CARD_NATIVE_RESULT, {
      success: result.success,
      result_code: result.code,
      page: sourcePage,
    })
    // Hide card immediately for terminal states; re-shows after cooldown.
    if (
      result.success
      || result.code === 'already-reviewed'
      || result.code === 'cooldown-period'
      || result.code === 'annual-limit-reached'
    ) {
      setHidden(true)
    }
    if (!result.success && RESULT_CODES_FALLBACK_TO_APP_STORE.has(result.code)) {
      // `cooldown-period` and `annual-limit-reached` are also user-actionable
      // in the App Store, so still offer the public listing as fallback.
      openAppStoreFallback()
    }
  }, [requestShopifyReview, trigger, sourcePage, trackEvent, openAppStoreFallback])

  const handleNotNow = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.REVIEW_CARD_NOT_NOW_CLICKED, { page: sourcePage })
    setHidden(true)
    try {
      await markNotNow()
    } catch (_) {
      // Suppression already applied locally via setHidden.
    }
  }, [markNotNow, sourcePage, trackEvent])

  const handleNeedHelp = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.REVIEW_CARD_NEED_HELP_CLICKED, { page: sourcePage })
    setHidden(true)
    try {
      Crisp.chat.show()
      Crisp.chat.open()
    } catch (_) {
      // Crisp may not be ready; suppression still applies and merchant can
      // reach support via header.
    }
    try {
      await markNeedHelp()
    } catch (_) {}
  }, [markNeedHelp, sourcePage, trackEvent])

  if (!showCard) return null

  return (
    <CardWithDismiss
      title={t('share-your-tailorkit-experience')}
      cardName={OCCURRED_EVENTS.HOW_S_TAILORKIT_WORKING_FOR_YOU_CARD_DASHBOARD_DISMISSED}
      headerBackground="var(--p-color-bg-fill-info, #91d0ff)"
    >
      <BlockStack gap="300">
        <Text variant="bodyMd" as="p">
          {t('if-tailorkit-has-been-useful-an-honest-shopify-app-store-review-helps-other-merchants-decide')}
        </Text>
        <InlineStack gap="200" wrap>
          <Button variant="primary" onClick={handleWriteReview} loading={isSubmitting}>
            {t('write-an-honest-review')}
          </Button>
          <Button onClick={handleNeedHelp} disabled={isSubmitting}>
            {t('need-help-question')}
          </Button>
          <Button variant="tertiary" onClick={handleNotNow} disabled={isSubmitting}>
            {t('not-now')}
          </Button>
        </InlineStack>
      </BlockStack>
    </CardWithDismiss>
  )
}
