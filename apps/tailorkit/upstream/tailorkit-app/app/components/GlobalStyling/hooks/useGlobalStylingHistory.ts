import isEqual from 'lodash/isEqual'
import { useCallback, useMemo, useState } from 'react'
import type { GlobalStyling } from '~/types/global-styling'

/**
 * Custom hook for managing global styling state with undo/redo functionality
 */
export function useGlobalStylingHistory(initialStyling: GlobalStyling) {
  const [styling, setStyling] = useState<GlobalStyling>(initialStyling)
  const [savedStyling, setSavedStyling] = useState<GlobalStyling>(initialStyling)
  const [history, setHistory] = useState<GlobalStyling[]>([])
  const [redoStack, setRedoStack] = useState<GlobalStyling[]>([])

  const isChanged = useMemo(() => !isEqual(styling, savedStyling), [styling, savedStyling])
  const canUndo = history.length > 0
  const canRedo = redoStack.length > 0

  const pushHistory = useCallback(
    (next: GlobalStyling) => {
      setHistory(prev => [...prev, styling])
      setRedoStack([])
      setStyling(next)
    },
    [styling]
  )

  const handleUndo = useCallback(() => {
    if (history.length === 0) return

    const previous = history[history.length - 1]
    const newHistory = history.slice(0, -1)

    setRedoStack(prev => [...prev, styling])
    setHistory(newHistory)
    setStyling(previous)
  }, [history, styling])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return

    const next = redoStack[redoStack.length - 1]
    const newRedoStack = redoStack.slice(0, -1)

    setHistory(prev => [...prev, styling])
    setRedoStack(newRedoStack)
    setStyling(next)
  }, [redoStack, styling])

  const resetHistory = useCallback(() => {
    // Use functional setter to get the latest styling value
    setStyling(currentStyling => {
      setSavedStyling(currentStyling)
      return currentStyling
    })
    setHistory([])
    setRedoStack([])
  }, [])

  const handleDiscard = useCallback(() => {
    setStyling(savedStyling)
    setHistory([])
    setRedoStack([])
  }, [savedStyling])

  return {
    styling,
    setStyling,
    pushHistory,
    handleUndo,
    handleRedo,
    resetHistory,
    handleDiscard,
    isChanged,
    canUndo,
    canRedo,
  }
}
