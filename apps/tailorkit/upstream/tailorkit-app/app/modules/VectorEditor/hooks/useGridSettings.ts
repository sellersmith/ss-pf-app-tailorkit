/**
 * useGridSettings - Hook for managing grid settings with localStorage persistence
 *
 * Manages:
 * - Grid cell size (in SVG units)
 * - Snap enabled state
 */

import { useState, useEffect, useCallback } from 'react'
import type { GridSettings } from '../types'
import { DEFAULT_GRID_SIZE, MIN_GRID_SIZE, MAX_GRID_SIZE } from '../constants'

const STORAGE_KEY = 'vectorEditor.gridSettings'

const DEFAULT_SETTINGS: GridSettings = {
  size: DEFAULT_GRID_SIZE,
  snapEnabled: true,
}

/**
 * Hook for managing grid settings with localStorage persistence
 *
 * @returns Object with grid settings state and update function
 *
 * @example
 * const { gridSettings, updateGridSettings } = useGridSettings()
 *
 * // Change grid size
 * updateGridSettings({ size: 20 })
 *
 * // Toggle snap
 * updateGridSettings({ snapEnabled: !gridSettings.snapEnabled })
 */
export function useGridSettings() {
  const [gridSettings, setGridSettings] = useState<GridSettings>(() => {
    // Initialize from localStorage if available (client-side only)
    if (typeof window === 'undefined') {
      return DEFAULT_SETTINGS
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate structure before using
        if (typeof parsed === 'object' && typeof parsed.size === 'number' && typeof parsed.snapEnabled === 'boolean') {
          // Clamp size to valid range
          return {
            ...parsed,
            size: Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, parsed.size)),
          }
        }
      }
    } catch {
      // Ignore parse errors, use defaults
    }

    return DEFAULT_SETTINGS
  })

  // Persist to localStorage when settings change
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gridSettings))
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }, [gridSettings])

  /**
   * Update one or more grid settings
   * @param partial - Partial settings object to merge
   */
  const updateGridSettings = useCallback((partial: Partial<GridSettings>) => {
    setGridSettings(prev => {
      const next = { ...prev, ...partial }

      // Clamp size to valid range if provided
      if (partial.size !== undefined) {
        next.size = Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, partial.size))
      }

      return next
    })
  }, [])

  /**
   * Reset grid settings to defaults
   */
  const resetGridSettings = useCallback(() => {
    setGridSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    gridSettings,
    updateGridSettings,
    resetGridSettings,
  }
}

export type UseGridSettingsReturn = ReturnType<typeof useGridSettings>
