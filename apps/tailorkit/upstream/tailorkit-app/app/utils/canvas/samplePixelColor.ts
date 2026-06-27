import type Konva from 'konva'

/**
 * Samples the pixel color at a specific position on the Konva stage
 * Returns the color in rgba format
 *
 * @param stage - The Konva stage reference
 * @param x - X coordinate in scene space (not stage space)
 * @param y - Y coordinate in scene space (not stage space)
 * @returns The color at the position in rgba format, or null if unable to sample
 */
export function samplePixelColorAtPosition(stage: Konva.Stage | null, x: number, y: number): string | null {
  if (!stage) {
    return null
  }

  try {
    // Try precise 1x1 crop from the stage at scene coordinates to avoid transform math
    const croppedCanvas = (stage as unknown as { toCanvas: (cfg: any) => HTMLCanvasElement }).toCanvas({
      x: Math.round(x),
      y: Math.round(y),
      width: 1,
      height: 1,
      pixelRatio: 1,
    })
    const croppedCtx = croppedCanvas.getContext('2d')
    if (croppedCtx) {
      const d = croppedCtx.getImageData(0, 0, 1, 1).data
      const r = d[0]
      const g = d[1]
      const b = d[2]
      const a = d[3] / 255
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }

    // Fallback: render whole stage and sample transformed coordinate
    const canvas = stage.toCanvas()
    const context = canvas.getContext('2d')
    if (!context) return null

    const scale = stage.scaleX()
    const position = stage.position()
    const canvasX = Math.round(x * scale + position.x)
    const canvasY = Math.round(y * scale + position.y)
    if (canvasX < 0 || canvasY < 0 || canvasX >= canvas.width || canvasY >= canvas.height) return null

    const pixelData = context.getImageData(canvasX, canvasY, 1, 1).data
    const r = pixelData[0]
    const g = pixelData[1]
    const b = pixelData[2]
    const a = pixelData[3] / 255
    return `rgba(${r}, ${g}, ${b}, ${a})`
  } catch (error) {
    console.error('Error sampling pixel color:', error)
    return null
  }
}

/**
 * Gets the center position of a Konva node in scene coordinates
 *
 * @param node - The Konva node to get the center position of
 * @returns Object with x and y coordinates of the center point
 */
export function getNodeCenterPosition(node: Konva.Node): { x: number; y: number } {
  const clientRect = node.getClientRect()

  return {
    x: clientRect.x + clientRect.width / 2,
    y: clientRect.y + clientRect.height / 2,
  }
}

/**
 * Samples the pixel color at the center of a Konva node
 *
 * @param stage - The Konva stage reference
 * @param node - The node to sample the color from its center
 * @returns The color at the center of the node in rgba format, or null if unable to sample
 */
export function samplePixelColorAtNodeCenter(stage: Konva.Stage | null, node: Konva.Node): string | null {
  const centerPos = getNodeCenterPosition(node)
  return samplePixelColorAtPosition(stage, centerPos.x, centerPos.y)
}

/**
 * Samples the average pixel color across the entire area under a Konva node
 * Temporarily hides the node and samples multiple points across its clientRect
 *
 * @param stage - The Konva stage reference
 * @param node - The node to sample the color underneath
 * @param sampleDensity - Number of sample points per axis (default: 5x5 grid = 25 samples)
 * @returns The average color underneath the node in rgba format, or null if unable to sample
 */
export function sampleAverageColorUnderNode(
  stage: Konva.Stage | null,
  node: Konva.Node,
  sampleDensity = 5
): string | null {
  if (!stage) {
    console.log(JSON.stringify({ error: 'Stage is null' }))
    return null
  }

  try {
    // Only hide the node itself to avoid hiding sibling/background content
    const nodeToHide = node

    // Store the original visibility state
    const wasVisible = nodeToHide.visible()

    // Clear any caching up the parent chain to ensure fresh render
    let nodeToCheck: Konva.Node | null = node
    while (nodeToCheck) {
      if (nodeToCheck.isCached()) {
        nodeToCheck.clearCache()
      }
      nodeToCheck = nodeToCheck.getParent()
      if (nodeToCheck?.getType() === 'Layer') break
    }

    // Get the client rect of the text
    const clientRect = node.getClientRect()

    // Temporarily hide just the node to expose content underneath
    nodeToHide.visible(false)
    stage.draw()

    // Sample multiple points across the client rect
    const samples: Array<{
      r: number
      g: number
      b: number
      a: number
      x: number
      y: number
      colorStr: string | null
    }> = []
    const { x, y, width, height } = clientRect

    for (let i = 0; i < sampleDensity; i++) {
      for (let j = 0; j < sampleDensity; j++) {
        const xRatio = (i + 0.5) / sampleDensity
        const yRatio = (j + 0.5) / sampleDensity
        const sampleX = x + width * xRatio
        const sampleY = y + height * yRatio
        const colorStr = samplePixelColorAtPosition(stage, sampleX, sampleY)
        if (colorStr) {
          const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
          if (match) {
            samples.push({
              r: parseInt(match[1]),
              g: parseInt(match[2]),
              b: parseInt(match[3]),
              a: parseFloat(match[4]),
              x: sampleX,
              y: sampleY,
              colorStr,
            })
          }
        }
      }
    }

    if (samples.length === 0) {
      nodeToHide.visible(wasVisible)
      stage.draw()
      return null
    }

    const avg = samples.reduce((acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b, a: acc.a + s.a }), {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    })
    const avgColor = {
      r: Math.round(avg.r / samples.length),
      g: Math.round(avg.g / samples.length),
      b: Math.round(avg.b / samples.length),
      a: avg.a / samples.length,
    }

    nodeToHide.visible(wasVisible)
    stage.draw()

    return `rgba(${avgColor.r}, ${avgColor.g}, ${avgColor.b}, ${avgColor.a})`
  } catch (error) {
    console.error(JSON.stringify({ error: 'Error sampling average color under node', message: String(error) }))
    node.visible(true)
    stage.draw()
    return null
  }
}

/**
 * Samples the pixel color at the center of a Konva node, excluding the node itself
 * Temporarily hides the node (and its parent group if applicable) to sample what's underneath it
 *
 * @param stage - The Konva stage reference
 * @param node - The node to sample the color underneath
 * @returns The color underneath the center of the node in rgba format, or null if unable to sample
 */
export function samplePixelColorUnderNodeCenter(stage: Konva.Stage | null, node: Konva.Node): string | null {
  if (!stage) {
    console.error('Stage is null')
    return null
  }

  try {
    // Only hide the node itself
    const wasVisible = node.visible()
    node.visible(false)
    stage.draw()

    const centerPos = getNodeCenterPosition(node)
    const color = samplePixelColorAtPosition(stage, centerPos.x, centerPos.y)

    node.visible(wasVisible)
    stage.draw()
    return color
  } catch (error) {
    console.error('Error sampling pixel color under node:', error)
    node.visible(true)
    stage.draw()
    return null
  }
}
