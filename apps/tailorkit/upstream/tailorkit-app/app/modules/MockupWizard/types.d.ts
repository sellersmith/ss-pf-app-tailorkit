// Import shared geometry types
import type {
  Point as GeometryPoint,
  BoundingBox,
  BaseShape as GeometryBaseShape,
  Shape as GeometryShape,
  VectorShape as GeometryVectorShape,
  TransparentArea as GeometryTransparentArea,
} from '~/types/geometry'

// MockupWizard-specific shape extensions (adds source and shapeId)
export interface BaseShape extends GeometryBaseShape {
  source?: 'manual'
  shapeId?: string
}

export interface RectangularShape extends BaseShape {
  type: 'rectangle'
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse'
}

export interface VectorShape extends BaseShape {
  type: 'vector'
  /** Closed path commands defining the shape boundary */
  pathCommands: GeometryVectorShape['pathCommands']
  /** Pre-computed SVG path d-string (cached for Path2D rendering) */
  pathD?: string
}

export type ShapeSelection = RectangularShape | EllipseShape | VectorShape

// Re-export TransparentArea from shared types
export type TransparentArea = GeometryTransparentArea

// Re-export base geometry types for convenience
export type { BoundingBox, GeometryPoint, GeometryShape }

export interface TemplateImageState {
  loaded: boolean
  error: string | null
}

export interface TemplatePosition {
  x: number
  y: number
  width: number
  height: number
  rotation?: number // Rotation angle in degrees (0-360), for matching rotated transparent areas
}

export interface DetectedShape {
  id: string
  boundingBox: BaseShape
  confidence: number
}

export interface ShapeDetectionStats {
  edgesFound: number
  componentsFound: number
  shapesBeforeFiltering: number
  shapesAfterFiltering: number
  processingTime: number
}

export interface MockupWizardProps {
  imageUrl: string
  /** @deprecated No longer used - upscaling now happens in the consumer (MaskLayer) */
  originalImageDimensions?: { width: number; height: number }
  isModal?: boolean
  /** Hide the "Mockup Wizard (beta)" title header when rendered inline */
  hideTitle?: boolean
  /** Hide the instructions collapsible accordion */
  hideInstructions?: boolean
  /** Hide the footer (zoom controls + Process/Reset/Apply buttons) */
  hideFooter?: boolean
  /** Skip the result view — auto-call Apply immediately after Process completes.
   *  Useful when the consumer handles compositing in its own UI (e.g. onboarding wizard). */
  skipResultView?: boolean
  /** Hide the settings panel, banner, and zoom controls in the result view.
   *  Shows only the composite canvas at full width. Used when the consumer provides its own controls. */
  hideResultSettings?: boolean
  /** Content to render in place of the settings panel when hideResultSettings is true.
   *  Rendered in the right column of the two-column layout. */
  resultSideContent?: React.ReactNode
  /** Fixed height for the result view container (e.g. 'calc(80vh - 280px)').
   *  Image column is fixed to this height; side content scrolls within it. */
  resultContainerHeight?: string
  /** Force fallbackToFullTransparency to be enabled from the start.
   *  When true, the entire drawn selection becomes transparent (no interior detection). */
  forceFullTransparency?: boolean
  forceServerSideProcessing?: boolean
  /** Hide mobile quick actions (shape mode buttons) when embedded in another UI */
  hideMobileControls?: boolean
  /** Fixed height for the canvas container (e.g. '400px', 'calc(80vh - 300px)') */
  canvasHeight?: string
  modalOpen?: boolean
  modalTitle?: string
  apiEndpoint?: string
  onModalClose?: () => void
  templateImages?: string[]
  /** Override the internally-managed processedImageUrl with an external mask URL.
   *  Used by SimplifiedOnboarding to swap between shadow/no-shadow masks. */
  processedImageUrlOverride?: string
  /** Pre-computed template positions to seed ResultView (used when advancing directly
   *  from stored mockupResult without re-processing). Provides position overrides so
   *  drawCompositeImage can render templates without needing transparentAreas. */
  initialTemplatePositions?: TemplatePosition[]
  /** Whether initialTemplatePositions are already computed (fitted/manipulated) vs raw area bounds.
   *  When true, positions are used directly. When false/undefined, fit/fill is applied. */
  initialPositionsAreComputed?: boolean
  /** Initial template positioning mode for the composite canvas ('fit' or 'fill'). Defaults to 'fill'. */
  defaultTemplatePositioningMode?: 'fit' | 'fill'
  showAdvancedSettings?: boolean
  onError?: (error: string) => void
  onApply?: (
    processedImageUrl: string,
    templatePositions?: TemplatePosition[],
    processedDimensions?: { width: number; height: number },
    transparentAreas?: TransparentArea[]
  ) => void
  /** Stored transparent areas from a previous processing run (bulk mode tab-switch).
   *  Merged with useImageProcessing's transparentAreas when the latter is empty after remount. */
  storedTransparentAreas?: TransparentArea[]
  /** Called when shape selections change — reports the count of valid shapes (width > 0 && height > 0) */
  onShapeCountChange?: (count: number) => void
  /** Called when template positions change (from drawComposite or manipulator) */
  onTemplatePositionsChange?: (positions: TemplatePosition[]) => void
  /** Initial shape selections to restore on mount (bulk mode tab-switch persistence) */
  initialShapeSelections?: ShapeSelection[]
  /** Called when shape selections change — reports the full shape array for external persistence */
  onShapeSelectionsChange?: (shapes: ShapeSelection[]) => void
  /** When true, auto-detect runs immediately on image load and results are auto-confirmed,
   *  with a center-rectangle fallback on timeout/error. Only enable in guided onboarding flows. */
  autoTriggerDetection?: boolean
  /** When true, composite skips the mask layer — template is drawn on top of full product image */
  noMask?: boolean
}

