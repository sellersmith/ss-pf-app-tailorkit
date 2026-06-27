# MockupWizard Processing Logic

## Overview

The MockupWizard module creates transparent areas in product mockup images, enabling template/product overlays. It supports both **client-side** and **server-side** processing with intelligent routing based on device type and image dimensions.

---

## Recent Changes

### Image Dimension Thresholds (Updated)

| Environment          | Force Server Threshold | Downscale Threshold            |
| -------------------- | ---------------------- | ------------------------------ |
| Server-side          | N/A                    | 1536px                         |
| Desktop client       | > 1536px → server      | > 1024px → downscale to 1024px |
| Mobile/Tablet client | > 1024px → server      | > 768px → downscale to 768px   |

### No Upscaling After Processing

Results are **no longer upscaled** back to original dimensions after processing:

- Processed images stay at their downscaled dimensions
- Original image is scaled down to match when rendering composite canvas
- Uploads to Shopify happen at the processed (downscaled) dimensions
- Benefits: Faster processing, smaller file sizes, less memory usage

### Uint8Array Optimization (Client-side)

Client-side pixel tracking now uses `Uint8Array` instead of `Set<string>`:

- **20× faster** performance for pixel tracking operations
- Reduced memory allocation and garbage collection overhead

### Seed Point Selection & Deletion (Updated)

Seed points now support selection before deletion:

| Action            | Desktop                             | Mobile                        |
| ----------------- | ----------------------------------- | ----------------------------- |
| Select seed point | Click on it                         | Tap on it                     |
| Deselect          | Click elsewhere                     | Tap elsewhere                 |
| Delete            | Select first, then Delete/Backspace | Select first, then long-press |
| Visual feedback   | Selected = blue, Hovered = orange   | Selected = blue               |

**Note**: New seed points can only be added when no seed point is currently selected. Click/tap elsewhere to deselect first.

### Shape Rotation Support

Shape selections now support rotation for non-straight product surfaces:

| Feature         | Desktop                     | Mobile                  |
| --------------- | --------------------------- | ----------------------- |
| Rotate shape    | Drag rotation handle        | Drag rotation handle    |
| Rotation handle | Circle above selected shape | Larger circle for touch |
| Rotation pivot  | Shape center                | Shape center            |
| Rotation range  | 0-360 degrees               | 0-360 degrees           |

Rotated shapes produce transparent areas with matching rotation. Template positions inherit the rotation angle and `sourceShapeDimensions` (original unrotated dimensions) for correct sizing and alignment.

---

## Processing Thresholds (`constants.ts`)

```typescript
export const IMAGE_DIMENSIONS = {
  SERVER_DOWNSCALE_THRESHOLD: 1536, // Server: downscale if > 1536px
  DESKTOP_FORCE_SERVER_THRESHOLD: 1536, // Desktop: route to server if > 1536px
  DESKTOP_DOWNSCALE_THRESHOLD: 1024, // Desktop: downscale to 1024px
  MOBILE_FORCE_SERVER_THRESHOLD: 1024, // Mobile: route to server if > 1024px
  MOBILE_DOWNSCALE_THRESHOLD: 768, // Mobile: downscale to 768px
} as const
```

---

## Client-Side Processing (`fns.client.ts`)

### Main Entry Point

```typescript
makeInnerTransparent(imageUrl, seedPoints, shapeSelections, parameters, featherRadius, maxDimension)
```

### Processing Pipeline

1. **Image Loading** (`loadImageToCanvas`)
   - Loads image via HTML Canvas with `crossOrigin='anonymous'`
   - Downscales if dimensions exceed `maxDimension` using high-quality smoothing
   - Returns canvas context with original/working dimensions

2. **Coordinate Scaling** (`scaleProcessingInputs`)
   - If image was downscaled, scales seed points and shape coordinates proportionally

3. **Seed Point Processing**
   - For each seed point:
     - Get pixel color at seed location
     - Check if inside any shape selection (uses ellipse equation or rectangle bounds)
     - Sample surrounding area (`sampleRadius`: 30px) to detect frame/edge colors
     - **Flood-fill algorithm**: Stack-based 4-directional expansion
       - Stop conditions: frame color match, area size limit, shape boundary
       - Color matching: `colorSimilarityThreshold` (Euclidean distance in RGB space)
     - Apply interior gap filling if enabled

