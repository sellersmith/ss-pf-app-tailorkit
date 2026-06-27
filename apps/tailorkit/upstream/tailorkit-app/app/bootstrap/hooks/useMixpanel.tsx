import type { Callback, Dict, RequestOptions } from 'mixpanel-browser'
import mixpanel from 'mixpanel-browser'
import { useCallback, useMemo } from 'react'
import { useRootLoaderData } from '~/root'
import { getMerchantVertical } from '../fns/misc'
import { getLifecycleStage, getDaysSinceInstall } from '../fns/lifecycle-stage'

interface UserProperties {
  shopDomain: string
  metadataDomain: string
  storeName: string
  timezone: string
  pricingPlan: string
  shopifyPlan: string
  lastAccess?: string | Date | null
  installedAt?: string | Date | null
  [key: string]: any
}

/**
 * Custom hook to initialize Mixpanel and track events.
 *
 * @returns {Object} An object containing the `initMixpanel` function to initialize Mixpanel
 *                  and the `trackEvent` function to track events.
 */
export function useMixpanel() {
  const { shopData, mixPanelAccessToken, PUBLIC_ENV } = useRootLoaderData()

  const {
    shopDomain,
    lastAccess,
    subscription,
    createdAt: installedAt,
    metadata: rawMetadata,
    shopConfig: {
      timezone,
      domain: metadataDomain,
      name: storeName,
      plan_display_name: shopifyPlan,
      country_code: countryCode,
      country_name: countryName,
    } = {},
    usages: {
      tierUsageFee = 0,
      discountedUsageFee = 0,
      appGeneratedRevenue = 0,
      usedAIAssistant = false,
      usedGenerativeAI = false,
      aiCredit: { monthlyUsage = 0 } = {},
    } = {},
  } = shopData || {}
  const { shopCategories = [], shopDescription = '', personalizationCompatibilityScore = 0 } = rawMetadata ?? {}

  const userProperties: UserProperties = useMemo(
    () => ({
      timezone,
      storeName,
      lastAccess,
      shopDomain,
      installedAt,
      countryCode,
      shopifyPlan,
      countryName,
      tierUsageFee,
      metadataDomain,
      shopDescription,
      usedAIAssistant,
      usedGenerativeAI,
      discountedUsageFee,
      appGeneratedRevenue,
      usedAICredits: monthlyUsage,
      shopCategories: shopCategories.join(','),
      pricingPlan: subscription?.plan?.name || 'Pay as You Grow',
      shopVertical: getMerchantVertical(shopCategories, personalizationCompatibilityScore),
      lifecycleStage: getLifecycleStage(
        installedAt,
        shopData?.usages?.firstIntegrationPublishedAt,
        appGeneratedRevenue
      ),
      daysSinceInstall: getDaysSinceInstall(installedAt),
    }),
    [
      appGeneratedRevenue,
      countryCode,
      countryName,
      discountedUsageFee,
      installedAt,
      lastAccess,
      metadataDomain,
      personalizationCompatibilityScore,
      monthlyUsage,
      shopCategories,
      shopDescription,
      shopDomain,
      shopifyPlan,
      storeName,
      subscription?.plan?.name,
      tierUsageFee,
      timezone,
      usedAIAssistant,
      usedGenerativeAI,
      shopData?.usages?.firstIntegrationPublishedAt,
    ]
  )

  /**
   * Initializes Mixpanel with user properties and identifies the user.
   */
  const initMixpanel = useCallback(() => {
    if (!mixPanelAccessToken || !shopData) return

    // Session Replay configuration
    const samplePercentEnv = Number(PUBLIC_ENV?.MIXPANEL_REPLAY_SAMPLE_PERCENT)
    // Default to 100% if unset or invalid to auto-enable Session Replay for all users
    const isExistingSamplePercent = Number.isFinite(samplePercentEnv) && samplePercentEnv > 0
    const recordSessionsPercent = isExistingSamplePercent ? Math.min(100, samplePercentEnv) : 100

    // Privacy controls per Mixpanel docs
    const recordMaskTextSelector = PUBLIC_ENV?.MIXPANEL_RECORD_MASK_TEXT_SELECTOR as string | undefined
    const recordBlockClass = PUBLIC_ENV?.MIXPANEL_RECORD_BLOCK_CLASS as string | undefined

    const config = {
      track_pageview: true,
      ignore_dnt: true,
      // Enable heatmap data collection
      record_heatmap_data: true,
      // Enable Session Replay sampling (default 100% if not configured)
      record_sessions_percent: recordSessionsPercent,
      // Privacy controls per Mixpanel docs
      ...(recordMaskTextSelector ? { record_mask_text_selector: recordMaskTextSelector } : {}),
      ...(recordBlockClass ? { record_block_class: recordBlockClass } : {}),
    }

    mixpanel.init(mixPanelAccessToken, config)

    // Identify user
    const userId = shopData.shopConfig?.id

    if (!userId) {
      return
    }

    mixpanel.identify(userId)

    mixpanel.people.set(userProperties)

    // Heatmaps rely on Replay; no additional init needed beyond enabling replay.

    // Store mixpanel object in global
    if (window.analytics !== mixpanel) {
      window.analytics = mixpanel
    }
  }, [
    mixPanelAccessToken,
    shopData,
    userProperties,
    PUBLIC_ENV?.MIXPANEL_REPLAY_SAMPLE_PERCENT,
    PUBLIC_ENV?.MIXPANEL_RECORD_MASK_TEXT_SELECTOR,
    PUBLIC_ENV?.MIXPANEL_RECORD_BLOCK_CLASS,
  ])

  /**
   * Tracks an event in Mixpanel.
   *
   * @param {string} eventName - The name of the event to track.
   * @param {TrackEventProperties} [properties={}] - Optional properties associated with the event.
   */
  const trackEvent = useCallback(
    (event_name: string, properties?: Dict, optionsOrCallback?: RequestOptions | Callback, callback?: Callback) => {
      // @ts-ignore
      if (!mixpanel.__loaded) {
        initMixpanel()

        setTimeout(() => trackEvent(event_name, properties, optionsOrCallback, callback), 2000)

        return
      }

      // Attach session replay properties to all events for better correlation
      const replayProps
        = typeof (mixpanel as any).get_session_recording_properties === 'function'
          ? (mixpanel as any).get_session_recording_properties()
          : {}

      mixpanel.track(
        event_name,
        {
          ...properties,
          ...replayProps,
          ...userProperties,
        },
        optionsOrCallback,
        callback
      )
    },
    [initMixpanel, userProperties]
  )

  const startSessionRecording = useCallback(() => {
    if (typeof (mixpanel as any).start_session_recording === 'function') {
      ;(mixpanel as any).start_session_recording()
    }
  }, [])

  const stopSessionRecording = useCallback(() => {
    if (typeof (mixpanel as any).stop_session_recording === 'function') {
      ;(mixpanel as any).stop_session_recording()
    }
  }, [])

  return { initMixpanel, trackEvent, startSessionRecording, stopSessionRecording }
}
