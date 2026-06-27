/**
 * Tracking and A/B test analytics for the wizard.
 * Manages wizard/step timing refs and fires analytics events.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useABTestTracking } from '~/hooks/useABTestTracking'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { STEP_NUMBERS } from '../constants'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import type { PublishResult, TemplateType, WizardStep } from '../types'

interface UseWizardTrackingOptions {
  active: boolean
  currentStep: WizardStep
  selectedTemplateType: TemplateType | null
  publishResult: PublishResult | null
  onComplete: () => void
  entryPoint?: string
}

export interface WizardTrackingReturn {
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  wizardStartTimeRef: React.MutableRefObject<number>
  stepStartTimeRef: React.MutableRefObject<number>
  fireWizardCompleted: (action: string) => void
}

export function useWizardTracking({
  active,
  currentStep,
  selectedTemplateType,
  publishResult,
  onComplete,
  entryPoint,
}: UseWizardTrackingOptions): WizardTrackingReturn {
  const { trackEvent } = useEventsTracking()
  const abTracking = useABTestTracking('simplified_product_publish_onboarding', 'treatment')
  const onboardingTracking = useFeatureTracking('simplified_product_publish_onboarding')
  const resolvedEntryPoint = entryPoint || 'unknown'

  const stepStartTimeRef = useRef(Date.now())
  const wizardStartTimeRef = useRef(Date.now())

  // Dedup guard for step 5 completed event (wizard ends at step 5, no departure)
  const step5CompletedRef = useRef(false)

  // Reset timing + fire started events when wizard opens
  useEffect(() => {
    if (active) {
      wizardStartTimeRef.current = Date.now()
      stepStartTimeRef.current = Date.now()
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STARTED, {
        ab_test_group: 'treatment',
        story_variant: 'skip_to_reveal',
        entry_point: resolvedEntryPoint,
      })
      // Mirror legacy start_onboarding event so historical funnel keeps working
      // under the new wizard. Deduped via localStorage (shared with control path).
      if (typeof window !== 'undefined') {
        if (!localStorage.getItem('TLK_ONBOARDING_START_AT')) {
          localStorage.setItem('TLK_ONBOARDING_START_AT', Date.now().toString())
        }
        const STARTED_KEY = 'TLK_STARTED_ONBOARDING'
        if (!localStorage.getItem(STARTED_KEY)) {
          localStorage.setItem(STARTED_KEY, 'true')
          trackEvent(EVENTS_TRACKING.START_ONBOARDING, {
            [EVENTS_PARAMETERS_NAME.VALUE]: 'treatment',
            entry_point: resolvedEntryPoint,
          })
        }
      }
      abTracking.trackDiscovered('onboarding_ab_test')
      abTracking.trackStarted()
      onboardingTracking.trackStarted({ entry_point: resolvedEntryPoint })
    }
  }, [active, trackEvent, abTracking, onboardingTracking, resolvedEntryPoint])

  // Track step views
  useEffect(() => {
    if (active) {
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STEP_VIEWED, {
        step: STEP_NUMBERS[currentStep],
        stepName: currentStep,
      })
      stepStartTimeRef.current = Date.now()
    }
  }, [active, currentStep, trackEvent])

  const fireWizardCompleted = useCallback(
    (action: string) => {
      const totalDurationMs = Date.now() - wizardStartTimeRef.current
      if (!step5CompletedRef.current) {
        step5CompletedRef.current = true
        trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STEP_COMPLETED, {
          step: STEP_NUMBERS[currentStep],
          stepName: currentStep,
          durationMs: Date.now() - stepStartTimeRef.current,
        })
      }
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.COMPLETED, {
        totalDurationMs,
        stepsCompleted: 5,
        action,
      })
      abTracking.trackCompleted(action, {
        template_type: selectedTemplateType,
        product_published: !!publishResult,
        total_duration_ms: totalDurationMs,
      })
      onboardingTracking.trackCompleted(action, Math.round(totalDurationMs / 1000))
      if (action !== 'view_in_editor' && action !== 'view_on_storefront') {
        onComplete()
      }
    },
    [currentStep, selectedTemplateType, publishResult, trackEvent, abTracking, onboardingTracking, onComplete]
  )

  return {
    trackEvent,
    wizardStartTimeRef,
    stepStartTimeRef,
    fireWizardCompleted,
  }
}
