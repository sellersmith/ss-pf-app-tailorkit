import { Button } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { ELink } from '~/constants/enum'
import useDevices from '~/utils/hooks/useDevice'
import CardWithDismiss from '../CardWithDismiss'

/**
 * PublishToEarnBannerCard Component
 *
 * Displays a promotional banner for the Valentine 2026 Publish to Earn campaign.
 * Features:
 * - Responsive hero images (mobile/desktop variants)
 * - Dismissible (persists in sessionStorage for current session only)
 * - Tracks user interactions (modal open, dismiss)
 * - Opens PublishToEarnModal on CTA click
 *
 * @example
 * <PublishToEarnBannerCard />
 */
export default function PublishToEarnBannerCard() {
  const { t } = useTranslation()
  const { openModal } = useModal()
  const { trackEvent } = useEventsTracking()
  const { isMobileView, isSmallDesktopView } = useDevices()

  const handleStartNow = useCallback(() => {
    trackEvent(EVENTS_TRACKING.CLICK_FEATURED_BANNER, {
      [EVENTS_PARAMETERS_NAME.FEATURED_BANNER]: 'pte-banner-card',
    })
    openModal(MODAL_ID.PUBLISH_TO_EARN_MODAL)
  }, [openModal, trackEvent])

  return (
    <CardWithDismiss cardName={'pte-banner-card-dismissed-session'} dismissForever={false} padding={'0'}>
      {/* Background Image */}
      <img
        src={
          isMobileView
            ? ELink.PUBLISH_TO_EARN_HERO_BANNER_IN_DASHBOARD_CARD_MOBILE
            : ELink.PUBLISH_TO_EARN_HERO_BANNER_IN_DASHBOARD_CARD_DESKTOP
        }
        alt={t('publish-to-earn')}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '12px',
          maxHeight: isMobileView ? '188px' : undefined,
          objectFit: 'cover',
        }}
      />

      {/* Start Now Button - Positioned absolutely, responsive positioning */}
      <div
        style={{
          position: 'absolute',
          left: isMobileView ? '5%' : '12%',
          top: isMobileView ? '70%' : isSmallDesktopView ? '64%' : '67%',
        }}
      >
        <Button variant="primary" size={isMobileView ? 'micro' : undefined} onClick={handleStartNow}>
          {t('start-now')}
        </Button>
      </div>
    </CardWithDismiss>
  )
}
