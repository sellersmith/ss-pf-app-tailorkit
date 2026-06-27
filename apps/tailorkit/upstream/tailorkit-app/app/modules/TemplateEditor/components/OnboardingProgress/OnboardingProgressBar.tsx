/**
 * Progress bar showing onboarding step completion in the template editor.
 * Renders below UnifiedHeader, full-width. Tracks milestone events via Mixpanel.
 */
import { useEffect, useRef } from 'react'
import { Icon, Tooltip } from '@shopify/polaris'
import { StatusActiveIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import type { NextStepKey, TemplateProgress } from '../../hooks/useTemplateProgress'
import styles from './onboarding-progress-bar.module.css'

const MILESTONES = [33, 67, 100] as const

/** Maps next step keys to user-facing hint text */
const NEXT_STEP_HINTS: Record<NonNullable<NextStepKey>, string> = {
  add_layers: 'Add a design element',
  add_personalization: 'Add personalization to a layer',
  add_mockup: 'Set up a mockup',
}

/** Detailed tooltip descriptions for each next step */
const NEXT_STEP_TOOLTIPS: Record<NonNullable<NextStepKey>, string> = {
  add_layers: 'Click "Add element" in the left panel to add text, images, or shapes to your design',
  add_personalization:
    'Select a layer, then add an option set (text, image, or color) in the right panel so customers can personalize it',
  add_mockup: 'Go to the Mockup tab and upload a base image to show how your product looks in real life',
}

interface OnboardingProgressBarProps {
  progress: TemplateProgress
}

export function OnboardingProgressBar({ progress }: OnboardingProgressBarProps) {
  const { t } = useTranslation()
  const { trackDiscovered, trackAction, trackCompleted } = useFeatureTracking('onboarding_progress_bar')
  const firedMilestones = useRef(new Set<number>())
  const hasTrackedDiscovery = useRef(false)

  const { completedSteps, totalSteps, percentage, nextStep } = progress

  // Track discovery on first render
  useEffect(() => {
    if (!hasTrackedDiscovery.current) {
      hasTrackedDiscovery.current = true
      trackDiscovered('editor_header')
    }
  }, [trackDiscovered])

  // Track milestones (33%, 67%, 100%)
  useEffect(() => {
    for (const milestone of MILESTONES) {
      if (percentage >= milestone && !firedMilestones.current.has(milestone)) {
        firedMilestones.current.add(milestone)
        if (milestone === 100) {
          trackCompleted('all_steps_done')
        } else {
          trackAction('milestone_reached', { percentage: milestone })
        }
      }
    }
  }, [percentage, trackAction, trackCompleted])

  const labelText = `${completedSteps}/${totalSteps} ${t('steps-completed')}`

  return (
    <div className={styles.container}>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={labelText}
      >
        <div className={styles.fill} style={{ width: `${percentage}%` }} />
      </div>
      <span className={styles.label}>{labelText}</span>
      {nextStep ? (
        <Tooltip content={t(NEXT_STEP_TOOLTIPS[nextStep])} dismissOnMouseOut>
          <span className={styles.hint}>
            {t('next')}: {t(NEXT_STEP_HINTS[nextStep])}
          </span>
        </Tooltip>
      ) : (
        <Tooltip content={t('your-product-is-ready-to-go-live-hit-publish-whenever-you-are-ready')} dismissOnMouseOut>
          <span className={styles.complete}>
            <Icon source={StatusActiveIcon} tone="success" />
            {t('all-set-ready-to-publish')}
          </span>
        </Tooltip>
      )}
    </div>
  )
}