4. **Shape Selection Processing** (`processShapeSelection`)
   - Routes to `processRectangularSelectionOptimized` or `processEllipseSelectionOptimized`
   - Uses **Uint8Array** for 20× faster pixel tracking
   - **Rectangle processing**:
     - Sample center pixel color
     - Collect all edge pixels for background detection
     - Three rules:
       1. Keep background pixels (different from center)
       2. Keep pixels adjacent to background (preserves frame outline)
       3. Make transparent if similar to center (`centerSimilarityThreshold`)
     - Apply fallback if detected area < threshold
   - **Ellipse processing**:
     - Uses ellipse equation: `(x-cx)²/rx² + (y-cy)²/ry² <= 1`
     - Same logic as rectangle within ellipse boundary

5. **Transparency Application**
   - **Mode 1** (`keepShadowHighlight=true`):
     - Calculate average brightness of detected area
     - Shadow pixels (darker than avg): partial opacity based on intensity
     - Highlight pixels (brighter than avg): partial opacity based on intensity
     - Neutral pixels: fully transparent
   - **Mode 2** (`keepShadowHighlight=false`):
     - Set alpha=0 for all detected pixels

6. **Output** (No upscaling)
   - Convert canvas to PNG Blob at processed dimensions
   - Return `{ processedImageBuffer, transparentCount, transparentAreas, processedWidth, processedHeight, scale }`

---

## Server-Side Processing (`fns.server.ts`)

### Main Entry Point

```typescript
processMockupMask(inputBuffer, seedPoints, shapeSelections, parameters, options)
```

### Key Differences from Client-Side

| Aspect              | Client-Side                       | Server-Side             |
| ------------------- | --------------------------------- | ----------------------- |
| Image Library       | HTML Canvas                       | Sharp (libvips)         |
| Data Structure      | Canvas ImageData + Uint8Array     | Uint8Array              |
| Downscale Threshold | 1024px (desktop) / 768px (mobile) | 1536px                  |
| Performance         | Good for small images             | Better for large images |
| Upload              | Returns Base64                    | Can upload to Shopify   |
| Timeout             | 5 seconds                         | 10+ seconds (dynamic)   |

### Processing Pipeline

1. **Image Loading with Sharp**
   - `sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true })`
   - Returns raw RGBA pixel data as Uint8Array

2. **Downscaling** (`downscaleIfNeeded`)
   - Default threshold: 1536px
   - Uses Lanczos3 kernel for high-quality resizing
   - Scales all coordinates proportionally

3. **Processing Logic**
   - Same algorithms as client-side, using Uint8Array

4. **Output** (No upscaling)
   - PNG with compression level 9
   - Result stays at processed dimensions
   - Optional Shopify Files API upload
   - Returns `{ processedImageBuffer, transparentCount, transparentAreas, processedWidth, processedHeight, scale }`

---

## Data Flow Diagram

```
Original Image (e.g., 2000x1500px)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTING DECISION                            │
│  Desktop: > 1536px → server, else client                        │
│  Mobile: > 1024px → server, else client                         │
└─────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────┐
        ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│     CLIENT-SIDE PATH        │ │       SERVER-SIDE PATH          │
│                             │ │                                 │
│  Downscale to 1024/768px    │ │  Downscale to 1536px            │
│  fns.client.ts              │ │  fns.server.ts                  │
│  Uses: Canvas + Uint8Array  │ │  Uses: Sharp (libvips)          │
└─────────────────────────────┘ └─────────────────────────────────┘
        │                              │
        └──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              RESULT (at processed dimensions)                    │
│  e.g., 1024x768 + scale info (0.512)                            │
│  NO UPSCALING - stays at processed size                         │
└─────────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│   COMPOSITE PREVIEW         │ │   UPLOAD TO SHOPIFY             │
│   Original scaled DOWN to   │ │   At processed dimensions       │
│   match result (1024x768)   │ │   (never upscale before upload) │
│   useTemplateComposition.ts │ │                                 │
└─────────────────────────────┘ └─────────────────────────────────┘
```

---

## Template Positions Flow

