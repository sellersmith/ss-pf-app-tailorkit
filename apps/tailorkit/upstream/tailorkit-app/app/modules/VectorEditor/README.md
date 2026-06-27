# VectorEditor Processing Logic

## Overview

The VectorEditor module is a full-featured SVG vector graphics editor built with React and TypeScript. It provides comprehensive **path editing**, **node manipulation**, and an advanced **effects system** (gradients, filters, masks, color corrections). Supports both **modal** and **embedded** modes with complete undo/redo history.

---

## Key Features

- **Path Node Editing**: Select, move, insert, and delete path nodes
- **Bezier Curve Editing**: Manipulate control points for cubic and quadratic curves
- **Multi-Node Selection**: Shift+click or drag selection rectangle
- **Multi-Path Selection**: Select multiple paths via rectangle drag for batch operations
- **Path Rotation**: Rotate single or multiple selected paths with visual handle
- **Path Resize**: Scale paths with 8-point resize handles (corners preserve aspect ratio, edges stretch)
- **Layer Ordering**: Reorder paths (move up/down, to front/back) for z-index control
- **Connected Segment Detection**: Intelligent hover highlighting of closed/unclosed subpaths
- **Per-Subpath Styling**: Apply different fill/stroke/effects to individual subpaths
- **Drawing Mode**: Create new paths by clicking to add nodes, with support for multiple subpaths
- **Copy/Cut/Paste**: Clipboard operations for nodes and segments with gradient preservation
- **Effects System**: Gradients, filters, masks, clip paths, blend modes
- **Color Corrections**: Brightness, contrast, saturation, hue rotation
- **History Management**: Full undo/redo with configurable stack size
- **Viewport Controls**: Zoom, pan, fit-to-view
- **Keyboard Shortcuts**: Comprehensive shortcuts for power users
- **Shopify Integration**: Optional upload to Shopify CDN

---

## Configuration Constants (`constants.ts`)

### Canvas Interaction

```typescript
export const NODE_RADIUS = 6 // Node hit radius (px)
export const CONTROL_POINT_RADIUS = 4 // Control point size
export const HIT_TOLERANCE = 10 // Snap distance (px)
export const SELECTION_DRAG_THRESHOLD = 5 // Pixels before drag starts selection
export const ROTATION_HANDLE_OFFSET = 30 // Distance from bounding box top to rotation handle
export const ROTATION_HANDLE_RADIUS = 8 // Rotation handle circle radius
export const RESIZE_HANDLE_SIZE = 8 // Resize handle square size
```

### Viewport

```typescript
export const MIN_SCALE = 0.1 // Minimum zoom level
export const MAX_SCALE = 50 // Maximum zoom level
export const ZOOM_FACTOR = 1.1 // Zoom multiplier per step
export const DEFAULT_PADDING = 50 // Fit-to-view padding (px)
export const MAX_FIT_SCALE = 2 // Maximum scale when auto-fitting
```

### History

```typescript
export const MAX_HISTORY_SIZE = 50 // Undo/redo stack limit
```

### Colors

```typescript
export const COLORS = {
  // Path colors
  selectedPath: '#00CFFF',
  hoveredPath: '#00CFFF',

  // Node colors
  selectedNode: '#0066cc',
  selectedNodeBorder: '#003366',
  multiSelectedNode: '#66aaff',
  multiSelectedNodeBorder: '#0066cc',
  unselectedNode: '#ffffff',
  unselectedNodeBorder: '#0066cc',

  // Control point colors
  controlPoint: '#ff6600',
  controlPointBorder: '#666666',
  controlPointLine: '#999999',

  // Segment highlight (for node insertion)
  segmentHighlight: '#00ff00',
  insertionPoint: '#00ff00',
  insertionPointBorder: '#00aa00',
  insertionPointInner: '#ffffff',

  // Selection rectangle (blue - matches workspace boundary style)
  selectionRect: '#007AFF',
  selectionRectFill: 'rgba(0, 122, 255, 0.15)',

  // Draw mode colors
  drawingPath: '#0066cc',
  drawingPathBorder: '#003366',
  drawingPreview: '#66aaff',
  closeableNode: '#00cc44',
  closeableNodeBorder: '#009933',

  // Checkerboard background
  checkerLight: '#ffffff',
  checkerDark: '#e5e5e5',

  // Closed segment highlight (orange theme)
  closedSegmentStroke: '#FF6B00',
  closedSegmentFill: 'rgba(255, 107, 0, 0.15)',
  closedSegmentNode: '#FF6B00',
  closedSegmentNodeBorder: '#CC5500',

  // Unclosed segment highlight (purple theme)
  unclosedSegmentStroke: '#9B59B6',
  unclosedSegmentNode: '#9B59B6',
  unclosedSegmentNodeBorder: '#7D3C98',

  // ViewBox boundary colors
  viewBoxBoundary: '#999999',
  viewBoxOverlay: 'rgba(128, 128, 128, 0.15)',
  outOfBoundsPreview: '#ff6b6b',

  // Rotation handle colors
  rotationHandle: '#00CFFF',
  rotationHandleBorder: '#0099CC',
  rotationHandleLine: '#00CFFF',

  // Resize handle colors
  resizeHandle: '#00CFFF',
  resizeHandleBorder: '#0099CC',
  resizeHandleFill: '#ffffff',

  // Clip/Hole/Adjustment mask path indicator colors (Overlay Mode)
  clipPath: '#22C55E', // Green for clip paths
  clipPathDash: [6, 4], // Dash pattern for clip paths
  holePath: '#EF4444', // Red for hole paths
  holePathDash: [6, 4], // Dash pattern for hole paths
  adjustmentMaskPath: '#F59E0B', // Amber/Orange for adjustment mask paths
  adjustmentMaskPathDash: [6, 4], // Dash pattern for adjustment mask paths

  // Invisible path indicator colors (no fill and no stroke)
  invisiblePath: '#6B7280', // Gray dashed outline for invisible paths
  invisiblePathDash: [4, 4], // Dash pattern for invisible paths
} as const

export const CHECKER_SIZE = 10 // Checkerboard pattern size
```

### Keyboard Shortcuts

```typescript
export const SHORTCUTS = {
  undo: { key: 'z', ctrl: true },
  redo: { key: 'z', ctrl: true, shift: true },
  redoAlt: { key: 'y', ctrl: true }, // Alternative redo (Illustrator pattern)
  delete: { key: 'Delete' },
  copy: { key: 'c', ctrl: true },
  cut: { key: 'x', ctrl: true },
  paste: { key: 'v', ctrl: true },
  editMode: { key: 'e', alt: true },
  editModeAlt: { key: 'v' }, // Industry standard (Figma/Illustrator)
  drawMode: { key: 'a', alt: true },
  drawModeAlt: { key: 'p' }, // Industry standard (Figma/Illustrator)
  newSubpath: { key: 'm', alt: true },
  finishDrawing: { key: 'Enter' },
  cancelDrawing: { key: 'Escape' },
} as const
```

### Edit Mode Settings Constants

```typescript
// Ruler constants
export const RULER_SIZE = 24 // Width/height of ruler in screen pixels
export const RULER_MAJOR_TICK = 100 // Major tick interval in SVG units
export const RULER_MINOR_TICKS = 10 // Number of minor ticks between major ticks

// Grid constants
export const DEFAULT_GRID_SIZE = 32 // Default grid cell size in SVG units
export const MIN_GRID_SIZE = 8 // Minimum grid size
export const MAX_GRID_SIZE = 128 // Maximum grid size
export const GRID_SNAP_THRESHOLD = 4 // Pixels threshold for snap detection

// Guideline constants
export const GUIDELINE_HIT_TOLERANCE = 4 // Pixels tolerance for guideline hit detection

// Viewport resize constants
export const MIN_VIEWPORT_SIZE = 32 // Minimum viewport dimension

// Edit mode colors
export const EDIT_MODE_COLORS = {
  // Ruler colors
  ruler: '#666666',
  rulerText: '#333333',
  rulerBackground: '#f5f5f5',
  rulerBorder: '#e0e0e0',

  // Grid colors (neutral gray - subtle background)
  gridMajor: 'rgba(128, 128, 128, 0.25)',
  gridMinor: 'rgba(128, 128, 128, 0.12)',

  // Guideline colors (magenta/pink - distinct from blue selection)
  guideline: '#E91E63',
  guidelineDrag: '#FF6B00',
  guidelineHover: '#C2185B',

  // Viewport resize handle colors
  viewportHandle: '#00CFFF',
  viewportHandleBorder: '#0099CC',
  viewportHandleFill: '#ffffff',
  viewportHandleActive: '#0099CC',
} as const
```

---

## Client-Side Processing

### Main Entry Point

```typescript
VectorEditor({
  svgDataUri, // data:image/svg+xml;base64,... or data:image/svg+xml,...
  svgUrl, // https://example.com/image.svg
  isModal, // Render as modal or embedded
  modalOpen, // Modal visibility state
  showFooter, // Show action buttons
  showToolbar, // Show toolbar controls
  initialMode, // 'edit' or 'draw'
  uploadToShopify, // Upload to CDN before onSave
  // Effects feature flags
  enableFilters,
  enableGradients,
  enableMasks,
  enableClipPaths,
  enableBlendModes,
  enableColorCorrection,
  onSave, // Callback with edited SVG data URI or CDN URL
  onModeChange, // Mode change callback
  onModalClose, // Modal close handler
})
```

### Creating From Scratch (Blank Canvas)

The VectorEditor supports creating new SVG files from scratch without requiring an initial source image or SVG:

```typescript
<VectorEditor
  allowBlankCanvas={true}
  initialDimensions={{ width: 800, height: 600 }} // Optional, default: 1024x1024
  initialMode="draw"
  onSave={(svgDataUri) => {
    // Handle the created SVG
  }}
/>
```

When `allowBlankCanvas` is enabled and no source is provided:

- A blank canvas is initialized with the specified dimensions (or 1024x1024 by default)
- The editor starts in Draw mode for immediate shape creation
- All drawing, shape, and effects tools are available

