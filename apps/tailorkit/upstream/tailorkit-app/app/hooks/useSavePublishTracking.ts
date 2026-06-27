import { useCallback, useEffect, useRef } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import { MODAL_ID } from '~/constants/modal'
import { EActionType } from '~/constants/fetcher-keys'
import { useAppConfig } from '~/hooks/useAppConfig'
import { useModal } from '~/utils/hooks/useModal'
import { authenticatedFetch } from '~/shopify/fns.client'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'

const SAVE_PUBLISH_MODAL_DISPLAY_COUNT_KEY = 'save_publish_modal_display_count'
const TIMER_DELAY_MS = 15000 // 15 seconds
const MAX_DISPLAY_COUNT = 2

// BFS Compliance: Flag to disable auto-opening modals (requirement 4.3.3)
const isSavePublishModalDisabled = BFS_COMPLIANCE.DISABLE_AUTO_OPENING_MODALS

/**
 * Global hook that tracks save/publish events across the entire app.
 * Shows ModalAskWhyOnlySaveNotPublish after user saves without publishing within 15 seconds.
 * Modal only shows maximum 2 times for the first 2 save events.
 *
 * IMPORTANT MECHANISMS TO PREVENT BUGS:
 * 1. Guard flag (isShowingModalRef): Prevents concurrent execution of showModalIfNeeded()
 *    - Multiple timers can fire simultaneously, guard ensures only one modal opens at a time
 * 2. Atomic check-and-increment: Increment count BEFORE showing modal
 *    - Prevents race condition where multiple timers check count before increment
 * 3. Stable event listeners: Use refs to prevent re-registration
 *    - When callbacks change (due to appConfig updates), listeners don't re-register
 *    - Prevents duplicate listeners that would cause multiple timers per save event
 * 4. Early exit: Check count before starting timer
 *    - Avoids unnecessary timer creation if modal already shown 2 times
 *
 * NOTE: When BFS_COMPLIANCE.DISABLE_AUTO_OPENING_MODALS is true, this hook will not
 * register any event listeners or show any modals (Shopify requirement 4.3.3).
 */
