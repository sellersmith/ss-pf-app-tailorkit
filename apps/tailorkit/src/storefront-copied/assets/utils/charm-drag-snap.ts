/**
 * Charm Drag-to-Swap — Pure utility functions for FIXED mode snap logic.
 *
 * In FIXED mode, charms snap to pre-defined slot positions on dragend.
 * Dragging a charm onto an occupied slot swaps the two charms.
 * Dragging beyond the snap threshold cancels the drag (snaps back).
 *
 * NOTE: Slot positions are stored on the StorefrontInteractiveCanvasManager
 * instance (not in a module-level Map) to avoid cross-bundle isolation issues.
 * The renderer and the manager live in different Vite bundles — a module-level
 * Map would create two separate instances, one per bundle.
 */

/** Slot position — node center point from server preparation */
export interface CharmSlotPosition {
  x: number
  y: number
  /** Rotation in degrees, 0-359. Applied to charm Konva node when snapped into this slot. Optional. */
  r?: number
}

/**
 * Parse a charm node ID into its components.
 * Format: `charm-{layerId}-{slotIdx}`
 * Returns null if the ID doesn't match the charm pattern.
 */
export function parseCharmId(charmId: string): { layerId: string; slotIdx: number } | null {
  if (!charmId.startsWith('charm-')) return null
  const lastDash = charmId.lastIndexOf('-')
  if (lastDash <= 6) return null // 'charm-' is 6 chars, need at least 'charm-X-N'
  const slotIdx = parseInt(charmId.slice(lastDash + 1), 10)
  if (isNaN(slotIdx)) return null
  const layerId = charmId.slice(6, lastDash)
  return { layerId, slotIdx }
}

/**
 * Find the nearest slot to the given position.
 * Returns the slot index if within threshold, or null if too far.
 * Excludes the current slot from candidates.
 *
 * @param threshold - Max distance in content px to trigger snap (default: charmSize * 1.5)
 */
export function findNearestSlot(
  dropX: number,
  dropY: number,
  slots: CharmSlotPosition[],
  currentSlotIdx: number,
  threshold: number = 90
): number | null {
  if (!slots || slots.length < 2) return null

  let bestIdx = -1
  let bestDist = threshold

  for (let i = 0; i < slots.length; i++) {
    if (i === currentSlotIdx) continue
    const dx = dropX - slots[i].x
    const dy = dropY - slots[i].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }

  return bestIdx >= 0 ? bestIdx : null
}
