/**
 * Subpath Style Utilities
 * Helper functions for per-subpath styling in VectorEditor
 */

import type {
  PathStyle,
  PathStyleWithSubpaths,
  SubpathStyleOverride,
  SubpathStylesMap,
  SubpathKey,
  Paint,
  ColorAdjustments,
} from './svg'
import type { ConnectedSegment } from '../types'

/**
 * Compute effective style for a subpath by merging override with parent path style
 * Properties in override take precedence; undefined means inherit from parent
 * null means explicitly no value (e.g., filterId: null = no filter)
 */
export function computeEffectiveSubpathStyle(pathStyle: PathStyle, override: SubpathStyleOverride): PathStyle {
  return {
    ...pathStyle,
    // Apply overrides (undefined = inherit, null = explicitly none)
    fill: override.fill !== undefined ? override.fill : pathStyle.fill,
    fillOpacity: override.fillOpacity !== undefined ? override.fillOpacity : pathStyle.fillOpacity,
    stroke: override.stroke !== undefined ? override.stroke : pathStyle.stroke,
    strokeWidth: override.strokeWidth !== undefined ? override.strokeWidth : pathStyle.strokeWidth,
    strokeOpacity: override.strokeOpacity !== undefined ? override.strokeOpacity : pathStyle.strokeOpacity,
    strokeLinecap: override.strokeLinecap !== undefined ? override.strokeLinecap : pathStyle.strokeLinecap,
    strokeLinejoin: override.strokeLinejoin !== undefined ? override.strokeLinejoin : pathStyle.strokeLinejoin,
    opacity: override.opacity !== undefined ? override.opacity : pathStyle.opacity,
    mixBlendMode: override.mixBlendMode !== undefined ? override.mixBlendMode : pathStyle.mixBlendMode,
    // Handle null as "explicitly no filter/adjustments"
    filterId: override.filterId !== undefined ? (override.filterId ?? undefined) : pathStyle.filterId,
    colorAdjustments:
      override.colorAdjustments !== undefined ? (override.colorAdjustments ?? undefined) : pathStyle.colorAdjustments,
  }
}

/**
 * Compare two Paint objects for equality
 */
export function arePaintsEqual(a: Paint | undefined, b: Paint | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.type !== b.type) return false

  if (a.type === 'color' && b.type === 'color') {
    return a.color === b.color && a.opacity === b.opacity
  }

  if (a.type === 'gradient' && b.type === 'gradient') {
    return a.gradientId === b.gradientId
  }

  return a.type === 'none' && b.type === 'none'
}

/**
 * Compare two ColorAdjustments objects for equality
 */
export function areColorAdjustmentsEqual(a: ColorAdjustments | undefined, b: ColorAdjustments | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false

  return (
    a.brightness === b.brightness
    && a.contrast === b.contrast
    && a.saturation === b.saturation
    && a.hueRotate === b.hueRotate
    && a.opacity === b.opacity
    && a.invert === b.invert
    && a.sepia === b.sepia
    && a.grayscale === b.grayscale
  )
}

/**
 * Compare two PathStyle objects for equality
 * Used to determine if subpaths can be serialized as a single path element
 */
export function areStylesEqual(a: PathStyle, b: PathStyle): boolean {
  if (!arePaintsEqual(a.fill, b.fill)) return false
  if (!arePaintsEqual(a.stroke, b.stroke)) return false
  if (a.strokeWidth !== b.strokeWidth) return false
  if (a.fillOpacity !== b.fillOpacity) return false
  if (a.strokeOpacity !== b.strokeOpacity) return false
  if (a.strokeLinecap !== b.strokeLinecap) return false
  if (a.strokeLinejoin !== b.strokeLinejoin) return false
  if (a.opacity !== b.opacity) return false
  if (a.mixBlendMode !== b.mixBlendMode) return false
  if (a.filterId !== b.filterId) return false
  if (!areColorAdjustmentsEqual(a.colorAdjustments, b.colorAdjustments)) return false

  return true
}

/**
 * Check if all subpaths have the same effective style
 * Returns true if styles are uniform (can use single path element in SVG output)
 */
export function areSubpathStylesUniform(pathStyle: PathStyleWithSubpaths, segments: ConnectedSegment[]): boolean {
  const subpathStyles = pathStyle.subpathStyles
  if (!subpathStyles || subpathStyles.size === 0) {
    return true // No overrides = uniform
  }

  // Get effective style for each segment
  const effectiveStyles = segments.map(segment => {
    const override = subpathStyles.get(segment.startIndex)
    return override ? computeEffectiveSubpathStyle(pathStyle, override) : pathStyle
  })

  // Compare all styles to first
  if (effectiveStyles.length === 0) return true

  const first = effectiveStyles[0]
  return effectiveStyles.every(style => areStylesEqual(style, first))
}

