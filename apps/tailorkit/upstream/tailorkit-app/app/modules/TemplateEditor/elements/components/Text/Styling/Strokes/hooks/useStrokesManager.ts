/**
 * useStrokesManager - State management hook for multiple strokes
 *
 * Manages strokes array with TextStudio-style wrapping:
 * - Up to 5 strokes per element
 * - Each stroke has independent weight (% of fontSize)
 * - Paint-based fills (solid, image, gradient)
 *
 * @module TemplateEditor/elements/components/Text/Styling/Strokes
 */

import { useCallback, useMemo, useState } from 'react'
import type { StrokeConfig, Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { MAX_STROKES, DEFAULT_STROKE, colorToSolidPaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { uuid } from '~/utils/uuid'
import type TemplateElement from '../../../..'
import type { TLayerStore } from '~/stores/modules/layer'
import { useStore } from '~/libs/external-store'

interface UseStrokesManagerProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
}

interface UseStrokesManagerReturn {
  // State
  strokes: StrokeConfig[]
  canAddStroke: boolean

  // UI State
  settingsOpen: Record<string, boolean>
  toggleSettingsOpen: (id: string) => void
  closeSettings: (id: string) => void

  // Handlers
  handleAddStroke: (openSettings?: boolean) => void
  handleRemoveStroke: (index: number) => void
  handleUpdateStroke: (index: number, patch: Partial<StrokeConfig>) => void
  handleToggleVisible: (index: number, checked: boolean) => void
  handleReorder: (items: Array<{ id: string; payload: unknown }>) => void
  handlePaintChange: (index: number, paint: Paint) => void
  handleWeightChange: (index: number, weight: number) => void
  handleOpacityChange: (index: number, opacity: number) => void
}

/**
 * Hook that manages strokes state and handlers for StrokesStack component.
 * Handles migration from legacy strokeColor/strokeWeight to strokes array.
 */
export function useStrokesManager({ element, clickedLayerStore }: UseStrokesManagerProps): UseStrokesManagerReturn {
  // ============================================================================
  // Determine target layer store (for nested elements in multi-layout)
  // ============================================================================

  const targetLayerStore = useMemo(() => {
    // For nested elements (e.g., text in multi-layout), use clickedLayerStore
    // Otherwise use element's layerStore
    if (clickedLayerStore && clickedLayerStore.getState()._id !== element.state._id) {
      return clickedLayerStore
    }
    return element.props.layerStore
  }, [clickedLayerStore, element])

  // Subscribe to targetLayerStore for settings
  const settings = useStore(targetLayerStore, state => (state as any).settings || {})

  // ============================================================================
  // State from element settings
  // ============================================================================

  const strokes = useMemo((): StrokeConfig[] => {
    // Check for new strokes array first
    if (settings?.strokes && Array.isArray(settings.strokes) && settings.strokes.length > 0) {
      return settings.strokes
    }

    // Legacy migration: Convert old strokeColor/strokeWeight to strokes[0]
    if (settings?.strokeColor && settings?.strokeWeight > 0) {
      return [
        {
          _id: uuid().split('-')[0],
          paint: colorToSolidPaint(settings.strokeColor),
          weight: settings.strokeWeight,
          opacity: 1,
          visible: true,
        },
      ]
    }

    return []
  }, [settings])

  const canAddStroke = strokes.length < MAX_STROKES

  // ============================================================================
  // UI State
  // ============================================================================

  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({})

  const toggleSettingsOpen = useCallback((id: string) => {
    setSettingsOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const closeSettings = useCallback((id: string) => {
    setSettingsOpen(prev => ({ ...prev, [id]: false }))
  }, [])

  // ============================================================================
  // Helper functions
  // ============================================================================

  const setStrokes = useCallback(
    (newStrokes: StrokeConfig[]) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              strokes: newStrokes,
              // Clear legacy fields when using new strokes array
              strokeColor: undefined,
              strokeWeight: undefined,
            },
          },
        },
      })
    },
    [targetLayerStore]
  )

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAddStroke = useCallback(
    (openSettings: boolean = false) => {
      if (!canAddStroke) return

      const newId = uuid().split('-')[0]
      const newStroke: StrokeConfig = {
        _id: newId,
        ...DEFAULT_STROKE,
      }

      const nextStrokes = [...strokes, newStroke]
      setStrokes(nextStrokes)

      if (openSettings) {
        setTimeout(() => {
          setSettingsOpen(prev => {
            const newState: Record<string, boolean> = {}
            Object.keys(prev).forEach(k => {
              newState[k] = false
            })
            newState[newId] = true
            return newState
          })
        }, 50)
      }
    },
    [canAddStroke, strokes, setStrokes]
  )

  const handleRemoveStroke = useCallback(
    (index: number) => {
      const nextStrokes = strokes.slice(0, index).concat(strokes.slice(index + 1))
      setStrokes(nextStrokes)
    },
    [strokes, setStrokes]
  )

  const handleUpdateStroke = useCallback(
    (index: number, patch: Partial<StrokeConfig>) => {
      const nextStrokes = [...strokes]
      nextStrokes[index] = { ...nextStrokes[index], ...patch }
      setStrokes(nextStrokes)
    },
    [strokes, setStrokes]
  )

  const handleToggleVisible = useCallback(
    (index: number, checked: boolean) => {
      const nextStrokes = [...strokes]
      nextStrokes[index] = { ...nextStrokes[index], visible: checked }
      setStrokes(nextStrokes)
    },
    [strokes, setStrokes]
  )

  const handleReorder = useCallback(
    (items: Array<{ id: string; payload: unknown }>) => {
      const nextStrokes = items.map(it => it.payload as StrokeConfig)
      setStrokes(nextStrokes)
    },
    [setStrokes]
  )

  const handlePaintChange = useCallback(
    (index: number, paint: Paint) => {
      handleUpdateStroke(index, { paint })
    },
    [handleUpdateStroke]
  )

  const handleWeightChange = useCallback(
    (index: number, weight: number) => {
      handleUpdateStroke(index, { weight })
    },
    [handleUpdateStroke]
  )

  const handleOpacityChange = useCallback(
    (index: number, opacity: number) => {
      handleUpdateStroke(index, { opacity })
    },
    [handleUpdateStroke]
  )

  return {
    // State
    strokes,
    canAddStroke,

    // UI State
    settingsOpen,
    toggleSettingsOpen,
    closeSettings,

    // Handlers
    handleAddStroke,
    handleRemoveStroke,
    handleUpdateStroke,
    handleToggleVisible,
    handleReorder,
    handlePaintChange,
    handleWeightChange,
    handleOpacityChange,
  }
}