export function useSavePublishTracking() {
  const { appConfig, refetch: refetchAppConfig } = useAppConfig()
  const { openModal } = useModal()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isPublishingRef = useRef<boolean>(false)
  const pendingShowModalRef = useRef<boolean>(false)
  /**
   * Guard flag to prevent concurrent execution of showModalIfNeeded()
   * When multiple timers fire simultaneously, only the first one will execute
   */
  const isShowingModalRef = useRef<boolean>(false)

  /**
   * Use refs for callbacks to prevent re-registration of event listeners.
   * Problem: When callbacks change (e.g., appConfig updates), useEffect re-runs and
   * re-registers listeners. For DOM elements, addEventListener doesn't prevent duplicates,
   * causing multiple handlers per event → multiple timers per save.
   * Solution: Store callbacks in refs, create stable wrapper functions that call refs.
   * This way, listeners are registered once and never re-register.
   */
  const openModalRef = useRef(openModal)
  const refetchAppConfigRef = useRef(refetchAppConfig)
  const handleSavedProductRef = useRef<() => void | Promise<void>>()
  const handlePublishingProductRef = useRef<() => void>()
  const handlePublishedProductRef = useRef<() => void>()
  const handleAbortActionRef = useRef<() => void | Promise<void>>()

  /**
   * Keep refs updated with latest callbacks
   * This ensures stable listeners always call the latest callback implementations
   */
  useEffect(() => {
    openModalRef.current = openModal
    refetchAppConfigRef.current = refetchAppConfig
  }, [openModal, refetchAppConfig])

  /**
   * Get current display count from occurredEvents
   */
  const getDisplayCount = useCallback((): number => {
    const occurredEvents = appConfig?.occurredEvents || {}
    const count = occurredEvents[SAVE_PUBLISH_MODAL_DISPLAY_COUNT_KEY]
    const result = typeof count === 'number' ? count : 0
    return result
  }, [appConfig])

  /**
   * Get display count directly from API (always fresh)
   */
  const getDisplayCountFromAPI = useCallback(async (): Promise<number> => {
    try {
      const data = await authenticatedFetch('/api/preferences?themeConfig=true')
      const occurredEvents = data?.appConfig?.occurredEvents || {}
      const count = occurredEvents[SAVE_PUBLISH_MODAL_DISPLAY_COUNT_KEY]
      const result = typeof count === 'number' ? count : 0
      return result
    } catch (error) {
      console.error('[useSavePublishTracking] Failed to fetch display count from API:', error)
      // Fallback to cached value
      return getDisplayCount()
    }
  }, [getDisplayCount])

  /**
   * Increment display count in database and refetch appConfig
   */
  const incrementDisplayCount = useCallback(async (): Promise<void> => {
    try {
      const currentCount = await getDisplayCountFromAPI()
      const newCount = currentCount + 1

      await authenticatedFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_OCCURRED_EVENT',
          eventName: SAVE_PUBLISH_MODAL_DISPLAY_COUNT_KEY,
          value: newCount,
        }),
      })

      // Refetch appConfig to get the latest value
      await refetchAppConfigRef.current()
    } catch (error) {
      console.error('Failed to increment save publish modal display count:', error)
    }
  }, [getDisplayCountFromAPI])

  /**
   * Clear timer if exists
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /**
   * Show modal if conditions are met.
   * Uses atomic check-and-increment pattern to prevent race conditions.
   *
   * RACE CONDITION FIX:
   * Old flow: Check count → Show modal → Increment count
   * Problem: Multiple timers can check count simultaneously before increment,
   *          all see count < 2, all show modal, then increment happens multiple times.
   *
   * New flow: Check count → Increment count → Show modal
   * Solution: Increment FIRST, then show modal. Even if multiple timers fire,
   *           the first one increments, subsequent ones see count >= 2 and exit.
   *
   * GUARD FLAG:
   * Prevents concurrent execution if multiple timers somehow pass the count check.
   * Only the first execution proceeds, others exit immediately.
   */
  const showModalIfNeeded = useCallback(async (): Promise<boolean> => {
    // Guard: Prevent concurrent execution
    // If another timer is already showing modal, exit immediately
    if (isShowingModalRef.current) {
      return false
    }

    try {
      // Set guard flag immediately to block concurrent executions
      isShowingModalRef.current = true

      // Check if we've already shown modal 2 times - fetch fresh from API
      const displayCount = await getDisplayCountFromAPI()

      if (displayCount >= MAX_DISPLAY_COUNT) {
        return false
      }

      // ATOMIC OPERATION: Increment count FIRST, then show modal
      // This ensures that even if multiple timers fire simultaneously,
      // only the first one will increment and show modal.
      // Subsequent ones will see count >= 2 and exit.
      await incrementDisplayCount()

      // Show modal AFTER incrementing (atomic pattern)
      // At this point, count is already incremented, so concurrent calls will see updated count
      openModalRef.current(MODAL_ID.ASK_WHY_ONLY_SAVE_NOT_PUBLISH_MODAL)

      return true
    } catch (error) {
      console.error('[useSavePublishTracking] Error in showModalIfNeeded:', error)
      return false
    } finally {
      // Always release guard flag, even if error occurs
      isShowingModalRef.current = false
    }
  }, [getDisplayCountFromAPI, incrementDisplayCount])

  /**
   * Handle SAVED_PRODUCT event - start 15-second timer.
   *
   * FLOW:
   * 1. Early check: If modal already shown 2 times, don't start timer (optimization)
   * 2. Clear any existing timer (new save resets the timer)
   * 3. Reset flags (new save means user is not publishing anymore)
   * 4. Start 15-second timer
   * 5. After 15 seconds:
   *    - If user is publishing → mark as pending, show later when publish completes/aborts
   *    - Otherwise → show modal (with race condition protection)
   *    - Clear timer to prevent duplicate fires
   */
  const handleSavedProduct = useCallback(async () => {
    // Early check: If already shown 2 times, don't start timer
    // This avoids unnecessary API calls and timer creation
    const currentCount = await getDisplayCountFromAPI()
    if (currentCount >= MAX_DISPLAY_COUNT) {
      return
    }

    // Clear any existing timer first
    // New save event means previous timer is no longer relevant
    clearTimer()
    // Reset publishing flag and pending show modal flag when new save happens
    // New save means user is not publishing anymore
    isPublishingRef.current = false
    pendingShowModalRef.current = false

    // Start new timer - will fire after 15 seconds
    timerRef.current = setTimeout(async () => {
      timerRef.current = null

      // Check if user is currently publishing - if so, mark as pending and don't show modal yet
      // We don't want to show modal while user is actively publishing
      if (isPublishingRef.current) {
        pendingShowModalRef.current = true
        return
      }

      // Show modal if conditions are met
      // showModalIfNeeded() has built-in race condition protection
      await showModalIfNeeded()

      // Clear timer after showing modal to prevent duplicate fires
      // Timer ref is already null, but this ensures cleanup
      clearTimer()
    }, TIMER_DELAY_MS)
  }, [clearTimer, showModalIfNeeded, getDisplayCountFromAPI])

  /**
   * Handle PUBLISHING_PRODUCT event - set flag to prevent modal from showing
   */
  const handlePublishingProduct = useCallback(() => {
    isPublishingRef.current = true
  }, [])

  /**
   * Handle PUBLISHED_PRODUCT event - reset flag and cancel timer
   */
  const handlePublishedProduct = useCallback(() => {
    isPublishingRef.current = false
    pendingShowModalRef.current = false
    clearTimer()
  }, [clearTimer])

  /**
   * Handle ABORT_ACTION event - reset flag when publish is cancelled
   * If modal was pending (timer expired while publishing), show it now
   */
  const handleAbortAction = useCallback(async () => {
    isPublishingRef.current = false

    // If modal was pending (timer expired while user was publishing), show it now
    if (pendingShowModalRef.current) {
      pendingShowModalRef.current = false
      await showModalIfNeeded()
    }
  }, [showModalIfNeeded])

  /**
   * Update handler refs when callbacks change.
   * This ensures stable listeners always call the latest callback implementations
   * without re-registering the listeners themselves.
   */
  useEffect(() => {
    handleSavedProductRef.current = handleSavedProduct
    handlePublishingProductRef.current = handlePublishingProduct
    handlePublishedProductRef.current = handlePublishedProduct
    handleAbortActionRef.current = handleAbortAction
  }, [handleSavedProduct, handlePublishingProduct, handlePublishedProduct, handleAbortAction])

  /**
   * Set up event listeners with stable callbacks using refs.
   *
   * CRITICAL: Empty dependency array prevents re-registration.
   *
   * PROBLEM WITHOUT REFS:
   * - When callbacks change (e.g., appConfig updates), useEffect re-runs
   * - Old listeners are removed, new ones are added
   * - For DOM elements, addEventListener doesn't prevent duplicates
   * - If cleanup doesn't happen in time, multiple listeners exist
   * - Result: Multiple timers per save event → modal shows multiple times
   *
   * SOLUTION WITH REFS:
   * - Create stable wrapper functions that call refs
   * - Listeners are registered once and never re-register
   * - When callbacks change, only the refs are updated (separate useEffect)
   * - Stable wrappers always call the latest callback via refs
   * - Result: Only one listener per event → only one timer per save event
   */
  useEffect(() => {
    // BFS Compliance: Skip event listener registration when modal is disabled
    if (isSavePublishModalDisabled) {
      return
    }

    // Create stable wrapper functions that call refs
    // These functions never change, so listeners never re-register
    const stableHandleSavedProduct = () => {
      handleSavedProductRef.current?.()
    }
    const stableHandlePublishingProduct = () => {
      handlePublishingProductRef.current?.()
    }
    const stableHandlePublishedProduct = () => {
      handlePublishedProductRef.current?.()
    }
    const stableHandleAbortAction = () => {
      handleAbortActionRef.current?.()
    }

    // Register listeners once - they will never be re-registered
    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.SAVED_PRODUCT, stableHandleSavedProduct)
    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.PUBLISHING_PRODUCT, stableHandlePublishingProduct)
    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT, stableHandlePublishedProduct)
    Transmitter.listen(EActionType.ABORT_ACTION, stableHandleAbortAction)

    return () => {
      // Cleanup: Remove listeners on unmount
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.SAVED_PRODUCT, stableHandleSavedProduct)
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.PUBLISHING_PRODUCT, stableHandlePublishingProduct)
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT, stableHandlePublishedProduct)
      Transmitter.remove(EActionType.ABORT_ACTION, stableHandleAbortAction)
      clearTimer()
    }
    // Empty dependency array - listeners are stable and won't re-register
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
