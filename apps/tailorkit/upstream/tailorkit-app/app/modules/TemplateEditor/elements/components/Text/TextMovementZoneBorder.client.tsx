/**
 * TextMovementZoneBorder
 *
 * Visual border indicator for the movement zone boundary.
 * Rendered OUTSIDE the clip group so it's always visible regardless of clip shape.
 *
 * Visible on hover OR when selected. In preview mode the parent conditionally passes
 * isSelected so the merchant can see the zone boundary while simulating buyer interaction.
 */

import { Ellipse, Path, Rect } from 'react-konva'
import {
  ZONE_DASH,
  ZONE_STROKE_COLOR,
  ZONE_STROKE_WIDTH,
} from 'extensions/tailorkit-src/src/shared/constants/movement-zone'
import type { MovementBounds } from '~/types/psd'

export interface ZoneBorderProps {
  bounds: MovementBounds
  isSelected: boolean
  isHovered: boolean
  contentMode: boolean
}

export function ZoneBorderShape({ bounds, isSelected, isHovered, contentMode }: ZoneBorderProps) {
  // Show border on hover OR any selected state.
  // For non-rectangular zones (path/ellipse), the border shows the actual zone shape.
  // The Transformer handles always form a rectangle regardless of zone shape, so without
  // the border the user can't see the polygon/ellipse shape in group-mode-selected.
  const shouldShow = isHovered || isSelected
  if (!shouldShow) return null

  const { type, x, y, width, height, pathData, pathViewBox } = bounds

  const opacity = 1
  const strokeWidth = isSelected && contentMode ? ZONE_STROKE_WIDTH * 2 : ZONE_STROKE_WIDTH
  const dash = isSelected && contentMode ? [] : ZONE_DASH

  const sharedProps = {
    stroke: ZONE_STROKE_COLOR,
    strokeWidth,
    fill: 'transparent' as const,
    dash,
    opacity,
    listening: false as const,
  }

  if (type === 'ellipse') {
    return <Ellipse x={x + width / 2} y={y + height / 2} radiusX={width / 2} radiusY={height / 2} {...sharedProps} />
  }

  if (type === 'path' && pathData) {
    const vbW = pathViewBox?.width ?? 0
    const vbH = pathViewBox?.height ?? 0
    return (
      <Path
        x={x}
        y={y}
        data={pathData}
        scaleX={vbW > 0 ? width / vbW : 1}
        scaleY={vbH > 0 ? height / vbH : 1}
        {...sharedProps}
      />
    )
  }

  return <Rect x={x} y={y} width={width} height={height} {...sharedProps} />
}