### Processing Pipeline

1. **SVG Loading** (`useSvgLoader`)
   - Decodes data URI or fetches from URL
   - Parses SVG string to extract paths
   - Extracts defs: gradients, filters, masks, clip paths
   - Returns `ParsedSvgExtended` with full structure

2. **Canvas Rendering** (`EditorCanvas`)
   - Two-layer architecture: SVGPreviewLayer + CanvasInteractionLayer
   - SVGPreviewLayer renders SVG with all effects
   - CanvasInteractionLayer renders interactive elements (nodes, handles)

3. **User Interaction**
   - Node selection (click)
   - Multi-selection (Shift+click, Shift+drag)
   - Node/control point dragging
   - Segment hover for node insertion
   - Path-level operations

4. **State Updates** (`immutableUpdates.ts`)
   - Shallow copying for efficient updates
   - History pushed after each operation

5. **Save Operation**
   - Rebuild SVG string with effects
   - Encode to data URI
   - Optional Shopify CDN upload

---

## Data Flow Diagram

```
SVG Input (data URI / URL)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SVG LOADING (useSvgLoader)                    │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐ │
│  │ Decode/Fetch    │ → │ Parse Paths     │ → │ Extract Defs   │ │
│  │ SVG String      │   │ (pathParsing)   │   │ (gradients,    │ │
│  └─────────────────┘   └─────────────────┘   │ filters, etc.) │ │
│                                              └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDITOR STATE                                  │
│  parsedSvg: ParsedSvgExtended                                   │
│  pathStyles: Map<pathIndex, PathStyle>                          │
│  defs: SvgDefs (gradients, filters, masks, clipPaths)           │
│  selection: { pathIndex, nodeIndex, nodeIndices }               │
│  editorMode: 'edit' | 'draw'                                    │
└─────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────┐
        ▼                              ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│   SVGPreviewLayer           │ │   CanvasInteractionLayer        │
│   (effects rendering)       │ │   (nodes, handles, selection)   │
│                             │ │                                 │
│   - Gradients applied       │ │   - Path outlines               │
│   - Filters applied         │ │   - Node circles                │
│   - Masks/clips applied     │ │   - Control point handles       │
│   - Blend modes             │ │   - Selection rectangle         │
│   - Color corrections       │ │   - Drawing preview             │
└─────────────────────────────┘ └─────────────────────────────────┘
        │                              │
        └──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Node Move  │  │ CP Move    │  │ Insert     │  │ Draw Path │ │
│  │ (drag)     │  │ (drag)     │  │ Node       │  │ (click)   │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              IMMUTABLE STATE UPDATE                              │
│  updateCommandPosition() / updateControlPointPosition()          │
│  pushToHistory() → enables undo/redo                            │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SAVE OPERATION                                │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐ │
│  │ Build Extended  │ → │ Rebuild SVG     │ → │ Encode to      │ │
│  │ ParsedSvg       │   │ String + Defs   │   │ Data URI       │ │
│  └─────────────────┘   └─────────────────┘   └────────────────┘ │
│                                                      │          │
│                              ┌────────────────────────┘          │
│                              ▼                                   │
│                    ┌─────────────────────┐                      │
│                    │ Upload to Shopify   │ (optional)           │
│                    │ → Return CDN URL    │                      │
│                    └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Algorithms

### 1. SVG Path Parsing (`pathParsing.ts`)

```
Parse 'd' attribute → PathCommand[]

Supported commands:
- M/m: Move to (start new subpath)
- L/l: Line to
- H/h: Horizontal line
- V/v: Vertical line
- C/c: Cubic Bezier (2 control points)
- S/s: Smooth cubic (reflected control point)
- Q/q: Quadratic Bezier (1 control point)
- T/t: Smooth quadratic (reflected control point)
- A/a: Elliptical arc
- Z/z: Close path

Features:
- Handles compact notation (.5.3 = 0.5, 0.3)
- Converts relative to absolute coordinates
- Preserves all curve data for editing
```

### 2. Path Geometry (`pathGeometry.ts`)

```typescript
// Distance calculations
distance(p1, p2): number

// Point on curves (parameter t: 0-1)
getPointOnLine(p1, p2, t): Point
getPointOnQuadraticBezier(p0, cp, p1, t): Point
getPointOnCubicBezier(p0, cp1, cp2, p1, t): Point

// Hit testing
isPointNearLineSegment(point, p1, p2, tolerance): boolean
isPointNearSegment(point, cmd, prevCmd, tolerance): { isNear, t }
findSegmentAtPoint(path, point, tolerance): { segmentIndex, t } | null

// Path operations
insertNodeIntoPath(path, segmentIndex, position, t): PathCommand[]
closePath(commands): PathCommand[]
```

### 3. Immutable State Updates (`immutableUpdates.ts`)

```typescript
// Single node position update
updateCommandPosition(paths, pathIndex, nodeIndex, x, y): ParsedPath[]

// Control point update
updateControlPointPosition(paths, pathIndex, nodeIndex, cpIndex, x, y): ParsedPath[]

// Multi-node batch update
updateMultipleNodePositions(paths, pathIndex, originalPositions, deltaX, deltaY): ParsedPath[]

// Entire path translation
updatePathPosition(paths, pathIndex, originalPositions, deltaX, deltaY): ParsedPath[]
```

### 4. Path Transformations (`pathTransforms.ts`)

```typescript
// Rotate point around center by angle in degrees
rotatePoint(x, y, center, angleDeg): Point

// Bake rotation into path coordinates (removes pathRotation)
bakeRotationIntoCommands(commands, angleDeg, center): PathCommand[]

// Scale path commands around anchor point
scalePathCommands(commands, scaleX, scaleY, center): PathCommand[]
```

### 5. Coordinate Transformation

```typescript
// Screen → SVG coordinates
screenToSvg(screenX, screenY): Point = {
  x: (screenX - offset.x) / scale,
  y: (screenY - offset.y) / scale
}

// SVG → Screen coordinates
svgToScreen(svgX, svgY): Point = {
  x: svgX * scale + offset.x,
  y: svgY * scale + offset.y
}
```

---

## Architecture Notes

### Component Structure

The VectorEditor module follows a layered architecture:

```
VectorEditor.tsx (orchestration)
├── EditorToolbar/ (top toolbar controls)
│   ├── icons/ (extracted icon components)
│   │   ├── index.ts (icon exports)
│   │   ├── ClipboardIcons.tsx (copy/paste icons)
│   │   ├── CurveIcons.tsx (curve type icons)
│   │   ├── EditModeIcons.tsx (edit mode icons)
│   │   ├── EffectIcons.tsx (effect icons)
│   │   ├── LayerIcons.tsx (layer ordering icons)
│   │   ├── NodeIcons.tsx (node operation icons)
│   │   ├── SelectionIcons.tsx (selection icons)
│   │   └── SidebarIcons.tsx (sidebar toggle icons)
│   ├── ColorButton.tsx (color picker)
│   ├── styles.module.css (toolbar styles)
│   └── index.tsx (toolbar layout)
├── EditorSidebar/ (right panel controls)
│   ├── FillSection.tsx (fill color/gradient)
│   ├── StrokeSection.tsx (stroke settings)
│   ├── FiltersSection.tsx (filter presets)
│   ├── FiltersSection/ (filter section subdirectory)
│   ├── filters/ (filter utilities)
│   ├── AdjustmentsSection.tsx (color adjustments)
│   ├── DrawModeSection.tsx (draw mode shape selection and AI generation)
│   ├── DrawModeSection.module.css (draw mode styles)
│   ├── EditModeSection.tsx (edit mode settings: viewport resize, grid, ruler)
│   ├── FilterPresetIcons.tsx (preset icons)
│   ├── types.d.ts (sidebar type definitions)
│   ├── styles.module.css (sidebar styles)
│   └── index.tsx (sidebar container)
├── EditorCanvas/ (rendering & interaction)
│   ├── SVGPreviewLayer.tsx (effects rendering)
│   ├── CanvasInteractionLayer.tsx (nodes, handles)
│   ├── RasterBackgroundLayer.tsx (overlay mode background)
│   ├── PreviewBackgroundLayer.tsx (preview image display)
│   ├── GridOverlay.tsx (grid display)
│   ├── GuidelinesOverlay.tsx (alignment guidelines)
│   ├── RulerOverlay.tsx (ruler display)
│   ├── styles.module.css (canvas styles)
│   └── hooks/ (viewport, hit detection)
│       ├── index.ts (hooks exports)
│       ├── useCanvasEffects.ts (canvas rendering)
│       └── useHitDetection.ts (interaction detection)
├── constants/ (shape and category definitions)
│   ├── shapes.tsx (shape definitions, icons, category filtering)
│   ├── grids.tsx (grid shape definitions)
│   ├── fantasy.tsx (fantasy shape definitions)
│   ├── zodiacSigns.tsx (western zodiac definitions)
│   ├── zodiacAnimals.tsx (chinese zodiac definitions)
│   ├── constellations.tsx (constellation definitions)
│   ├── pets.tsx (pet shape definitions)
│   ├── nature.tsx (nature shape definitions)
│   ├── objects.tsx (object shape definitions)
│   ├── patterns.tsx (pattern shape definitions)
│   ├── birthday.tsx (birthday shape definitions)
│   ├── valentine.tsx (valentine shape definitions)
│   └── wedding.tsx (wedding shape definitions)
├── hooks/ (reusable logic)
│   ├── index.ts (hook exports)
│   ├── useEditorHistory.ts (undo/redo)
│   ├── useKeyboardShortcuts.ts (input handling)
│   ├── useViewport.ts (zoom/pan)
│   ├── useSvgLoader.ts (parsing)
│   ├── useEffectsManager.ts (effects management)
│   ├── useTouchGestures.ts (mobile gestures)
│   ├── useLayerOrdering.ts (z-index manipulation)
│   ├── useRasterImage.ts (overlay image loading)*
│   ├── useImageTracing.ts (vector tracing)
│   ├── useOverlayState.ts (overlay state management)*
│   ├── useEditModeSettings.ts (edit mode preferences)
│   ├── useGridSettings.ts (grid configuration)
│   └── useGuidelines.ts (alignment guidelines)
│   * Note: useRasterImage and useOverlayState exist but are not exported from hooks/index.ts
└── utils/ (pure functions)
    ├── svg/ (parsing, geometry, effects)
    │   ├── index.ts (SVG utilities exports)
    │   ├── pathParsing.ts (path parsing)
    │   ├── pathGeometry.ts (geometric calculations + connected segment detection)
    │   ├── effectGroups.ts (SVG effect group calculations)
    │   ├── types/ (type definitions)
    │   │   ├── index.ts (type exports)
    │   │   ├── effects.ts (effect types)
    │   │   └── parsed.ts (parsed SVG types)
    │   ├── parsing/ (SVG element parsing)
    │   │   ├── index.ts (parsing exports)
    │   │   ├── gradientParsing.ts
    │   │   ├── filterParsing.ts
    │   │   └── maskClipParsing.ts
    │   ├── effects/ (color matrix utilities)
    │   │   ├── index.ts (effects exports)
    │   │   └── colorMatrix.ts (color matrix operations)
    │   └── serialization/ (SVG output)
    │       ├── index.ts (serialization exports)
    │       └── overlaySerializer.ts (overlay mode output)
    ├── shapes/ (predefined shape generators)
    │   ├── index.ts (shape exports)
    │   ├── shapeGenerators.ts (simple shape generators)
    │   ├── compositeTypes.ts (shared composite types)
    │   ├── fantasy/ (wings, halos)
    │   ├── zodiacSigns/ (western zodiac generators)
    │   ├── zodiacAnimals/ (chinese zodiac generators)
    │   ├── constellations/ (constellation generators)
    │   ├── pets/ (pet shape generators)
    │   ├── nature/ (flowers, leaves)
    │   ├── objects/ (birthday, valentine, wedding, electronics, etc.)
    │   ├── patterns/ (confetti, petals, fireworks, leaves)
    │   └── grids/ (grid layout generators)
    ├── filters/ (filter presets)
    │   ├── index.ts (filter exports)
    │   ├── imageFilterPresets.ts (image filter definitions)
    │   ├── pathFilterPresets.ts (path filter definitions)
    │   └── presets/ (preset subdirectory)
    ├── composite/ (composite utilities)
    ├── export/ (export utilities)
    ├── immutableUpdates.ts (state updates)
    ├── pathTransforms.ts (rotation/scale)
    ├── subpathStyles.ts (per-subpath styling)
    ├── platformShortcuts.ts (keyboard shortcuts)
    └── snap.ts (snapping utilities)
