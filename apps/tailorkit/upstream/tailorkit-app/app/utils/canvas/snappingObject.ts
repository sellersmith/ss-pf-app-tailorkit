import Konva from 'konva'
import type { Snap, SnappingEdges } from '~/types/canvas'
import { getClientRect } from '~/utils/canvas/getClientRect'

/**
 * Get the template bounds from a grid background element or from the stage.
 *
 * @param {Konva.Stage} stage - The stage to get the template bounds from.
 * @param {string} gridBackgroundName - The name of the grid background element.
 * @returns {{ width: number, height: number, x: number, y: number }} - The template bounds.
 */
export const getTemplateBounds = (stage: Konva.Stage, gridBackgroundName: string) => {
  const gridBackground = stage.findOne(`.${gridBackgroundName}`)

  if (gridBackground) {
    const box = gridBackground.getClientRect()

    return {
      width: box.width,
      height: box.height,
      x: box.x,
      y: box.y,
    }
  }

  return {
    width: stage.width(),
    height: stage.height(),
    x: 0,
    y: 0,
  }
}

/**
 * Get the line guide stops for snapping.
 *
 * @param {Konva.Node[]} nodes - The nodes to find guides in.
 * @param {string} layerName - The name of the layer to find guides in.
 * @param {string} gridBackgroundName - The name of the grid background element.
 * @param {Object} ruler - The ruler object.
 * @param {string} ruler.rulerName - The name of the ruler element.
 * @param {string} ruler.horizontalPrefix - The prefix for horizontal guides. Ruler guides should be named with horizontalPrefix or verticalPrefix
 * @returns {{ vertical: number[], horizontal: number[] }} - The vertical and horizontal guide stops.
 */
export const getLineGuideStops = (args: {
  nodes: Konva.Node[]
  layerName: string
  gridBackgroundName: string
  ruler?: {
    rulerName: string
    horizontalPrefix: string
  }
}) => {
  const { nodes, layerName, gridBackgroundName, ruler } = args
  const stage = nodes[0]?.getStage()
  if (!stage) return { vertical: [], horizontal: [] }

  // Get template bounds instead of using the whole stage
  const template = getTemplateBounds(stage, gridBackgroundName)

  // We can snap to template borders and the center of the template
  const vertical = [
    template.x, // Left edge
    template.x + template.width / 2, // Center
    template.x + template.width, // Right edge
  ]

  const horizontal = [
    template.y, // Top edge
    template.y + template.height / 2, // Center
    template.y + template.height, // Bottom edge
  ]

  // Get all shapes in the layer for snapping
  const shapes = stage.find(`.${layerName}`)
  shapes.forEach(shape => {
    // Skip if this shape is being dragged
    if (nodes.includes(shape)) return

    const box = shape.getClientRect()

    // Add edges and center points
    vertical.push(
      box.x, // Left edge
      box.x + box.width / 2, // Center
      box.x + box.width // Right edge
    )
    horizontal.push(
      box.y, // Top edge
      box.y + box.height / 2, // Center
      box.y + box.height // Bottom edge
    )
  })

  if (ruler) {
    // Add ruler guides to snapping points
    const rulerGuides = stage.find(`.${ruler.rulerName}`)

    rulerGuides.forEach(guide => {
      const guideLine = guide as Konva.Line
      const guideId = guideLine.id()
      const points = guideLine.getClientRect()

      const isHorizontal = guideId.includes(ruler.horizontalPrefix)

      if (isHorizontal) {
        // For horizontal guides, use the y position
        horizontal.push(points.y)
      } else {
        // For vertical guides, use the x position
        vertical.push(points.x)
      }
    })
  }

  return {
    vertical: [...new Set(vertical)], // Remove duplicates
    horizontal: [...new Set(horizontal)], // Remove duplicates
  }
}

/**
 * Get the snapping edges of an object.
 *
 * @param {Konva.Shape} node - The node to get snapping edges for.
 * @returns {SnappingEdges} - The snapping edges of the node.
 */
