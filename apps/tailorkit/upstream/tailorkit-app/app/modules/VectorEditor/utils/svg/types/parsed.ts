/**
 * Extended Parsed SVG Type Definitions
 * Types for parsed SVG with full effect support
 */

import type { PathCommand, ParsedPath, ParsedSvg } from '../pathParsing'
import type { GradientDef, FilterDef, MaskDef, ClipPathDef, PathStyle, Paint } from './effects'

// =============================================================================
// SVG Definitions Container
// =============================================================================

/**
 * Container for all SVG definitions (gradients, filters, masks, clip paths)
 */
export interface SvgDefs {
  gradients: Map<string, GradientDef>
  filters: Map<string, FilterDef>
  masks: Map<string, MaskDef>
  clipPaths: Map<string, ClipPathDef>
}

/**
 * Create an empty SvgDefs container
 */
export function createEmptyDefs(): SvgDefs {
  return {
    gradients: new Map(),
    filters: new Map(),
    masks: new Map(),
    clipPaths: new Map(),
  }
}

/**
 * Check if defs container has any definitions
 */
export function hasAnyDefs(defs: SvgDefs): boolean {
  return defs.gradients.size > 0 || defs.filters.size > 0 || defs.masks.size > 0 || defs.clipPaths.size > 0
}

/**
 * Clone defs container (deep copy)
 */
export function cloneDefs(defs: SvgDefs): SvgDefs {
  return {
    gradients: new Map(defs.gradients),
    filters: new Map(defs.filters),
    masks: new Map(defs.masks),
    clipPaths: new Map(defs.clipPaths),
  }
}

// =============================================================================
// Extended Parsed Path
// =============================================================================

/**
 * Extended parsed path with full styling support
 */
export interface ParsedPathExtended {
  id?: string
  commands: PathCommand[]
  style: PathStyle
  transform?: string
}

/**
 * Convert a string fill/stroke value to a Paint object
 * Handles 'none', gradient URLs (url(#id)), and solid colors
 */
export function stringToPaint(value: string): Paint {
  if (value === 'none') {
    return { type: 'none' }
  }
  if (value.startsWith('url(#')) {
    const gradientId = value.match(/#([^)]+)/)?.[1] || ''
    return { type: 'gradient', gradientId }
  }
  return { type: 'color', color: value }
}

/**
 * Create a ParsedPathExtended from basic path data
 */
export function createParsedPathExtended(
  commands: PathCommand[],
  fill: string = '#000000',
  stroke?: string,
  strokeWidth?: number,
  fillRule?: 'nonzero' | 'evenodd'
): ParsedPathExtended {
  const style: PathStyle = {
    fill: stringToPaint(fill),
    fillRule,
    stroke: stroke ? stringToPaint(stroke) : undefined,
    strokeWidth,
  }

  return {
    commands,
    style,
  }
}

// =============================================================================
// Extended Parsed SVG
// =============================================================================

/**
 * Extended parsed SVG with full effect support
 */
export interface ParsedSvgExtended {
  paths: ParsedPathExtended[]
  viewBox: {
    x: number
    y: number
    width: number
    height: number
  }
  width: number
  height: number
  defs: SvgDefs
}

/**
 * Create an empty ParsedSvgExtended
 */
export function createEmptyParsedSvg(width: number = 100, height: number = 100): ParsedSvgExtended {
  return {
    paths: [],
    viewBox: { x: 0, y: 0, width, height },
    width,
    height,
    defs: createEmptyDefs(),
  }
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert legacy ParsedPath to ParsedPathExtended
 */
export function convertToExtendedPath(path: ParsedPath): ParsedPathExtended {
  return createParsedPathExtended(path.commands, path.fill, path.stroke, path.strokeWidth, path.fillRule)
}

/**
 * Convert legacy ParsedSvg to ParsedSvgExtended
 * @param parsedSvg - The legacy parsed SVG
 * @param defs - Optional defs to include (gradients, filters, masks, clips)
 */
export function convertToExtendedSvg(parsedSvg: ParsedSvg, defs?: SvgDefs): ParsedSvgExtended {
  return {
    paths: parsedSvg.paths.map(convertToExtendedPath),
    viewBox: parsedSvg.viewBox,
    width: parsedSvg.width,
    height: parsedSvg.height,
    defs: defs || createEmptyDefs(),
  }
}

/**
 * Convert ParsedPathExtended back to legacy ParsedPath (lossy - loses extended style info)
 */
export function convertToLegacyPath(path: ParsedPathExtended): ParsedPath {
  const { style } = path

  // Extract fill color
  let fill = '#000000'
  if (style.fill.type === 'color') {
    fill = style.fill.color
  } else if (style.fill.type === 'gradient') {
    // For gradient, we return a url reference
    fill = `url(#${style.fill.gradientId})`
  } else {
    fill = 'none'
  }

  // Extract stroke color
  let stroke: string | undefined
  if (style.stroke) {
    if (style.stroke.type === 'color') {
      stroke = style.stroke.color
    } else if (style.stroke.type === 'gradient') {
      stroke = `url(#${style.stroke.gradientId})`
    } else {
      stroke = 'none'
    }
  }

  return {
    commands: path.commands,
    fill,
    stroke,
    strokeWidth: style.strokeWidth,
    fillRule: style.fillRule,
  }
}

/**
 * Convert ParsedSvgExtended back to legacy ParsedSvg (lossy - loses defs and extended style info)
 */
export function convertToLegacySvg(parsedSvg: ParsedSvgExtended): ParsedSvg {
  return {
    paths: parsedSvg.paths.map(convertToLegacyPath),
    viewBox: parsedSvg.viewBox,
    width: parsedSvg.width,
    height: parsedSvg.height,
  }
}

// =============================================================================
// Helper Functions for Working with Defs
// =============================================================================

/**
 * Add a gradient to defs
 */
export function addGradientToDefs(defs: SvgDefs, gradient: GradientDef): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.gradients.set(gradient.id, gradient)
  return newDefs
}

/**
 * Remove a gradient from defs
 */
export function removeGradientFromDefs(defs: SvgDefs, gradientId: string): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.gradients.delete(gradientId)
  return newDefs
}

