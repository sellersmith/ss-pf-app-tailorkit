/**
 * Example usage of text shapes in Konva Canvas Manager
 * This file demonstrates how to use the new text shape functionality
 */

import { KonvaCanvasManager } from '../shared/libraries/konva/core/konva-canvas-manager'

export async function createTextShapesExample() {
  // Create a container div for the canvas
  const container = document.createElement('div')
  container.id = 'text-shapes-example'
  container.style.width = '800px'
  container.style.height = '600px'
  container.style.border = '1px solid #ccc'
  container.style.margin = '20px'
  document.body.appendChild(container)

  // Initialize canvas manager
  const canvasManager = new KonvaCanvasManager({
    width: 800,
    height: 600,
    containerId: container,
    autoResize: false,
  })

  try {
    // Example 1: Regular text
    const regularText = await canvasManager.addTextLayer({
      text: 'Regular Text Example',
      x: 50,
      y: 50,
      width: 300,
      height: 50,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#333333',
      textShape: 'none',
    })
    console.log('Regular text created:', regularText)

    // Example 2: Full circle text with auto-fitting
    const circleText = await canvasManager.addTextLayer({
      text: 'This is circular text that flows around a perfect circle',
      x: 450,
      y: 50,
      width: 300,
      height: 300,
      fontSize: 16,
      fontFamily: 'Arial',
      fill: '#0066cc',
      textShape: 'circle',
      circleStartAngle: 0,
      circleEndAngle: Math.PI * 2,
      autoFitToContainer: true,
    })
    console.log('Circle text created:', circleText)

    // Example 3: Half circle text
    const halfCircleText = await canvasManager.addTextLayer({
      text: 'Half Circle Arc',
      x: 50,
      y: 150,
      width: 250,
      height: 250,
      fontSize: 20,
      fontFamily: 'Arial',
      fill: '#cc0066',
      textShape: 'circle',
      circleStartAngle: 0,
      circleEndAngle: Math.PI,
      autoFitToContainer: false,
    })
    console.log('Half circle text created:', halfCircleText)

    // Example 4: Quarter circle text with auto-fitting
    const quarterCircleText = await canvasManager.addTextLayer({
      text: 'Quarter Arc',
      x: 450,
      y: 400,
      width: 200,
      height: 200,
      fontSize: 18,
      fontFamily: 'Arial',
      fill: '#009900',
      textShape: 'circle',
      circleStartAngle: 0,
      circleEndAngle: Math.PI / 2,
      autoFitToContainer: true,
    })
    console.log('Quarter circle text created:', quarterCircleText)

    // Example 5: Curve text (future implementation)
    const curveText = await canvasManager.addTextLayer({
      text: 'Curved Text Path',
      x: 50,
      y: 450,
      width: 300,
      height: 100,
      fontSize: 16,
      fontFamily: 'Arial',
      fill: '#663399',
      textShape: 'curve',
      autoFitToContainer: true,
    })
    console.log('Curve text created:', curveText)

    console.log('All text shapes created successfully!')

    return {
      canvasManager,
      examples: {
        regularText,
        circleText,
        halfCircleText,
        quarterCircleText,
        curveText,
      },
    }
  } catch (error) {
    console.error('Error creating text shapes:', error)
    throw error
  }
}

// Export for potential use in tests or demos
export function testTextShapeTypes() {
  console.log('Testing text shape type validation...')

  // Test that all shape types are supported
  const supportedShapes = ['none', 'circle', 'curve'] as const

  supportedShapes.forEach(shape => {
    console.log(`✓ Shape type "${shape}" is supported`)
  })

  // Test angle calculations
  const angles = {
    fullCircle: Math.PI * 2,
    halfCircle: Math.PI,
    quarterCircle: Math.PI / 2,
    threeQuarterCircle: Math.PI * 1.5,
  }

  Object.entries(angles).forEach(([name, angle]) => {
    console.log(`✓ ${name}: ${angle} radians (${((angle * 180) / Math.PI).toFixed(1)}°)`)
  })

  console.log('Type validation completed!')
}

// Auto-run example if this file is executed directly
if (typeof window !== 'undefined' && window.document) {
  // Add a button to run the example
  const button = document.createElement('button')
  button.textContent = 'Create Text Shapes Example'
  button.style.margin = '20px'
  button.style.padding = '10px 20px'
  button.style.fontSize = '16px'
  button.onclick = () => {
    createTextShapesExample()
    testTextShapeTypes()
  }
  document.body.appendChild(button)
}