export const getObjectSnappingEdges = (transformer: Konva.Transformer): SnappingEdges => {
  if (!transformer) {
    return { vertical: [], horizontal: [] }
  }

  const trRect = transformer.__getNodeRect()
  const box = getClientRect({
    ...trRect,
    rotation: Konva.Util.radToDeg(trRect.rotation),
  })
  const absPos = transformer.getAbsolutePosition()

  return {
    vertical: [
      {
        guide: box.x,
        offset: absPos.x - box.x,
        snap: 'start',
      },
      {
        guide: box.x + box.width / 2,
        offset: absPos.x - box.x - box.width / 2,
        snap: 'center',
      },
      {
        guide: box.x + box.width,
        offset: absPos.x - box.x - box.width,
        snap: 'end',
      },
    ],
    horizontal: [
      {
        guide: box.y,
        offset: absPos.y - box.y,
        snap: 'start',
      },
      {
        guide: box.y + box.height / 2,
        offset: absPos.y - box.y - box.height / 2,
        snap: 'center',
      },
      {
        guide: box.y + box.height,
        offset: absPos.y - box.y - box.height,
        snap: 'end',
      },
    ],
  }
}

/**
 * Get the guides for snapping.
 *
 * @param {ReturnType<typeof getLineGuideStops>} lineGuideStops - The line guide stops.
 * @param {ReturnType<typeof getObjectSnappingEdges>} objectSnappingEdges - The object snapping edges.
 * @returns {Array<{ lineGuide: number, offset: number, orientation: 'V' | 'H', snap: 'start' | 'center' | 'end' }>} - The guides for snapping.
 */
export const getGuides = (
  lineGuideStops: ReturnType<typeof getLineGuideStops>,
  objectSnappingEdges: ReturnType<typeof getObjectSnappingEdges>,
  guideLineOffset: number = 5
) => {
  const resultV: Array<{
    lineGuide: number
    diff: number
    snap: Snap
    offset: number
  }> = []

  const resultH: Array<{
    lineGuide: number
    diff: number
    snap: Snap
    offset: number
  }> = []

  // Special case for exact origin (0,0) to prioritize it
  const hasOriginGuideV = lineGuideStops.vertical.some(guide => guide === 0)
  const hasOriginGuideH = lineGuideStops.horizontal.some(guide => guide === 0)

  lineGuideStops.vertical.forEach(lineGuide => {
    objectSnappingEdges.vertical.forEach(itemBound => {
      const diff = Math.abs(lineGuide - itemBound.guide)

      // Special handling for origin - increase the threshold
      const threshold = lineGuide === 0 && hasOriginGuideV ? guideLineOffset * 1.5 : guideLineOffset

      if (diff < threshold) {
        // Handle origin point with higher priority
        const priority = lineGuide === 0 ? -1 : diff

        resultV.push({
          lineGuide: lineGuide,
          diff: priority,
          snap: itemBound.snap,
          offset: itemBound.offset,
        })
      }
    })
  })

  lineGuideStops.horizontal.forEach(lineGuide => {
    objectSnappingEdges.horizontal.forEach(itemBound => {
      const diff = Math.abs(lineGuide - itemBound.guide)

      // Special handling for origin - increase the threshold
      const threshold = lineGuide === 0 && hasOriginGuideH ? guideLineOffset * 1.5 : guideLineOffset

      if (diff < threshold) {
        // Handle origin point with higher priority
        const priority = lineGuide === 0 ? -1 : diff

        resultH.push({
          lineGuide: lineGuide,
          diff: priority,
          snap: itemBound.snap,
          offset: itemBound.offset,
        })
      }
    })
  })

  const guides: Array<{
    lineGuide: number
    offset: number
    orientation: 'V' | 'H'
    snap: 'start' | 'center' | 'end'
  }> = []

  const minV = resultV.sort((a, b) => a.diff - b.diff)[0]
  const minH = resultH.sort((a, b) => a.diff - b.diff)[0]

  if (minV) {
    guides.push({
      lineGuide: minV.lineGuide,
      offset: minV.offset,
      orientation: 'V',
      snap: minV.snap,
    })
  }

  if (minH) {
    guides.push({
      lineGuide: minH.lineGuide,
      offset: minH.offset,
      orientation: 'H',
      snap: minH.snap,
    })
  }

  return guides
}

