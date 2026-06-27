# VectorWizard Processing Logic

## Overview

The VectorWizard module converts raster images to scalable vector graphics (SVG) using Potrace-based vectorization. It supports **shape selection** (manual drawing and auto-detection), **monochrome and color modes**, and integrates with the **VectorEditor** for post-processing.

---

## Key Features

- **Shape Selection**: Draw rectangles/ellipses or use auto-detection
- **Potrace Vectorization**: Industry-standard bitmap-to-vector conversion
- **Color Mode**: Supports monochrome and multi-color (2-256 colors) vectorization
- **Quality Presets**: Low/Medium/High presets for quick parameter adjustment
- **Inline Editing**: VectorEditor integration for SVG post-processing
- **Mobile Support**: Touch gestures for pinch zoom, pan, and shape manipulation

---

## Processing Configuration (`constants.ts`)

### Canvas Interaction Constants

```typescript
export const CANVAS_CONSTANTS = {
  HANDLE_SIZE: 12, // Resize handle size (px)
  HANDLE_HOVER_SIZE: 14, // Handle size when hovered
  EDGE_THRESHOLD: 5, // Edge detection threshold (px)
  MIN_SHAPE_SIZE: 20, // Minimum shape dimensions
  HANDLE_DETECTION_MULTIPLIER: 2.0, // Clickable area multiplier
  DELETE_BUTTON_SIZE: 20, // Delete button size
  DELETE_BUTTON_OFFSET: 25, // Delete button offset from corner

  // Mobile-specific (larger for touch)
  MOBILE_HANDLE_SIZE: 20,
  MOBILE_HANDLE_HOVER_SIZE: 24,
  MOBILE_HANDLE_DETECTION_MULTIPLIER: 3.0,
  MOBILE_EDGE_THRESHOLD: 15,
} as const
```

### Quality Presets

| Preset | Threshold | Turd Size | Opt Tolerance | Use Case                    |
| ------ | --------- | --------- | ------------- | --------------------------- |
| Low    | 80        | 1         | 0.1           | More detail, smaller shapes |
| Medium | 128       | 2         | 0.2           | Balanced (default)          |
| High   | 180       | 10        | 0.5           | Smoother curves, less noise |

---

## Client-Side Processing

### Main Entry Point

```typescript
VectorWizard({
  imageUrl, // Source image URL
  isModal, // Render as modal or standalone
  modalOpen, // Modal visibility state
  apiEndpoint, // API endpoint (default: '/api/vector-wizard')
  showAdvancedSettings, // Show advanced parameter controls
  onApply, // Callback with vector results
  onError, // Error callback
  onModalClose, // Modal close handler
})
```

### Processing Pipeline

1. **Image Loading** (`InteractiveCanvas`)
   - Loads image into HTML Canvas
   - Auto-detects distinct shapes on initial load
   - Supports viewport zoom/pan transformations

2. **Shape Selection**
   - **Manual Drawing**: Click and drag to create rectangles/ellipses
   - **Auto-Detection**: Edge detection identifies distinct image regions
   - **Manipulation**: Move, resize, delete shapes via handles

3. **Coordinate Transformation**
   - Canvas pixels → Image coordinates (for API submission)
   - Image coordinates → Canvas pixels (for rendering)
   - Viewport-aware transformations (scale + offset)

4. **API Request** (`processImage`)
   - Submits shapes and parameters to server
   - Receives SVG data URIs for each shape
   - Supports debounced reprocessing (800ms)

5. **Result Display** (`ResultView`)
   - Carousel of converted SVG previews
   - Parameter adjustment with live reprocessing
   - Download or edit individual results

---

## Server-Side Processing (`fns.server.ts`)

### Main Entry Point

```typescript
convertRasterToVector(
  imageBuffer, // Source image buffer
  shapeSelections, // Array of shape bounds
  conversionParameters, // Potrace settings
  uploadToShopify, // Upload to Shopify Files API
  fileName, // Base filename for uploads
  shopifyClient // Shopify API client (optional)
)
```

### Processing Pipeline

1. **Image Cropping** (`cropImageToShape`)
   - Extracts rectangular region using Sharp
   - For ellipses: applies ellipse mask via SVG composite

