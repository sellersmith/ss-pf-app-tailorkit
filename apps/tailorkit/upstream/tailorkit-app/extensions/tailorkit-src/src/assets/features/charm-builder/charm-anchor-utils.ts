/**
 * Compute Y offset for charm positioning based on anchor position.
 * Storefront version — coordinates are pre-scaled during server preparation.
 * - 'top': charm top edge at node.y (hangs below) — default
 * - 'center': charm centered on node.y
 * - 'bottom': charm bottom edge at node.y (sits above)
 */
export function getAnchorYOffset(anchorPosition: 'top' | 'center' | 'bottom' | undefined, halfSize: number): number {
  switch (anchorPosition) {
    case 'center':
      return -halfSize
    case 'bottom':
      return -(halfSize * 2)
    case 'top':
    default:
      return 0
  }
}

/**
 * Bbox-local Y of the slot anchor pivot inside a charm's bounding box.
 *
 * The pivot is the point on the charm that lines up with its slot in canvas space —
 * it stays fixed when the slot has a rotation, so the charm swings around its
 * attachment point (like a pendant on a chain) instead of rotating around the bbox
 * center. Returns:
 *  - 0 for 'top' / undefined: pivot at top edge (charm hangs from slot — default)
 *  - charmSize / 2 for 'center': pivot at bbox center (bracelet style)
 *  - charmSize for 'bottom': pivot at bottom edge (charm sits above slot)
 *
 * Used by editor (Konva offsetY), storefront (rotationOrigin.offsetY), and print
 * (SVG / Konva pivot offsetY) so all three render with a consistent rotation pivot.
 */
export function getCharmRotationPivotOffsetY(
  anchorPosition: 'top' | 'center' | 'bottom' | undefined,
  charmSize: number
): number {
  switch (anchorPosition) {
    case 'center':
      return charmSize / 2
    case 'bottom':
      return charmSize
    case 'top':
    default:
      return 0
  }
}

/**
 * Konva pivot config for a charm — the `{ offsetX, offsetY }` shape consumed by both
 * React-Konva (editor's `<KonvaImage>`) and the imperative renderer (`addImageLayer`'s
 * `rotationOrigin`). Centralizing this lets editor + storefront + print stay in lock-step
 * on rotation pivot without each code path re-deriving the same constants. If the
 * pivot model ever changes (e.g. slot offset becomes a per-slot field), it changes
 * here exactly once.
 */
export function getCharmKonvaPivot(
  anchorPosition: 'top' | 'center' | 'bottom' | undefined,
  charmSize: number
): { offsetX: number; offsetY: number } {
  return {
    offsetX: charmSize / 2,
    offsetY: getCharmRotationPivotOffsetY(anchorPosition, charmSize),
  }
}