```
User draws template at 1024x768 preview (processed dimensions)
        │
        ▼
Template positions stored at preview scale
  - x, y: top-left corner (for center-based rotation in MockupWizard)
  - width, height: template dimensions
  - rotation: angle in degrees (0-360)
        │
        ▼
onApply callback passes positions + processedDimensions to consumer
        │
        ▼
Consumer (MaskLayer) calculates upscale factor:
  upscaleFactor = originalWidth / processedWidth
        │
        ▼
Consumer transforms positions for Konva's top-left rotation pivot:
  1. Calculate center: centerX = x + width/2, centerY = y + height/2
  2. Upscale center: scaledCenterX = centerX * upscaleFactor
  3. Upscale dimensions: scaledWidth = width * upscaleFactor
  4. Transform for Konva's rotation (around top-left):
     scaledX = scaledCenterX - (scaledWidth/2)*cos(θ) + (scaledHeight/2)*sin(θ)
     scaledY = scaledCenterY - (scaledWidth/2)*sin(θ) - (scaledHeight/2)*cos(θ)
        │
        ▼
Final positions at original 2000x1500 scale with correct rotation pivot
```

### Rotation Pivot Point Difference

MockupWizard and TemplateEditor (Konva) use different rotation pivot points:

| System               | Rotation Pivot  | Position Meaning                  |
| -------------------- | --------------- | --------------------------------- |
| MockupWizard         | Center          | x, y = top-left of unrotated rect |
| Konva/TemplateEditor | Top-left (x, y) | x, y = rotation origin            |

When transferring rotated templates from MockupWizard to TemplateEditor, the position must be transformed so that the visual center remains at the same location despite different rotation pivots.

---

## API Endpoint

**Route**: `POST /api/mockup-wizard`

### Request Format (FormData)

```typescript
{
  imageUrl?: string,             // Source image URL (either imageUrl or image required)
  image?: File,                  // Direct file upload (either imageUrl or image required)
  seedPoints: SeedPoint[],       // JSON string: [{x, y}, ...]
  shapeSelections: ShapeSelection[], // JSON string: [{type, x, y, width, height, rotation?}, ...]
  processingParameters: ProcessingParameters, // JSON string
  uploadToShopify: "true" | "false",
  featherRadius: string
}
```

### Response Format

```typescript
{
  success: boolean,
  processedImageUrl: string,     // Shopify URL or Base64
  transparentCount: number,
  transparentAreas?: TransparentArea[],
  message: string,
  // Dimension info for composite canvas scaling
  processedWidth?: number,
  processedHeight?: number,
  originalWidth?: number,
  originalHeight?: number,
  scale?: number
}
```

---

## Core Algorithms

### 1. Flood-Fill (Seed Point Expansion)

```
Stack-based 4-directional expansion:
1. Start at seed point, push to stack
2. Pop pixel, check if:
   - Within bounds
   - Not visited (using Uint8Array for O(1) lookup)
   - Not frame color (via frameMatchThreshold)
   - Similar to seed (via colorSimilarityThreshold)
   - Above minimum brightness
3. If valid: mark as transparent, push 4 neighbors
4. Repeat until stack empty or max area reached
```

### 2. Shape Interior Detection (Optimized with Uint8Array)

```
For rectangles/ellipses:
1. Sample center pixel (reference color)
2. Collect edge pixels → identify background colors
3. For each interior pixel:
   - Skip if matches background
   - Skip if adjacent to background (preserves frame)
   - Include if similar to center
4. Fill gaps horizontally/vertically
5. Apply fallback if detection < threshold
```

### 3. Shadow/Highlight Preservation

```
For each transparent pixel:
1. Calculate brightness delta from average
2. If delta < shadowThreshold: shadow pixel
   - Alpha = shadowIntensity × shadowOpacity
   - Darken RGB by shadowColorDarkeningFactor
3. If delta > highlightThreshold: highlight pixel
   - Alpha = highlightIntensity × highlightOpacity
   - Lighten RGB toward white
4. Else: fully transparent (alpha = 0)
```

---

## Key Files

### Core Files

| File            | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `index.tsx`     | Main component, state management                         |
| `fns.client.ts` | Client-side processing algorithms (Uint8Array optimized) |
| `fns.server.ts` | Server-side processing with Sharp                        |
| `types.d.ts`    | TypeScript interfaces                                    |
| `constants.ts`  | Dimension thresholds, rotation handle constants          |

### Hooks

| File                              | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `hooks/useImageProcessing.ts`     | Processing orchestration, dimension tracking |
| `hooks/useTemplateComposition.ts` | Composite canvas with scaled original image  |
| `hooks/useCanvasState.ts`         | Canvas/drawing state                         |
| `hooks/useShapeDetection.ts`      | Auto shape detection for one-click creation  |
| `hooks/useTouchGestures.ts`       | Mobile touch gestures (pinch, pan, tap-hold) |

