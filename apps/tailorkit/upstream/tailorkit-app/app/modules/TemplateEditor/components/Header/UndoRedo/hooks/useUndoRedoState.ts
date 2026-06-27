import { useState, useEffect } from 'react'
import { canUndo, canRedo } from '../undo-redo'
import { subscribeToUndoRedoChanges, getCurrentStep } from '~/libs/steps.client'

interface UndoRedoState {
  canUndo: boolean
  canRedo: boolean
}

function getCanUndo() {
  const currentStep = getCurrentStep()
  return currentStep?.type === 'INIT_DATA' ? false : canUndo()
}

function getCanRedo() {
  const currentStep = getCurrentStep()
  return currentStep?.type === 'INIT_DATA' ? false : canRedo()
}

/**
 * Get the canUndo and canRedo state
 * @returns {UndoRedoState}
 */
export const useUndoRedoState = (): UndoRedoState => {
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState>({
    canUndo: getCanUndo(),
    canRedo: getCanRedo(),
  })

  useEffect(() => {
    const updateState = () => {
      setUndoRedoState({
        canUndo: getCanUndo(),
        canRedo: getCanRedo(),
      })
    }

    // Check initial state
    updateState()

    // Subscribe to changes
    const unsubscribe = subscribeToUndoRedoChanges(updateState)

    return () => {
      unsubscribe()
    }
  }, [])

  return undoRedoState
}
