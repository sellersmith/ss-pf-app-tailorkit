/**
 * usePaintTool — freehand paint tool for defining personalization areas.
 *
 * Thin wrapper around useOverlayPainting that manages paint-specific lifecycle
 * and converts painted overlay to VectorShape on confirm.
 */

import { useCallback } from 'react'
import type { VectorShape } from '../types'
import { computePathBoundingBox, serializePathCommandsToD } from '../utils/vectorPathUtils'
import { useOverlayPainting } from './use-overlay-painting'

interface UsePaintToolOptions {
  isActive: boolean
  image: HTMLImageElement | null
  transformCanvasToImage: (cx: number, cy: number) => { x: number; y: number }
  onShapeComplete: (shape: VectorShape) => void
}

export function usePaintTool({ isActive, image, transformCanvasToImage, onShapeComplete }: UsePaintToolOptions) {
  const painting = useOverlayPainting({
    imageWidth: image?.width ?? 0,
    imageHeight: image?.height ?? 0,
    isActive,
    transformCanvasToImage,
  })

  const confirmSelection = useCallback(async () => {
    const commands = await painting.confirmAsVectorPath()
    if (!commands || commands.length < 3) return

    const bbox = computePathBoundingBox(commands)
    const pathD = serializePathCommandsToD(commands)

    onShapeComplete({
      type: 'vector',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      pathCommands: commands,
      pathD,
      source: 'manual',
      shapeId: `paint-${Date.now()}`,
    })
    painting.clear()
  }, [painting, onShapeComplete])

  const cancelSelection = useCallback(() => {
    painting.clear()
  }, [painting])

  return {
    ...painting,
    confirmSelection,
    cancelSelection,
  }
}
