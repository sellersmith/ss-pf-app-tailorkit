/**
 * VectorEditor Module Type Definitions
 */

import type {
  ParsedPath,
  ParsedSvg,
  PathCommand,
  Point,
  ParsedPathExtended,
  ParsedSvgExtended,
  SvgDefs,
  GradientDef,
  BlendMode,
  ColorAdjustments,
  PathStyleWithSubpaths,
} from './utils/svg'

// Re-export SvgEffectGroup for external use (separate re-export to avoid unused import warning)
export type { SvgEffectGroup } from './utils/svg'

// Editor modes
export type EditorMode = 'edit' | 'draw'

// Drawing curve types for draw mode — re-export from shared hook to avoid duplication
export type { DrawingCurveType } from '~/hooks/useVectorPathDrawing'

// Sidebar section types for collapsible sidebar
export type SidebarSection = 'fill' | 'stroke' | 'filters' | 'adjustments' | 'draw' | 'edit' | 'guide-image' | null

// Resize handle types (8-point resize handles)
export type ResizeHandleType = 'tl' | 'tr' | 'br' | 'bl' | 'n' | 's' | 'e' | 'w'

// Main component props
export interface VectorEditorProps {
  // Support both data URI and standard URL (mutually exclusive)
  svgDataUri?: string // data:image/svg+xml;base64,... or data:image/svg+xml,...
  svgUrl?: string // https://example.com/image.svg
  isModal?: boolean
  modalOpen?: boolean
  modalTitle?: string
  showFooter?: boolean
  showToolbar?: boolean
  initialMode?: EditorMode
  /** When true, uploads edited SVG to Shopify CDN before calling onSave with the CDN URL */
  uploadToShopify?: boolean
  onModalClose?: () => void
  /** Called when the SVG is saved. Receives the data URI or CDN URL (if uploadToShopify is true) and the viewport dimensions. */
  onSave: (editedSvgDataUri: string, dimensions?: { width: number; height: number }) => void
  onModeChange?: (mode: EditorMode) => void
}

// Ref handle for imperative API
export interface VectorEditorRef {
  save: () => void
  undo: () => void
  redo: () => void
  setMode: (mode: EditorMode) => void
  getMode: () => EditorMode
  resetViewport: () => void
}

// History state for undo/redo
export interface HistoryState {
  paths: ParsedPath[]
  overlayState: OverlayState
  pathStyles: Map<number, PathStyleWithSubpaths>
  defs: SvgDefs
}

// Viewport state for zoom/pan
export interface ViewportState {
  scale: number
  offset: Point
}

// Selection state
export interface SelectionState {
  pathIndex: number | null
  nodeIndex: number | null
  nodeIndices: Set<number>
}

