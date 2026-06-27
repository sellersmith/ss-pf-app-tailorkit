import { Rect, Group } from 'react-konva'
import { LAYER_STROKE_COLOR } from '~/constants/canvas'

interface InnerEditModeIndicatorProps {
  width: number
  height: number
  x: number
  y: number
  rotation: number
  visible: boolean
}

/**
 * Visual indicator that shows when user is editing the inner image within a clipGroup
 * Displays a dashed border around the outer frame and a status label
 */
export function InnerEditModeIndicator({ width, height, x, y, rotation, visible }: InnerEditModeIndicatorProps) {
  if (!visible) return null

  const strokeColor = LAYER_STROKE_COLOR // Blue color for inner edit mode
  const strokeWidth = 2
  const dashPattern = [8, 4] // Dashed line pattern

  return (
    <Group>
      {/* Dashed border frame */}
      <Rect
        listening={false}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        dash={dashPattern}
        fill="transparent"
      />
    </Group>
  )
}