/**
 * Draw the guides on the layer.
 *
 * @param {ReturnType<typeof getGuides>} guides - The guides to draw.
 * @param {Konva.Layer} layer - The layer to draw guides on.
 * @param {string} guideName - The name for the guide lines.
 * @param {{ stroke?: string, strokeWidth?: number, dash?: number[] }} [opts] - Options for the guide lines.
 */
export const drawGuides = (
  guides: ReturnType<typeof getGuides>,
  layer: Konva.Layer,
  guideName: string,
  opts: {
    stroke?: string
    strokeWidth?: number
    dash?: number[]
  } = { stroke: 'rgb(0, 161, 255)', strokeWidth: 2, dash: [4, 6] }
) => {
  const maxOffset = 10000
  const verticalPoints = [0, -maxOffset, 0, maxOffset]
  const horizontalPoints = [-maxOffset, 0, maxOffset, 0]

  guides.forEach(lg => {
    if (lg.orientation === 'H') {
      const line = new Konva.Line({
        points: horizontalPoints,
        name: guideName,
        ...opts,
      })
      layer.add(line)
      line.absolutePosition({
        x: 0,
        y: lg.lineGuide,
      })
    } else if (lg.orientation === 'V') {
      const line = new Konva.Line({
        points: verticalPoints,
        name: guideName,
        ...opts,
      })
      layer.add(line)
      line.absolutePosition({
        x: lg.lineGuide,
        y: 0,
      })
    }
  })
}

/**
 * Force update the position of a shape based on guides.
 *
 * @param {Konva.KonvaEventObject<DragEvent>} e - The drag event.
 * @param {ReturnType<typeof getGuides>} guides - The guides to snap to.
 */
export const forceUpdatePosition = (transformer: Konva.Transformer, guides: ReturnType<typeof getGuides>) => {
  const absPos = transformer.absolutePosition()

  // now force object position
  guides.forEach(lg => {
    // Special case for origin (0,0) to ensure perfect alignment
    if (lg.lineGuide === 0) {
      switch (lg.orientation) {
        case 'V': {
          // Ensure exact alignment with left edge
          if (lg.snap === 'start') {
            absPos.x = 0
          } else {
            absPos.x = lg.lineGuide + lg.offset
          }
          break
        }
        case 'H': {
          // Ensure exact alignment with top edge
          if (lg.snap === 'start') {
            absPos.y = 0
          } else {
            absPos.y = lg.lineGuide + lg.offset
          }
          break
        }
      }
    } else {
      // Normal handling for other guides
      switch (lg.snap) {
        case 'start': {
          switch (lg.orientation) {
            case 'V': {
              absPos.x = lg.lineGuide + lg.offset
              break
            }
            case 'H': {
              absPos.y = lg.lineGuide + lg.offset
              break
            }
          }
          break
        }
        case 'center': {
          switch (lg.orientation) {
            case 'V': {
              absPos.x = lg.lineGuide + lg.offset
              break
            }
            case 'H': {
              absPos.y = lg.lineGuide + lg.offset
              break
            }
          }
          break
        }
        case 'end': {
          switch (lg.orientation) {
            case 'V': {
              absPos.x = lg.lineGuide + lg.offset
              break
            }
            case 'H': {
              absPos.y = lg.lineGuide + lg.offset
              break
            }
          }
          break
        }
      }
    }
  })

  // Get all nodes of the transformer
  const nodes = transformer.getNodes()
  const trRect = transformer.__getNodeRect()

  // Re-evaluate node position in transformer
  nodes.forEach(node => {
    // Calculate the position of the node relative to the transformer
    const pos = node.getAbsolutePosition()

    const offset = {
      x: pos.x - trRect.x,
      y: pos.y - trRect.y,
    }

    const newPos = {
      x: absPos.x + offset.x,
      y: absPos.y + offset.y,
    }

    node.absolutePosition(newPos)
  })
}