export interface MockupWizardState {
  isProcessing: boolean
  shapeSelections: ShapeSelection[]
  showResult: boolean
  processedImageUrl: string | null
  error: string | null
  isDrawing: boolean
  currentSelection: ShapeSelection | null
  processingParameters: ProcessingParameters
  isReprocessing: boolean
  templateImageStates: TemplateImageState[]
  transparentAreas: TransparentArea[]
  detectedShapes: DetectedShape[]
  hoveredShapeId: string | null
  isDetectingShapes: boolean
  detectionStatus: 'idle' | 'detecting' | 'completed' | 'failed'
  detectionStats: ShapeDetectionStats | null
  templatePositioningMode: 'fit' | 'fill'
}

export interface ProcessingResponse {
  success: boolean
  processedImageUrl: string
  transparentCount: number
  transparentAreas?: TransparentArea[]
  message: string
  error?: string
  // Dimension info for composite canvas scaling (when downscaling was applied)
  processedWidth?: number
  processedHeight?: number
  originalWidth?: number
  originalHeight?: number
  scale?: number
}

export interface ProcessingParameters {
  // Core Detection Parameters
  colorSimilarityThreshold: number
  maxAreaRatio: number
  featherRadius: number
  interiorGapFilling: boolean
  keepShadowHighlight: boolean

  // Sampling Parameters
  sampleRadius: number
  frameDetectionThreshold: number
  frameMatchThreshold: number
  brightnessThreshold: number
  minBrightnessFilter: number

  // Shadow Parameters
  shadowDetectionThreshold: number
  shadowOpacity: number
  shadowColorDarkeningFactor: number

  // Highlight Parameters
  highlightDetectionThreshold: number
  highlightOpacity: number
  highlightColorBaseFactor: number

  // Shape Selection Parameters
  safeMarginRatio: number
  centerBackgroundThreshold: number
  backgroundMatchThreshold: number
  centerSimilarityThreshold: number

  // Boundary Expansion Parameters
  minimumBrightness: number
  minimumColorChannels: number

  // Transparent Area Filtering Parameters
  keepOnlyLargestArea: boolean
  minAreaSize: number

  // Transparency Fallback Parameters
  fallbackToFullTransparency: boolean
}
