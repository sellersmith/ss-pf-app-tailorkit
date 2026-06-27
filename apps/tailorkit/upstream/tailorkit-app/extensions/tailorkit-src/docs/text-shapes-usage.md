# Text Shapes Usage in Canvas Manager

This document demonstrates how to use the text shape functionality in the Konva Canvas Manager.

## Basic Usage

```typescript
import { KonvaCanvasManager } from '../src/assets/utils/konva-canvas-manager'

// Create canvas manager instance
const canvasManager = new KonvaCanvasManager({
  width: 400,
  height: 400,
  containerId: 'canvas-container',
})

// Add regular text (no shape)
await canvasManager.addTextLayer({
  text: 'Hello World',
  x: 50,
  y: 50,
  width: 300,
  height: 100,
  fontSize: 24,
  fontFamily: 'Arial',
  fill: '#000000',
  textShape: 'none', // or omit this property
})

// Add circular text with auto-fitting
await canvasManager.addTextLayer({
  text: 'Circular Text Example',
  x: 50,
  y: 150,
  width: 300,
  height: 300,
  fontSize: 20,
  fontFamily: 'Arial',
  fill: '#0066cc',
  textShape: 'circle',
  circleStartAngle: 0, // Start from top (12 o'clock)
  circleEndAngle: Math.PI * 2, // Full circle
  autoFitToContainer: true, // Enable auto-scaling
})

// Add partial circular text
await canvasManager.addTextLayer({
  text: 'Half Circle',
  x: 50,
  y: 150,
  width: 300,
  height: 300,
  fontSize: 18,
  fontFamily: 'Arial',
  fill: '#cc0066',
  textShape: 'circle',
  circleStartAngle: 0, // Start from top
  circleEndAngle: Math.PI, // Half circle (180 degrees)
  autoFitToContainer: false, // Use exact font size
})

// Add curve text (placeholder for future implementation)
await canvasManager.addTextLayer({
  text: 'Curved Text',
  x: 50,
  y: 150,
  width: 300,
  height: 100,
  fontSize: 16,
  fontFamily: 'Arial',
  fill: '#006600',
  textShape: 'curve',
  autoFitToContainer: true,
})
```

## Properties

### Text Shape Properties

- `textShape`: `'none' | 'circle' | 'curve'` - The shape of the text path
  - `'none'`: Regular text (default)
  - `'circle'`: Text follows a circular path
  - `'curve'`: Text follows a curved path (ellipse-based)

- `circleStartAngle`: `number` - Start angle for circular text in radians (default: 0)
- `circleEndAngle`: `number` - End angle for circular text in radians (default: Math.PI \* 2)
- `autoFitToContainer`: `boolean` - Enable auto-scaling to fit text within container

### Return Types

- For `textShape: 'none'`: Returns `Konva.Text`
- For `textShape: 'circle'` or `'curve'`: Returns `Konva.TextPath`

## Auto-Scaling with Circular Text

When `autoFitToContainer: true` is used with circular text shapes, the system automatically:

1. Calculates the available arc length based on the circle radius and angle span
2. Adjusts the font size to fit the text within the available arc space
3. Maintains proper text readability and spacing

## Future Enhancements

- More curve shape options
- Additional text path effects
- Better curve path generation algorithms
- Support for custom path definitions

## Implementation Notes

- Uses shared utilities from `text-path-geometry.ts`, `text-scaling.ts`, and `text-path-utils.ts`
- Seamless integration with existing canvas manager functionality
- Performance optimized with proper path caching
- Compatible with all existing text styling options (neon effects, shadows, etc.)
