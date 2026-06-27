import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useAppConfig } from '~/hooks/useAppConfig'
import { authenticatedFetch } from '~/shopify/fns.client'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'

/** Delay after confetti before showing checklist (matches confetti duration) */
const CONFETTI_DELAY_MS = 4500

interface UsePostPublishChecklistProps {
  integrationId: string
  productHandle: string
}

/**
 * Hook to manage post-publish checklist modal display logic.
 *
 * Display rules:
 * - First publish: show after confetti animation completes (~4.5s delay)
 * - Subsequent publishes: show immediately after publish success
 * - Never show if user has opted out ("Don't show again")
 *
 * This modal is a DIRECT response to user clicking Publish,
 * so it's BFS-compliant (not auto-opening).
 */
export function usePostPublishChecklist({ integrationId, productHandle }: UsePostPublishChecklistProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [itemsClicked, setItemsClicked] = useState<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { appConfig } = useAppConfig()
  const { trackEvent } = useEventsTracking()
  const featureTracking = useFeatureTracking('post_publish_checklist')

  /** Check if user has permanently dismissed the checklist */
  const isDismissedForever = Boolean(appConfig?.occurredEvents?.[OCCURRED_EVENTS.POST_PUBLISH_CHECKLIST_DISMISSED])

  /** Cleanup timer on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  /**
   * Trigger the checklist modal after a successful publish.
   * @param isFirstPublish - true if this is the very first publish (showConfetti was true)
   */
  const show = useCallback(
    (isFirstPublish: boolean) => {
      if (isDismissedForever) return

      // Clear any pending timer from a previous publish
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      // Reset state for new publish
      setItemsClicked([])

      const onShow = () => {
        setIsOpen(true)
        trackEvent(EVENTS_TRACKING.POST_PUBLISH_CHECKLIST_SHOWN, {
          is_first_publish: isFirstPublish,
          integration_id: integrationId,
          product_handle: productHandle,
        })
        featureTracking.trackDiscovered(isFirstPublish ? 'first_publish' : 'subsequent_publish')
      }

      if (isFirstPublish) {
        // Delay after confetti animation completes
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          onShow()
        }, CONFETTI_DELAY_MS)
      } else {
        // Show immediately for subsequent publishes
        onShow()
      }
    },
    [isDismissedForever, integrationId, productHandle, trackEvent, featureTracking]
  )

  /** Track when a checklist item CTA is clicked */
  const trackItemClick = useCallback(
    (itemId: string) => {
      setItemsClicked(prev => (prev.includes(itemId) ? prev : [...prev, itemId]))
      trackEvent(EVENTS_TRACKING.POST_PUBLISH_CHECKLIST_ITEM_CLICKED, {
        item: itemId,
        integration_id: integrationId,
      })
      featureTracking.trackStarted({ item: itemId })
    },
    [integrationId, trackEvent, featureTracking]
  )

  /** Track social share click */
  const trackSocialShare = useCallback(
    (platform: string) => {
      trackEvent(EVENTS_TRACKING.POST_PUBLISH_CHECKLIST_SOCIAL_SHARE, {
        platform,
        integration_id: integrationId,
      })
    },
    [integrationId, trackEvent]
  )

  /**
   * Close the modal. Optionally persist "don't show again" preference.
   */
  const close = useCallback(
    async (dontShowAgain: boolean) => {
      // Track dismiss event
      trackEvent(EVENTS_TRACKING.POST_PUBLISH_CHECKLIST_DISMISSED, {
        dont_show_again: dontShowAgain,
        items_clicked: itemsClicked,
      })

      const result = dontShowAgain ? 'dismissed_forever' : itemsClicked.length > 0 ? 'engaged' : 'dismissed_once'
      featureTracking.trackCompleted(result)

      if (dontShowAgain) {
        try {
          await authenticatedFetch('/api/preferences', {
            method: 'POST',
            body: JSON.stringify({
              action: 'UPDATE_OCCURRED_EVENT',
              eventName: OCCURRED_EVENTS.POST_PUBLISH_CHECKLIST_DISMISSED,
              value: true,
            }),
          })
        } catch (error) {
          console.error('[PostPublishChecklist] Failed to persist dismiss preference:', error)
        }
      }

      setIsOpen(false)
    },
    [itemsClicked, trackEvent, featureTracking]
  )

  return useMemo(
    () => ({
      isOpen,
      show,
      close,
      trackItemClick,
      trackSocialShare,
    }),
    [isOpen, show, close, trackItemClick, trackSocialShare]
  )
}
