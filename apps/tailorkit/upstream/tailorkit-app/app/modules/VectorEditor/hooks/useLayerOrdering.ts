/**
 * Layer Ordering Hook
 * Handles z-index manipulation (move up/down/to front/to back) for paths
 */

import { useCallback, useMemo } from 'react'
import type { ParsedSvg, ParsedPath } from '../utils/svg'
import type { PathStyleWithSubpaths } from '../types'

export interface UseLayerOrderingProps {
  parsedSvg: ParsedSvg | null
  selectedPathIndex: number | null
  setParsedSvg: (svg: ParsedSvg) => void
  pushToHistory: (paths: ParsedPath[]) => void
  setSelectedPathIndices: React.Dispatch<React.SetStateAction<Set<number>>>
  pathStyles: Map<number, PathStyleWithSubpaths>
  setPathStyles: React.Dispatch<React.SetStateAction<Map<number, PathStyleWithSubpaths>>>
}

export function useLayerOrdering({
  parsedSvg,
  selectedPathIndex,
  setParsedSvg,
  pushToHistory,
  setSelectedPathIndices,
  pathStyles,
  setPathStyles,
}: UseLayerOrderingProps) {
  // Can move up = not already at top (last in array = front)
  const canMoveUp = useMemo(() => {
    if (selectedPathIndex === null || !parsedSvg) return false
    return selectedPathIndex < parsedSvg.paths.length - 1
  }, [selectedPathIndex, parsedSvg])

  // Can move down = not already at bottom (first in array = back)
  const canMoveDown = useMemo(() => {
    if (selectedPathIndex === null || !parsedSvg) return false
    return selectedPathIndex > 0
  }, [selectedPathIndex, parsedSvg])

  // Move path up (toward front - swap with next index)
  const handleMoveUp = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveUp) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    // Swap with next path
    ;[newPaths[idx], newPaths[idx + 1]] = [newPaths[idx + 1], newPaths[idx]]

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths)
    setSelectedPathIndices(new Set([idx + 1]))

    // Update pathStyles map if needed
    setPathStyles(prev => {
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          newStyles.set(idx + 1, style)
        } else if (index === idx + 1) {
          newStyles.set(idx, style)
        } else {
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [parsedSvg, selectedPathIndex, canMoveUp, pushToHistory, setParsedSvg, setSelectedPathIndices, setPathStyles])

  // Move path down (toward back - swap with previous index)
  const handleMoveDown = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveDown) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    // Swap with previous path
    ;[newPaths[idx], newPaths[idx - 1]] = [newPaths[idx - 1], newPaths[idx]]

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths)
    setSelectedPathIndices(new Set([idx - 1]))

    // Update pathStyles map
    setPathStyles(prev => {
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          newStyles.set(idx - 1, style)
        } else if (index === idx - 1) {
          newStyles.set(idx, style)
        } else {
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [parsedSvg, selectedPathIndex, canMoveDown, pushToHistory, setParsedSvg, setSelectedPathIndices, setPathStyles])

  // Move path to front (last in array)
  const handleMoveToFront = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveUp) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    const [path] = newPaths.splice(idx, 1)
    newPaths.push(path)

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths)
    setSelectedPathIndices(new Set([newPaths.length - 1]))

    // Update pathStyles map - shift all indices above down, put moved path at end
    setPathStyles(prev => {
      const movedStyle = prev.get(idx)
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          // This path moves to end
          if (movedStyle) newStyles.set(newPaths.length - 1, movedStyle)
        } else if (index > idx) {
          // Shift down by 1
          newStyles.set(index - 1, style)
        } else {
          // Keep same index
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [parsedSvg, selectedPathIndex, canMoveUp, pushToHistory, setParsedSvg, setSelectedPathIndices, setPathStyles])

  // Move path to back (first in array)
  const handleMoveToBack = useCallback(() => {
    if (!parsedSvg || selectedPathIndex === null || !canMoveDown) return

    const newPaths = [...parsedSvg.paths]
    const idx = selectedPathIndex
    const [path] = newPaths.splice(idx, 1)
    newPaths.unshift(path)

    setParsedSvg({ ...parsedSvg, paths: newPaths })
    pushToHistory(newPaths)
    setSelectedPathIndices(new Set([0]))

    // Update pathStyles map - shift all indices below up, put moved path at start
    setPathStyles(prev => {
      const movedStyle = prev.get(idx)
      const newStyles = new Map<number, PathStyleWithSubpaths>()
      prev.forEach((style, index) => {
        if (index === idx) {
          // This path moves to start
          if (movedStyle) newStyles.set(0, movedStyle)
        } else if (index < idx) {
          // Shift up by 1
          newStyles.set(index + 1, style)
        } else {
          // Keep same index
          newStyles.set(index, style)
        }
      })
      return newStyles
    })
  }, [parsedSvg, selectedPathIndex, canMoveDown, pushToHistory, setParsedSvg, setSelectedPathIndices, setPathStyles])

  return {
    canMoveUp,
    canMoveDown,
    handleMoveUp,
    handleMoveDown,
    handleMoveToFront,
    handleMoveToBack,
  }
}
