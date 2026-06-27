import { useCallback, useEffect } from 'react'
import { useMixpanel } from './useMixpanel'
import { useClarity } from './useClarity'
import { CLARITY_KEY } from '~/constants/services'
import { useSatismeter } from './useSatismeter'
import type { Callback, Dict, RequestOptions } from 'mixpanel-browser'

export interface TrackEventProperties {
  [key: string]: any
}

export type TrackEventFn = (
  event_name: string,
  properties?: Dict,
  optionsOrCallback?: RequestOptions | Callback,
  callback?: Callback
) => void

/**
 * Custom hook for tracking events with Mixpanel, we can add more tracking events with other tools.
 *
 * @returns {Object} An object containing the initMixpanel function and the trackEvent function.
 * @property {Function} initMixpanel - Function to initialize Mixpanel.
 * @property {Function} trackEvent - Function to track an event with a given name and properties.
 */
export function useEventsTracking(): {
  initMixpanel: () => void
  trackEvent: TrackEventFn
} {
  const { initMixpanel, trackEvent: trackEventMixpanel } = useMixpanel()

  const trackEvent = useCallback(
    (event_name: string, properties?: Dict, optionsOrCallback?: RequestOptions | Callback, callback?: Callback) => {
      try {
        trackEventMixpanel(event_name, properties, optionsOrCallback, callback)
      } catch (error) {
        console.error('Error tracking event', error)
      }
    },
    [trackEventMixpanel]
  )

  return { initMixpanel, trackEvent }
}

interface InitEventsTrackingOptions {
  /** Shop domain for user identification (e.g., "my-shop.myshopify.com") */
  shopDomain?: string | null
}

/**
 * Custom hook to initialize events tracking.
 *
 * @param {InitEventsTrackingOptions} options - Configuration options
 * @param {string | null} options.shopDomain - Shop domain for user identification in Clarity
 * @returns {void}
 */
export function useInitEventsTracking(options: InitEventsTrackingOptions = {}) {
  const { shopDomain } = options
  const { initMixpanel } = useEventsTracking()

  // Inject Clarity script and identify user by shop domain
  useClarity({ clarityKey: CLARITY_KEY, shopDomain })

  // Inject the Satismeter script
  useSatismeter()

  useEffect(() => {
    // Initialize Mixpanel
    initMixpanel()
  }, [initMixpanel])
}