/**
 * Clear the guides from the layer.
 *
 * @param {Konva.Layer} layer - The layer to clear guides from.
 * @param {string} name - The name of the guides to clear.
 */
export const clearGuides = (layer: Konva.Layer, name: string) => {
  layer.find(`.${name}`).forEach(line => {
    line.destroy()
  })
}

/**
 * Get the relative snapping point of a guide.
 * This function is used for getting the relative snapping point with the stage scale and absolute stage position.
 * We can't get absolute snapping point because the snapping points are in the original coordinates.
 * So we need to convert them to the stage coordinates to make it transformable on canvas.
 *
 * @param {Object} args - The arguments.
 * @param {ReturnType<typeof getGuides>[number]} args.guide - The guide to get the relative snapping point of.
 * @param {number} args.scale - The scale of the stage.
 * @param {Object} args.absoluteStagePos - The absolute position of the stage.
 * @param {boolean} args.isHorizontal - Whether the guide is horizontal.
 * @returns {number} The relative snapping point.
 */
export const getRelativeSnappingPoint = (args: {
  guide: ReturnType<typeof getGuides>[number]
  scale: number
  absoluteStagePos: { x: number; y: number }
  isHorizontal: boolean
}) => {
  const { guide, scale, absoluteStagePos, isHorizontal } = args

  if (isHorizontal) {
    return guide.lineGuide * scale - absoluteStagePos.y
  }

  return guide.lineGuide * scale - absoluteStagePos.x
}

/**
 * Apply snapping during resize operations.
 *
 * @param {Konva.Transformer} transformer - The transformer being used.
 * @param {ReturnType<typeof getGuides>} guides - The guides to snap to.
 */