/**
 * Convert full PathStyle updates to SubpathStyleOverride format
 * Only includes properties that should be overridable at subpath level
 */
export function convertToSubpathOverride(updates: Partial<PathStyle>): SubpathStyleOverride {
  const override: SubpathStyleOverride = {}

  if (updates.fill !== undefined) override.fill = updates.fill
  if (updates.fillOpacity !== undefined) override.fillOpacity = updates.fillOpacity
  if (updates.stroke !== undefined) override.stroke = updates.stroke
  if (updates.strokeWidth !== undefined) override.strokeWidth = updates.strokeWidth
  if (updates.strokeOpacity !== undefined) override.strokeOpacity = updates.strokeOpacity
  if (updates.strokeLinecap !== undefined) override.strokeLinecap = updates.strokeLinecap
  if (updates.strokeLinejoin !== undefined) override.strokeLinejoin = updates.strokeLinejoin
  if (updates.opacity !== undefined) override.opacity = updates.opacity
  if (updates.mixBlendMode !== undefined) override.mixBlendMode = updates.mixBlendMode
  if (updates.filterId !== undefined) override.filterId = updates.filterId ?? null
  if (updates.colorAdjustments !== undefined) override.colorAdjustments = updates.colorAdjustments ?? null

  return override
}

/**
 * Update subpath style keys after node insertion or deletion
 * Shifts keys that are at or after the change index
 */
export function updateSubpathStylesAfterNodeChange(
  subpathStyles: SubpathStylesMap,
  changeIndex: number,
  delta: number // +1 for insert, -1 for delete
): SubpathStylesMap {
  const updated = new Map<SubpathKey, SubpathStyleOverride>()

  subpathStyles.forEach((style, startIndex) => {
    const newKey = startIndex >= changeIndex ? startIndex + delta : startIndex
    if (newKey >= 0) {
      updated.set(newKey, style)
    }
  })

  return updated
}

/**
 * Get all unique segments that contain any of the selected node indices
 * Used when multiple nodes are selected across different segments
 */
export function getSegmentsForSelectedNodes(
  allSegments: ConnectedSegment[],
  selectedNodeIndices: Set<number>
): ConnectedSegment[] {
  if (selectedNodeIndices.size === 0) return []

  const selectedSegments: ConnectedSegment[] = []
  const seenStartIndices = new Set<number>()

  for (const segment of allSegments) {
    // Check if any selected node is in this segment
    const hasSelectedNode = segment.nodeIndices.some(idx => selectedNodeIndices.has(idx))
    if (hasSelectedNode && !seenStartIndices.has(segment.startIndex)) {
      selectedSegments.push(segment)
      seenStartIndices.add(segment.startIndex)
    }
  }

  return selectedSegments
}

/**
 * Check if a subpath has any style overrides (is not fully inherited)
 */
export function hasSubpathOverride(pathStyle: PathStyleWithSubpaths, segmentStartIndex: number): boolean {
  return pathStyle.subpathStyles?.has(segmentStartIndex) ?? false
}

/**
 * Remove subpath style override (revert to path-level inheritance)
 */
export function removeSubpathOverride(
  pathStyle: PathStyleWithSubpaths,
  segmentStartIndex: number
): PathStyleWithSubpaths {
  if (!pathStyle.subpathStyles?.has(segmentStartIndex)) {
    return pathStyle
  }

  const newSubpathStyles = new Map(pathStyle.subpathStyles)
  newSubpathStyles.delete(segmentStartIndex)

  return {
    ...pathStyle,
    subpathStyles: newSubpathStyles.size > 0 ? newSubpathStyles : undefined,
  }
}

/**
 * Check if multiple segments have different effective styles (mixed state)
 */
export function hasMultipleDifferentStyles(pathStyle: PathStyleWithSubpaths, segments: ConnectedSegment[]): boolean {
  if (segments.length <= 1) return false

  const subpathStyles = pathStyle.subpathStyles
  const effectiveStyles = segments.map(segment => {
    const override = subpathStyles?.get(segment.startIndex)
    return override ? computeEffectiveSubpathStyle(pathStyle, override) : pathStyle
  })

  const first = effectiveStyles[0]
  return !effectiveStyles.every(style => areStylesEqual(style, first))
}