// Drag state for canvas interaction
export interface DragState {
  type: 'node' | 'control-point' | 'multi-node' | 'path'
  pathIndex: number
  nodeIndex: number
  cpIndex?: number
  startX: number
  startY: number
  startSvgX?: number
  startSvgY?: number
  /** Starting bounds of selection (for path snapping) */
  startBounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

// Hovered segment info (for node insertion)
export interface HoveredSegment {
  pathIndex: number
  segmentIndex: number
  position: Point
  t: number
}

// Selection rectangle
export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

// =============================================================================
// Connected Segment Types (for subpath highlighting)
// =============================================================================

// Represents a connected segment within a path (can be closed M...Z or unclosed)
export interface ConnectedSegment {
  startIndex: number // Index of first command in segment
  endIndex: number // Index of last command in segment
  nodeIndices: number[] // All node indices in this segment (excluding Z)
  isClosed: boolean // True if segment ends with Z command
}

// Hovered connected segment state for highlighting (different from HoveredSegment used for node insertion)
export interface HoveredConnectedSegment {
  pathIndex: number
  segment: ConnectedSegment
  closestNodeIndex: number
}

// EditorCanvas props
// NOTE: Selection state is now consolidated to use only Set-based variables
// - selectedPathIndices replaces both selectedPathIndex and selectedPathIndices
// - selectedNodeIndices replaces both selectedNodeIndex and selectedNodeIndices
export interface EditorCanvasProps {
  parsedSvg: ParsedSvg
  // Consolidated selection state (Set-based only)
  selectedPathIndices: Set<number>
  selectedNodeIndices: Set<number>
  editorMode: EditorMode
  drawingPath: PathCommand[] | null
  // New subpath mode state
  isStartingNewSubpath?: boolean
  // Predefined shape drawing state
  selectedPredefinedShape?: string | null
  shapeDragStart?: Point | null
  shapeDragCurrent?: Point | null
  // Extended styles for effects rendering
  pathStyles?: Map<number, ParsedPathExtended['style']>
  defs?: SvgDefs
  // Consolidated selection callbacks (Set-based only)
  onPathIndicesChange: (indices: Set<number>) => void
  onNodeIndicesChange: (indices: Set<number>) => void
  onNodeMove: (pathIndex: number, nodeIndex: number, x: number, y: number) => void
  onNodeMoveEnd: (pathIndex: number, nodeIndex: number, x: number, y: number) => void
  onControlPointMove: (pathIndex: number, nodeIndex: number, cpIndex: number, x: number, y: number) => void
  onControlPointMoveEnd: (pathIndex: number, nodeIndex: number, cpIndex: number, x: number, y: number) => void
  onMultiNodeMove?: (pathIndex: number, nodeIndices: Set<number>, deltaX: number, deltaY: number) => void
  onMultiNodeMoveEnd?: (pathIndex: number, nodeIndices: Set<number>, deltaX: number, deltaY: number) => void
  onPathMove?: (pathIndices: Set<number>, deltaX: number, deltaY: number) => void
  onPathMoveEnd?: (pathIndices: Set<number>, deltaX: number, deltaY: number) => void
  onNodeInsert?: (pathIndex: number, segmentIndex: number, position: Point, t: number) => void
  onDrawPathClick?: (x: number, y: number) => void
  onDrawPathCurve?: (x: number, y: number, controlDx: number, controlDy: number) => void
  onDrawPathQuadratic?: (x: number, y: number, controlDx: number, controlDy: number) => void
  onCloseDrawingPath?: (closeToNodeIndex: number) => void
  onCloseDrawingPathWithCurve?: (
    closeToNodeIndex: number,
    controlDx: number,
    controlDy: number,
    curveType: 'cubic' | 'quadratic'
  ) => void
  // Drawing curve type for draw mode
  drawingCurveType?: DrawingCurveType
  // Mobile modifier toggles (simulate Alt/Shift key on mobile)
  mobileInsertNodeMode?: boolean
  mobileMultiSelectMode?: boolean
  // Mobile selection rectangle mode (toggle button instead of long-press)
  mobileSelectionRectMode?: boolean
  // Extend mode props (Feature 3)
  isExtendMode?: boolean
  extendFromNode?: { pathIndex: number; nodeIndex: number } | null
  onExtendPath?: (pathIndex: number, nodeIndex: number, newX: number, newY: number) => void
  onCloseExtendPath?: () => void
  // Canvas interaction callback (for hiding hints on mobile)
  onCanvasInteraction?: () => void
  // Predefined shape drag callbacks
  onShapeDragStart?: (point: Point) => void
  onShapeDragMove?: (point: Point) => void
  onShapeDragEnd?: (startPoint: Point, endPoint: Point) => void
  // Rotation callbacks (supports multi-path selection)
  onRotationChange?: (pathIndices: Set<number>, deltaAngle: number, center: Point) => void
  onRotationChangeEnd?: (pathIndices: Set<number>, deltaAngle: number, center: Point) => void
  // Resize callbacks (supports multi-path selection)
  onResizeChange?: (pathIndices: Set<number>, scaleX: number, scaleY: number, center: Point) => void
  onResizeChangeEnd?: (pathIndices: Set<number>, scaleX: number, scaleY: number, center: Point) => void
  // Overlay mode props (raster image background)
  isOverlayMode?: boolean
  imageInfo?: RasterImageInfo | null
  imageColorAdjustments?: ImageColorAdjustments
  // Clip and hole path indices for visual feedback
  clipPathIndices?: number[]
  holePathIndices?: number[]
  // Adjustment masks for region-specific color adjustments
  adjustmentMasks?: AdjustmentMask[]
  // Block click actions when popover/sidebar is visible (only allow pan/zoom)
  isPopoverOrSidebarOpen?: boolean
  // Callback to close sidebar when clicking on canvas
  onCloseSidebar?: () => void
  // Hide path selection feedback (stroke + nodes) - keep bounding box and transform handles
  // Used when Filters panel is open to avoid obscuring filter effects
  hidePathSelectionFeedback?: boolean
  // Edit mode settings for overlays (grid, ruler, viewport resize)
  editModeSettings?: EditModeSettings
  gridSettings?: GridSettings
  guidelines?: Guideline[]
  onGuidelineAdd?: (axis: 'x' | 'y', position: number) => string
  onGuidelineUpdate?: (id: string, position: number) => void
  onGuidelineRemove?: (id: string) => void
  // Preview image from TemplateEditor (non-editable environmental background)
  previewImageConfig?: PreviewImageConfig
  // SVG workspace dimensions (template canvas dimensions)
  workspaceDimensions?: { width: number; height: number }
}

// EditorCanvas imperative handle methods
export interface EditorCanvasRef {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

// EditorToolbar props
export interface EditorToolbarProps {
  editorMode: EditorMode
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  hasNodeSelection: boolean
  canCopy: boolean
  drawingPath: PathCommand[] | null
  // New subpath mode state
  isStartingNewSubpath?: boolean
  // Predefined shape state
  selectedPredefinedShape: string | null
  // Drawing curve type for draw mode
  drawingCurveType?: DrawingCurveType
  onDrawingCurveTypeChange?: (type: DrawingCurveType) => void
  // Select all nodes callback
  onSelectAllNodes?: () => void
  // Mobile modifier toggles
  mobileInsertNodeMode?: boolean
  mobileMultiSelectMode?: boolean
  mobileSelectionRectMode?: boolean
  onToggleMobileInsertNodeMode?: () => void
  onToggleMobileMultiSelectMode?: () => void
  onToggleMobileSelectionRectMode?: () => void
  // Extend mode props (Feature 3)
  isExtendMode?: boolean
  onToggleExtendMode?: () => void
  onBreakOpenPath?: () => void
  selectedPathIsClosed?: boolean
  // Subpath styling props (for disabling sidebar buttons)
  isSubpathStylingMode: boolean
  // Filter applied state (for disabling adjustments when filter is active)
  selectedPathHasFilter?: boolean
  // Adjustments applied state (for disabling filters when adjustments are active)
  selectedPathHasAdjustments?: boolean
  onModeChange: (mode: EditorMode) => void
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onInvertSelection: () => void
  onFinishDrawing: () => void
  onCancelDrawing: () => void
  // New subpath toggle callback
  onToggleNewSubpath?: () => void
  // Predefined shape callback
  onShapeSelect: (shapeId: string | null) => void
  // Auto-open draw sidebar on first draw mode activation (blank canvas)
  shouldAutoOpenDrawSidebar?: boolean
  onDrawSidebarOpened?: () => void
  // Notify parent when popover open state changes
  onPopoverOpenChange?: (isOpen: boolean) => void
  // Close popover from parent (e.g., when canvas is tapped)
  closePopover?: boolean
  // Layer ordering (z-index) props
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveToFront?: () => void
  onMoveToBack?: () => void
  // Overlay mode props (for raster image background)
  isOverlayMode?: boolean
  // Image tracing props (for raster image to vector conversion)
  isTracing?: boolean
  onTraceImage?: () => void
  // Clip path and hole path controls (for overlay mode)
  isSelectedPathClip?: boolean
  isSelectedPathHole?: boolean
  onToggleClipPath?: () => void
  onToggleHolePath?: () => void
  // Adjustment mask controls (for overlay mode)
  isSelectedPathAdjustmentMask?: boolean
  onToggleAdjustmentMask?: () => void
  // Sidebar section state (for collapsible sidebar)
  activeSidebarSection?: SidebarSection
  onToggleSidebarSection?: (section: SidebarSection) => void
  // Close sidebar when clicking non-sidebar buttons
  onCloseSidebar?: () => void
  // AI vector generation props
  imageUrl?: string
  onAIVectorGenerate?: (svgDataUri: string, svgUrl?: string) => void
  // Edit mode settings props (for EditModeSection sidebar)
  editModeSettings?: EditModeSettings
  onEditModeSettingsChange?: (settings: Partial<EditModeSettings>) => void
  gridSettings?: GridSettings
  onGridSettingsChange?: (settings: Partial<GridSettings>) => void
  // Viewport resize props (for EditModeSection canvas size inputs)
  viewBox?: ViewBox
  onViewBoxChange?: (viewBox: ViewBox) => void
  /** Notify parent when mobile hint text changes so it can render outside the scroll container. */
  onMobileHintChange?: (hint: string | null) => void
}

// Re-export common types from svg utils for convenience
export type { ParsedSvg, ParsedPath, PathCommand, Point } from './utils/svg'

// Re-export extended types
export type {
  ParsedPathExtended,
  ParsedSvgExtended,
  SvgDefs,
  GradientDef,
  FilterDef,
  MaskDef,
  ClipPathDef,
  PathStyle,
  Paint,
  BlendMode,
  ColorAdjustments,
  // Gradient types
  GradientStop,
  LinearGradientDef,
  RadialGradientDef,
  // Filter types
  FilterPrimitive,
  FeGaussianBlur,
  FeDropShadow,
  FeColorMatrix,
  // Subpath style types
  SubpathStyleOverride,
  SubpathKey,
  SubpathStylesMap,
  PathStyleWithSubpaths,
} from './utils/svg'

// =============================================================================
// Extended VectorEditor Props (with effects support)
// =============================================================================

export interface VectorEditorPropsExtended extends VectorEditorProps {
  /** Enable SVG filter effects editing */
  enableFilters?: boolean
  /** Enable gradient fill/stroke editing */
  enableGradients?: boolean
  /** Enable mask editing */
  enableMasks?: boolean
  /** Enable clip path editing */
  enableClipPaths?: boolean
  /** Enable blend mode editing */
  enableBlendModes?: boolean
  /** Enable color correction adjustments */
  enableColorCorrection?: boolean
  /** Initial SVG defs (gradients, filters, masks, clips) */
  initialDefs?: SvgDefs
  /** Callback when defs change */
  onDefsChange?: (defs: SvgDefs) => void
}

// =============================================================================
// Inspector Panel Types
// =============================================================================

export type InspectorPanelType = 'gradient' | 'filters' | 'colorCorrection' | 'masking' | 'presets' | null

export interface InspectorState {
  activePanel: InspectorPanelType
  gradientPanelState?: GradientPanelState
  filtersPanelState?: FiltersPanelState
  colorCorrectionState?: ColorCorrectionState
}

export interface GradientPanelState {
  editingGradientId: string | null
  gradientType: 'linear' | 'radial'
}

export interface FiltersPanelState {
  selectedFilterIndex: number | null
}

export interface ColorCorrectionState {
  // Temporary values while editing
  brightness: number
  contrast: number
  saturation: number
  hueRotate: number
}

// =============================================================================
// Effects State
// =============================================================================

export interface PathEffectsState {
  /** Currently applied filter ID */
  filterId: string | null
  /** Currently applied mask ID */
  maskId: string | null
  /** Currently applied clip path ID */
  clipPathId: string | null
  /** Current blend mode */
  blendMode: BlendMode | null
  /** Current opacity (0-1) */
  opacity: number
  /** Color correction adjustments */
  colorAdjustments: ColorAdjustments | null
}

// =============================================================================
// Extended History State (includes defs)
// =============================================================================

export interface HistoryStateExtended {
  paths: ParsedPathExtended[]
  defs: SvgDefs
}

// =============================================================================
// SVG Preview Layer Props
// =============================================================================

export interface SVGPreviewLayerProps {
  parsedSvg: ParsedSvgExtended
  scale: number
  offset: Point
  width: number
  height: number
}

// =============================================================================
// Canvas Interaction Layer Props
// =============================================================================

export interface CanvasInteractionLayerProps {
  parsedSvg: ParsedSvg | ParsedSvgExtended
  selectedPathIndex: number | null
  selectedNodeIndex: number | null
  selectedNodeIndices: Set<number>
  selectedPathIndices: Set<number>
  hoveredPathIndex: number | null
  hoveredSegment: HoveredSegment | null
  selectionRect: SelectionRect | null
  drawingPath: PathCommand[] | null
  drawPreviewPos: Point | null
  isStartingNewSubpath?: boolean
  editorMode: EditorMode
  scaleRef: React.MutableRefObject<number>
  offsetRef: React.MutableRefObject<Point>
  width: number
  height: number
  hoveredDrawingNodeIndex?: number | null
  onRequestRender: () => void
}

// =============================================================================
// Clipboard Data Types
// =============================================================================

/** Style info for a single copied path */
interface ClipboardPathStyle {
  fill: string
  stroke?: string
  strokeWidth?: number
  fillRule?: 'nonzero' | 'evenodd'
  /** Filter ID if a filter preset is applied to this path */
  filterId?: string
}

/** A complete path with its style for path-level clipboard */
interface ClipboardPath {
  commands: PathCommand[]
  style: ClipboardPathStyle
}

/** Clipboard data format for copy/cut/paste operations */
export interface VectorEditorClipboardData {
  /** Guard key to identify VectorEditor clipboard data */
  __vectorEditorClipboard__: true
  /** Version for future compatibility */
  version: 1 | 2
  /** Action that created this clipboard data (determines paste offset) */
  action: 'copy' | 'cut'
  /** Type of clipboard content: 'nodes' for node-level, 'paths' for path-level */
  type?: 'nodes' | 'paths'
  /** Array of segments for node-level copy (version 1 format) */
  segments?: PathCommand[][]
  /** Style information for node-level copy (version 1 format) */
  style?: ClipboardPathStyle
  /** Array of complete paths for path-level copy (version 2 format) */
  paths?: ClipboardPath[]
  /** Cloned gradient definitions if paths use gradients */
  gradients?: GradientDef[]
  /** Cloned filter definitions if paths have filters applied */
  filters?: FilterDef[]
}

// =============================================================================
// Raster Image Overlay Mode Types
// =============================================================================

/** Raster image information for overlay mode */
export interface RasterImageInfo {
  /** Image URL */
  url: string
  /** Display width (may be scaled) */
  width: number
  /** Display height (may be scaled) */
  height: number
  /** Natural/original width of the image */
  naturalWidth: number
  /** Natural/original height of the image */
  naturalHeight: number
}

/** Color adjustments applied to the background raster image */
export interface ImageColorAdjustments {
  /** Brightness adjustment (-100 to 100) */
  brightness?: number
  /** Contrast adjustment (-100 to 100) */
  contrast?: number
  /** Saturation adjustment (-100 to 100) */
  saturation?: number
  /** Hue rotation (0-360 degrees) */
  hueRotate?: number
  /** Invert amount (0-1) */
  invert?: number
  /** Sepia amount (0-1) */
  sepia?: number
  /** Grayscale amount (0-1) */
  grayscale?: number
  /** ID of the applied filter preset (if any) */
  filterPresetId?: string
  /** Parameters for fine-tuning the active filter preset */
  filterPresetParams?: FilterPresetParams
}

/**
 * Filter preset parameters - simple key-value map of parameter names to numeric values.
 * Each filter preset defines its own parameter keys (e.g., 'threshold', 'invert' for silhouette).
 * The parameter definitions (min, max, step, default) are in imageFilterPresets.ts.
 */
export type FilterPresetParams = Record<string, number>

/** Adjustment mask - applies color adjustments to a specific region defined by a path */
export interface AdjustmentMask {
  /** Index of the path used as the mask */
  pathIndex: number
  /** Color adjustments to apply within this mask */
  adjustments: ImageColorAdjustments
}

/** Overlay state tracking what's drawn on top of the raster image */
export interface OverlayState {
  /** Color adjustments applied to the background image */
  imageColorAdjustments?: ImageColorAdjustments
  /** Path indices used as clip masks */
  clipPathIndices: number[]
  /** Path indices used as holes/cutouts */
  holePathIndices: number[]
  /** Paths used as adjustment masks with their specific adjustments */
  adjustmentMasks: AdjustmentMask[]
}

/** Overlay SVG output structure for external application */
export interface OverlaySvgOutput {
  /** SVG string containing only clipPath definitions */
  clipPathSvg: string
  /** SVG string containing only filter definitions (feColorMatrix) */
  filterSvg: string
  /** Combined overlay SVG with all paths and effects (for rendering) */
  combinedSvg: string
  /** SVG string containing all paths for resuming editing (pass as svgDataUri) */
  editableSvg: string
  /** Overlay state for resuming editing (pass as initialOverlayState) */
  overlayState: OverlayState
  /** Metadata about the overlay */
  metadata: {
    /** Original image width */
    imageWidth: number
    /** Original image height */
    imageHeight: number
    /** Whether overlay contains clip paths */
    hasClipPaths: boolean
    /** Whether overlay contains color filters */
    hasFilters: boolean
    /** Whether overlay contains drawn paths */
    hasDrawnPaths: boolean
    /** Whether overlay contains hole paths */
    hasHoles?: boolean
    /** Whether overlay contains adjustment masks */
    hasAdjustmentMasks?: boolean
  }
}

/** Preview product image configuration from TemplateEditor */
export interface PreviewImageConfig {
  /** Image URL */
  src: string
  /** Position X relative to template canvas origin */
  left: number
  /** Position Y relative to template canvas origin */
  top: number
  /** Display width */
  width: number
  /** Display height */
  height: number
  /** Rotation in degrees */
  rotation: number
  /** Original image width */
  naturalWidth?: number
  /** Original image height */
  naturalHeight?: number
}

/** Extended props for overlay mode (raster image background) */
export interface VectorEditorOverlayProps extends Omit<VectorEditorPropsExtended, 'onSave'> {
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
  /** Allow creating from scratch without any source image/SVG */
  allowBlankCanvas?: boolean
  /** Initial dimensions for blank canvas (default: 1024x1024) */
  initialDimensions?: { width: number; height: number }
  /** Preview image from TemplateEditor (non-editable environmental background) */
  previewImageConfig?: PreviewImageConfig
  /** Additional secondary actions to prepend inside the modal header (next to Cancel) */
  secondaryActions?: Array<{ content: string; onAction: () => void; disabled?: boolean }>
  /** Centered overlay content on the canvas (e.g. empty state CTA). Hidden when user starts interacting. */
  canvasOverlay?: React.ReactNode
  /** Floating action buttons at bottom-left of canvas area */
  canvasActions?: Array<{
    icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
    /** Optional text label shown next to icon. When omitted, renders icon-only button. */
    label?: string
    tooltip: string
    onAction: () => void
    disabled?: boolean
    /** When true, shows active/pressed visual state */
    active?: boolean
  }>
  /** Enable the guide image tool in the toolbar sidebar */
  guideImageProps?: {
    /** Currently selected guide image URL */
    imageUrl?: string
    /** Capture current canvas as guide image */
    onCaptureCanvas: () => void
    /** Remove the guide image */
    onRemoveImage: () => void
    /** Inline image browser rendered in the sidebar (no modal) */
    imageBrowser?: React.ReactNode
  }
}

// =============================================================================
// Edit Mode Settings Types (Grid, Ruler, Guidelines, Viewport Resize)
// =============================================================================

/** Edit mode settings for canvas helpers */
export interface EditModeSettings {
  /** Show rulers at top and left edges */
  showRuler: boolean
  /** Show grid overlay on canvas */
  showGrid: boolean
}

/** Grid display and snap settings */
export interface GridSettings {
  /** Grid cell size in SVG units */
  size: number
  /** Enable snapping to grid during move/resize */
  snapEnabled: boolean
}

/** A guideline for alignment assistance */
export interface Guideline {
  /** Unique identifier for the guideline */
  id: string
  /** Axis of the guideline: 'x' for vertical, 'y' for horizontal */
  axis: 'x' | 'y'
  /** Position in SVG coordinates */
  position: number
}

/** Result of a snap operation */
export interface SnapResult {
  /** X coordinate after snapping */
  x: number
  /** Y coordinate after snapping */
  y: number
  /** Whether X was snapped */
  snappedX: boolean
  /** Whether Y was snapped */
  snappedY: boolean
}

/** ViewBox structure for viewport resize */
export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}