2. **Color Palette Extraction** (Color Mode Only)
   - Uses `quantize` library for color quantization
   - Creates deterministic color-to-pixel mapping
   - Generates separate mask for each palette color

3. **Potrace Vectorization** (`bitmapToSvg`)
   - Monochrome: Direct Potrace conversion
   - Color: Traces each color mask separately, composites paths

4. **SVG Optimization** (`optimizeSvg`)
   - SVGO with preset-default plugins
   - Preserves viewBox and xmlns attributes
   - Removes fixed dimensions for responsiveness

5. **Output Generation**
   - Converts to Base64 data URI
   - Optional Shopify Files API upload
   - Returns `VectorResult[]` with bounds and URLs

---

## Data Flow Diagram

```
Source Image
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHAPE SELECTION (Client)                      │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Auto-Detection    │ OR │      Manual Drawing              │ │
│  │   (edge detection)  │    │  (rectangle/ellipse)             │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│              PROCESS BUTTON → API REQUEST                        │
│  FormData: image blob + shapeSelections + conversionParams       │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER PROCESSING                             │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────┐│
│  │ Crop to      │ → │ Color Mode?  │ → │ Potrace Conversion    ││
│  │ Shape Bounds │   │ Yes → Palette│   │ (mono or multi-layer) ││
│  └──────────────┘   └──────────────┘   └───────────────────────┘│
│                                                │                 │
│                                                ▼                 │
│                                    ┌───────────────────────────┐│
│                                    │ SVGO Optimization         ││
│                                    │ → Base64 Data URI         ││
│                                    └───────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RESULT VIEW (Client)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SVG Carousel  │  Parameter Controls  │  Edit/Download      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
     │
     ├──────────────────────────────┐
     ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│   APPLY (with onApply)      │ │   EDIT (VectorEditor)           │
│   Upload to Shopify CDN     │ │   Path editing, colors, effects │
│   Return results to parent  │ │   Return edited SVG data URI    │
└─────────────────────────────┘ └─────────────────────────────────┘
```

---

## Core Algorithms

### 1. Shape Auto-Detection

```
Image loaded → Canvas context
     │
     ▼
Edge detection (Sobel/Canny-like)
     │
     ▼
Connected component analysis
     │
     ▼
Filter by size/aspect ratio
     │
     ▼
Return DetectedShape[] with bounding boxes
```

### 2. Canvas Coordinate Transformation

```typescript
// Canvas → Image coordinates
const imageX = (canvasX - viewport.left) / viewport.scale
const imageY = (canvasY - viewport.top) / viewport.scale

// Image → Canvas coordinates
const canvasX = imageX * viewport.scale + viewport.left
const canvasY = imageY * viewport.scale + viewport.top
```

### 3. Color Quantization (Color Mode)

```
1. Extract raw pixel data from image
2. Skip transparent pixels (alpha ≤ 128)
3. Run quantize algorithm (modified median-cut)
4. Get colorMap for deterministic pixel→color mapping
5. Create binary mask per color (BLACK = traced, WHITE = ignored)
6. Trace each mask with Potrace
7. Composite all paths with fill colors
```

### 4. Ellipse Masking

```
1. Generate SVG ellipse at shape center
2. Convert to PNG mask buffer
3. Composite with 'dest-in' blend mode
4. Result: only pixels inside ellipse retained
```

---

## Key Files

