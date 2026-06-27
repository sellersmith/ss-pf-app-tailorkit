import type { ShopDocument } from '~/models/Shop'
import { trackEvent } from './mixpanel.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { getLifecycleStage, getDaysSinceInstall } from './lifecycle-stage'

/**
 * Server-side feature adoption tracking.
 * Fires standardized 'feature_used' event with lifecycle context.
 * Thin wrapper around existing trackEvent() from mixpanel.server.ts.
 *
 * Usage:
 *   await trackFeatureEvent(shopData, 'fulfillment_printify', 'order_fulfilled', {
 *     provider: 'printify',
 *     task_success: true,
 *   })
 */
export async function trackFeatureEvent(
  shopData: ShopDocument,
  featureName: string,
  action: string,
  extra?: Record<string, unknown>
) {
  const createdAt = shopData?.createdAt
  const firstPublished = shopData?.usages?.firstIntegrationPublishedAt
  const revenue = shopData?.usages?.appGeneratedRevenue

  await trackEvent(shopData, EVENTS_TRACKING.FEATURE_USED, {
    feature_name: featureName,
    feature_action: action,
    lifecycle_stage: getLifecycleStage(createdAt, firstPublished, revenue),
    days_since_install: getDaysSinceInstall(createdAt),
    ...extra,
  })
}
