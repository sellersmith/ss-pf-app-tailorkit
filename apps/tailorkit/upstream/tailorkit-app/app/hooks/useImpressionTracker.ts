import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { uuid } from '~/utils/uuid'

export interface ImpressionTrackerConfig {
  /** Debounce time in ms for batching impressions (default: 500) */
  debounceMs?: number
  /** Intersection Observer threshold (default: 0.5 = 50% visible) */
  visibilityThreshold?: number
  /** Minimum time item must be visible before counting (default: 1000ms) */
  minVisibleTimeMs?: number
  /** Interval for sending batched impressions (default: 2000ms) */
  batchIntervalMs?: number
}

export interface ImpressionItem {
  _id: string
  [key: string]: any
}

interface ImpressionTrackerResult<T extends ImpressionItem> {
  /** Function to get a ref callback for each item */
  getItemRef: (id: string) => (el: HTMLElement | null) => void
  /** Session ID for correlating view/select/convert events */
  sessionId: string
  /** Get the timestamp when an item was first impressed (for time-to-select calculation) */
  getFirstImpressionTime: (id: string) => number | undefined
  /** Manually track a selection event with time-to-select and position */
  trackSelection: (item: T, position: number) => void
}

const DEFAULT_CONFIG: Required<ImpressionTrackerConfig> = {
  debounceMs: 500,
  visibilityThreshold: 0.5,
  minVisibleTimeMs: 1000,
  batchIntervalMs: 2000,
}

/**
 * Hook for tracking item impressions with visibility detection, debouncing, and batching.
 *
 * @param eventName - The Mixpanel event name for view impressions
 * @param selectEventName - The Mixpanel event name for selection events
 * @param sourceComponent - The source component identifier (e.g., 'dashboard_showcase')
 * @param getItemProperties - Function to extract tracking properties from an item
 * @param config - Optional configuration for the tracker
 */
