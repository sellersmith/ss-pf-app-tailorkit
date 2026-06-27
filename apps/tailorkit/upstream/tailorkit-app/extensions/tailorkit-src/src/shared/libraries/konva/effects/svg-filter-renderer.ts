/**
 * SVG Filter Renderer
 *
 * Framework-agnostic utilities for rendering text with SVG filter effects.
 * Works with vanilla Konva - can be used in React or non-React contexts.
 *
 * @module shared/libraries/konva/effects
 * @deprecated - Use SVGFilterManager instead. May be in the future, when context.filter is supported by all browsers.
 */

import type Konva from 'konva'
import type { Context } from 'konva/lib/Context'
import type { DropShadowConfig, InnerShadowConfig } from './types'
import { getSVGFilterManager } from './svg-filter-manager'

/**
 * State for tracking filter and scale across renders
 */
export interface FilterRenderState {
  /** Current filter ID */
  filterId: string | null
  /** Last used stage scale */
  lastScale: number
}

/**
 * Configuration for filter rendering
 */
export interface FilterRenderConfig {
  /** Inner shadow effects */
  innerShadows: InnerShadowConfig[]
  /** Drop shadow effects */
  dropShadows: DropShadowConfig[]
  /** RGB color (without alpha) for the text */
  rgbColor: string
  /** Original color with alpha */
  originalColor: string
  /** Combined fill opacity (0-1) */
  fillOpacity: number
  /** Whether effects are enabled */
  hasEffects: boolean
}

/**
 * Create initial filter render state
 */
export function createFilterRenderState(): FilterRenderState {
  return {
    filterId: null,
    lastScale: 1,
  }
}

/**
 * Update filter if scale has changed
 *
 * @param state - Mutable state object to update
 * @param config - Filter configuration
 * @param currentScale - Current stage scale
 * @returns The active filter ID (or null if no effects)
 */
export function updateFilterForScale(
  state: FilterRenderState,
  config: FilterRenderConfig,
  currentScale: number
): string | null {
  if (!config.hasEffects) {
    // Clean up existing filter if effects were disabled
    if (state.filterId) {
      getSVGFilterManager().removeFilter(state.filterId)
      state.filterId = null
    }
    state.lastScale = currentScale
    return null
  }

  // Check if scale changed and we need to recreate filter
  if (currentScale !== state.lastScale || !state.filterId) {
    state.lastScale = currentScale

    // Remove old filter
    if (state.filterId) {
      getSVGFilterManager().removeFilter(state.filterId)
    }

    // Create new filter with current scale
    state.filterId = getSVGFilterManager().createCombinedFilter(
      config.innerShadows,
      config.dropShadows,
      config.rgbColor,
      config.fillOpacity,
      currentScale
    )
  }

  return state.filterId
}

/**
 * Clean up filter state
 *
 * @param state - State object to clean up
 */
export function cleanupFilterState(state: FilterRenderState): void {
  if (state.filterId) {
    getSVGFilterManager().removeFilter(state.filterId)
    state.filterId = null
  }
  state.lastScale = 1
}

/**
 * Create a sceneFunc for rendering text/textPath with SVG filter effects
 *
 * @param helperNode - The Konva.Text or Konva.TextPath helper node (not added to layer)
 * @param state - Mutable state for tracking filter and scale
 * @param config - Filter configuration
 * @returns A sceneFunc compatible with Konva.Shape
 */
export function createFilteredSceneFunc(
  helperNode: Konva.Text | Konva.TextPath,
  state: FilterRenderState,
  config: FilterRenderConfig
): (context: Context, shape: Konva.Shape) => void {
  return (context: Context, shape: Konva.Shape) => {
    // Get current stage scale directly from Konva
    const currentScale = shape.getStage()?.scaleX() ?? 1

    // Update filter if needed
    const activeFilterId = updateFilterForScale(state, config, currentScale)

    const ctx = context._context as CanvasRenderingContext2D

    // Apply SVG filter if we have effects
    if (activeFilterId) {
      ctx.filter = `url(#${activeFilterId})`
      // Use solid RGB color (no alpha) when filter is active
      // The filter's feComponentTransfer handles opacity independently from shadows
      helperNode.fill(config.rgbColor)
    } else {
      // When no filter, use original color with alpha
      helperNode.fill(config.originalColor)
    }

    // Render using Konva's internal scene function
    helperNode._sceneFunc(context)

    // Reset filter
    if (activeFilterId) {
      ctx.filter = 'none'
    }
  }
}

/**
 * Create a hitFunc for hit detection on text/textPath
 *
 * @param helperNode - The Konva.Text or Konva.TextPath helper node
 * @returns A hitFunc compatible with Konva.Shape
 */
export function createFilteredHitFunc(helperNode: Konva.Text | Konva.TextPath): (context: Context) => void {
  return (context: Context) => {
    helperNode._hitFunc(context)
  }
}

/**
 * Higher-level helper that creates both sceneFunc and hitFunc
 *
 * @param helperNode - The Konva.Text or Konva.TextPath helper node
 * @param state - Mutable state for tracking filter and scale
 * @param config - Filter configuration
 * @returns Object with sceneFunc and hitFunc
 */
export function createFilteredRenderFuncs(
  helperNode: Konva.Text | Konva.TextPath,
  state: FilterRenderState,
  config: FilterRenderConfig
): {
  sceneFunc: (context: Context, shape: Konva.Shape) => void
  hitFunc: (context: Context) => void
} {
  return {
    sceneFunc: createFilteredSceneFunc(helperNode, state, config),
    hitFunc: createFilteredHitFunc(helperNode),
  }
}
