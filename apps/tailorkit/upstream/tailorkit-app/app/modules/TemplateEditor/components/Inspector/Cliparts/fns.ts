import { TemplatesService } from '~/api/services/templates'
import type { LayerDocument } from '~/models/Layer.server'
import { type TClipartsSelected } from '~/routes/api.templates/constants'

/**
 * Get cliparts details by ids and type of cliparts
 * @param clipartsSelected - Cliparts selected
 * @returns Cliparts details
 */
export const getClipartsDetails = async ({ clipartsSelected }: { clipartsSelected: TClipartsSelected[] }) => {
  try {
    const res = await TemplatesService.getClipartsDetails(clipartsSelected)
    return res
  } catch (error) {
    console.error('Error getting cliparts details', error)
    return []
  }
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface IBoundingBoxClipartCanvas {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate the bounding box of a set of layers.
 * This function computes the smallest rectangle that can contain all the given layers,
 * taking into account their positions, dimensions, and rotations.
 *
 * @param layers - An array of LayerDocument objects, each representing a layer with position, size, and rotation.
 * @returns BoundingBox - An object representing the bounding box with properties x, y, width, and height.
 */
export function calculateBoundingBox(layers: LayerDocument[]): BoundingBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  layers.forEach(layer => {
    // Get layer position and dimensions
    const { left = 0, top = 0, width = 0, height = 0, rotate = 0 } = layer

    if (rotate) {
      // For rotated layers, calculate corners after rotation
      const rad = (rotate * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)

      // Calculate four corners
      const points = [
        { x: left, y: top },
        { x: left + width, y: top },
        { x: left + width, y: top + height },
        { x: left, y: top + height },
      ]

      // Transform points
      points.forEach(point => {
        const rotatedX = cos * (point.x - left) - sin * (point.y - top) + left
        const rotatedY = sin * (point.x - left) + cos * (point.y - top) + top

        minX = Math.min(minX, rotatedX)
        minY = Math.min(minY, rotatedY)
        maxX = Math.max(maxX, rotatedX)
        maxY = Math.max(maxY, rotatedY)
      })
    } else {
      // For non-rotated layers
      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, left + width)
      maxY = Math.max(maxY, top + height)
    }
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