```

### File Size Considerations

The main components (`VectorEditor.tsx`, `EditorCanvas/index.tsx`) are large because they:

- Orchestrate complex interactive state (selection, drawing, transformation)
- Handle multiple input modes (mouse, touch, keyboard)
- Manage interdependent handlers that share state

Pure utility functions are extracted to `utils/` directories. UI icons are extracted to `components/EditorToolbar/icons/`. State management hooks are in `hooks/`.

---

## Key Files

| File                                                 | Purpose                                              |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `VectorEditor.tsx`                                   | Main component, state orchestration, modal handling  |
| `index.tsx`                                          | Public exports and documentation                     |
| `types.d.ts`                                         | TypeScript type definitions                          |
| `constants.ts`                                       | Configuration constants (colors, shortcuts, etc.)    |
| `styles.module.css`                                  | Global component styles                              |
| `constants/shapes.tsx`                               | Shape definitions, icons, category filtering         |
| `constants/grids.tsx`                                | Grid shape definitions and icons                     |
| `constants/fantasy.tsx`                              | Fantasy shape definitions (wings, halos)             |
| `constants/zodiacSigns.tsx`                          | Western zodiac sign definitions                      |
| `constants/zodiacAnimals.tsx`                        | Chinese zodiac animal definitions                    |
| `constants/constellations.tsx`                       | Constellation shape definitions                      |
| `constants/pets.tsx`                                 | Pet shape definitions                                |
| `constants/nature.tsx`                               | Nature shape definitions                             |
| `constants/objects.tsx`                              | Object shape definitions                             |
| `constants/patterns.tsx`                             | Pattern shape definitions                            |
| `constants/birthday.tsx`                             | Birthday shape definitions                           |
| `constants/valentine.tsx`                            | Valentine shape definitions                          |
| `constants/wedding.tsx`                              | Wedding shape definitions                            |
| `components/EditorCanvas/index.tsx`                  | Canvas wrapper, viewport management                  |
| `components/EditorCanvas/CanvasInteractionLayer.tsx` | Interactive elements rendering (Canvas 2D)           |
| `components/EditorCanvas/SVGPreviewLayer.tsx`        | SVG rendering with effects                           |
| `components/EditorCanvas/RasterBackgroundLayer.tsx`  | Overlay mode raster background rendering             |
| `components/EditorCanvas/PreviewBackgroundLayer.tsx` | Preview image display layer                          |
| `components/EditorCanvas/GridOverlay.tsx`            | Grid display overlay for alignment                   |
| `components/EditorCanvas/GuidelinesOverlay.tsx`      | Alignment guidelines overlay                         |
| `components/EditorCanvas/RulerOverlay.tsx`           | Ruler display overlay                                |
| `components/EditorCanvas/styles.module.css`          | Canvas component styles                              |
| `components/EditorCanvas/hooks/useCanvasEffects.ts`  | Canvas rendering effects and sizing                  |
| `components/EditorCanvas/hooks/useHitDetection.ts`   | Hit detection for canvas interactions                |
| `components/EditorToolbar/index.tsx`                 | Toolbar controls and mode switching                  |
| `components/EditorToolbar/icons/index.ts`            | Toolbar icon component exports                       |
| `components/EditorToolbar/icons/ClipboardIcons.tsx`  | Copy/cut/paste icon components                       |
| `components/EditorToolbar/icons/CurveIcons.tsx`      | Curve type selection icons                           |
| `components/EditorToolbar/icons/EditModeIcons.tsx`   | Edit mode icon components                            |
| `components/EditorToolbar/icons/EffectIcons.tsx`     | Effect-related icon components                       |
| `components/EditorToolbar/icons/LayerIcons.tsx`      | Layer ordering icon components                       |
| `components/EditorToolbar/icons/NodeIcons.tsx`       | Node operation icon components                       |
| `components/EditorToolbar/icons/SelectionIcons.tsx`  | Selection mode icon components                       |
| `components/EditorToolbar/icons/SidebarIcons.tsx`    | Sidebar toggle icon components                       |
| `components/EditorToolbar/ColorButton.tsx`           | Reusable color picker                                |
| `components/EditorToolbar/styles.module.css`         | Toolbar component styles                             |
| `components/EditorSidebar/index.tsx`                 | Sidebar panel container                              |
| `components/EditorSidebar/FillSection.tsx`           | Fill color and gradient controls                     |
| `components/EditorSidebar/StrokeSection.tsx`         | Stroke color and width controls                      |
| `components/EditorSidebar/FiltersSection.tsx`        | Filter and effects controls                          |
| `components/EditorSidebar/AdjustmentsSection.tsx`    | Color adjustment controls                            |
| `components/EditorSidebar/DrawModeSection.tsx`       | Draw mode shape selection and AI vector generation   |
| `components/EditorSidebar/EditModeSection.tsx`       | Edit mode settings (viewport, grid, ruler)           |
| `components/EditorSidebar/FilterPresetIcons.tsx`     | Filter preset icon components                        |
| `components/EditorSidebar/types.d.ts`                | Sidebar type definitions                             |
| `components/EditorSidebar/styles.module.css`         | Sidebar component styles                             |
| `hooks/index.ts`                                     | Hook exports                                         |
| `hooks/useEditorHistory.ts`                          | Undo/redo history management                         |
| `hooks/useKeyboardShortcuts.ts`                      | Keyboard event handling                              |
| `hooks/useSvgLoader.ts`                              | SVG loading with effects parsing                     |
| `hooks/useViewport.ts`                               | Zoom/pan state management                            |
| `hooks/useEffectsManager.ts`                         | SVG effects management                               |
| `hooks/useTouchGestures.ts`                          | Mobile gesture handling (pinch, long-press)          |
| `hooks/useLayerOrdering.ts`                          | Layer z-index manipulation (move up/down)            |
| `hooks/useRasterImage.ts`                            | Raster image loading for overlay mode (not exported) |
| `hooks/useImageTracing.ts`                           | Image to vector tracing via VectorWizard API         |
| `hooks/useOverlayState.ts`                           | Overlay state management (not exported from index)   |
| `hooks/useEditModeSettings.ts`                       | Edit mode preferences management                     |
| `hooks/useGridSettings.ts`                           | Grid display and snapping configuration              |
| `hooks/useGuidelines.ts`                             | Alignment guidelines management                      |
| `utils/svg/index.ts`                                 | SVG utilities exports                                |
| `utils/svg/pathParsing.ts`                           | SVG path parsing and serialization                   |
| `utils/svg/pathGeometry.ts`                          | Geometric calculations + connected segment detection |
| `utils/svg/effectGroups.ts`                          | SVG effect group calculations for clip/hole          |
| `utils/svg/types/index.ts`                           | SVG type exports                                     |
| `utils/svg/types/effects.ts`                         | Effect type definitions                              |
| `utils/svg/types/parsed.ts`                          | Extended parse type definitions                      |
| `utils/svg/parsing/index.ts`                         | Parsing utilities exports                            |
| `utils/svg/parsing/gradientParsing.ts`               | Gradient extraction                                  |
| `utils/svg/parsing/filterParsing.ts`                 | Filter extraction                                    |
| `utils/svg/parsing/maskClipParsing.ts`               | Mask/clip path extraction                            |
| `utils/svg/effects/index.ts`                         | Effects utilities exports                            |
| `utils/svg/effects/colorMatrix.ts`                   | Color matrix operations                              |
| `utils/svg/serialization/index.ts`                   | SVG rebuilding with effects                          |
| `utils/svg/serialization/overlaySerializer.ts`       | Overlay mode SVG output generation                   |
| `utils/immutableUpdates.ts`                          | Efficient state update functions                     |
| `utils/pathTransforms.ts`                            | Path rotation and scale transformations              |
| `utils/subpathStyles.ts`                             | Per-subpath styling utilities                        |
| `utils/platformShortcuts.ts`                         | Platform-aware keyboard shortcut formatting          |
| `utils/snap.ts`                                      | Snapping utilities for alignment                     |
| `utils/filters/imageFilterPresets.ts`                | Image filter presets definitions and builders        |
| `utils/filters/pathFilterPresets.ts`                 | Path filter presets for printing techniques          |
| `utils/filters/index.ts`                             | Filter utilities exports                             |

---

## Type Definitions

### Editor Mode

```typescript
type EditorMode = 'edit' | 'draw'
```

### VectorEditorProps

```typescript
interface VectorEditorProps {
  svgDataUri?: string // data:image/svg+xml;...
  svgUrl?: string // https://example.com/image.svg
  isModal?: boolean // Modal vs embedded
  modalOpen?: boolean // Modal visibility
  modalTitle?: string // Modal title
  showFooter?: boolean // Show action buttons
  showToolbar?: boolean // Show toolbar
  initialMode?: EditorMode // 'edit' or 'draw'
  uploadToShopify?: boolean // Upload to CDN before onSave
  onModalClose?: () => void
  onSave: (editedSvgDataUri: string) => void
  onModeChange?: (mode: EditorMode) => void
}