### Utilities

| File                           | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `utils/shapeUtils.ts`          | Shape manipulation, rotation utilities          |
| `utils/canvasDrawing.ts`       | Canvas rendering, rotation handle drawing       |
| `utils/templatePositioning.ts` | Template position calculation with rotation     |
| `utils/shapeDetection.ts`      | Flood-fill based auto shape detection           |
| `utils/imageCache.server.ts`   | Server-side image caching for URL downloads     |
| `utils/imagePreprocessing.ts`  | Image dimension validation and preprocessing    |
| `utils/timeoutCalculator.ts`   | Dynamic timeout calculation based on image size |
| `utils/urlValidation.ts`       | URL validation for image sources                |
| `utils/imageProcessing.ts`     | Image processing utilities                      |

### Components

| File                                                 | Purpose                                         |
| ---------------------------------------------------- | ----------------------------------------------- |
| `components/InteractiveCanvas/`                      | User interaction layer (rotation, resize, move) |
| `components/MobileControls/`                         | Mobile-specific UI controls                     |
| `components/MockupWizardFooter/`                     | Footer with action buttons                      |
| `components/ParameterControls/`                      | Parameter adjustment panel                      |
| `components/ParameterControls/CompositeControls.tsx` | Composite/overlay parameter controls            |
| `components/ParameterControls/DetectionControls.tsx` | Detection sensitivity controls                  |
| `components/ParameterControls/SeedPointControls.tsx` | Seed point parameter controls                   |
| `components/ParameterControls/ShapeControls.tsx`     | Shape selection parameter controls              |
| `components/ResultView/`                             | Processed result display                        |

### API Route

| File                                    | Purpose      |
| --------------------------------------- | ------------ |
| `app/routes/api.mockup-wizard/route.ts` | API endpoint |

---

## Shared Utilities Infrastructure

MockupWizard can leverage shared utilities extracted from other modules for common operations.

### Available Shared Types (`app/types/`)

| File                         | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `app/types/geometry.ts`      | `Point`, `BoundingBox`, `BaseShape`, `Shape`    |
| `app/types/color.ts`         | `RGB`, `RGBA`, `HexColor`                       |
| `app/types/shape-handles.ts` | `HandleType`, `HandlePosition`, `HandleOptions` |

### Available Shared Utilities

| Module              | Purpose                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `~/utils/geometry/` | Point-in-shape detection, bounding box calculations, rotation transforms, edge detection |
| `~/utils/color/`    | Color distance, conversion, pixel manipulation                                           |
| `~/utils/svg/`      | SVG parsing, data URI handling, optimization                                             |

### Import Patterns

```typescript
// Types
import type { Point, BoundingBox, BaseShape } from '~/types/geometry'
import type { RGB, RGBA } from '~/types/color'

// Geometry utilities
import { isPointInShape } from '~/utils/geometry/point-in-shape'
import { getBoundingBox } from '~/utils/geometry/bounding-box'
import { rotatePoint } from '~/utils/geometry/rotation-transforms'

// Color utilities
import { colorDistance } from '~/utils/color/distance'
import { rgbToHex, hexToRgb } from '~/utils/color/conversion'
```

---

## Processing Decision Logic

```typescript
// In useImageProcessing hook
const forceServerThreshold = isMobileView
  ? IMAGE_DIMENSIONS.MOBILE_FORCE_SERVER_THRESHOLD // 1024px
  : IMAGE_DIMENSIONS.DESKTOP_FORCE_SERVER_THRESHOLD // 1536px

const downscaleThreshold = isMobileView
  ? IMAGE_DIMENSIONS.MOBILE_DOWNSCALE_THRESHOLD // 768px
  : IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD // 1024px

if (maxDimension > forceServerThreshold) {
  console.log(`[MockupWizard] Routing to server: image exceeds threshold`)
  return processOnServer()
}

try {
  // Try client-side first (5s timeout) with device-appropriate downscale
  console.log(`[MockupWizard] Processing on client with downscale: ${downscaleThreshold}px`)
  return await withTimeout(processOnClient(downscaleThreshold), 5000)
} catch (timeoutError) {
  // Fallback to server
  return processOnServer()
}
```
