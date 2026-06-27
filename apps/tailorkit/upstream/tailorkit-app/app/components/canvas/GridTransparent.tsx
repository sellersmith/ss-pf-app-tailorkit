import type Konva from 'konva'
import { useEffect, useRef } from 'react'
import { Layer } from 'react-konva'
import { GRID_BACKGROUND_NAME } from './constants'

// Function to create a grid pattern
const createGridPattern = (gridSize: number, patternSize: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = patternSize
  canvas.height = patternSize
  const context = canvas.getContext('2d')

  if (!context) return canvas

  // Draw the grid pattern (grey and white squares)
  context.fillStyle = '#e0e0e0' // Grey color
  context.fillRect(0, 0, gridSize, gridSize)
  context.fillRect(gridSize, gridSize, gridSize, gridSize)
  context.fillStyle = '#ffffff' // White color
  context.fillRect(gridSize, 0, gridSize, gridSize)
  context.fillRect(0, gridSize, gridSize, gridSize)

  return canvas
}

interface IGridBackgroundTransparentProps {
  width: number
  height: number
  gridSize: number
}

/**
 * This component renders grid background transparent into canvas
 * @param props IGridBackgroundTransparentProps
 * @returns
 */

const GridBackgroundTransparent = (props: IGridBackgroundTransparentProps) => {
  const { width, height, gridSize } = props

  const patternSize = gridSize * 2
  const gridRef = useRef<Konva.Layer>(null)

  useEffect(() => {
    const patternCanvas = createGridPattern(gridSize, patternSize)
    const layer = gridRef.current

    if (!layer) return

    // Clear any existing children before adding new ones
    layer.destroyChildren()

    const rect = new window.Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fillPatternImage: patternCanvas,
      fillPatternRepeat: 'repeat',
      listening: false, // Disable event listening
      name: GRID_BACKGROUND_NAME,
    })

    layer.add(rect)
    layer.batchDraw()
  }, [width, height, gridSize, patternSize])

  return <Layer listening={false} id="background-transparent-layer" ref={gridRef} />
}

export default GridBackgroundTransparent
