import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import type { TrackEventFn } from '~/bootstrap/hooks/useEventsTracking'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'

/**
 * Track the start create product event and set the start create product timestamp
 *
 * @param trackEvent - The track event function
 * @returns void
 */
export function trackEventStartCreateProduct(trackEvent: TrackEventFn) {
  if (!trackEvent) return

  // Track the start create product event
  trackEvent(EVENTS_TRACKING.START_CREATE_PRODUCT)

  // Set the start create product timestamp
  if (!localStorage.getItem('TLK_CREATING_PRODUCT_START_AT')) {
    localStorage.setItem('TLK_CREATING_PRODUCT_START_AT', Date.now().toString())
  }
}
