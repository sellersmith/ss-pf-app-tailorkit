/**
 * DealWidget
 *
 * Fixed bottom-left widget shown when the $1 first month deal is active.
 * Shows for both V2 trial users and V1 plan users who are deal-eligible.
 *
 * Behavior:
 * - Visible when: deal is active + shop is eligible + not on /pricing + not on onboarding page
 * - Always shows "Switch to a new plan" subtitle (widget only visible to non-subscribers)
 * - Dismissable (reappears on full page reload / new tab)
 *
 * JIRA: EMTLKIT-5304
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from '@remix-run/react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import { FIRST_MONTH_DEAL_DEADLINE } from '~/constants/first-month-deal'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import styles from './styles.module.css'

// Module-level flag: resets on full page reload (new tab / iframe recreation)
// but persists across SPA navigations within the same Shopify session
let dismissedThisSession = false

interface TrialDealWidgetProps extends WithTranslationProps {
  isDealActive?: boolean
  isDealEligible?: boolean
}

function TrialDealWidget({ isDealActive, isDealEligible, t }: TrialDealWidgetProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(dismissedThisSession)
  const { trackDiscovered, trackAction } = useFeatureTracking('first_month_deal')
  const hasTrackedView = useRef(false)

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      trackAction('widget_dismissed')
      dismissedThisSession = true
      setDismissed(true)
    },
    [trackAction]
  )

  const handleClick = useCallback(() => {
    trackAction('widget_clicked')
    navigate('/pricing')
  }, [navigate, trackAction])

  // Hide when: dismissed, deal inactive, shop not eligible, on /pricing, onboarding, or editor
  const isOnPricingPage = location.pathname.startsWith('/pricing')
  const isOnOnboardingPage = new URLSearchParams(location.search).get('onboarding') === 'true'
  const isOnEditorPage
    = location.pathname.startsWith('/personalized-products/') || location.pathname.includes('/templates/modal')
  const shouldShow
    = !dismissed && !!isDealActive && !!isDealEligible && !isOnPricingPage && !isOnOnboardingPage && !isOnEditorPage

  // Track widget view once per session
  useEffect(() => {
    if (shouldShow && !hasTrackedView.current) {
      hasTrackedView.current = true
      trackDiscovered('deal_widget')
    }
  }, [shouldShow, trackDiscovered])

  if (!shouldShow) return null

  return (
    <div
      className={styles.widget}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label={t('subscribe-for-1-view-pricing-plans')}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.trialDays}>{t('switch-to-a-new-plan')}</p>
          <p className={styles.headline}>{t('get-any-plan-for-1-mo')}</p>
          <p className={styles.deadline}>
            {t('1-first-month-ends-date', {
              date: FIRST_MONTH_DEAL_DEADLINE.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            })}
          </p>
        </div>
        {/* Close button: stopPropagation to avoid triggering widget navigation */}
        <button className={styles.closeButton} onClick={handleDismiss} aria-label={t('dismiss-offer')} type="button">
          ✕
        </button>
      </div>

      {/* Decorative CTA label — interaction handled by parent div */}
      <div className={styles.ctaButton} aria-hidden="true">
        {t('subscribe-for-1')}
      </div>
    </div>
  )
}

export default withTranslation(TrialDealWidget)
