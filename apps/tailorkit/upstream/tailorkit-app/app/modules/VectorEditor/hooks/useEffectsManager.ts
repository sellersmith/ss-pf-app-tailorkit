/**
 * useEffectsManager - Hook for managing SVG effects (gradients, filters, masks, etc.)
 */

import { useState, useCallback, useMemo } from 'react'
import type {
  SvgDefs,
  GradientDef,
  FilterDef,
  MaskDef,
  ClipPathDef,
  Paint,
  BlendMode,
  ColorAdjustments,
} from '../types'
import {
  createEmptyDefs,
  addGradientToDefs,
  removeGradientFromDefs,
  addFilterToDefs,
  removeFilterFromDefs,
  addMaskToDefs,
  removeMaskFromDefs,
  addClipPathToDefs,
  removeClipPathFromDefs,
  createSolidPaint,
  createGradientPaint,
} from '../utils/svg'

export interface UseEffectsManagerOptions {
  /** Initial defs */
  initialDefs?: SvgDefs
  /** Callback when defs change */
  onDefsChange?: (defs: SvgDefs) => void
}

export interface UseEffectsManagerReturn {
  /** Current defs */
  defs: SvgDefs

  // Gradient management
  createGradient: (gradient: GradientDef) => void
  updateGradient: (id: string, updates: Partial<GradientDef>) => void
  deleteGradient: (id: string) => void

  // Filter management
  createFilter: (filter: FilterDef) => void
  updateFilter: (id: string, updates: Partial<FilterDef>) => void
  deleteFilter: (id: string) => void

  // Mask management
  createMask: (mask: MaskDef) => void
  updateMask: (id: string, updates: Partial<MaskDef>) => void
  deleteMask: (id: string) => void

  // Clip path management
  createClipPath: (clipPath: ClipPathDef) => void
  updateClipPath: (id: string, updates: Partial<ClipPathDef>) => void
  deleteClipPath: (id: string) => void

  // Path style updates (returns new path style properties)
  applyFillGradient: (gradientId: string) => { fill: Paint }
  applyStrokeGradient: (gradientId: string) => { stroke: Paint }
  applyFillColor: (color: string) => { fill: Paint }
  applyStrokeColor: (color: string) => { stroke: Paint }
  applyFilter: (filterId: string | null) => { filterId: string | undefined }
  applyMask: (maskId: string | null) => { maskId: string | undefined }
  applyClipPath: (clipPathId: string | null) => { clipPathId: string | undefined }
  applyBlendMode: (mode: BlendMode) => { mixBlendMode: BlendMode }
  applyOpacity: (opacity: number) => { opacity: number }
  applyColorAdjustments: (adjustments: ColorAdjustments) => { colorAdjustments: ColorAdjustments }

  // Utility
  setDefs: (defs: SvgDefs) => void
  reset: () => void
}

