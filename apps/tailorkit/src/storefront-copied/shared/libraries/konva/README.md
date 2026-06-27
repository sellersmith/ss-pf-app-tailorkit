## Konva utilities (core and text)

Utilities and a high-level manager for building canvas-based experiences using Konva. This package powers image layers, masked rendering, and advanced text rendering (auto-fit, circular/curved paths) in TailorKit.

### Folder structure

- `core/`
  - `konva-canvas-manager.ts`: High-level orchestrator that owns the Konva `Stage`/`Layer`, image caching, resize handling, grouping/clip management, and convenience APIs to add images and text.
- `text/`
  - `index.ts`: Re-exports for text utilities below
  - `text-path-utils.ts`: Safe geometry helpers, angle conversions, snapping
  - `text-path-geometry.ts`: Path geometry and path generation for circle/curve text
  - `text-scaling.ts`: Auto-fit text sizing with optional wrapping or circular path
  - `text-style-utils.ts`: Safety padding calculations for stroke/shadow
  - `curve-path-utils.ts`: Length and equivalent-radius math for sinusoidal curves
  - `text-fit-engine.ts`: Text fitting engine for advanced layout calculations
  - `renderer.ts`: Text rendering utilities
  - `scale-custom-path.ts`: Custom path scaling utilities
- `effects/`
  - `types.ts`: Framework-agnostic effect discriminated unions
  - `utils.ts`: Effect utility functions
  - `vanilla-effects.ts`: Vanilla JS effects implementation for Konva Text
  - `relative-shadow-utils.ts`: Relative shadow calculation utilities
  - `svg-filter-manager.ts`: SVG filter management for advanced effects
  - `svg-filter-renderer.ts`: SVG filter rendering pipeline
  - Core manager now uses native Konva shadow properties for better performance

This module is designed to be framework-agnostic and can be used alongside React Konva or plain Konva.

### Quick start

1. Provide a DOM container with fixed aspect ratio (or enable auto-resize):

```html
<div id="canvas-root" style="width: 800px; height: 600px"></div>
```

2. Initialize the manager and add layers:

```ts
import { KonvaCanvasManager } from './core/konva-canvas-manager'
import { generateTextPath, calculateOptimalTextSize } from './text'

const manager = new KonvaCanvasManager({
  containerId: 'canvas-root',
  width: 800,
  height: 600,
  autoResize: true, // scales stage to container while preserving original aspect
})

// Image
await manager.addImageLayer({
  url: 'https://example.com/image.png',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
})

// Auto-fit text inside a box
const { fontSize } = calculateOptimalTextSize({
  text: 'Hello TailorKit',
  width: 400,
  height: 120,
  wrap: 'word',
  lineHeight: 1.2,
  fontFamily: 'Inter',
})

await manager.addTextLayer({
  text: 'Hello TailorKit',
  x: 200,
  y: 200,
  width: 400,
  height: 120,
  fontFamily: 'Inter',
  fontSize, // optional; manager can also auto-fit when autoFitToContainer is true
  autoFitToContainer: true,
  wrap: 'word',
})

// Effects: automatic multi-layer rendering with native Konva shadows
import type { EffectConfig } from './effects/types'

const effects: EffectConfig[] = [
  { type: 'DROP_SHADOW', color: '#00ffff', offsetX: 0, offsetY: 0, radius: 8, visible: true },
  { type: 'INNER_SHADOW', color: 'rgba(0,0,0,0.6)', offsetX: 1, offsetY: 1, radius: 2, visible: true },
]

// The manager automatically handles multi-layer rendering internally
await manager.addTextLayer({
  text: 'Hello TailorKit',
  x: 100,
  y: 100,
  width: 300,
  height: 100,
  effects, // Effects are automatically converted to multiple Konva Text layers
  fontFamily: 'Inter',
  autoFitToContainer: true,
})

// Dispose when done
manager.dispose()
```

### Core API: `KonvaCanvasManager`

Constructor:

```ts
new KonvaCanvasManager({
  containerId: string | HTMLDivElement,
  width: number,
  height: number,
  autoResize?: boolean, // default: false
  printAreaId?: string, // added to container as data-print-area
})
```

Key methods:

- `getStage(): Konva.Stage` and `getMainLayer(): Konva.Layer`
- `startTemplateGroup(template: { l: number; t: number; r: number }, mask?: { w: number; h: number; l: number; t: number; r: number })`:
  - Starts a temporary group to position/rotate a set of elements
  - When `mask` is provided, applies a rectangular clip to that content
- `endTemplateGroup()` — ends the active group
- `addImageLayer(options): Promise<Konva.Image | Konva.Group>`:
  - `{ url, x, y, width, height, rotation?, maskConfig?, clipGroup? }`
  - `maskConfig` supports `{ src, invert?, globalCompositeOperation?, smoothEdges?, smoothingStrength? }`
  - If `clipGroup` is provided, image is placed into a clipping container using its absolute geometry
- `addTextLayer(props): Promise<Konva.Text | Konva.TextPath>`:
  - Accepts all `Konva.TextConfig` plus:
    - `autoFitToContainer?: boolean`
    - `textShape?: 'none' | 'circle' | 'curve'`
    - `circleStartAngle?: number`, `circleEndAngle?: number`
    - `curvePeaks?: number`, `curveBend?: number`
    - `wrap?: 'none' | 'word' | 'char'`
    - `effects?: EffectConfig[]` - **New multi-layer effects system using native Konva shadows**
    - Optional neon-related props: `neonMode`, `neonIntensity`, `neonOffsetX`, `neonOffsetY` (backward compatible - converted to effects)
    - Optional font source: `fontSrc` (custom font loader will attempt to load it)
  - Returns `Konva.TextPath` when a text path is requested and generated, otherwise the main `Konva.Text` node
  - **Automatically creates multiple text layers when effects are present for optimal performance**
