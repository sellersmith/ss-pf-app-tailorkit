import type Konva from 'konva'
import type { Stage } from 'konva/lib/Stage'

// Use getClientRect() to get the transformed bounding box (handles rotation & scaling)
export const isInsideRect = (node: Konva.Node, stage: Stage | null) => {
  const rect = node.getClientRect({ relativeTo: stage })
  const { x = 0, y = 0 } = stage?.getPointerPosition() || {}

  return rect.x + 5 < x && x < rect.x + rect.width - 5 && rect.y + 5 < y && y < rect.y + rect.height - 5
}
