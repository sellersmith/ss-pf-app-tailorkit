import type { HighlightRect } from '../types'

function evaluateHighlightRectSize(
  boundingClientRect: HighlightRect,
  padding: number | [number, number, number, number] // Refined type for padding
) {
  const { x, y, width, height } = boundingClientRect

  // Normalize padding to an array of 4 values [top, right, bottom, left]
  let paddingArray: number[]

  if (typeof padding === 'number') {
    // If padding is a single number, apply it to all sides
    paddingArray = [padding, padding, padding, padding]
  } else if (padding.length === 4) {
    // If padding is an array of length 4, use it directly
    paddingArray = padding
  } else {
    throw new Error('Padding should be a number or an array of 4 numbers.')
  }

  // Extract padding values for easy access
  const [top, right, bottom, left] = paddingArray

  // Calculate the new width and x position
  const newWidth = width + left + right
  const newX = x - left // Adjust the x-coordinate by subtracting the left padding

  // Calculate the new height and y position
  const newHeight = height + top + bottom
  const newY = y - top // Adjust the y-coordinate by subtracting the top padding

  return {
    x: newX,
    y: newY,
    left: newX,
    top: newY,
    bottom: newY + newHeight,
    right: newX + newWidth,
    width: newWidth,
    height: newHeight,
  }
}

export default evaluateHighlightRectSize
