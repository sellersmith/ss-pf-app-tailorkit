import { useState, useCallback, useEffect, useMemo } from 'react'
import type { OverlayState, ImageColorAdjustments, AdjustmentMask } from '../types'

interface UseOverlayStateOptions {
  /** Initial overlay state */
  initialState?: OverlayState
  /** Callback when overlay state changes */
  onStateChange?: (state: OverlayState) => void
}

interface UseOverlayStateReturn {
  /** Current overlay state */
  overlayState: OverlayState
  /** Set image color adjustments */
  setImageColorAdjustments: (adjustments: ImageColorAdjustments | undefined) => void
  /** Update a single image color adjustment property */
  updateImageColorAdjustment: <K extends keyof ImageColorAdjustments>(key: K, value: ImageColorAdjustments[K]) => void
  /** Update a filter preset parameter (uses functional update to avoid stale state) */
  updateFilterPresetParam: (paramKey: string, value: number) => void
  /** Add a path index to clip paths */
  addClipPath: (pathIndex: number) => void
  /** Remove a path index from clip paths */
  removeClipPath: (pathIndex: number) => void
  /** Toggle a path index as clip path */
  toggleClipPath: (pathIndex: number) => void
  /** Check if a path index is a clip path */
  isClipPath: (pathIndex: number) => boolean
  /** Add a path index to hole paths */
  addHolePath: (pathIndex: number) => void
  /** Remove a path index from hole paths */
  removeHolePath: (pathIndex: number) => void
  /** Toggle a path index as hole path */
  toggleHolePath: (pathIndex: number) => void
  /** Check if a path index is a hole path */
  isHolePath: (pathIndex: number) => boolean
  /** Toggle a path as adjustment mask (with default adjustments) */
  toggleAdjustmentMask: (pathIndex: number) => void
  /** Check if a path is an adjustment mask */
  isAdjustmentMask: (pathIndex: number) => boolean
  /** Get adjustment mask for a path */
  getAdjustmentMask: (pathIndex: number) => AdjustmentMask | undefined
  /** Update adjustments for a specific mask */
  updateAdjustmentMask: (pathIndex: number, adjustments: Partial<ImageColorAdjustments>) => void
  /** Remap all indices when paths are deleted/reordered. Map value of null means deleted. */
  remapIndices: (indexMap: Map<number, number | null>) => void
  /** Restore overlay state from a snapshot (for undo/redo) */
  restoreState: (state: OverlayState) => void
  /** Reset overlay state to initial/default */
  reset: () => void
  /** Check if overlay has any modifications */
  hasModifications: boolean
}

const DEFAULT_OVERLAY_STATE: OverlayState = {
  imageColorAdjustments: undefined,
  clipPathIndices: [],
  holePathIndices: [],
  adjustmentMasks: [],
}

/**
 * Hook for managing overlay state in raster image overlay mode.
 * Tracks color adjustments, clip paths, hole paths, and adjustment masks.
 */
