import type { Shape } from '../constants/shape'
import { generateShapePath, type TextStyle } from '../libraries/generate-shape-path'

export async function loadTextIntoCanvas(
  context: CanvasRenderingContext2D,
  args: {
    width: number
    height: number
    textContent: string
    style: Omit<TextStyle, 'color'> & { textColor: string }
    shape: Shape
  }
) {
  const { width, height, textContent, style, shape } = args
  // Clear context
  context.clearRect(0, 0, width, height)

  const svgStr = await generateShapePath(shape, {
    style: { ...style, color: style.textColor },
    width,
    height,
    text: textContent,
  })

  const svg = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(svg)

  return url
}
