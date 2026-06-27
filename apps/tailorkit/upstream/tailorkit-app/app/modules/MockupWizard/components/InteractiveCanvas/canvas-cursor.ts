/**
 * canvas-cursor.ts
 * Cursor style calculation for the interactive canvas based on hover/selection state.
 */
import type { ShapeSelection } from '../../types'
import { getCursorForHandle, getHandleAtPointRotated } from '../../utils/shapeUtils'

interface CursorParams {
  x: number
  y: number
  shapeSelections: ShapeSelection[]
  selectedShapeIndex: number | null
  isMoving: boolean
  viewportScale: number
  isMobileView: boolean
  nodeEditing: {
    isActive: boolean
    hoveredNodeIndex: number | null
    hoveredCp: unknown | null
    selectedNodeIndices: Set<number>
  }
}

export function computeCursorStyle(p: CursorParams): string {
  if (p.nodeEditing.isActive && (p.nodeEditing.hoveredNodeIndex !== null || p.nodeEditing.hoveredCp !== null)) {
    return p.nodeEditing.selectedNodeIndices.has(p.nodeEditing.hoveredNodeIndex ?? -1) ? 'move' : 'pointer'
  }

  for (let i = p.shapeSelections.length - 1; i >= 0; i--) {
    const s = p.shapeSelections[i]
    if (!s || p.x < s.x || p.x > s.x + s.width || p.y < s.y || p.y > s.y + s.height) continue
    const isSelected = p.selectedShapeIndex === i
    if (!p.isMoving) {
      const h = getHandleAtPointRotated(p.x, p.y, s, p.viewportScale, p.isMobileView)
      return h ? getCursorForHandle(h) : isSelected ? 'move' : 'pointer'
    }
    return 'move'
  }

  return 'crosshair'
}