export function useOverlayState({ initialState, onStateChange }: UseOverlayStateOptions): UseOverlayStateReturn {
  const [overlayState, setOverlayState] = useState<OverlayState>(() => ({
    imageColorAdjustments: initialState?.imageColorAdjustments,
    clipPathIndices: initialState?.clipPathIndices || [],
    holePathIndices: initialState?.holePathIndices || [],
    adjustmentMasks: initialState?.adjustmentMasks || [],
  }))

  // Sync state when initialState prop changes (e.g., when modal reopens with new saved data)
  // Use JSON.stringify comparison to detect actual changes in the initialState object
  const initialStateKey = JSON.stringify(initialState)
  useEffect(() => {
    setOverlayState({
      imageColorAdjustments: initialState?.imageColorAdjustments,
      clipPathIndices: initialState?.clipPathIndices || [],
      holePathIndices: initialState?.holePathIndices || [],
      adjustmentMasks: initialState?.adjustmentMasks || [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStateKey])

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(overlayState)
  }, [overlayState, onStateChange])

  const setImageColorAdjustments = useCallback((adjustments: ImageColorAdjustments | undefined) => {
    setOverlayState(prev => ({
      ...prev,
      imageColorAdjustments: adjustments,
    }))
  }, [])

  const updateImageColorAdjustment = useCallback(
    <K extends keyof ImageColorAdjustments>(key: K, value: ImageColorAdjustments[K]) => {
      setOverlayState(prev => ({
        ...prev,
        imageColorAdjustments: {
          ...prev.imageColorAdjustments,
          [key]: value,
        },
      }))
    },
    []
  )

  // Update a filter preset parameter using functional update to avoid stale state issues
  const updateFilterPresetParam = useCallback((paramKey: string, value: number) => {
    setOverlayState(prev => ({
      ...prev,
      imageColorAdjustments: {
        ...prev.imageColorAdjustments,
        filterPresetParams: {
          ...prev.imageColorAdjustments?.filterPresetParams,
          [paramKey]: value,
        },
      },
    }))
  }, [])

  const addClipPath = useCallback((pathIndex: number) => {
    setOverlayState(prev => {
      if (prev.clipPathIndices.includes(pathIndex)) return prev
      // Remove from hole paths if present (can't be both)
      const holePathIndices = prev.holePathIndices.filter(i => i !== pathIndex)
      return {
        ...prev,
        clipPathIndices: [...prev.clipPathIndices, pathIndex],
        holePathIndices,
      }
    })
  }, [])

  const removeClipPath = useCallback((pathIndex: number) => {
    setOverlayState(prev => ({
      ...prev,
      clipPathIndices: prev.clipPathIndices.filter(i => i !== pathIndex),
    }))
  }, [])

  const toggleClipPath = useCallback((pathIndex: number) => {
    setOverlayState(prev => {
      const isCurrentlyClipPath = prev.clipPathIndices.includes(pathIndex)
      if (isCurrentlyClipPath) {
        return {
          ...prev,
          clipPathIndices: prev.clipPathIndices.filter(i => i !== pathIndex),
        }
      }
      // Remove from hole paths if present
      const holePathIndices = prev.holePathIndices.filter(i => i !== pathIndex)
      return {
        ...prev,
        clipPathIndices: [...prev.clipPathIndices, pathIndex],
        holePathIndices,
      }
    })
  }, [])

  const isClipPath = useCallback(
    (pathIndex: number) => overlayState.clipPathIndices.includes(pathIndex),
    [overlayState.clipPathIndices]
  )

  const addHolePath = useCallback((pathIndex: number) => {
    setOverlayState(prev => {
      if (prev.holePathIndices.includes(pathIndex)) return prev
      // Remove from clip paths if present (can't be both)
      const clipPathIndices = prev.clipPathIndices.filter(i => i !== pathIndex)
      return {
        ...prev,
        holePathIndices: [...prev.holePathIndices, pathIndex],
        clipPathIndices,
      }
    })
  }, [])

  const removeHolePath = useCallback((pathIndex: number) => {
    setOverlayState(prev => ({
      ...prev,
      holePathIndices: prev.holePathIndices.filter(i => i !== pathIndex),
    }))
  }, [])

  const toggleHolePath = useCallback((pathIndex: number) => {
    setOverlayState(prev => {
      const isCurrentlyHolePath = prev.holePathIndices.includes(pathIndex)
      if (isCurrentlyHolePath) {
        return {
          ...prev,
          holePathIndices: prev.holePathIndices.filter(i => i !== pathIndex),
        }
      }
      // Remove from clip paths if present
      const clipPathIndices = prev.clipPathIndices.filter(i => i !== pathIndex)
      return {
        ...prev,
        holePathIndices: [...prev.holePathIndices, pathIndex],
        clipPathIndices,
      }
    })
  }, [])

  const isHolePath = useCallback(
    (pathIndex: number) => overlayState.holePathIndices.includes(pathIndex),
    [overlayState.holePathIndices]
  )

  // Adjustment mask functions
  // Note: A path can be BOTH a clip/hole path AND an adjustment mask
  // This allows clipping the image to a shape while also applying adjustments to that area
  const toggleAdjustmentMask = useCallback((pathIndex: number) => {
    setOverlayState(prev => {
      const existingIndex = prev.adjustmentMasks.findIndex(m => m.pathIndex === pathIndex)
      if (existingIndex >= 0) {
        // Remove the mask
        return {
          ...prev,
          adjustmentMasks: prev.adjustmentMasks.filter(m => m.pathIndex !== pathIndex),
        }
      }
      // Add new mask with default adjustments (no changes initially)
      // Keep clip/hole paths unchanged - a path can be both
      return {
        ...prev,
        adjustmentMasks: [...prev.adjustmentMasks, { pathIndex, adjustments: {} }],
      }
    })
  }, [])

  const isAdjustmentMask = useCallback(
    (pathIndex: number) => overlayState.adjustmentMasks.some(m => m.pathIndex === pathIndex),
    [overlayState.adjustmentMasks]
  )

  const getAdjustmentMask = useCallback(
    (pathIndex: number) => overlayState.adjustmentMasks.find(m => m.pathIndex === pathIndex),
    [overlayState.adjustmentMasks]
  )

  const updateAdjustmentMask = useCallback((pathIndex: number, adjustments: Partial<ImageColorAdjustments>) => {
    setOverlayState(prev => {
      const maskIndex = prev.adjustmentMasks.findIndex(m => m.pathIndex === pathIndex)
      if (maskIndex < 0) return prev

      const updatedMasks = [...prev.adjustmentMasks]
      updatedMasks[maskIndex] = {
        ...updatedMasks[maskIndex],
        adjustments: {
          ...updatedMasks[maskIndex].adjustments,
          ...adjustments,
        },
      }
      return {
        ...prev,
        adjustmentMasks: updatedMasks,
      }
    })
  }, [])

  const remapIndices = useCallback((indexMap: Map<number, number | null>) => {
    setOverlayState(prev => {
      // Remap clipPathIndices - filter out deleted (null) and apply new indices
      const newClipPathIndices = prev.clipPathIndices
        .map(idx => indexMap.get(idx))
        .filter((idx): idx is number => idx !== null && idx !== undefined)

      // Remap holePathIndices
      const newHolePathIndices = prev.holePathIndices
        .map(idx => indexMap.get(idx))
        .filter((idx): idx is number => idx !== null && idx !== undefined)

      // Remap adjustmentMasks
      const newAdjustmentMasks = prev.adjustmentMasks
        .map(mask => {
          const newIndex = indexMap.get(mask.pathIndex)
          if (newIndex === null || newIndex === undefined) return null
          return { ...mask, pathIndex: newIndex }
        })
        .filter((mask): mask is AdjustmentMask => mask !== null)

      return {
        ...prev,
        clipPathIndices: newClipPathIndices,
        holePathIndices: newHolePathIndices,
        adjustmentMasks: newAdjustmentMasks,
      }
    })
  }, [])

  const restoreState = useCallback((state: OverlayState) => {
    setOverlayState({
      imageColorAdjustments: state.imageColorAdjustments,
      clipPathIndices: state.clipPathIndices || [],
      holePathIndices: state.holePathIndices || [],
      adjustmentMasks: state.adjustmentMasks || [],
    })
  }, [])

  const reset = useCallback(() => {
    setOverlayState(initialState || DEFAULT_OVERLAY_STATE)
  }, [initialState])

  const hasModifications = useMemo(
    () =>
      overlayState.clipPathIndices.length > 0
      || overlayState.holePathIndices.length > 0
      || overlayState.adjustmentMasks.length > 0
      || overlayState.imageColorAdjustments !== undefined,
    [overlayState]
  )

  // Memoize the return object to prevent unnecessary re-renders of consumers
  return useMemo(
    () => ({
      overlayState,
      setImageColorAdjustments,
      updateImageColorAdjustment,
      updateFilterPresetParam,
      addClipPath,
      removeClipPath,
      toggleClipPath,
      isClipPath,
      addHolePath,
      removeHolePath,
      toggleHolePath,
      isHolePath,
      toggleAdjustmentMask,
      isAdjustmentMask,
      getAdjustmentMask,
      updateAdjustmentMask,
      remapIndices,
      restoreState,
      reset,
      hasModifications,
    }),
    [
      overlayState,
      setImageColorAdjustments,
      updateImageColorAdjustment,
      updateFilterPresetParam,
      addClipPath,
      removeClipPath,
      toggleClipPath,
      isClipPath,
      addHolePath,
      removeHolePath,
      toggleHolePath,
      isHolePath,
      toggleAdjustmentMask,
      isAdjustmentMask,
      getAdjustmentMask,
      updateAdjustmentMask,
      remapIndices,
      restoreState,
      reset,
      hasModifications,
    ]
  )
}

export default useOverlayState