| File                                      | Purpose                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `index.tsx`                               | Main component, state management, modal handling      |
| `fns.server.ts`                           | Server-side Potrace conversion, color quantization    |
| `generateVector.server.ts`                | AI-powered vector generation from text prompts        |
| `shapeDetection.server.ts`                | Server-side shape detection algorithms                |
| `types.d.ts`                              | TypeScript interfaces for shapes, parameters, results |
| `constants.ts`                            | Canvas constants and styling configuration            |
| `styles.module.css`                       | Component styling                                     |
| `hooks/useImageProcessing.ts`             | Processing orchestration, Shopify upload, debouncing  |
| `hooks/useCanvasState.ts`                 | Canvas state, image loading, drawing state            |
| `hooks/useShapeDetection.ts`              | Shape auto-detection hook                             |
| `hooks/useTouchGestures.ts`               | Mobile gesture handling (pinch, pan, tap)             |
| `components/InteractiveCanvas/index.tsx`  | Canvas rendering, shape drawing/manipulation          |
| `components/ResultView/index.tsx`         | SVG preview carousel, parameter controls              |
| `components/VectorWizardFooter/index.tsx` | Action buttons (process, apply, reset)                |
| `components/MobileControls/index.tsx`     | Mobile-specific controls and mode selector            |
| `components/ParameterControls/`           | Basic and advanced settings panels                    |
| `utils/canvasDrawing.ts`                  | Canvas rendering functions                            |
| `utils/shapeUtils.ts`                     | Shape manipulation (handles, resizing, moving)        |
| `utils/shapeDetection.ts`                 | Edge detection and shape analysis                     |
| `utils/imageProcessing.ts`                | API calls for vector conversion                       |

---

## API Endpoint

**Route**: `POST /api/vector-wizard`

### Request Format

```typescript
FormData {
  image: Blob,                        // Source image file
  shapeSelections: string,            // JSON array of ShapeSelection
  conversionParams: string,           // JSON VectorConversionParameters
  uploadToShopify: string,            // "true" | "false"
  fileName: string                    // Base filename for uploads
}
```

### Response Format

```typescript
{
  success: boolean,
  results: VectorResult[],            // Array of conversion results
  error?: string                      // Error message if failed
}
```

### VectorResult Structure

```typescript
{
  shapeId: string,                    // Unique shape identifier
  svgDataUri?: string,                // Base64 data URI of SVG
  svgUrl?: string,                    // Shopify CDN URL (if uploaded)
  bounds: BaseShape,                  // Original shape bounds
  error?: string                      // Error message for this shape
}
```

---

## Type Definitions

### ShapeSelection

```typescript
type ShapeSelection = RectangularShape | EllipseShape

interface BaseShape {
  x: number
  y: number
  width: number
  height: number
  source?: 'manual' | 'auto-detected' | 'deleted-auto-detected'
  shapeId?: string
}

interface RectangularShape extends BaseShape {
  type: 'rectangle'
}

interface EllipseShape extends BaseShape {
  type: 'ellipse'
}
```

### VectorConversionParameters

```typescript
interface VectorConversionParameters {
  // Color mode
  colorMode: 'monochrome' | 'color' // Default: 'monochrome'
  colorCount: number // 2-256 for color mode (default: 16)

  // Core Potrace settings
  threshold: number // 0-255, edge detection (default: 128)
  turdSize: number // Suppress speckles 0-100 (default: 2)
  turnPolicy: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority'
  alphaMax: number // Corner threshold 0-2 (default: 1.0)
  optCurve: boolean // Optimize curves (default: true)
  optTolerance: number // Curve tolerance 0-1 (default: 0.2)

  // Background removal settings
  removeSolidBackground?: boolean // Remove solid color background before vectorization (default: false)
  bgRemovalTolerance?: number // Color tolerance for background removal, 5-100 (default: 30)
  removeWhiteBackground?: boolean // Remove only white color globally across entire image (default: false)
}
```

### VectorWizardProps

```typescript
interface VectorWizardProps {
  imageUrl: string // Source image URL
  isModal?: boolean // Render as modal (default: false)
  hideTitle?: boolean // Hide header title
  modalOpen?: boolean // Modal open state
  modalTitle?: string // Custom modal title
  apiEndpoint?: string // API endpoint (default: '/api/vector-wizard')
  showAdvancedSettings?: boolean // Show advanced controls (default: true)
  onModalClose?: () => void // Modal close handler
  onError?: (error: string) => void // Error callback
  onApply?: (results: VectorResult[]) => void // Apply callback with results
}
```

---

## Hook Return Values

### useImageProcessing

