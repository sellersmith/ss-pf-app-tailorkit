/**
 * useEditorHistory - Manages undo/redo history for the editor
 */

import { useState, useCallback } from 'react'
import type { ParsedPath, PathStyleWithSubpaths, SvgDefs, SubpathStyleOverride } from '../utils/svg'
import { createEmptyDefs } from '../utils/svg'
import type { HistoryState, OverlayState } from '../types'
import { MAX_HISTORY_SIZE } from '../constants'

interface UseEditorHistoryOptions {
  maxHistorySize?: number
}

const DEFAULT_OVERLAY_STATE: OverlayState = {
  imageColorAdjustments: undefined,
  clipPathIndices: [],
  holePathIndices: [],
  adjustmentMasks: [],
}

// Serialization helpers for Map<number, PathStyleWithSubpaths>
function serializePathStyles(styles: Map<number, PathStyleWithSubpaths>): [number, PathStyleWithSubpaths][] {
  return Array.from(styles.entries()).map(([key, value]) => {
    // Deep clone the value, handling nested Maps (subpathStyles)
    const clonedValue: PathStyleWithSubpaths = { ...value }
    if (value.subpathStyles) {
      clonedValue.subpathStyles = new Map(value.subpathStyles)
    }
    return [key, clonedValue]
  })
}

function deserializePathStyles(entries: [number, PathStyleWithSubpaths][]): Map<number, PathStyleWithSubpaths> {
  return new Map(
    entries.map(([key, value]) => {
      // Restore nested Maps
      const restoredValue: PathStyleWithSubpaths = { ...value }
      if (value.subpathStyles) {
        restoredValue.subpathStyles = new Map(
          Object.entries(value.subpathStyles as object).map(([k, v]) => [parseInt(k, 10), v as SubpathStyleOverride])
        )
      }
      return [key, restoredValue]
    })
  )
}

// Serialization helpers for SvgDefs
function serializeDefs(defs: SvgDefs): {
  gradients: [string, unknown][]
  filters: [string, unknown][]
  masks: [string, unknown][]
  clipPaths: [string, unknown][]
} {
  return {
    gradients: Array.from(defs.gradients.entries()),
    filters: Array.from(defs.filters.entries()),
    masks: Array.from(defs.masks.entries()),
    clipPaths: Array.from(defs.clipPaths.entries()),
  }
}

function deserializeDefs(data: {
  gradients: [string, unknown][]
  filters: [string, unknown][]
  masks: [string, unknown][]
  clipPaths: [string, unknown][]
}): SvgDefs {
  return {
    gradients: new Map(data.gradients),
    filters: new Map(data.filters),
    masks: new Map(data.masks),
    clipPaths: new Map(data.clipPaths),
  } as SvgDefs
}

interface UseEditorHistoryReturn {
  history: HistoryState[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
  pushToHistory: (
    paths: ParsedPath[],
    overlayState: OverlayState,
    pathStyles: Map<number, PathStyleWithSubpaths>,
    defs: SvgDefs
  ) => void
  undo: () => HistoryState | null
  redo: () => HistoryState | null
  resetHistory: (
    initialPaths: ParsedPath[],
    overlayState?: OverlayState,
    pathStyles?: Map<number, PathStyleWithSubpaths>,
    defs?: SvgDefs
  ) => void
}

export function useEditorHistory(options: UseEditorHistoryOptions = {}): UseEditorHistoryReturn {
  const { maxHistorySize = MAX_HISTORY_SIZE } = options

  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const pushToHistory = useCallback(
    (
      newPaths: ParsedPath[],
      overlayState: OverlayState,
      pathStyles: Map<number, PathStyleWithSubpaths>,
      defs: SvgDefs
    ) => {
      setHistory(prevHistory => {
        // Slice history up to current index (discard any "future" states after undo)
        const newHistory = prevHistory.slice(0, historyIndex + 1)
        // Add new state with all editor state
        newHistory.push({
          paths: JSON.parse(JSON.stringify(newPaths)),
          overlayState: JSON.parse(JSON.stringify(overlayState)),
          pathStyles: deserializePathStyles(JSON.parse(JSON.stringify(serializePathStyles(pathStyles)))),
          defs: deserializeDefs(JSON.parse(JSON.stringify(serializeDefs(defs)))),
        })

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift()
          return newHistory
        }

        return newHistory
      })
      setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1))
    },
    [historyIndex, maxHistorySize]
  )

  const undo = useCallback((): HistoryState | null => {
    if (!canUndo) return null

    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    const state = history[newIndex]
    // Deep clone the state including Maps
    return {
      paths: JSON.parse(JSON.stringify(state.paths)),
      overlayState: JSON.parse(JSON.stringify(state.overlayState)),
      pathStyles: deserializePathStyles(JSON.parse(JSON.stringify(serializePathStyles(state.pathStyles)))),
      defs: deserializeDefs(JSON.parse(JSON.stringify(serializeDefs(state.defs)))),
    }
  }, [canUndo, historyIndex, history])

  const redo = useCallback((): HistoryState | null => {
    if (!canRedo) return null

    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    const state = history[newIndex]
    // Deep clone the state including Maps
    return {
      paths: JSON.parse(JSON.stringify(state.paths)),
      overlayState: JSON.parse(JSON.stringify(state.overlayState)),
      pathStyles: deserializePathStyles(JSON.parse(JSON.stringify(serializePathStyles(state.pathStyles)))),
      defs: deserializeDefs(JSON.parse(JSON.stringify(serializeDefs(state.defs)))),
    }
  }, [canRedo, historyIndex, history])

  const resetHistory = useCallback(
    (
      initialPaths: ParsedPath[],
      overlayState?: OverlayState,
      pathStyles?: Map<number, PathStyleWithSubpaths>,
      defs?: SvgDefs
    ) => {
      const effectivePathStyles = pathStyles || new Map()
      const effectiveDefs = defs || createEmptyDefs()
      setHistory([
        {
          paths: JSON.parse(JSON.stringify(initialPaths)),
          overlayState: JSON.parse(JSON.stringify(overlayState || DEFAULT_OVERLAY_STATE)),
          pathStyles: deserializePathStyles(JSON.parse(JSON.stringify(serializePathStyles(effectivePathStyles)))),
          defs: deserializeDefs(JSON.parse(JSON.stringify(serializeDefs(effectiveDefs)))),
        },
      ])
      setHistoryIndex(0)
    },
    []
  )

  return {
    history,
    historyIndex,
    canUndo,
    canRedo,
    pushToHistory,
    undo,
    redo,
    resetHistory,
  }
}
