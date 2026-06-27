import { useEffect } from 'react'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'

/**
 * Unified hook for tracking events in the unified editor
 * @returns {Object} An object containing the trackEvent function.
 * @property {Function} trackEvent - Function to track an event with a given name and properties.
 */
export default function useUnifiedEditorEventTracking() {
  const { trackEvent } = useEventsTracking()

  useEffect(() => {
    // Start tracking event when the unified editor is viewed
    trackEvent(EVENTS_TRACKING.VIEW_EDITOR, {
      [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
    })
  }, [trackEvent])
}
