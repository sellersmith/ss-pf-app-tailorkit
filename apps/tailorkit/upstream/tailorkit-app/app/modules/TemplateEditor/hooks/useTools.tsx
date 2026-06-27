import { useCallback } from 'react'
import { useKeyboardState } from '../contexts/KeyboardContext'
import type { ToolBarGridSettings, ToolBarMode, ToolBarQuickTool, ToolBarSettings } from '../contexts/ToolBarContext'
import { useToolBarState } from '../contexts/ToolBarContext'

interface ToolState {
  /** Current tool mode */
  mode: ToolBarMode
  /** Quick tools selected */
  quickTools: ToolBarQuickTool[]
  /** Whether the hand tool is active or the space key is pressed */
  isGrabbing: boolean
  /** Whether the ruler tool is active */
  isRulerModeVisible: boolean
  /** Whether the grid tool is active */
  isGridModeVisible: boolean
  /** Grid settings */
  toolBarSettings: ToolBarSettings
  /** Dispatch function for tool actions */
  dispatch: (action: { payload: any }) => void
  /** Handler for mode change */
  onModeChangeHandler: (mode: ToolBarMode) => void
  /** Handler for quick tools change */
  onQuickToolsChangeHandler: (quickTool: ToolBarQuickTool) => void
  /** Handler for grid settings change */
  onGridSettingsChangeHandler: (gridSettings: ToolBarGridSettings) => void
  /** Handler for grid size change */
  onGridSizeChangeHandler: (gridSize: number | string) => void
}

/**
 * Hook for managing template editor tools and interactions
 * Provides access to current tool mode, quick tools, and grabbing state
 * @returns {Object} Object containing tool state and actions
 */
export function useTools(): ToolState {
  const { mode, quickTools, settings, dispatch } = useToolBarState()
  const { isSpacePressed } = useKeyboardState()

  // TODO: CREATE A NEW CONTEXT TO CONTROL THE VIEWPORT
  // MIGRATE THE TEMPLATE EDITOR STORE TO USE THE CONTEXT

  // Check if the hand tool is active or the space key is pressed
  const isGrabbing = mode === 'hand-tool' || isSpacePressed

  // Check if the ruler tool is active
  const isRulerModeVisible = quickTools.includes('ruler-tool')
  // Check if the grid tool is active
  const isGridModeVisible = quickTools.includes('grid-tool')

  const onModeChangeHandler = useCallback(
    (mode: ToolBarMode) => {
      dispatch({
        payload: {
          mode,
        },
      })
    },
    [dispatch]
  )

  const onQuickToolsChangeHandler = useCallback(
    (quickTool: ToolBarQuickTool) => {
      // Create a new array with the updated quick tools
      const _quickTools = quickTools.includes(quickTool)
        ? quickTools.filter(tool => tool !== quickTool)
        : [...quickTools, quickTool]

      // Dispatch the new quick tools
      dispatch({
        payload: {
          quickTools: _quickTools,
        },
      })
    },
    [quickTools, dispatch]
  )

  const onGridSettingsChangeHandler = useCallback(
    (gridSettings: ToolBarGridSettings) => {
      dispatch({
        payload: {
          settings: {
            ...settings,
            grid: gridSettings,
          },
        },
      })
    },
    [settings, dispatch]
  )

  const onGridSizeChangeHandler = useCallback(
    (gridSize: number | string) => {
      const parsed = Number(gridSize)
      if (!isNaN(parsed)) {
        const clamped = Math.max(0, parsed)
        onGridSettingsChangeHandler({
          ...settings.grid,
          gridSize: clamped,
        })
      }
    },
    [onGridSettingsChangeHandler, settings.grid]
  )

  return {
    mode,
    quickTools,
    toolBarSettings: settings,
    isGrabbing,
    isRulerModeVisible,
    isGridModeVisible,
    dispatch,
    onModeChangeHandler,
    onQuickToolsChangeHandler,
    onGridSettingsChangeHandler,
    onGridSizeChangeHandler,
  }
}
