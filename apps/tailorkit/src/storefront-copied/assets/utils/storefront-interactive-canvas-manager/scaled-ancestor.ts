/**
 * Find the nearest ancestor Group that applies a non-identity scale transform.
 * Used to detect __groupScale groups so interactive handlers can convert between
 * template-space (inside the group) and stage-space (screen pixels).
 *
 * Returns null when no scaled ancestor exists (groupScale = 1, no conversion needed).
 */
import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../../../shared/libraries/konva/runtime-konva'

export function findScaledAncestorGroup(node: Konva.Node): Konva.Group | null {
  let parent = node.getParent()
  while (parent && !(parent instanceof KonvaRuntime.Layer)) {
    if (parent instanceof KonvaRuntime.Group && (parent.scaleX() !== 1 || parent.scaleY() !== 1)) {
      return parent
    }
    parent = parent.getParent()
  }
  return null
}

/** Get the scaleX of the scaled ancestor group, or 1 if none. */
export function getAncestorScaleX(node: Konva.Node): number {
  const group = findScaledAncestorGroup(node)
  return group ? group.scaleX() || 1 : 1
}

/** Get the scaleY of the scaled ancestor group, or 1 if none. */
export function getAncestorScaleY(node: Konva.Node): number {
  const group = findScaledAncestorGroup(node)
  return group ? group.scaleY() || 1 : 1
}
