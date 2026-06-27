/**
 * useEditModeSettings - Hook for managing edit mode settings with localStorage persistence
 *
 * Manages settings for:
 * - Ruler visibility (top and left rulers)
 * - Grid visibility (snap grid overlay)
 */

import { useState, useEffect, useCallback } from 'react'
import type { EditModeSettings } from '../types'

const STORAGE_KEY = 'vectorEditor.editModeSettings'

const DEFAULT_SETTINGS: EditModeSettings = {
  showRuler: true,
  showGrid: false,
}

/**
 * Hook for managing edit mode settings with localStorage persistence
 *
 * @returns Object with settings state and update function
 *
 * @example
 * const { settings, updateSettings } = useEditModeSettings()
 *
 * // Toggle grid
 * updateSettings({ showGrid: !settings.showGrid })
 */
export function useEditModeSettings() {
  const [settings, setSettings] = useState<EditModeSettings>(() => {
    // Initialize from localStorage if available (client-side only)
    if (typeof window === 'undefined') {
      return DEFAULT_SETTINGS
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate structure before using
        if (
          typeof parsed === 'object'
          && typeof parsed.showRuler === 'boolean'
          && typeof parsed.showGrid === 'boolean'
        ) {
          return parsed
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }, [settings])

  /**
   * Update one or more settings
   * @param partial - Partial settings object to merge
   */
  const updateSettings = useCallback((partial: Partial<EditModeSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    settings,
    updateSettings,
    resetSettings,
  }
}

export type UseEditModeSettingsReturn = ReturnType<typeof useEditModeSettings>