/**
 * Add a filter to defs
 */
export function addFilterToDefs(defs: SvgDefs, filter: FilterDef): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.filters.set(filter.id, filter)
  return newDefs
}

/**
 * Remove a filter from defs
 */
export function removeFilterFromDefs(defs: SvgDefs, filterId: string): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.filters.delete(filterId)
  return newDefs
}

/**
 * Add a mask to defs
 */
export function addMaskToDefs(defs: SvgDefs, mask: MaskDef): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.masks.set(mask.id, mask)
  return newDefs
}

/**
 * Remove a mask from defs
 */
export function removeMaskFromDefs(defs: SvgDefs, maskId: string): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.masks.delete(maskId)
  return newDefs
}

/**
 * Add a clip path to defs
 */
export function addClipPathToDefs(defs: SvgDefs, clipPath: ClipPathDef): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.clipPaths.set(clipPath.id, clipPath)
  return newDefs
}

/**
 * Remove a clip path from defs
 */
export function removeClipPathFromDefs(defs: SvgDefs, clipPathId: string): SvgDefs {
  const newDefs = cloneDefs(defs)
  newDefs.clipPaths.delete(clipPathId)
  return newDefs
}

/**
 * Generate a unique ID for a definition
 */
export function generateDefId(prefix: string, defs: SvgDefs): string {
  let id = `${prefix}-1`
  let counter = 1

  // Find a unique ID by checking all def types
  while (defs.gradients.has(id) || defs.filters.has(id) || defs.masks.has(id) || defs.clipPaths.has(id)) {
    counter++
    id = `${prefix}-${counter}`
  }

  return id
}

// =============================================================================
// Orphaned Defs Cleanup
// =============================================================================

/**
 * IDs of defs currently referenced by paths
 */
export interface UsedDefIds {
  filterIds: Set<string>
  gradientIds: Set<string>
  maskIds: Set<string>
  clipPathIds: Set<string>
}

/**
 * Collect all def IDs that are actually used by paths
 */
export function collectUsedDefIds(paths: ParsedPathExtended[]): UsedDefIds {
  const result: UsedDefIds = {
    filterIds: new Set<string>(),
    gradientIds: new Set<string>(),
    maskIds: new Set<string>(),
    clipPathIds: new Set<string>(),
  }

  for (const path of paths) {
    const { style } = path
    if (!style) continue

    if (style.filterId) {
      result.filterIds.add(style.filterId)
    }
    if (style.maskId) {
      result.maskIds.add(style.maskId)
    }
    if (style.clipPathId) {
      result.clipPathIds.add(style.clipPathId)
    }
    if (style.fill?.type === 'gradient' && style.fill.gradientId) {
      result.gradientIds.add(style.fill.gradientId)
    }
    if (style.stroke?.type === 'gradient' && style.stroke.gradientId) {
      result.gradientIds.add(style.stroke.gradientId)
    }
  }

  return result
}

/**
 * Create new SvgDefs containing only definitions that are actually used
 */
export function cleanupOrphanedDefs(defs: SvgDefs, usedIds: UsedDefIds): SvgDefs {
  const cleanedDefs: SvgDefs = {
    gradients: new Map(),
    filters: new Map(),
    masks: new Map(),
    clipPaths: new Map(),
  }

  for (const [id, gradient] of defs.gradients) {
    if (usedIds.gradientIds.has(id)) {
      cleanedDefs.gradients.set(id, gradient)
    }
  }
  for (const [id, filter] of defs.filters) {
    if (usedIds.filterIds.has(id)) {
      cleanedDefs.filters.set(id, filter)
    }
  }
  for (const [id, mask] of defs.masks) {
    if (usedIds.maskIds.has(id)) {
      cleanedDefs.masks.set(id, mask)
    }
  }
  for (const [id, clipPath] of defs.clipPaths) {
    if (usedIds.clipPathIds.has(id)) {
      cleanedDefs.clipPaths.set(id, clipPath)
    }
  }

  return cleanedDefs
}

/**
 * Convenience function: collect used IDs and cleanup in one call
 */
export function getCleanedDefs(defs: SvgDefs, paths: ParsedPathExtended[]): SvgDefs {
  const usedIds = collectUsedDefIds(paths)
  return cleanupOrphanedDefs(defs, usedIds)
}
