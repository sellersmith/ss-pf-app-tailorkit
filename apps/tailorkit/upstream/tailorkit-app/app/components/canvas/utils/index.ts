import Konva from 'konva'
/**
 * Check if a layer intersects with the selection rectangle
 * This is the key function for proper intersection detection with scaled/panned canvas
 */
export const checkIntersection = (
  layer: Konva.Node,
  selBox: { x: number; y: number; width: number; height: number },
  stageViewport: { left: number; top: number; scale: number }
) => {
  const { left, top, scale } = stageViewport
  // Get the actual layer rectangle (this returns coords in the layer's coordinate space)
  const layerRect = layer.getClientRect()

  // Adjust layer rectangle for stage position and scale
  const adjustedLayerRect = {
    x: (layerRect.x - left) / scale,
    y: (layerRect.y - top) / scale,
    width: layerRect.width / scale,
    height: layerRect.height / scale,
  }

  // Check intersection using Konva utility
  return Konva.Util.haveIntersection(selBox, adjustedLayerRect)
}

/**
 * Convert stage coordinates to scene coordinates
 * This accounts for stage scaling and position
 */
export const stageToSceneCoords = (
  pos: { x: number; y: number },
  stageViewport: { left: number; top: number; scale: number }
) => {
  const { left, top, scale } = stageViewport

  return {
    x: (pos.x - left) / scale,
    y: (pos.y - top) / scale,
  }
}