```typescript
{
  // State
  isProcessing: boolean,               // Initial processing in progress
  isReprocessing: boolean,             // Parameter adjustment in progress
  isApplying: boolean,                 // Uploading/applying results
  vectorResults: VectorResult[],       // Conversion results
  showResult: boolean,                 // Has results to display

  // Actions
  processImage: (shapes, params, t) => Promise<void>,
  reprocessImage: (shapes, params, t) => Promise<void>,  // Debounced (800ms)
  applyVectors: (shapes, params, t) => Promise<void>,
  updateVectorResult: (shapeId, svgDataUri) => void,
  backToCanvas: () => void,
  cleanup: () => void
}
```

---

## Mobile Interaction Modes

| Mode       | Icon   | Behavior                           |
| ---------- | ------ | ---------------------------------- |
| Pan        | Hand   | Pinch zoom, two-finger pan         |
| Rectangle  | Square | Touch-drag to draw rectangle       |
| Ellipse    | Circle | Touch-drag to draw ellipse         |
| Manipulate | Move   | Tap to select, drag to move/resize |

### Touch Gesture Configuration

```typescript
{
  enabled: boolean,           // Disable during drawing
  tapHoldDelay: 600,         // ms for long-press detection
  minPinchDistance: 20,      // px before recognizing pinch
  panThreshold: 8            // px slop for pan detection
}
```

---

## VectorEditor Integration

The VectorWizard integrates with VectorEditor for post-conversion editing:

```typescript
// Opening editor for a result
const handleEditResult = (result: VectorResult) => {
  setEditingResult(result)
}

// Saving edited SVG
const handleEditorSave = (editedSvgDataUri: string) => {
  updateVectorResult(editingResult.shapeId, editedSvgDataUri)
  setEditingResult(null)
}
```

**VectorEditor Capabilities:**

- Path node editing (move, add, delete)
- Control point manipulation
- Fill/stroke color changes
- Gradient support
- Undo/redo history
- Zoom/pan navigation

---

## Error Handling

### Client-Side

- Shape validation: minimum 20×20px dimensions
- Empty selection check before processing
- Network error handling with user feedback
- AbortController for request cancellation

### Server-Side

- Invalid shape bounds handling
- Potrace conversion error recovery
- SVGO optimization fallback
- Shopify upload failure graceful degradation

---

## Performance Optimizations

1. **Debounced Reprocessing**: 800ms delay prevents API spam during slider adjustments
2. **AbortController**: Cancels in-flight requests when parameters change
3. **Parallel Shape Processing**: All shapes processed concurrently on server
4. **Canvas Rendering**: Uses requestAnimationFrame for smooth updates
5. **Lazy SVG Loading**: Result images loaded on demand
6. **Memoized Callbacks**: Proper dependency arrays to prevent re-renders

---

## Shared Utilities Infrastructure

VectorWizard leverages shared utilities extracted from the VectorEditor module for common operations.

### Available Shared Types (`app/types/`)

| File                         | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `app/types/geometry.ts`      | `Point`, `BoundingBox`, `BaseShape`, `Shape`    |
| `app/types/color.ts`         | `RGB`, `RGBA`, `HexColor`                       |
| `app/types/shape-handles.ts` | `HandleType`, `HandlePosition`, `HandleOptions` |

### Available Shared Utilities

| Module                            | Purpose                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `~/utils/geometry/`               | Point-in-shape detection, bounding box calculations, rotation transforms |
| `~/utils/color/`                  | Color distance, conversion, pixel manipulation                           |
| `~/utils/svg/parsing`             | SVG string parsing                                                       |
| `~/utils/svg/data-uri`            | Data URI encoding/decoding                                               |
| `~/utils/svg/optimization.server` | SVGO optimization (server-side)                                          |

### Import Patterns

```typescript
// Types
import type { Point, BoundingBox, BaseShape } from '~/types/geometry'
import type { RGB, RGBA } from '~/types/color'

// Geometry utilities
import { isPointInShape, getBoundingBox } from '~/utils/geometry/point-in-shape'
import { rotatePoint } from '~/utils/geometry/rotation-transforms'

// Color utilities
import { colorDistance } from '~/utils/color/distance'
import { rgbToHex } from '~/utils/color/conversion'

// SVG utilities
import { parseSvgToDataUri } from '~/utils/svg/data-uri'
```

### VectorEditor Integration

VectorWizard integrates with VectorEditor for post-conversion editing. See the **VectorEditor Integration** section above for details on the editing workflow
