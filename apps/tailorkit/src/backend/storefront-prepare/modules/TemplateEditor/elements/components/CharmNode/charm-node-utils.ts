// Node styling — empty (no charm assigned)
export const NODE_RADIUS = 14
export const NODE_FILL = '#FFE4C6'
export const NODE_STROKE = '#6366F1'
export const CHARM_STROKE_COLOR = '#FFC879'
export const NODE_FONT_SIZE = 9
export const NODE_TEXT_FILL = '#6366F1'
export const NODE_SELECTED_STROKE = '#4F46E5'

// Node styling — occupied (charm assigned to this slot)
export const NODE_OCCUPIED_FILL = '#C7D2FE'
export const NODE_OCCUPIED_STROKE = '#4F46E5'
export const NODE_OCCUPIED_TEXT_FILL = '#312E81'

// Delete handle
export const DELETE_RADIUS = 8
export const DELETE_OFFSET = 14

// Base charm thumbnail size – actual visual size is controlled by scaleX/scaleY
export const CHARM_THUMB_SIZE = 180
export const CHARM_THUMB_OFFSET = CHARM_THUMB_SIZE / 2
// P1-5: Touch target padding for accessible tap area (kept small for editor precision)
export const CHARM_HIT_AREA_PADDING = 4

// Snap threshold: max distance from node center to trigger snap (in canvas px)
export const SNAP_THRESHOLD = NODE_RADIUS * 4 // ~56px

// Custom cursor: standard OS-style arrow with green "+" badge (32x32, no clipping)
export const ADD_NODE_CURSOR = (() => {
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>",
    // Classic OS cursor arrow (white fill, black stroke — matches native macOS/Windows look)
    "<path d='M2 1L2 17L6 13L9.5 20L12 19L8.5 12L14 12Z' fill='white' stroke='#000' stroke-width='1' stroke-linejoin='round'/>",
    // Green "+" badge (bottom-right)
    "<circle cx='24' cy='25' r='6' fill='#22C55E' stroke='white' stroke-width='1.5'/>",
    "<path d='M24 22v6M21 25h6' stroke='white' stroke-width='1.8' stroke-linecap='round'/>",
    '</svg>',
  ].join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 1, copy`
})()

/** Stop Konva event from bubbling to Stage-level handlers */
export const stopBubble = (e: any) => {
  e.cancelBubble = true
}

/** Total charm instances across all products */
export function getTotalCharmCount(products: Array<{ transforms?: Array<unknown> }>): number {
  return products.reduce((sum, p) => sum + (p.transforms?.length || 0), 0)
}

/** Compute which slot nodes have charms snapped to them (FIXED mode only).
 *  Uses < 1 threshold (post-snap identity) matching use-charm-transform-handlers.ts */
export function getOccupiedNodeIds(
  nodes: Array<{ _id: string; x: number }>,
  charmTransforms: Array<{ x: number }>
): Set<string> {
  const occupied = new Set<string>()
  for (const node of nodes) {
    if (charmTransforms.some(t => Math.abs(t.x - node.x) < 1)) occupied.add(node._id)
  }
  return occupied
}

/**
 * Compute Y offset for charm snap based on anchor position.
 * - 'top': charm hangs below node (top edge at node.y) — default, pendant style
 * - 'center': charm centered on node — bracelet style
 * - 'bottom': charm sits above node (bottom edge at node.y)
 */
export function getAnchorYOffset(
  anchorPosition: 'top' | 'center' | 'bottom' | undefined,
  offset: number,
  scale: number
): number {
  switch (anchorPosition) {
    case 'center':
      return 0
    case 'bottom':
      return -offset * scale
    case 'top':
    default:
      return offset * scale
  }
}

/**
 * Konva node Y for an editor-rendered charm so the rotation pivot lands at the slot
 * anchor in canvas space.
 *
 * Editor stores transform.y as the bbox-CENTER Y (= slot.y + getAnchorYOffset(...)),
 * so to put the pivot at slot.y we shift the Konva node by `(pivot - bboxCenter)`
 * in scaled units. With pivot = 0 (top) the shift is -size/2 * scale → nodeY = slot.y;
 * with pivot = size (bottom) the shift is +size/2 * scale → nodeY = slot.y; with
 * pivot = size/2 (center) the shift is 0 → nodeY = transform.y = slot.y.
 *
 * @param transformY    The charm's stored Y (bbox center in canvas space)
 * @param pivotOffsetY  Bbox-local Y of the pivot — from getCharmRotationPivotOffsetY
 * @param scale         The charm's scale factor (transform.scale)
 * @param charmSize     Unscaled charm size in pixels (width = height)
 * @returns Konva node Y that places the rotation pivot at the slot anchor in canvas space
 */
export function computeEditorCharmNodeY(
  transformY: number,
  pivotOffsetY: number,
  scale: number,
  charmSize: number
): number {
  return transformY + (pivotOffsetY - charmSize / 2) * scale
}
