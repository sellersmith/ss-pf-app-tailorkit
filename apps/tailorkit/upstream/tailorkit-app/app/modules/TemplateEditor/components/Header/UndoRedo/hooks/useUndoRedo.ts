import { useCallback } from 'react'
import { redo, undo } from '../undo-redo'
import { useUndoRedoState } from './useUndoRedoState'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

/**
 * Use undo/redo
 * @returns {canUndo, canRedo, onUndo, onRedo}
 */
export const useUndoRedo = () => {
  const { canUndo, canRedo } = useUndoRedoState()
  const { trackEvent } = useEventsTracking()

  const onUndo = useCallback(() => {
    undo()
    trackEvent(EVENTS_TRACKING.UNDO)
  }, [trackEvent])

  const onRedo = useCallback(() => {
    redo()
    trackEvent(EVENTS_TRACKING.REDO)
  }, [trackEvent])

  return { canUndo, canRedo, onUndo, onRedo }
}
