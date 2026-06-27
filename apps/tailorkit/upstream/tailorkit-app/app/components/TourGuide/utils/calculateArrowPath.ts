import { ECardPlacement } from '../constants'
import type { TourGuideArrowProps } from '../types'

interface PathParams {
  startX: number
  startY: number
  targetX: number
  targetY: number
  elementWidth: number
  elementHeight: number
  placement?: ECardPlacement
  curveIntensity?: number
  offset?: [number, number]
}

/**
 * Calculates the optimal target position at the edge of an element
 * based on the placement and element dimensions.
 *
 * @param targetX Center X of target element
 * @param targetY Center Y of target element
 * @param elementWidth Width of target element
 * @param elementHeight Height of target element
 * @param placement Placement of the arrow
 * @param offset Additional offset [x, y]
 * @returns {x, y} Target position
 */
export function calculateTargetEdgePosition(
  targetX: number,
  targetY: number,
  elementWidth: number,
  elementHeight: number,
  placement: ECardPlacement = ECardPlacement.CENTER,
  offset: [number, number] = [0, 0]
) {
  // Calculate element boundaries
  const left = targetX - elementWidth / 2
  const right = targetX + elementWidth / 2
  const top = targetY - elementHeight / 2
  const bottom = targetY + elementHeight / 2

  // Define a margin from the edge (to avoid touching exactly at the edge)
  const margin = 10

  // Adjusted target position (default to center)
  let adjustedTargetX = targetX + offset[0]
  let adjustedTargetY = targetY + offset[1]

  // Determine target point based on placement
  switch (placement) {
    // Top variations - arrow points to the top edge
    case ECardPlacement.TOP:
    case ECardPlacement.TOP_CENTER:
      adjustedTargetX = targetX + offset[0]
      adjustedTargetY = top + margin + offset[1]
      break
    case ECardPlacement.TOP_LEFT:
      adjustedTargetX = left + elementWidth * 0.25 + offset[0]
      adjustedTargetY = top + margin + offset[1]
      break
    case ECardPlacement.TOP_RIGHT:
      adjustedTargetX = right - elementWidth * 0.25 + offset[0]
      adjustedTargetY = top + margin + offset[1]
      break

    // Bottom variations - arrow points to the bottom edge
    case ECardPlacement.BOTTOM:
    case ECardPlacement.BOTTOM_CENTER:
      adjustedTargetX = targetX + offset[0]
      adjustedTargetY = bottom - margin + offset[1]
      break
    case ECardPlacement.BOTTOM_LEFT:
      adjustedTargetX = left + elementWidth * 0.25 + offset[0]
      adjustedTargetY = bottom - margin + offset[1]
      break
    case ECardPlacement.BOTTOM_RIGHT:
      adjustedTargetX = right - elementWidth * 0.25 + offset[0]
      adjustedTargetY = bottom - margin + offset[1]
      break

    // Left variations - arrow points to the left edge
    case ECardPlacement.LEFT:
    case ECardPlacement.LEFT_CENTER:
      adjustedTargetX = left + margin + offset[0]
      adjustedTargetY = targetY + offset[1]
      break
    case ECardPlacement.LEFT_TOP:
      adjustedTargetX = left + margin + offset[0]
      adjustedTargetY = top + elementHeight * 0.25 + offset[1]
      break
    case ECardPlacement.LEFT_BOTTOM:
      adjustedTargetX = left + margin + offset[0]
      adjustedTargetY = bottom - elementHeight * 0.25 + offset[1]
      break

    // Right variations - arrow points to the right edge
    case ECardPlacement.RIGHT:
    case ECardPlacement.RIGHT_CENTER:
      adjustedTargetX = right - margin + offset[0]
      adjustedTargetY = targetY + offset[1]
      break
    case ECardPlacement.RIGHT_TOP:
      adjustedTargetX = right - margin + offset[0]
      adjustedTargetY = top + elementHeight * 0.25 + offset[1]
      break
    case ECardPlacement.RIGHT_BOTTOM:
      adjustedTargetX = right - margin + offset[0]
      adjustedTargetY = bottom - elementHeight * 0.25 + offset[1]
      break

    // Default to center position
    default:
      break
  }

  return { x: adjustedTargetX, y: adjustedTargetY }
}