export function useEffectsManager(options: UseEffectsManagerOptions = {}): UseEffectsManagerReturn {
  const { initialDefs, onDefsChange } = options

  // Defs state
  const [defs, setDefsState] = useState<SvgDefs>(initialDefs || createEmptyDefs())

  // Helper to update defs and notify - supports both direct value and functional updates
  const setDefs = useCallback(
    (newDefsOrUpdater: SvgDefs | ((currentDefs: SvgDefs) => SvgDefs)) => {
      if (typeof newDefsOrUpdater === 'function') {
        setDefsState(currentDefs => {
          const newDefs = newDefsOrUpdater(currentDefs)
          onDefsChange?.(newDefs)
          return newDefs
        })
      } else {
        setDefsState(newDefsOrUpdater)
        onDefsChange?.(newDefsOrUpdater)
      }
    },
    [onDefsChange]
  )

  // Reset
  const reset = useCallback(() => {
    setDefs(createEmptyDefs())
  }, [setDefs])

  // =====================
  // Gradient Management
  // =====================

  const createGradient = useCallback(
    (gradient: GradientDef) => {
      setDefs(currentDefs => addGradientToDefs(currentDefs, gradient))
    },
    [setDefs]
  )

  const updateGradient = useCallback(
    (id: string, updates: Partial<GradientDef>) => {
      setDefs(currentDefs => {
        const existing = currentDefs.gradients.get(id)
        if (!existing) {
          console.warn(`Gradient ${id} not found in defs`)
          return currentDefs
        }

        const updated = { ...existing, ...updates } as GradientDef
        const newDefs = removeGradientFromDefs(currentDefs, id)
        return addGradientToDefs(newDefs, updated)
      })
    },
    [setDefs]
  )

  const deleteGradient = useCallback(
    (id: string) => {
      setDefs(currentDefs => removeGradientFromDefs(currentDefs, id))
    },
    [setDefs]
  )

  // =====================
  // Filter Management
  // =====================

  const createFilter = useCallback(
    (filter: FilterDef) => {
      setDefs(currentDefs => addFilterToDefs(currentDefs, filter))
    },
    [setDefs]
  )

  const updateFilter = useCallback(
    (id: string, updates: Partial<FilterDef>) => {
      setDefs(currentDefs => {
        const existing = currentDefs.filters.get(id)
        if (!existing) {
          console.warn(`Filter ${id} not found in defs`)
          return currentDefs
        }

        const updated = { ...existing, ...updates }
        const newDefs = removeFilterFromDefs(currentDefs, id)
        return addFilterToDefs(newDefs, updated)
      })
    },
    [setDefs]
  )

  const deleteFilter = useCallback(
    (id: string) => {
      setDefs(currentDefs => removeFilterFromDefs(currentDefs, id))
    },
    [setDefs]
  )

  // =====================
  // Mask Management
  // =====================

  const createMask = useCallback(
    (mask: MaskDef) => {
      setDefs(currentDefs => addMaskToDefs(currentDefs, mask))
    },
    [setDefs]
  )

  const updateMask = useCallback(
    (id: string, updates: Partial<MaskDef>) => {
      setDefs(currentDefs => {
        const existing = currentDefs.masks.get(id)
        if (!existing) {
          console.warn(`Mask ${id} not found in defs`)
          return currentDefs
        }

        const updated = { ...existing, ...updates }
        const newDefs = removeMaskFromDefs(currentDefs, id)
        return addMaskToDefs(newDefs, updated)
      })
    },
    [setDefs]
  )

  const deleteMask = useCallback(
    (id: string) => {
      setDefs(currentDefs => removeMaskFromDefs(currentDefs, id))
    },
    [setDefs]
  )

  // =====================
  // Clip Path Management
  // =====================

  const createClipPath = useCallback(
    (clipPath: ClipPathDef) => {
      setDefs(currentDefs => addClipPathToDefs(currentDefs, clipPath))
    },
    [setDefs]
  )

  const updateClipPath = useCallback(
    (id: string, updates: Partial<ClipPathDef>) => {
      setDefs(currentDefs => {
        const existing = currentDefs.clipPaths.get(id)
        if (!existing) {
          console.warn(`ClipPath ${id} not found in defs`)
          return currentDefs
        }

        const updated = { ...existing, ...updates }
        const newDefs = removeClipPathFromDefs(currentDefs, id)
        return addClipPathToDefs(newDefs, updated)
      })
    },
    [setDefs]
  )

  const deleteClipPath = useCallback(
    (id: string) => {
      setDefs(currentDefs => removeClipPathFromDefs(currentDefs, id))
    },
    [setDefs]
  )

  // =====================
  // Path Style Updates
  // =====================

  const applyFillGradient = useCallback((gradientId: string): { fill: Paint } => {
    return { fill: createGradientPaint(gradientId) }
  }, [])

  const applyStrokeGradient = useCallback((gradientId: string): { stroke: Paint } => {
    return { stroke: createGradientPaint(gradientId) }
  }, [])

  const applyFillColor = useCallback((color: string): { fill: Paint } => {
    return { fill: createSolidPaint(color) }
  }, [])

  const applyStrokeColor = useCallback((color: string): { stroke: Paint } => {
    return { stroke: createSolidPaint(color) }
  }, [])

  const applyFilter = useCallback((filterId: string | null): { filterId: string | undefined } => {
    return { filterId: filterId || undefined }
  }, [])

  const applyMask = useCallback((maskId: string | null): { maskId: string | undefined } => {
    return { maskId: maskId || undefined }
  }, [])

  const applyClipPath = useCallback((clipPathId: string | null): { clipPathId: string | undefined } => {
    return { clipPathId: clipPathId || undefined }
  }, [])

  const applyBlendMode = useCallback((mode: BlendMode): { mixBlendMode: BlendMode } => {
    return { mixBlendMode: mode }
  }, [])

  const applyOpacity = useCallback((opacity: number): { opacity: number } => {
    return { opacity: Math.max(0, Math.min(1, opacity)) }
  }, [])

  const applyColorAdjustments = useCallback((adjustments: ColorAdjustments): { colorAdjustments: ColorAdjustments } => {
    // Just store the adjustments - don't create an SVG filter
    // Color adjustments will be applied via CSS filter in the renderer
    // This allows color adjustments to coexist with SVG filters (blur, shadow)
    return { colorAdjustments: adjustments }
  }, [])

  return useMemo(
    () => ({
      defs,
      createGradient,
      updateGradient,
      deleteGradient,
      createFilter,
      updateFilter,
      deleteFilter,
      createMask,
      updateMask,
      deleteMask,
      createClipPath,
      updateClipPath,
      deleteClipPath,
      applyFillGradient,
      applyStrokeGradient,
      applyFillColor,
      applyStrokeColor,
      applyFilter,
      applyMask,
      applyClipPath,
      applyBlendMode,
      applyOpacity,
      applyColorAdjustments,
      setDefs,
      reset,
    }),
    [
      defs,
      createGradient,
      updateGradient,
      deleteGradient,
      createFilter,
      updateFilter,
      deleteFilter,
      createMask,
      updateMask,
      deleteMask,
      createClipPath,
      updateClipPath,
      deleteClipPath,
      applyFillGradient,
      applyStrokeGradient,
      applyFillColor,
      applyStrokeColor,
      applyFilter,
      applyMask,
      applyClipPath,
      applyBlendMode,
      applyOpacity,
      applyColorAdjustments,
      setDefs,
      reset,
    ]
  )
}

export default useEffectsManager