- `getMetrics()` — `{ fps, renderTime, layerCount, cacheHits, cacheMisses }`
- `clear()` — removes all children from the main layer
- `clearCache()` — clears image/mask caches
- `dispose()` — tears down observers, listeners, caches and destroys the stage

Behavior notes:

- When `autoResize` is true, the stage scales to the container while preserving the original aspect ratio defined by `{ width, height }`. Do not enable it if you need to read original canvas size in CSS pixels.
- The container gets the class `emtlkit--canvas` and optional `data-print-area` attribute.
- Images and processed masks are cached; use `clearCache()` for memory-sensitive flows.

### Text utilities

All are re-exported from `text/index.ts` and can be imported as `from './text'`.

Auto-fit text:

```ts
import { calculateOptimalTextSize } from './text'

const { fontSize, textLines, textProps } = calculateOptimalTextSize({
  text: 'Paragraph that may wrap',
  width: 320,
  height: 180,
  wrap: 'word', // 'none' | 'word' | 'char'
  lineHeight: 1.25,
  fontFamily: 'Inter',
  precision: 0.1,
})
```

Circular/curved text paths:

```ts
import { generateTextPath, calculateCurveEquivalentRadius } from './text'

// Circle
const { textPath } = generateTextPath({
  width: 300,
  height: 300,
  fontSize: 36,
  textShape: 'circle',
  circleStartAngle: 0,
  circleEndAngle: Math.PI * 2,
  curvePeaks: 1,
  curveBend: 50,
  fontFamily: 'Inter',
  color: '#000',
  align: 'center',
  verticalAlign: 'middle',
})

// Curve (sinusoidal)
const equivalentRadius = calculateCurveEquivalentRadius(600, 200, 2, 75)
const curved = generateTextPath({
  width: 600,
  height: 200,
  fontSize: 36,
  textShape: 'curve',
  circleStartAngle: 0,
  circleEndAngle: Math.PI * 2,
  curvePeaks: 2,
  curveBend: 75,
  fontFamily: 'Inter',
  color: '#000',
  align: 'center',
  verticalAlign: 'middle',
})
```

Supporting helpers:

- Geometry and safety
  - `calculateSafeRadius(width, height)` — inscribed-circle radius with safety padding
  - `validateGeometryParams({ width, height })` — clamps to safe minimums
  - `isValidTextPathGeometry(width, height, fontSize)` — basic validity check
  - `computeTextSafetyPadding(style)` — padding for stroke/shadow to avoid clipping
- Angles and snapping
  - `radiansToDegrees`, `degreesToRadians`, `snapAngleToIncrement(angle, isShift, increment)`
- Curves
  - `calculateCurvePathLength(width, height, peaks, bend, { steps? })`
  - `calculateCurveEquivalentRadius(width, height, peaks, bend, { steps? })`

### Using `addTextLayer` with shapes

```ts
// Circle text auto-fitted to arc length
await manager.addTextLayer({
  text: 'Circular text',
  x: 100,
  y: 100,
  width: 300,
  height: 300,
  fontFamily: 'Inter',
  autoFitToContainer: true,
  textShape: 'circle',
  circleStartAngle: 0,
  circleEndAngle: Math.PI * 2,
  wrap: 'word',
})

// Curved text with 2 peaks and 75% bend
await manager.addTextLayer({
  text: 'Curved text on a wave',
  x: 0,
  y: 250,
  width: 600,
  height: 200,
  fontFamily: 'Inter',
  autoFitToContainer: true,
  textShape: 'curve',
  curvePeaks: 2,
  curveBend: 75,
  wrap: 'word',
})
```

### Performance and cleanup

- FPS and render timing metrics are published internally and can be read via `getMetrics()`.
- Offscreen measurement for wrapping uses a lightweight Konva stage; it requires a browser DOM.
- Always call `dispose()` to remove ResizeObservers and event listeners when a canvas is no longer needed.

### Common pitfalls

- `autoResize: true` scales the visual output. The logical (original) size is the constructor `{ width, height }`.
- When using wrapping (`wrap: 'word' | 'char'`), sizing is height-driven; width is handled by wrapping.
- Near-full circle arcs are treated as full circles to avoid tiny gaps making text invisible.

### Type references (abridged)

```ts
// core/konva-canvas-manager.ts
interface IMaskConfig {
  src: string
  invert?: boolean
  globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
  smoothEdges?: boolean
  smoothingStrength?: number
}

// text/text-scaling.ts
interface CircularTextOptions {
  radius: number
  startAngle: number // radians
  endAngle: number // radians
}

interface TextScalingOptions {
  text: string | string[]
  width: number
  height: number
  padding?: number
  minFontSize?: number
  maxFontSize?: number
  lineHeight?: number
  precision?: number
  fontFamily?: string
  fontStyle?: string
  wrap?: 'none' | 'word' | 'char'
  circularPath?: CircularTextOptions
  align?: 'left' | 'center' | 'right'
  letterSpacing?: number
}
```

### License

Internal to TailorKit. See repository license.
