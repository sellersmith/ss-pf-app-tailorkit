import { useCallback, useRef } from 'react'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

/**
 * Reusable A/B test tracking hook built on top of useFeatureTracking.
 * Fires standardized 'feature_used' events to Mixpanel with A/B test context.
 *
 * Usage:
 *   const abTracking = useABTestTracking('simplified_product_publish_onboarding', 'treatment')
 *   abTracking.trackStarted()                              // fires feature_used with action='started'
 *   abTracking.trackCompleted('go_to_pricing', 45)         // fires feature_used with action='completed'
 *   abTracking.trackAbandoned('step_3')                    // fires feature_used with action='abandoned'
 *   abTracking.trackResult('completed', { templateType })  // fires feature_used with action='ab_test_result'
 */
export function useABTestTracking(featureName: string, abTestGroup: 'treatment' | 'control') {
  const tracking = useFeatureTracking(featureName)
  const startTimeRef = useRef(Date.now())

  /** Reset the timer (call when the tracked flow actually begins) */
  const resetTimer = useCallback(() => {
    startTimeRef.current = Date.now()
  }, [])

  /** Get elapsed seconds since timer start */
  const getElapsedSeconds = useCallback(() => {
    return Math.round((Date.now() - startTimeRef.current) / 1000)
  }, [])

  /** Track when user first encounters the A/B tested feature */
  const trackDiscovered = useCallback(
    (entryPoint: string) => {
      tracking.trackDiscovered(entryPoint)
    },
    [tracking]
  )

  /** Track when user starts the A/B tested flow */
  const trackStarted = useCallback(
    (extra?: Record<string, unknown>) => {
      startTimeRef.current = Date.now()
      tracking.trackStarted({ ab_test_group: abTestGroup, ...extra })
    },
    [tracking, abTestGroup]
  )

  /** Track when user completes the A/B tested flow */
  const trackCompleted = useCallback(
    (result: string, extra?: Record<string, unknown>) => {
      tracking.trackCompleted(result, getElapsedSeconds())
      tracking.trackAction('ab_test_result', {
        ab_test_group: abTestGroup,
        outcome: 'completed',
        duration_seconds: getElapsedSeconds(),
        ...extra,
      })
    },
    [tracking, abTestGroup, getElapsedSeconds]
  )

  /** Track when user abandons the A/B tested flow */
  const trackAbandoned = useCallback(
    (step: string, extra?: Record<string, unknown>) => {
      tracking.trackAbandoned(step)
      tracking.trackAction('ab_test_result', {
        ab_test_group: abTestGroup,
        outcome: 'abandoned',
        duration_seconds: getElapsedSeconds(),
        ...extra,
      })
    },
    [tracking, abTestGroup, getElapsedSeconds]
  )

  /** Track an error within the A/B tested flow */
  const trackError = useCallback(
    (errorType: string) => {
      tracking.trackError(errorType)
    },
    [tracking]
  )

  /** Track a custom action with A/B context */
  const trackAction = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      tracking.trackAction(action, { ab_test_group: abTestGroup, ...extra })
    },
    [tracking, abTestGroup]
  )

  return {
    trackDiscovered,
    trackStarted,
    trackCompleted,
    trackAbandoned,
    trackError,
    trackAction,
    resetTimer,
    getElapsedSeconds,
  }
}
