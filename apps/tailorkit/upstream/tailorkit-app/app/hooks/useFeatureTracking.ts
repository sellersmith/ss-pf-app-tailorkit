import { useCallback } from 'react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useRootLoaderData } from '~/root'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { getLifecycleStage, getDaysSinceInstall } from '~/bootstrap/fns/lifecycle-stage'

/**
 * Client-side feature adoption tracking hook.
 * Fires standardized 'feature_used' events with lifecycle context.
 *
 * Usage:
 *   const tracking = useFeatureTracking('mockup_wizard')
 *   tracking.trackDiscovered('dashboard_card')
 *   tracking.trackCompleted('applied', 45)
 */
export function useFeatureTracking(featureName: string) {
  const { trackEvent } = useEventsTracking()
  const { shopData } = useRootLoaderData()

  const getBaseProps = useCallback(() => {
    const createdAt = shopData?.createdAt
    const firstPublished = shopData?.usages?.firstIntegrationPublishedAt
    const revenue = shopData?.usages?.appGeneratedRevenue

    return {
      feature_name: featureName,
      lifecycle_stage: getLifecycleStage(createdAt, firstPublished, revenue),
      days_since_install: getDaysSinceInstall(createdAt),
    }
  }, [
    featureName,
    shopData?.createdAt,
    shopData?.usages?.firstIntegrationPublishedAt,
    shopData?.usages?.appGeneratedRevenue,
  ])

  const trackFeature = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      try {
        trackEvent(EVENTS_TRACKING.FEATURE_USED, {
          ...getBaseProps(),
          feature_action: action,
          ...extra,
        })
      } catch {
        // Silent failure — never break UX for tracking
      }
    },
    [trackEvent, getBaseProps]
  )

  return {
    /** Track when user first sees/discovers the feature */
    trackDiscovered: useCallback(
      (entryPoint: string) => trackFeature('discovered', { entry_point: entryPoint }),
      [trackFeature]
    ),
    /** Track when user starts using the feature */
    trackStarted: useCallback((extra?: Record<string, unknown>) => trackFeature('started', extra), [trackFeature]),
    /** Track when user completes a task within the feature */
    trackCompleted: useCallback(
      (result: string, durationSeconds?: number) =>
        trackFeature('completed', {
          result,
          task_success: true,
          ...(durationSeconds !== null && durationSeconds !== undefined && { duration_seconds: durationSeconds }),
        }),
      [trackFeature]
    ),
    /** Track when user abandons a task within the feature */
    trackAbandoned: useCallback(
      (step: string) => trackFeature('abandoned', { abandon_step: step, task_success: false }),
      [trackFeature]
    ),
    /** Track when an error occurs within the feature */
    trackError: useCallback(
      (errorType: string) => trackFeature('error', { error_type: errorType, task_success: false }),
      [trackFeature]
    ),
    /** Track a custom action within the feature */
    trackAction: useCallback(
      (action: string, extra?: Record<string, unknown>) => trackFeature(action, extra),
      [trackFeature]
    ),
  }
}
