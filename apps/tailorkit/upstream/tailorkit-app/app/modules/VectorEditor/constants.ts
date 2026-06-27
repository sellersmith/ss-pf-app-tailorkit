/**
 * VectorEditor Constants
 */

// Canvas interaction constants
export const NODE_RADIUS = 6
export const CONTROL_POINT_RADIUS = 4
export const HIT_TOLERANCE = 10
export const SELECTION_DRAG_THRESHOLD = 5 // Minimum pixels to drag before starting selection
export const ROTATION_HANDLE_OFFSET = 30 // Distance from top of bounding box to rotation handle
export const ROTATION_HANDLE_RADIUS = 8 // Rotation handle circle radius
export const RESIZE_HANDLE_SIZE = 8 // Size of resize handle squares
export const RESIZE_HANDLE_HIT_TOLERANCE = 4 // Smaller hit tolerance for resize handles (vs general HIT_TOLERANCE)

// Viewport constants
export const MIN_SCALE = 0.1
export const MAX_SCALE = 50
export const ZOOM_FACTOR = 1.1
export const DEFAULT_PADDING = 50
export const TOOLBAR_PADDING = 70 // Extra top padding to account for toolbar overlay
export const BOTTOM_PADDING = 90 // Extra bottom padding to ensure canvas is fully visible
export const MAX_FIT_SCALE = 2 // Maximum scale when auto-fitting

// History constants
export const MAX_HISTORY_SIZE = 50

// Colors
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
  closeableNode: '#00cc44', // Green to indicate "can close path here"
  closeableNodeBorder: '#009933',

  // Checkerboard background
  checkerLight: '#ffffff',
  checkerDark: '#e5e5e5',

  // Closed segment highlight colors (orange theme)
  closedSegmentStroke: '#FF6B00',
  closedSegmentFill: 'rgba(255, 107, 0, 0.15)',
  closedSegmentNode: '#FF6B00',
  closedSegmentNodeBorder: '#CC5500',

  // Unclosed segment highlight colors (purple theme)
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

  // Clip/Hole path indicator colors
  clipPath: '#22C55E', // Green for clip paths
  clipPathDash: [6, 4], // Dash pattern for clip paths
  holePath: '#EF4444', // Red for hole paths
  holePathDash: [6, 4], // Dash pattern for hole paths
  adjustmentMaskPath: '#F59E0B', // Amber/Orange for adjustment mask paths
  adjustmentMaskPathDash: [6, 4], // Dash pattern for adjustment mask paths

  // Invisible path indicator colors (no fill and no stroke)
  invisiblePath: '#6B7280', // Gray for invisible paths
  invisiblePathDash: [4, 4], // Dash pattern for invisible paths
} as const

// Checkerboard size
export const CHECKER_SIZE = 10

// Keyboard shortcuts
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

// =============================================================================
// Edit Mode Settings Constants (Grid, Ruler, Guidelines, Viewport Resize)
// =============================================================================

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

// Edit mode colors (add to main COLORS object usage)
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
