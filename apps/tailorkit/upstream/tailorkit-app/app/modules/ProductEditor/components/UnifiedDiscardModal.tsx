import { useCallback, useEffect, useState } from 'react'
import { EActionType } from '~/constants/fetcher-keys'
import useUnifiedDiscard from '../hooks/useUnifiedDiscard'
import ModalDiscardConfirmation from '~/components/common/Modal/ModalDiscardConfirmation'
import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

/**
 * Unified Discard Modal Component
 *
 * This component handles discard functionality across the entire unified editor.
 * It listens for DISCARD_INTEGRATION messages and shows a confirmation modal.
 *
 * Key Features:
 * - Always mounted (works in Design, Mockup, and Preview tabs)
 * - Single source of truth for discard logic
 * - Reusable across different contexts
 *
 * Usage:
 * Place this component at the root level of ProductEditor so it's always listening
 */
export default function UnifiedDiscardModal() {
  const { discardAll } = useUnifiedDiscard()
  const { trackEvent } = useEventsTracking()
  const [modalDiscardConfirmationActive, setModalDiscardConfirmationActive] = useState(false)

  const toggleDiscardModal = useCallback(() => {
    setModalDiscardConfirmationActive(prev => !prev)
  }, [])

  const onDiscardHandler = useCallback(async () => {
    await discardAll()

    // Track event when the unified editor is discarded
    trackEvent(EVENTS_TRACKING.DISCARD_EDITOR, {
      [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
    })

    toggleDiscardModal()
  }, [discardAll, toggleDiscardModal, trackEvent])

  // Listen for discard messages from save bar
  useEffect(() => {
    function handleMessageFromMainApp(ev: MessageEvent | EventObject) {
      if (ev.data === EActionType.DISCARD_INTEGRATION) {
        toggleDiscardModal()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessageFromMainApp)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleMessageFromMainApp)
      }
    }
  }, [toggleDiscardModal])

  return (
    <ModalDiscardConfirmation
      active={modalDiscardConfirmationActive}
      handleChange={toggleDiscardModal}
      onDiscard={onDiscardHandler}
    />
  )
}