interface VectorEditorOverlayProps extends VectorEditorProps {
  // ... overlay mode props ...

  /** Allow creating from scratch without any source image/SVG */
  allowBlankCanvas?: boolean
  /** Initial dimensions for blank canvas (default: 1024x1024) */
  initialDimensions?: { width: number; height: number }
}
```

### VectorEditorRef (Imperative API)

```typescript
interface VectorEditorRef {
  save: () => void // Trigger save
  undo: () => void // Undo last action
  redo: () => void // Redo undone action
  setMode: (mode: EditorMode) => void // Switch mode
  getMode: () => EditorMode // Get current mode
  resetViewport: () => void // Reset zoom/pan
}
```

### PathCommand

```typescript
interface PathCommand {
  type: PathCommandType // M, L, C, Q, Z, A, H, V, S, T
  x: number
  y: number // Endpoint coordinates
  cp1?: Point // Cubic Bezier control point 1
  cp2?: Point // Cubic Bezier control point 2
  cp?: Point // Quadratic Bezier control point
  rx?: number
  ry?: number // Arc radius
  rotation?: number // Arc rotation
  largeArc?: boolean
  sweep?: boolean // Arc flags
}
```

### ParsedSvg

```typescript
interface ParsedPath {
  commands: PathCommand[]
  fill: string
  stroke?: string
  strokeWidth?: number
  fillRule?: 'nonzero' | 'evenodd'
}

