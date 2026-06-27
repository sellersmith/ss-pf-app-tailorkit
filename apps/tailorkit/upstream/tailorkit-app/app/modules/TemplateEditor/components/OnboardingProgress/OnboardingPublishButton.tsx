/**
 * 1-click publish button for onboarding. Always enabled.
 * Shows "Unpublish anytime" reassurance text inline.
 */
import { useCallback } from 'react'
import { Button } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import styles from './onboarding-publish-button.module.css'

interface OnboardingPublishButtonProps {
  onPublish: () => void
  loading: boolean
}

export function OnboardingPublishButton({ onPublish, loading }: OnboardingPublishButtonProps) {
  const { t } = useTranslation()
  const { trackAction } = useFeatureTracking('onboarding_progress_bar')
  const { trackEvent } = useEventsTracking()

  const handlePublish = useCallback(() => {
    // Fire onboarding-specific event
    trackAction('one_click_publish')
    // Fire general app-wide publish event
    trackEvent(EVENTS_TRACKING.PUBLISH_PRODUCT, { source: 'onboarding' })
    onPublish()
  }, [trackAction, trackEvent, onPublish])

  return (
    <div className={styles.container}>
      <Button id="integration-publish-btn" variant="primary" loading={loading} onClick={handlePublish}>
        {t('publish-product')}
      </Button>
      <span className={styles.reassurance}>{t('unpublish-anytime')}</span>
    </div>
  )
}