/**
 * Calculates the optimal path for an arrow to point to a target element
 * considering the element's position and the desired start position.
 *
 * @param params Path calculation parameters
 * @returns SVG path data string
 */
export function calculateArrowPath({
  startX,
  startY,
  targetX,
  targetY,
  elementWidth,
  elementHeight,
  placement = ECardPlacement.CENTER,
  curveIntensity = 0.5,
  offset = [0, 0],
}: PathParams): string {
  // Get the edge position based on placement
  const { x: adjustedTargetX, y: adjustedTargetY } = calculateTargetEdgePosition(
    targetX,
    targetY,
    elementWidth,
    elementHeight,
    placement,
    offset
  )

  // Calculate distance between points
  const dx = adjustedTargetX - startX
  const dy = adjustedTargetY - startY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Calculate control points for cubic bezier curve
  // The control points create the curved shape of the arrow
  const controlDistance = distance * curveIntensity

  // Create a natural curve based on relative positions
  let cp1x, cp1y, cp2x, cp2y

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant direction
    cp1x = startX + dx * 0.25
    cp1y = startY + controlDistance
    cp2x = adjustedTargetX - dx * 0.25
    cp2y = adjustedTargetY - controlDistance
  } else {
    // Vertical dominant direction
    cp1x = startX + controlDistance
    cp1y = startY + dy * 0.25
    cp2x = adjustedTargetX - controlDistance
    cp2y = adjustedTargetY - dy * 0.25
  }

  // Return the SVG path data
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${adjustedTargetX} ${adjustedTargetY}`
}

/**
 * Calculates start position for the arrow based on the target position and viewport
 *
 * @param targetX Target X coordinate
 * @param targetY Target Y coordinate
 * @param elementWidth Width of the element
 * @param elementHeight Height of the element
 * @param startPosition Preferred start position
 * @returns [startX, startY] coordinates
 */
export function calculateArrowStartPosition(
  targetX: number,
  targetY: number,
  elementWidth: number,
  elementHeight: number,
  startPosition: TourGuideArrowProps['startPosition'] = 'auto'
): [number, number] {
  const fixedArrowDimensions = {
    width: 500,
    height: 300,
  }

  //   const viewportWidth = window.innerWidth
  //   const viewportHeight = window.innerHeight

  const { width: arrowWidth, height: arrowHeight } = fixedArrowDimensions

  const margin = 80 // Distance from viewport edge

  // We'll make the arrow shorter by bringing the start position closer to the target
  const shortenFactor = 0.4 // Makes the distance 40% of original

  // Calculate base starting position
  let baseStartX: number, baseStartY: number

  // Determine starting position
  switch (startPosition) {
    case 'bottom':
      baseStartX = targetX - arrowWidth / 2
      baseStartY = targetY + arrowHeight
      break
    case 'right':
      baseStartX = targetX + arrowWidth / 2
      baseStartY = targetY - arrowHeight / 2
      break
    case 'left':
      baseStartX = targetX - arrowWidth
      baseStartY = targetY + arrowHeight
      break

    case 'top':
      baseStartX = targetX - arrowWidth / 2
      baseStartY = targetY - arrowHeight
      break
    case 'auto':
    default:
      // Auto-determine the best start position based on target location
      if (targetX < elementWidth / 2) {
        if (targetY < elementHeight / 2) {
          // Target in top-left quadrant, start from bottom-right
          baseStartX = elementWidth - margin
          baseStartY = elementHeight - margin
        } else {
          // Target in bottom-left quadrant, start from top-right
          baseStartX = elementWidth - margin
          baseStartY = margin
        }
      } else {
        if (targetY < elementHeight / 2) {
          // Target in top-right quadrant, start from bottom-left
          baseStartX = margin
          baseStartY = elementHeight - margin
        } else {
          // Target in bottom-right quadrant, start from top-left
          baseStartX = margin
          baseStartY = margin
        }
      }
  }

  // Now shorten the distance between start and target
  // Calculate the vector from base start to target
  const vectorX = targetX - baseStartX
  const vectorY = targetY - baseStartY

  // Calculate the shortened vector
  const shortenedVectorX = vectorX * (1 - shortenFactor)
  const shortenedVectorY = vectorY * (1 - shortenFactor)

  // Calculate the new start position
  const startX = targetX - shortenedVectorX
  const startY = targetY - shortenedVectorY

  return [startX, startY]
}