export function useImpressionTracker<T extends ImpressionItem>(
  eventName: string,
  selectEventName: string,
  sourceComponent: string,
  getItemProperties: (item: T) => Record<string, any>,
  config?: ImpressionTrackerConfig
): ImpressionTrackerResult<T> {
  const { trackEvent } = useEventsTracking()
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Session ID for correlating events in this component's lifecycle
  const sessionId = useMemo(() => `sess_${uuid()}`, [])

  // Refs for tracking state
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const itemsDataRef = useRef<Map<string, T>>(new Map())
  const visibleItems = useRef<Map<string, number>>(new Map()) // id -> timestamp when became visible
  const impressedItems = useRef<Set<string>>(new Set()) // Items already tracked (deduplication)
  const firstImpressionTimes = useRef<Map<string, number>>(new Map()) // id -> first impression timestamp
  const pendingBatch = useRef<T[]>([])
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Send batched impressions
  const sendBatch = useCallback(() => {
    if (pendingBatch.current.length === 0) return

    const batch = [...pendingBatch.current]
    pendingBatch.current = []

    const batchId = `batch_${uuid()}`
    const properties: Record<string, any> = {
      [EVENTS_PARAMETERS_NAME.BATCH_ID]: batchId,
      [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
      [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: sourceComponent,
    }

    // Aggregate item properties
    const ids: string[] = []
    const names: string[] = []
    const categories: Set<string> = new Set()

    batch.forEach(item => {
      const itemProps = getItemProperties(item)
      ids.push(item._id)
      if (itemProps.clipart_name) names.push(itemProps.clipart_name)
      if (itemProps.prompt_name) names.push(itemProps.prompt_name)
      if (itemProps.clipart_category) categories.add(itemProps.clipart_category)
    })

    // Add aggregated properties
    if (ids.length > 0) {
      properties[EVENTS_PARAMETERS_NAME.CLIPART_IDS] = ids
      properties[EVENTS_PARAMETERS_NAME.CLIPART_COUNT] = ids.length
    }
    if (names.length > 0) {
      properties['names'] = names
    }
    if (categories.size > 0) {
      properties[EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY] = Array.from(categories).join(',')
    }

    trackEvent(eventName, properties)
  }, [eventName, sessionId, sourceComponent, getItemProperties, trackEvent])

  // Schedule batch send with debouncing
  const scheduleBatchSend = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
    }
    batchTimeoutRef.current = setTimeout(sendBatch, mergedConfig.batchIntervalMs)
  }, [sendBatch, mergedConfig.batchIntervalMs])

  // Process item that has been visible long enough
  const processVisibleItem = useCallback(
    (id: string) => {
      // Check if already impressed (deduplication)
      if (impressedItems.current.has(id)) return

      const item = itemsDataRef.current.get(id)
      if (!item) return

      // Mark as impressed
      impressedItems.current.add(id)

      // Record first impression time for time-to-select calculation
      if (!firstImpressionTimes.current.has(id)) {
        firstImpressionTimes.current.set(id, Date.now())
      }

      // Add to pending batch
      pendingBatch.current.push(item)
      scheduleBatchSend()
    },
    [scheduleBatchSend]
  )

  // Initialize IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const id = entry.target.getAttribute('data-impression-id')
          if (!id) return

          if (entry.isIntersecting) {
            // Item became visible - start timing
            if (!visibleItems.current.has(id)) {
              visibleItems.current.set(id, Date.now())

              // Schedule check after minVisibleTimeMs
              setTimeout(() => {
                const visibleSince = visibleItems.current.get(id)
                if (visibleSince && Date.now() - visibleSince >= mergedConfig.minVisibleTimeMs) {
                  processVisibleItem(id)
                }
              }, mergedConfig.minVisibleTimeMs)
            }
          } else {
            // Item left viewport - stop timing
            visibleItems.current.delete(id)
          }
        })
      },
      {
        threshold: mergedConfig.visibilityThreshold,
      }
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
        // Send any remaining items
        sendBatch()
      }
    }
  }, [mergedConfig.visibilityThreshold, mergedConfig.minVisibleTimeMs, processVisibleItem, sendBatch])

  // Function to get ref callback for each item
  const getItemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const prevEl = itemRefs.current.get(id)

      if (prevEl && observerRef.current) {
        observerRef.current.unobserve(prevEl)
      }

      if (el) {
        el.setAttribute('data-impression-id', id)
        itemRefs.current.set(id, el)
        if (observerRef.current) {
          observerRef.current.observe(el)
        }
      } else {
        itemRefs.current.delete(id)
      }
    },
    []
  )

  // Get first impression time for an item
  const getFirstImpressionTime = useCallback((id: string): number | undefined => {
    return firstImpressionTimes.current.get(id)
  }, [])

  // Track selection with time-to-select calculation
  const trackSelection = useCallback(
    (item: T, position: number) => {
      const itemProps = getItemProperties(item)
      const firstImpression = firstImpressionTimes.current.get(item._id)
      const timeToSelectSeconds = firstImpression ? Math.round((Date.now() - firstImpression) / 1000) : undefined

      const properties: Record<string, any> = {
        ...itemProps,
        [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
        [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: sourceComponent,
        [EVENTS_PARAMETERS_NAME.SELECTION_POSITION]: position,
      }

      if (timeToSelectSeconds !== undefined) {
        properties[EVENTS_PARAMETERS_NAME.TIME_TO_SELECT_SECONDS] = timeToSelectSeconds
      }

      trackEvent(selectEventName, properties)
    },
    [selectEventName, sessionId, sourceComponent, getItemProperties, trackEvent]
  )

  // Update item data when items change (called from parent component)
  const updateItemsData = useCallback((items: T[]) => {
    items.forEach(item => {
      itemsDataRef.current.set(item._id, item)
    })
  }, [])

  // Expose updateItemsData through the ref mechanism
  useEffect(() => {
    // This effect allows parent to update items data
    // The parent should call getItemRef for each item, which registers the element
  }, [updateItemsData])

  return {
    getItemRef,
    sessionId,
    getFirstImpressionTime,
    trackSelection,
  }
}

/**
 * Utility function to update items data in the tracker.
 * Call this when items change to keep the tracker in sync.
 */
export function useImpressionTrackerItems<T extends ImpressionItem>(
  items: T[],
  getItemRef: (id: string) => (el: HTMLElement | null) => void
) {
  const itemsDataRef = useRef<Map<string, T>>(new Map())

  useEffect(() => {
    items.forEach(item => {
      itemsDataRef.current.set(item._id, item)
    })
  }, [items])

  return { itemsDataRef }
}