interface ParsedSvg {
  paths: ParsedPath[]
  viewBox: { x: number; y: number; width: number; height: number }
  width: number
  height: number
}
```

### Paint System

```typescript
type Paint = { type: 'none' } | { type: 'color'; color: string } | { type: 'gradient'; gradientId: string }
```

### PathStyle

```typescript
interface PathStyle {
  fill: Paint
  fillRule?: 'nonzero' | 'evenodd'
  stroke?: Paint
  strokeWidth?: number
  opacity?: number
  mixBlendMode?: BlendMode
  filterId?: string
  maskId?: string
  clipPathId?: string
  colorAdjustments?: ColorAdjustments
}
```

### ColorAdjustments

```typescript
interface ColorAdjustments {
  brightness?: number // -100 to 100
  contrast?: number // -100 to 100
  saturation?: number // -100 to 100
  hueRotate?: number // 0 to 360 degrees
  grayscale?: number // 0 to 1
  sepia?: number // 0 to 1
  invert?: number // 0 to 1
}
```

### SvgDefs

```typescript
interface SvgDefs {
  gradients: Map<string, GradientDef>
  filters: Map<string, FilterDef>
  masks: Map<string, MaskDef>
  clipPaths: Map<string, ClipPathDef>
}
```

### VectorEditorClipboardData

```typescript
/** Clipboard data format for copy/cut/paste operations */
interface VectorEditorClipboardData {
  /** Guard key to identify VectorEditor clipboard data */
  __vectorEditorClipboard__: true
  /** Version for future compatibility */
  version: 1
  /** Action that created this clipboard data (determines paste offset) */
  action: 'copy' | 'cut'
  /** Array of segments, each segment is an array of PathCommands starting with M */
  segments: PathCommand[][]
  /** Style information for the copied path */
  style: {
    fill: string
    stroke?: string
    strokeWidth?: number
    fillRule?: 'nonzero' | 'evenodd'
  }
  /** Cloned gradient definitions if the path uses gradients */
  gradients?: GradientDef[]
}
```

### EditorCanvasProps (Selection-related)

> **Note:** Selection state is now consolidated to use only Set-based variables:
>
> - `selectedPathIndices` replaces both `selectedPathIndex` and `selectedPathIndices`
> - `selectedNodeIndices` replaces both `selectedNodeIndex` and `selectedNodeIndices`

```typescript
interface EditorCanvasProps {
  // ... existing props ...
  // Consolidated selection state (Set-based only)
  selectedPathIndices: Set<number>
  selectedNodeIndices: Set<number>
  // Consolidated selection callbacks (Set-based only)
  onPathIndicesChange: (indices: Set<number>) => void
  onNodeIndicesChange: (indices: Set<number>) => void
  // Rotation callbacks (supports multi-path selection)
  onRotationChange?: (pathIndices: Set<number>, deltaAngle: number, center: Point) => void
  onRotationChangeEnd?: (pathIndices: Set<number>, deltaAngle: number, center: Point) => void
  // Resize callbacks (supports multi-path selection)
  onResizeChange?: (pathIndices: Set<number>, scaleX: number, scaleY: number, center: Point) => void
  onResizeChangeEnd?: (pathIndices: Set<number>, scaleX: number, scaleY: number, center: Point) => void
}
```

### EditorToolbarProps (Layer Ordering)

```typescript
interface EditorToolbarProps {
  // ... existing props ...
  // Layer ordering (z-index) props
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveToFront?: () => void
  onMoveToBack?: () => void
}
```

---

## Hooks API

### useEditorHistory

```typescript
interface UseEditorHistoryReturn {
  history: HistoryState[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
  pushToHistory: (paths: ParsedPath[]) => void
  undo: () => ParsedPath[] | null
  redo: () => ParsedPath[] | null
  resetHistory: (initialPaths: ParsedPath[]) => void
}
```

### useViewport

```typescript
interface UseViewportReturn {
  scale: number
  offset: Point
  scaleRef: React.MutableRefObject<number>
  offsetRef: React.MutableRefObject<Point>
  screenToSvg: (screenX: number, screenY: number) => Point
  svgToScreen: (svgX: number, svgY: number) => Point
  setScale: (scale: number) => void
  setOffset: (offset: Point) => void
  commitViewport: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetViewport: () => void
  fitToView: () => void
  handleWheel: (e: React.WheelEvent, canvasRect: DOMRect) => void
  isInitialized: boolean
}
```

### useEffectsManager

```typescript
// Key methods
applyFillGradient(gradientId: string): void
applyStrokeGradient(gradientId: string): void
applyFilter(filterId: string | null): void
applyBlendMode(mode: BlendMode): void
applyOpacity(opacity: number): void
applyColorAdjustments(adjustments: ColorAdjustments): void
createGradient(gradient: GradientDef): void
updateGradient(id: string, updates: Partial<GradientDef>): void
deleteGradient(id: string): void
createFilter(filter: FilterDef): void
updateFilter(id: string, updates: Partial<FilterDef>): void
deleteFilter(id: string): void
```

### useTouchGestures

Handles mobile touch gestures including pinch-zoom, long-press, and double-tap.

```typescript
interface TouchGestureHandlers {
  onPinchStart?: (center: Point, initialDistance: number) => void
  onPinchMove?: (center: Point, scale: number) => void
  onPinchEnd?: () => void
  onLongPress?: (position: Point) => void
  onDoubleTap?: (position: Point) => void
}

interface TouchGestureState {
  isPinching: boolean
  isLongPressing: boolean
  pinchScale: number
  pinchCenter: Point | null
  longPressPosition: Point | null
}

// Usage
const { gestureState, handleTouchStart, handleTouchMove, handleTouchEnd, cleanup } = useTouchGestures({
  onPinchMove: (center, scale) => {
    /* zoom */
  },
  onLongPress: pos => {
    /* selection mode */
  },
  onDoubleTap: pos => {
    /* reset zoom */
  },
})

// Constants
LONG_PRESS_DURATION = 500 // ms
DOUBLE_TAP_THRESHOLD = 300 // ms
DOUBLE_TAP_DISTANCE = 30 // px
```

### useLayerOrdering

Handles z-index manipulation for paths (move up/down, to front/back).

```typescript
interface UseLayerOrderingProps {
  parsedSvg: ParsedSvg | null
  selectedPathIndex: number | null
  setParsedSvg: (svg: ParsedSvg) => void
  pushToHistory: (paths: ParsedPath[]) => void
  setSelectedPathIndices: React.Dispatch<React.SetStateAction<Set<number>>>
  pathStyles: Map<number, PathStyleWithSubpaths>
  setPathStyles: React.Dispatch<React.SetStateAction<Map<number, PathStyleWithSubpaths>>>
}

// Return value
interface UseLayerOrderingReturn {
  canMoveUp: boolean // Can move path toward front (higher z-index)
  canMoveDown: boolean // Can move path toward back (lower z-index)
  handleMoveUp: () => void // Swap with next path
  handleMoveDown: () => void // Swap with previous path
  handleMoveToFront: () => void // Move to end of array (topmost)
  handleMoveToBack: () => void // Move to start of array (bottommost)
}
```

### useRasterImage

Hook for loading and managing raster images in overlay mode.

```typescript
interface UseRasterImageOptions {
  /** Image URL to load */
  imageUrl?: string
  /** Whether the hook should load the image (default: true) */
  enabled?: boolean
}

interface UseRasterImageReturn {
  /** Loaded HTMLImageElement (for canvas rendering if needed) */
  imageElement: HTMLImageElement | null
  /** Image information including dimensions */
  imageInfo: RasterImageInfo | null
  /** Loading state */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Retry loading the image */
  retry: () => void
}

// Usage
const { imageInfo, isLoading, error, retry } = useRasterImage({
  imageUrl: 'https://example.com/photo.jpg',
  enabled: true,
})
```

### useImageTracing

Hook for tracing raster images to vector paths using the VectorWizard API.

```typescript
interface UseImageTracingOptions {
  apiEndpoint?: string // Default: '/api/vector-wizard'
}

interface TracingResult {
  success: boolean
  paths: ParsedPath[]
  error?: string
}

interface UseImageTracingReturn {
  isTracing: boolean
  trace: (imageUrl: string) => Promise<TracingResult>
}

// Usage
const { isTracing, trace } = useImageTracing()

const handleTrace = async () => {
  const result = await trace(imageUrl)
  if (result.success) {
    // Add result.paths to the canvas
  }
}
```

### useOverlayState

Hook for managing overlay state including clip paths, hole paths, and adjustment masks.

```typescript
interface UseOverlayStateOptions {
  /** Initial overlay state */
  initialState?: OverlayState
  /** Callback when overlay state changes */
  onStateChange?: (state: OverlayState) => void
}

interface UseOverlayStateReturn {
  /** Current overlay state */
  overlayState: OverlayState
  /** Set image color adjustments */
  setImageColorAdjustments: (adjustments: ImageColorAdjustments | undefined) => void
  /** Update a single image color adjustment property */
  updateImageColorAdjustment: <K extends keyof ImageColorAdjustments>(key: K, value: ImageColorAdjustments[K]) => void
  /** Add a path index to clip paths */
  addClipPath: (pathIndex: number) => void
  /** Remove a path index from clip paths */
  removeClipPath: (pathIndex: number) => void
  /** Toggle a path index as clip path */
  toggleClipPath: (pathIndex: number) => void
  /** Check if a path index is a clip path */
  isClipPath: (pathIndex: number) => boolean
  /** Add a path index to hole paths */
  addHolePath: (pathIndex: number) => void
  /** Remove a path index from hole paths */
  removeHolePath: (pathIndex: number) => void
  /** Toggle a path index as hole path */
  toggleHolePath: (pathIndex: number) => void
  /** Check if a path index is a hole path */
  isHolePath: (pathIndex: number) => boolean
  /** Toggle a path as adjustment mask */
  toggleAdjustmentMask: (pathIndex: number) => void
  /** Check if a path is an adjustment mask */
  isAdjustmentMask: (pathIndex: number) => boolean
  /** Get adjustment mask for a path */
  getAdjustmentMask: (pathIndex: number) => AdjustmentMask | undefined
  /** Update adjustments for a specific mask */
  updateAdjustmentMask: (pathIndex: number, adjustments: Partial<ImageColorAdjustments>) => void
  /** Remap all indices when paths are deleted/reordered */
  remapIndices: (indexMap: Map<number, number | null>) => void
  /** Reset overlay state to initial/default */
  reset: () => void
  /** Check if overlay has any modifications */
  hasModifications: boolean
}

// Usage
const overlayState = useOverlayState({
  initialState: savedOverlayState,
  onStateChange: state => console.log('State changed:', state),
})

// Toggle a path as clip path
overlayState.toggleClipPath(selectedPathIndex)

// Check current state
if (overlayState.isClipPath(0)) {
  console.log('Path 0 is a clip path')
}
```

### useEditModeSettings

Hook for managing edit mode preferences and settings.

```typescript
interface EditModeSettings {
  /** Show node handles in edit mode */
  showNodeHandles: boolean
  /** Show control point handles */
  showControlPoints: boolean
  /** Snap to grid when moving nodes */
  snapToGrid: boolean
  /** Grid snap size in pixels */
  gridSnapSize: number
  /** Show alignment guidelines */
  showGuidelines: boolean
}

interface UseEditModeSettingsReturn {
  /** Current settings */
  settings: EditModeSettings
  /** Update a single setting */
  updateSetting: <K extends keyof EditModeSettings>(key: K, value: EditModeSettings[K]) => void
  /** Reset to default settings */
  resetSettings: () => void
}

// Usage
const { settings, updateSetting, resetSettings } = useEditModeSettings()

// Toggle snap to grid
updateSetting('snapToGrid', !settings.snapToGrid)
```

### useGridSettings

Hook for managing grid display and snapping configuration.

```typescript
interface GridSettings {
  /** Whether grid is visible */
  visible: boolean
  /** Grid cell size in pixels */
  size: number
  /** Grid line color */
  color: string
  /** Grid line opacity (0-1) */
  opacity: number
  /** Subdivision count (minor grid lines) */
  subdivisions: number
}

interface UseGridSettingsReturn {
  /** Current grid settings */
  gridSettings: GridSettings
  /** Update grid settings */
  setGridSettings: (settings: Partial<GridSettings>) => void
  /** Toggle grid visibility */
  toggleGrid: () => void
  /** Reset to default grid settings */
  resetGrid: () => void
}

// Usage
const { gridSettings, setGridSettings, toggleGrid } = useGridSettings()

// Change grid size
setGridSettings({ size: 20 })
```

### useGuidelines

Hook for managing alignment guidelines that help position elements precisely.

```typescript
interface Guideline {
  /** Guideline orientation */
  orientation: 'horizontal' | 'vertical'
  /** Position in SVG coordinates */
  position: number
  /** Source of the guideline */
  source: 'edge' | 'center' | 'custom'
}

interface UseGuidelinesReturn {
  /** Active guidelines */
  guidelines: Guideline[]
  /** Calculate snap guidelines for a bounding box */
  calculateSnapGuidelines: (
    bounds: BoundingBox,
    threshold: number
  ) => {
    horizontal: Guideline[]
    vertical: Guideline[]
    snapX: number | null
    snapY: number | null
  }
  /** Add a custom guideline */
  addGuideline: (guideline: Guideline) => void
  /** Remove a guideline */
  removeGuideline: (index: number) => void
  /** Clear all custom guidelines */
  clearGuidelines: () => void
}

// Usage
const { guidelines, calculateSnapGuidelines } = useGuidelines()

// Check for snap points when dragging
const { snapX, snapY, horizontal, vertical } = calculateSnapGuidelines(pathBounds, 5)
```

---

## Predefined Shapes

The VectorEditor includes a library of predefined shapes that users can quickly draw by clicking and dragging. This includes simple geometric shapes and complex composite shapes like body parts and fantasy creatures.

### Shape Categories

| Category       | Shapes                                                  |
| -------------- | ------------------------------------------------------- |
| Basic          | Circle, Ellipse, Rectangle, Square, Triangle            |
| Polygons       | Pentagon, Hexagon, Heptagon, Octagon                    |
| Stars          | 5-Point Star, 9-Point Star                              |
| Nature         | Heart, Waterdrop, Moon, Sun, Snowflake, Mountain, Trees |
| Weather        | Wave, Thunder, Wind                                     |
| Arrows         | Arrow, Double Arrow                                     |
| Objects        | Common objects and items                                |
| Patterns       | Decorative patterns and textures                        |
| Grids          | Configurable grid layouts (see Grid Shapes below)       |
| Fantasy        | Wings, Halos                                            |
| Zodiac Signs   | Western zodiac symbols (Aries through Pisces)           |
| Zodiac Animals | Chinese zodiac animals (Rat through Pig)                |
| Constellations | Star constellation patterns                             |
| Pets           | Common pets (dogs, cats, birds, fish, etc.)             |
| Birthday       | Cake, Balloons, Party Hat, Gift Box, Candles, Confetti  |
| Valentine      | Hearts, Cupid, Love Letters, Roses, Ring                |
| Wedding        | Rings, Bouquet, Cake, Dress, Bells, Dove                |

### Simple Shapes

Simple shapes generate a single path with `PathCommand[]`. They are created by:

1. Select a shape from the shapes popover (click the Draw button)
2. Click and drag on canvas to define the bounding box
3. Release to place the shape

### Composite Shapes (Body Parts & Fantasy)

Body parts and fantasy shapes are **composite shapes** that generate multiple paths - one for each component part. This allows users to edit/style individual parts after placement.

#### Style Variants

Composite shape categories use the **Cartoon** style (standard cartoon proportions). The shape definitions support style variants internally, but the UI currently filters to show only cartoon-style shapes for consistency.

#### Composite Shape Structure

```typescript
interface CompositePathResult {
  id: string // Part identifier (e.g., 'head', 'left-eye', 'hair')
  name: string // Display name for the part
  commands: PathCommand[]
  fill?: string // Default fill color
  stroke?: string // Default stroke color
  strokeWidth?: number
  zIndex?: number // Layer order (higher = on top)
}

type CompositeShapeGenerator = (cx: number, cy: number, width: number, height: number) => CompositePathResult[]
```

### Grid Shapes

Grid shapes generate multiple paths arranged in grid patterns. They are composite shapes with configurable layouts and tile types.

#### Grid Configurations

| Configuration | Layout             | Total Tiles |
| ------------- | ------------------ | ----------- |
| 2x2           | 2 rows × 2 columns | 4           |
| 2x3           | 2 rows × 3 columns | 6           |
| 3x3           | 3 rows × 3 columns | 9           |
| 3x4           | 3 rows × 4 columns | 12          |
| 4x4           | 4 rows × 4 columns | 16          |

#### Tile Types

| Tile Type | Description                                       | Default Colors                 |
| --------- | ------------------------------------------------- | ------------------------------ |
| Square    | Rectangular tiles with 3px gap                    | Fill: #CCCCCC, Stroke: #999999 |
| Circle    | Circular tiles inscribed in grid cells            | Fill: #90CAF9, Stroke: #42A5F5 |
| Heart     | Heart-shaped tiles                                | Fill: #FFCDD2, Stroke: #EF5350 |
| Honeycomb | Hexagonal tiles in interlocking pattern (2px gap) | Fill: #FFD54F, Stroke: #FFA000 |

#### Grid Structure

```typescript
interface GridTile {
  row: number // Row index (0-based)
  col: number // Column index (0-based)
  cx: number // Center X coordinate
  cy: number // Center Y coordinate
  width: number // Tile width
  height: number // Tile height
}

interface GridLayout {
  tiles: GridTile[]
  rows: number
  cols: number
  gap: number
  totalWidth: number
  totalHeight: number
}
```

#### Grid Files

| File                                             | Purpose                          |
| ------------------------------------------------ | -------------------------------- |
| `constants/grids.tsx`                            | Grid shape definitions and icons |
| `utils/shapes/grids/types.ts`                    | Grid type definitions            |
| `utils/shapes/grids/gridLayout.ts`               | Layout calculation utilities     |
| `utils/shapes/grids/generators/squareGrid.ts`    | Square tile generator            |
| `utils/shapes/grids/generators/circleGrid.ts`    | Circle tile generator            |
| `utils/shapes/grids/generators/heartGrid.ts`     | Heart tile generator             |
| `utils/shapes/grids/generators/honeycombGrid.ts` | Honeycomb tile generator         |

### Shape Generator Files

| File                                           | Purpose                                     |
| ---------------------------------------------- | ------------------------------------------- |
| `utils/shapes/index.ts`                        | Shape exports                               |
| `utils/shapes/shapeGenerators.ts`              | Simple shape generator functions            |
| `utils/shapes/compositeTypes.ts`               | Shared types for composite shapes           |
| `utils/shapes/fantasy/`                        | Fantasy composite shape generators          |
| `utils/shapes/zodiacSigns/`                    | Zodiac sign shape generators                |
| `utils/shapes/zodiacAnimals/`                  | Zodiac animal shape generators              |
| `utils/shapes/constellations/`                 | Constellation shape generators              |
| `utils/shapes/pets/`                           | Pet shape generators                        |
| `utils/shapes/nature/`                         | Nature shape generators (flowers, leaves)   |
| `utils/shapes/objects/`                        | Object generators (birthday, wedding, etc.) |
| `utils/shapes/patterns/`                       | Pattern generators (confetti, petals, etc.) |
| `utils/shapes/grids/`                          | Grid shape generators and layout utilities  |
| `components/EditorSidebar/DrawModeSection.tsx` | Shape selection UI with category filtering  |

---

## Drawing Mode with Multiple Subpaths

The VectorEditor supports creating paths with multiple disconnected subpaths (compound paths) within a single drawing session. This is useful for creating complex shapes like letters with holes (e.g., "O", "A") or multi-part graphics.

### How It Works

While in Draw mode, there are two ways to create multiple subpaths:

#### Method 1: Close Subpath and Continue

1. Draw nodes for your first shape
2. **Click on a closeable node** (any node in the current subpath except the last one) to close the subpath with a `Z` command
3. The editor automatically enters "new subpath mode" - the preview line disappears
4. Click anywhere to start a new disconnected subpath
5. Repeat as needed

#### Method 2: Manual New Subpath Mode

1. Draw nodes for your first shape (without closing)
2. **Toggle New Subpath Mode**: Press `Alt/Option + M` or click the "New Subpath" toolbar button
3. **Visual Indicator**: The toolbar button shows a pressed/active state, and the preview line disappears
4. **Place New Subpath**: Click anywhere to start a new disconnected subpath with an `M` (moveTo) command
5. **Toggle Off**: Press `Alt/Option + M` again to cancel new subpath mode without placing a point

### Finishing vs. Closing

- **Close subpath** (click on closeable node): Closes the current subpath with `Z` and continues drawing
- **Finish drawing** (Enter key or Finish button): Completes the entire path, saves it, and switches to Edit mode

### Fill Behavior

- **Paths with closed subpaths** (containing `Z` commands): Automatically get a fill color applied
- **Open paths** (no `Z` commands): Render as stroke-only (no fill)

### SVG Path Structure

Multiple subpaths within a single path are represented using multiple `M` commands:

```
M x1,y1 L x2,y2 L x3,y3 Z    // First closed subpath
M x4,y4 L x5,y5 L x6,y6      // Second open subpath
M x7,y7 C ... Z              // Third closed subpath with curves
```

### Toolbar Button

The "New Subpath" button appears in the Draw mode toolbar section:

- **Icon**: Two disconnected path segments
- **State**: Shows pressed appearance when new subpath mode is active
- **Disabled**: Until at least one point has been placed

### Use Cases

- Creating compound shapes (donut shapes, frames with cutouts)
- Drawing multiple disconnected elements as a single path
- Creating letter-like shapes with holes
- Building complex logos or icons in one drawing session

---

## Copy/Cut/Paste Operations

The VectorEditor supports standard clipboard operations for copying, cutting, and pasting path nodes and segments.

### Requirements for Copy/Cut

Copy and cut operations require one of the following:

1. **Entire path selected**: All nodes in a path are selected (minimum 2 nodes)
2. **Contiguous segments**: Selected nodes form contiguous runs, with each run containing at least 2 nodes

### Keyboard Shortcuts

| Shortcut       | Action                             |
| -------------- | ---------------------------------- |
| `Ctrl/Cmd + C` | Copy selected nodes to clipboard   |
| `Ctrl/Cmd + X` | Cut selected nodes (copy + delete) |
| `Ctrl/Cmd + V` | Paste from clipboard as new path   |

### Paste Behavior

- **Copy action**: Pasted content is offset by 10px (both x and y) to avoid overlapping
- **Cut action**: Pasted content appears at original position (no offset)
- Pasted nodes create a new path (not merged into existing paths)
- Gradient definitions are automatically cloned with new IDs

### Clipboard Data Format

The clipboard stores path data in a JSON format (`VectorEditorClipboardData`) that includes:

- Path segments (as arrays of `PathCommand`)
- Style information (fill, stroke, strokeWidth, fillRule)
- Gradient definitions (if the path uses gradients)
- Action type (`'copy'` or `'cut'`) for determining paste offset

### Features

- **Multi-segment support**: Can copy multiple disconnected segments at once
- **Style preservation**: Fill, stroke, and gradient styles are preserved
- **Gradient cloning**: Gradients are duplicated with new IDs to avoid conflicts
- **Closed path detection**: Automatically preserves `Z` commands for closed segments

---

## Keyboard Shortcuts

| Shortcut               | Action                    | Mode |
| ---------------------- | ------------------------- | ---- |
| `Ctrl/Cmd + Z`         | Undo                      | Any  |
| `Ctrl/Cmd + Shift + Z` | Redo                      | Any  |
| `Ctrl/Cmd + Y`         | Redo (alternative)        | Any  |
| `V`                    | Switch to Edit mode       | Any  |
| `Alt/Option + E`       | Switch to Edit mode (alt) | Any  |
| `P`                    | Switch to Draw/Pen mode   | Any  |
| `Alt/Option + A`       | Switch to Draw mode (alt) | Any  |
| `Ctrl/Cmd + A`         | Select all nodes          | Edit |
| `Ctrl/Cmd + C`         | Copy selected nodes       | Edit |
| `Ctrl/Cmd + X`         | Cut selected nodes        | Edit |
| `Ctrl/Cmd + V`         | Paste from clipboard      | Edit |
| `Delete` / `Backspace` | Delete selected           | Edit |
| `Shift + I`            | Invert node selection     | Edit |
| `Alt/Option + M`       | Toggle new subpath mode   | Draw |
| `Enter`                | Finish drawing path       | Draw |
| `Escape`               | Cancel drawing            | Draw |

**Note:** On macOS, `Alt` displays as `option` and `Ctrl` displays as `control` in the UI.

**Industry Standard Shortcuts:** `V` and `P` match shortcuts used in Figma, Adobe Illustrator, and Sketch for selection and pen tools respectively. The `Alt+E` and `Alt+A` alternatives are also supported for compatibility.

---

## Drawing Curve Type

In Draw mode, select the curve type before drawing:

| Mode      | Button             | Behavior                               |
| --------- | ------------------ | -------------------------------------- |
| Line      | Straight line icon | Click adds line segments only          |
| Quadratic | Single curve icon  | Click+drag adds quadratic curves       |
| Cubic     | Double curve icon  | Click+drag adds cubic curves (default) |

The drawing preview updates in real-time to match the selected curve type.

---

## Mouse Interactions

| Interaction                    | Action                                  |
| ------------------------------ | --------------------------------------- |
| Click on node                  | Select node                             |
| Shift + Click on node          | Add/remove from multi-selection         |
| Drag node                      | Move node position                      |
| Drag selected node (multi)     | Move all selected nodes together        |
| Click selected node (multi)    | Reduce to single node selection         |
| Drag control point             | Adjust Bezier curve                     |
| Shift + Drag (empty area)      | Draw selection rectangle (nodes)        |
| Drag (empty, no path selected) | Draw selection rectangle (paths)        |
| Click on path (no node)        | Select path                             |
| Drag selected path             | Move entire path                        |
| Drag selected paths (multi)    | Move all selected paths together        |
| Alt/Option + Click segment     | Insert new node                         |
| Mouse wheel                    | Pan canvas                              |
| Ctrl/Cmd + Mouse wheel         | Zoom in/out (toward cursor)             |
| Drag rotation handle           | Rotate selected path(s)                 |
| Drag corner resize handle      | Scale path(s) uniformly (aspect ratio)  |
| Drag edge resize handle        | Stretch path(s) in one direction        |
| Click (Draw mode)              | Add straight line node                  |
| Click + Drag (Draw mode)       | Add curved node                         |
| Click on closeable node (Draw) | Close current subpath, continue drawing |
| Enter / Finish button (Draw)   | Finish entire drawing and save path     |
| New Subpath button (Draw)      | Start new disconnected subpath          |

---

## Touch/Mobile Interactions

### Basic Touch Gestures

| Interaction                | Action                                  |
| -------------------------- | --------------------------------------- |
| Tap on node                | Select node                             |
| Drag node                  | Move node position                      |
| Short drag on empty area   | Pan canvas                              |
| Pinch                      | Zoom in/out                             |
| Double-tap                 | Reset zoom                              |
| Long-press on path segment | Insert new node (Alt+click equiv.)      |
| Tap on path (no node)      | Select path                             |
| Drag selected path         | Move entire path                        |
| Drag rotation handle       | Rotate selected path(s)                 |
| Drag corner resize handle  | Scale path(s) uniformly (aspect ratio)  |
| Drag edge resize handle    | Stretch path(s) in one direction        |
| Tap (Draw mode)            | Add straight line node                  |
| Tap + drag (Draw mode)     | Add curved node                         |
| Tap closeable node (Draw)  | Close current subpath, continue drawing |
| Finish button (Draw)       | Finish entire drawing and save path     |
| New Subpath button (Draw)  | Start new disconnected subpath          |

### Mobile Toolbar Toggle Buttons

The EditorToolbar provides toggle buttons for mobile users to access keyboard modifier equivalents:

| Toggle Button       | Keyboard Equivalent | Function                                          |
| ------------------- | ------------------- | ------------------------------------------------- |
| Multi-Select Mode   | `Shift`             | Add/remove paths or nodes to/from multi-selection |
| Selection Rectangle | `Shift + Drag`      | Draw rectangle to select multiple paths           |
| Node Insert Mode    | `Alt/Option`        | Tap on segment to insert new node                 |

#### Multi-Select Mode

When enabled:

- Tap on unselected path/node to add to selection
- Tap on selected path/node to remove from selection
- Tap on empty area to clear selection (when mode disabled)

#### Selection Rectangle Mode

When enabled:

- Drag on canvas to draw selection rectangle
- All paths within rectangle are selected
- Combines with Multi-Select Mode for additive selection

---

## Effects System

### Gradients

- **Linear Gradient**: Direction defined by x1, y1, x2, y2
- **Radial Gradient**: Center (cx, cy) and radius (r)
- **Color Stops**: Multiple stops with offset (0-1) and color

### Filters

Supported filter primitives:

- `feGaussianBlur` - Blur effect
- `feDropShadow` - Drop shadow
- `feColorMatrix` - Color transformations
- `feBlend` - Blend modes
- `feOffset` - Position offset
- `feFlood` - Solid color fill
- `feComposite` - Compositing operations
- `feMerge` - Layer merging

### Blend Modes

Supported modes: `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`

### Color Corrections

Applied via CSS filters on SVGPreviewLayer:

- `brightness()` - Brightness adjustment
- `contrast()` - Contrast adjustment
- `saturate()` - Saturation adjustment
- `hue-rotate()` - Hue rotation
- `grayscale()` - Grayscale conversion
- `sepia()` - Sepia tone
- `invert()` - Color inversion

### Filter Presets (Overlay Mode)

In overlay mode, predefined filter presets are available for quick image transformations:

| Preset        | Effect                                  | Parameters                   |
| ------------- | --------------------------------------- | ---------------------------- |
| Silhouette    | High contrast black/white conversion    | Threshold (0-1), Invert      |
| Vintage       | Retro film look with grain              | Intensity (0-100), Grain     |
| Pop Art       | Bold colors with posterization          | Saturation (100-400), Levels |
| Pencil Sketch | Sketch-like appearance with edge detect | Contrast (100-300)           |

**Parameter Controls**: Each preset has adjustable parameters accessible in the Filters sidebar when a preset is active.

**Architecture**:

- Preview uses CSS filters via `buildCssPreview()` for real-time updates
- Export uses the same CSS filters via `ctx.filter` for Canvas rendering
- SVG filter primitives are included as fallback for compatibility

### Path Filter Presets (Vector Paths)

Path filter presets simulate real-world printing and engraving techniques on vector paths. These are used to visualize how text or graphics will appear when printed using various techniques on leather or jewelry.

#### Leather Techniques

| Preset            | Effect                               | Parameters                                 |
| ----------------- | ------------------------------------ | ------------------------------------------ |
| Debossing         | Pressed-in effect with inner shadows | Depth, Light Angle, Softness, Opacity      |
| Embossing         | Raised effect with highlights        | Height, Light Angle, Softness, Opacity     |
| Hot Foil Stamping | Metallic foil appearance             | Depth, Light Angle, Foil Color (11 colors) |
| Laser Engraving   | Burnt brown appearance with depth    | Burn Intensity, Depth                      |

#### Jewelry Techniques

| Preset               | Effect                                         | Parameters                     |
| -------------------- | ---------------------------------------------- | ------------------------------ |
| Diamond Drag         | V-groove engraving with depth effects          | Line Width, Depth, Light Angle |
| Laser Annealing      | Flat matte oxidation mark on metal (heat mark) | Darkness, Warmth               |
| Deep Laser Engraving | Pronounced depth with shadows                  | Depth                          |
| Enamel Fill          | Glossy colored epoxy fill                      | Gloss                          |

#### Foil Colors (Hot Foil Stamping)

Available foil colors: Gold, Silver, Rose Gold, Copper, Bronze, Black, White, Red, Blue, Green, Holographic.

#### Path Filter Architecture

- SVG filter primitives (`feFlood`, `feComposite`, `feOffset`, `feGaussianBlur`, `feMerge`, etc.) for realistic effects
- Dynamic primitive building based on parameter values via `buildPathFilterPrimitives()`
- CSS preview generation via `buildPathFilterCssPreview()`

---

## Performance Optimizations

1. **Immutable Updates**: Shallow copying instead of deep cloning
2. **RAF Batching**: Canvas rendering batched with requestAnimationFrame
3. **Ref Usage**: scaleRef, offsetRef avoid re-renders during interactions
4. **Cached Checkerboard**: Background pattern rendered once, reused
5. **Memoization**: useMemo for computed values
6. **Lazy Computation**: SVG defs parsing only on load
7. **Two-Layer Architecture**: Separates effects rendering from interaction layer

---

## Shared Utilities Infrastructure

VectorEditor utilities have been extracted to shared locations for reuse across modules. The module contains both the original implementations and the shared infrastructure.

### Shared Type Definitions (`app/types/`)

| File                         | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `app/types/geometry.ts`      | `Point`, `BoundingBox`, `BaseShape`, `Shape`         |
| `app/types/color.ts`         | `RGB`, `RGBA`, `HexColor`                            |
| `app/types/shape-handles.ts` | `HandleType`, `HandlePosition`, `HandleOptions`      |
| `app/types/svg-effects.ts`   | `ColorAdjustments`, gradients, filters, blend modes  |
| `app/types/svg-path.ts`      | `PathCommand`, `PathCommandType`, `ConnectedSegment` |
| `app/types/pattern.ts`       | `ScatterPoint`, `PatternConfig`                      |

### Shared SVG Utilities (`app/utils/svg/`)

| File                                | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `app/utils/svg/color-matrix.ts`     | Color matrix operations (brightness, contrast, saturation, hue rotation) |
| `app/utils/svg/path-geometry.ts`    | Bezier curves, distance calculations, path operations                    |
| `app/utils/svg/gradient-parsing.ts` | Parse linear/radial gradients from SVG strings                           |
| `app/utils/svg/filter-parsing.ts`   | Parse SVG filter primitives                                              |
| `app/utils/svg/effect-groups.ts`    | Calculate clip/hole effect groups                                        |

### Shared Shape Utilities (`app/utils/shapes/`)

| File                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `app/utils/shapes/generators.ts` | Shape generator functions (circle, rectangle, polygon, star, etc.) |

### Shared Random/Distribution Utilities

| File                                | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `app/utils/random/seeded-random.ts` | Deterministic seeded random number generator           |
| `app/utils/distribution/scatter.ts` | Distribution algorithms (random, grid, radial, spiral) |

### Import Patterns

New modules should import from shared utilities:

```typescript
// Types
import type { Point, BoundingBox } from '~/types/geometry'
import type { ColorAdjustments, GradientDef, FilterDef } from '~/types/svg-effects'
import type { PathCommand, ConnectedSegment } from '~/types/svg-path'

// Utilities
import { brightnessMatrix, saturationMatrix, colorAdjustmentsToMatrix } from '~/utils/svg/color-matrix'
import { distance, getPointOnCubicBezier, findSegmentAtPoint } from '~/utils/svg/path-geometry'
import { extractGradients, parseLinearGradient } from '~/utils/svg/gradient-parsing'
import { extractFilters, isFilterReference } from '~/utils/svg/filter-parsing'
import { calculateEffectGroups, findAffectingGroup } from '~/utils/svg/effect-groups'
import { generateCircle, generateHeart, shapeGenerators } from '~/utils/shapes/generators'
import { createSeededRandom } from '~/utils/random/seeded-random'
import { scatter, scatterRadial } from '~/utils/distribution/scatter'
```

### Module-Specific vs Shared

VectorEditor retains module-specific implementations for:

- **Path parsing** (`pathParsing.ts`) - VectorEditor-specific parsing with style extraction
- **Filter presets** (`pathFilterPresets.ts`) - Leather/jewelry printing technique filters
- **Shape generators** (`shapeGenerators.ts`, `fantasy/`, `zodiacSigns/`, etc.) - Complex composite shapes
- **Overlay serialization** (`overlaySerializer.ts`) - CSS filter semantics for overlay mode

The shared utilities provide foundational functions that can be reused by other modules like MockupWizard and VectorWizard

---

## Connected Segment Detection

The VectorEditor intelligently detects and highlights connected segments (subpaths) within paths. This enables precise selection and styling of individual subpaths.

### How It Works

A **connected segment** is a continuous series of path commands that form either:

- **Closed subpath**: Ends with a `Z` command (returns to starting point)
- **Open subpath**: A sequence of connected commands between `M` (moveTo) commands

### Detection Algorithm (`pathGeometry.ts`)

The connected segment detection functions are located in `utils/svg/pathGeometry.ts`:

```typescript
// Find the segment containing a specific node
findConnectedSegment(commands: PathCommand[], nodeIndex: number): ConnectedSegment | null

// Parse all segments in a path
parseAllSegments(commands: PathCommand[]): ConnectedSegment[]

// Build SVG path 'd' attribute for a segment
buildSegmentPathD(commands: PathCommand[], segment: ConnectedSegment): string

interface ConnectedSegment {
  startIndex: number      // Index of first command (M command)
  endIndex: number        // Index of last command
  nodeIndices: number[]   // All node indices in this segment
  isClosed: boolean       // Whether segment ends with Z
}
```

### Visual Feedback

When hovering over a path with nodes selected:

- The entire connected segment containing the hovered area is highlighted
- Uses distinct colors for selection vs hover states:
  - `connectedSegmentHover: 'rgba(0, 207, 255, 0.3)'` - Hover highlight
  - `connectedSegmentSelected: 'rgba(0, 102, 204, 0.25)'` - Selected segment

### Interaction Behavior

| State                         | Visual Feedback                         |
| ----------------------------- | --------------------------------------- |
| Hovering path (no selection)  | Path outline highlighted                |
| Hovering path (node selected) | Connected segment filled with highlight |
| Node selected                 | Segment containing node highlighted     |
| Multiple nodes selected       | All affected segments highlighted       |

---

## Per-Subpath Styling

The VectorEditor supports applying different styles to individual subpaths within a single path. This enables fine-grained control over complex vector graphics.

### Style Inheritance Model

Subpath styles use an **inheritance model** where:

1. **Path-level styles** are the default for all subpaths
2. **Subpath overrides** can selectively override specific properties
3. Properties not overridden inherit from the parent path
4. `null` values explicitly clear a property (e.g., `filterId: null` = no filter)

### Type Definitions

```typescript
// Override for a specific subpath (partial, inherits from parent)
interface SubpathStyleOverride {
  fill?: Paint
  fillOpacity?: number
  stroke?: Paint
  strokeWidth?: number
  strokeOpacity?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  opacity?: number
  mixBlendMode?: BlendMode
  filterId?: string | null // null = explicitly no filter
  colorAdjustments?: ColorAdjustments | null
}

// Subpath key is the startIndex of the segment
type SubpathKey = number
type SubpathStylesMap = Map<SubpathKey, SubpathStyleOverride>

// Extended PathStyle with optional subpath overrides
interface PathStyleWithSubpaths extends PathStyle {
  subpathStyles?: SubpathStylesMap
}
```

### Styling Behavior

| Selection State          | Style Changes Apply To                |
| ------------------------ | ------------------------------------- |
| Path selected (no nodes) | Entire path (all subpaths)            |
| Node(s) selected         | Only the subpath containing selection |

---

## Raster Image Overlay Mode

The VectorEditor supports an **Overlay Mode** for editing raster images (PNG/JPG) with vector overlays. This mode allows drawing vector paths on top of images to create clipping masks, cutouts, and region-specific color adjustments.

### Enabling Overlay Mode

Overlay mode is automatically enabled when a `rasterImageUrl` is provided:

```typescript
<VectorEditor
  rasterImageUrl="https://example.com/photo.jpg"
  onOverlaySave={(output) => {
    // Handle the overlay output
  }}
/>
```

Or force overlay mode explicitly:

```typescript
<VectorEditor
  overlayMode={true}
  svgDataUri={existingSvgData} // Optional: resume editing
  initialOverlayState={previousState} // Optional: restore state
  onOverlaySave={(output) => {
    // Handle the overlay output
  }}
/>
```

### VectorEditorOverlayProps

```typescript
interface VectorEditorOverlayProps extends VectorEditorPropsExtended {
  /** Raster image URL for overlay mode (PNG/JPG) */
  rasterImageUrl?: string
  /** Force overlay mode even without rasterImageUrl */
  overlayMode?: boolean
  /** Initial overlay state (clip paths, filters) */
  initialOverlayState?: OverlayState
  /** Callback when overlay state changes */
  onOverlayStateChange?: (state: OverlayState) => void
  /** Alternative save callback for overlay mode */
  onOverlaySave?: (output: OverlaySvgOutput) => void
  /** Optional save callback (required for SVG mode, optional for overlay mode) */
  onSave?: (editedSvgDataUri: string) => void
}
```

### Clip Paths

Clip paths mask the image to show only the area inside the path:

1. Draw or select a path
2. Click the "Clip" button in the toolbar (or use the context menu)
3. The image will be clipped to show only the area inside the path

**Visual Indicator**: Clip paths are shown with a green dashed outline.

### Hole Paths

Hole paths cut out sections of the image (inverse of clip):

1. Draw or select a path
2. Click the "Hole" button in the toolbar
3. The area inside the path will be cut out/transparent

**Visual Indicator**: Hole paths are shown with a red dashed outline.

### Adjustment Masks

Adjustment masks apply color corrections to specific regions:

1. Draw or select a path defining the region
2. Click "Adjustment Mask" in the toolbar
3. Adjust color settings (brightness, contrast, saturation, etc.)
4. Only the area inside the path is affected

**Visual Indicator**: Adjustment mask paths are shown with an amber/orange dashed outline.

### Image Color Adjustments

Global color adjustments can be applied to the entire background image:

```typescript
interface ImageColorAdjustments {
  brightness?: number // -100 to 100
  contrast?: number // -100 to 100
  saturation?: number // -100 to 100
  hueRotate?: number // 0 to 360 degrees
  invert?: number // 0 to 1
  sepia?: number // 0 to 1
  grayscale?: number // 0 to 1
}
```

### Image Tracing

Convert raster images to vector paths using the built-in tracing feature:

1. In overlay mode, click the "Trace" button in the toolbar
2. The image is processed through the VectorWizard API
3. Resulting vector paths are added to the canvas for editing

### Overlay State

The overlay state tracks all modifications:

```typescript
interface OverlayState {
  /** Color adjustments applied to the background image */
  imageColorAdjustments?: ImageColorAdjustments
  /** Path indices used as clip masks */
  clipPathIndices: number[]
  /** Path indices used as holes/cutouts */
  holePathIndices: number[]
  /** Paths used as adjustment masks with their specific adjustments */
  adjustmentMasks: AdjustmentMask[]
}

interface AdjustmentMask {
  /** Index of the path used as the mask */
  pathIndex: number
  /** Color adjustments to apply within this mask */
  adjustments: ImageColorAdjustments
}
```

### Overlay Output

When saving in overlay mode, `onOverlaySave` receives:

```typescript
interface OverlaySvgOutput {
  /** SVG string containing only clipPath definitions */
  clipPathSvg: string
  /** SVG string containing only filter definitions (feColorMatrix) */
  filterSvg: string
  /** Combined overlay SVG with all paths and effects (for rendering) */
  combinedSvg: string
  /** SVG string containing all paths for resuming editing */
  editableSvg: string
  /** Overlay state for resuming editing */
  overlayState: OverlayState
  /** Metadata about the overlay */
  metadata: {
    imageWidth: number
    imageHeight: number
    hasClipPaths: boolean
    hasFilters: boolean
    hasDrawnPaths: boolean
  }
}
```

### Resuming Overlay Edits

To resume editing a previously saved overlay:

```typescript
<VectorEditor
  rasterImageUrl={originalImageUrl}
  svgDataUri={savedOutput.editableSvg}
  initialOverlayState={savedOutput.overlayState}
  onOverlaySave={handleSave}
/>
```

### Utility Functions (`utils/subpathStyles.ts`)

```typescript
// Merge override with parent style
computeEffectiveSubpathStyle(pathStyle: PathStyle, override: SubpathStyleOverride): PathStyle

// Compare styles for equality
areStylesEqual(a: PathStyle, b: PathStyle): boolean
arePaintsEqual(a: Paint, b: Paint): boolean
areColorAdjustmentsEqual(a: ColorAdjustments, b: ColorAdjustments): boolean

// Check if subpaths can be serialized as single path
areSubpathStylesUniform(pathStyle: PathStyleWithSubpaths, segments: ConnectedSegment[]): boolean

// Convert full style to override format
convertToSubpathOverride(updates: Partial<PathStyle>): SubpathStyleOverride

// Update keys after node insertion/deletion
updateSubpathStylesAfterNodeChange(subpathStyles: SubpathStylesMap, changeIndex: number, delta: number): SubpathStylesMap

// Get segments for selected nodes
getSegmentsForSelectedNodes(allSegments: ConnectedSegment[], selectedNodeIndices: Set<number>): ConnectedSegment[]

// Check/remove overrides
hasSubpathOverride(pathStyle: PathStyleWithSubpaths, segmentStartIndex: number): boolean
removeSubpathOverride(pathStyle: PathStyleWithSubpaths, segmentStartIndex: number): PathStyleWithSubpaths
```

### SVG Serialization

When saving, the serialization logic intelligently handles subpath styles:

1. **Uniform styles**: If all subpaths have the same effective style, serialize as a single `<path>` element
2. **Different styles**: Split into multiple `<path>` elements, one per subpath

```typescript
// Serialization with subpath support
serializePathWithSubpaths(path: ParsedPathExtended): string

// Helper to extract commands for a segment
extractSegmentCommands(commands: PathCommand[], segment: ConnectedSegment): PathCommand[]
```

### Toolbar Integration

The EditorToolbar shows a visual indicator when in subpath styling mode:

- **Badge**: Shows "Closed subpath" or "Open subpath" based on selection
- **Reset Button**: Clears subpath override, reverting to path-level inheritance
- **Tooltip**: Explains that styles apply to selected subpath only