export const applyResizeSnapping = (transformer: Konva.Transformer, guides: ReturnType<typeof getGuides>) => {
  if (!transformer || !guides.length) return

  // Get the active anchor name
  const activeAnchorName = transformer.getActiveAnchor()
  if (!activeAnchorName) return

  // Get the stage and its scale
  const stage = transformer.getStage()
  if (!stage) return
  const stageScale = stage.scaleX()

  // Get resize direction from anchor name
  const direction = getResizeDirectionFromAnchor(activeAnchorName)

  // Get current transform
  const trRect = transformer.__getNodeRect()
  const box = getClientRect({
    ...trRect,
    rotation: Konva.Util.radToDeg(trRect.rotation),
  })

  // Calculate adjustments based on guides
  let adjustX = 0
  let adjustY = 0
  let adjustWidth = 0
  let adjustHeight = 0

  guides.forEach(guide => {
    // Important: Correct stage scaling for both guide positions and box position
    if (guide.orientation === 'V') {
      if (guide.snap === 'start' && direction.horizontal === 'left') {
        // Adjust left edge - this works in stage coordinate space
        adjustX = (guide.lineGuide - box.x) / stageScale
        adjustWidth = -adjustX
      } else if (guide.snap === 'end' && direction.horizontal === 'right') {
        // Adjust right edge - this works in stage coordinate space
        adjustWidth = (guide.lineGuide - (box.x + box.width)) / stageScale
      }
    } else if (guide.orientation === 'H') {
      if (guide.snap === 'start' && direction.vertical === 'top') {
        // Adjust top edge - this works in stage coordinate space
        adjustY = (guide.lineGuide - box.y) / stageScale
        adjustHeight = -adjustY
      } else if (guide.snap === 'end' && direction.vertical === 'bottom') {
        // Adjust bottom edge - this works in stage coordinate space
        adjustHeight = (guide.lineGuide - (box.y + box.height)) / stageScale
      }
    }
  })

  // Apply adjustments to all nodes in transformer
  const nodes = transformer.getNodes()
  nodes.forEach(node => {
    // Store original properties
    const originalProps = {
      width: node.width(),
      height: node.height(),
      x: node.x(),
      y: node.y(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    }

    // Calculate new dimensions
    let newWidth = originalProps.width
    let newHeight = originalProps.height
    let newX = originalProps.x
    let newY = originalProps.y

    // Apply width and position changes based on horizontal direction
    if (direction.horizontal === 'right' && adjustWidth !== 0) {
      newWidth = originalProps.width + adjustWidth / originalProps.scaleX
    } else if (direction.horizontal === 'left' && adjustWidth !== 0) {
      newWidth = originalProps.width + adjustWidth / originalProps.scaleX
      newX = originalProps.x + adjustX
    }

    // Apply height and position changes based on vertical direction
    if (direction.vertical === 'bottom' && adjustHeight !== 0) {
      newHeight = originalProps.height + adjustHeight / originalProps.scaleY
    } else if (direction.vertical === 'top' && adjustHeight !== 0) {
      newHeight = originalProps.height + adjustHeight / originalProps.scaleY
      newY = originalProps.y + adjustY
    }

    // Only apply valid adjustments (prevent too small dimensions)
    if (newWidth > 5) node.width(newWidth)
    if (newHeight > 5) node.height(newHeight)

    // Apply position changes
    if (newX !== originalProps.x || newY !== originalProps.y) {
      node.position({
        x: newX,
        y: newY,
      })
    }
  })

  // Update the transformer
  transformer.update()
}

/**
 * Get the snapping edges during resize based on active anchor.
 *
 * @param {Konva.Transformer} transformer - The transformer being used.
 * @returns {SnappingEdges} - The snapping edges for the resize operation.
 */
export const getResizeSnappingEdges = (transformer: Konva.Transformer): SnappingEdges => {
  if (!transformer) {
    return { vertical: [], horizontal: [] }
  }

  // Get the active anchor name
  const activeAnchorName = transformer.getActiveAnchor()

  if (!activeAnchorName) {
    return { vertical: [], horizontal: [] }
  }

  const trRect = transformer.__getNodeRect()
  const box = getClientRect({
    ...trRect,
    rotation: Konva.Util.radToDeg(trRect.rotation),
  })

  // Get resize direction from anchor name
  const direction = getResizeDirectionFromAnchor(activeAnchorName)

  // Initialize edges arrays
  const vertical: Array<{ guide: number; offset: number; snap: Snap }> = []
  const horizontal: Array<{ guide: number; offset: number; snap: Snap }> = []

  // Add vertical edges based on resize direction
  if (direction.horizontal === 'left') {
    vertical.push({
      guide: box.x,
      offset: 0,
      snap: 'start',
    })
  } else if (direction.horizontal === 'right') {
    vertical.push({
      guide: box.x + box.width,
      offset: 0,
      snap: 'end',
    })
  }

  // Add horizontal edges based on resize direction
  if (direction.vertical === 'top') {
    horizontal.push({
      guide: box.y,
      offset: 0,
      snap: 'start',
    })
  } else if (direction.vertical === 'bottom') {
    horizontal.push({
      guide: box.y + box.height,
      offset: 0,
      snap: 'end',
    })
  }

  return { vertical, horizontal }
}

/**
 * Get resize direction from active anchor name.
 *
 * @param {string} anchorName - The active anchor name (e.g., 'top-left', 'bottom-right').
 * @returns {{ horizontal: 'left' | 'right' | null, vertical: 'top' | 'bottom' | null }} - The resize directions.
 */
export const getResizeDirectionFromAnchor = (anchorName: string) => {
  // Initialize result
  const result = {
    horizontal: null as 'left' | 'right' | null,
    vertical: null as 'top' | 'bottom' | null,
  }

  // Parse the anchor name to determine direction
  if (anchorName.includes('left')) {
    result.horizontal = 'left'
  } else if (anchorName.includes('right')) {
    result.horizontal = 'right'
  }

  if (anchorName.includes('top')) {
    result.vertical = 'top'
  } else if (anchorName.includes('bottom')) {
    result.vertical = 'bottom'
  }

  return result
}
