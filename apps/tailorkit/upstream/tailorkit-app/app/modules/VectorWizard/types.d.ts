// Base shape interface
export interface BaseShape {
  x: number
  y: number
  width: number
  height: number
  source?: 'manual' | 'auto-detected' | 'deleted-auto-detected'
  shapeId?: string
}

// Shape-specific interfaces
export interface RectangularShape extends BaseShape {
  type: 'rectangle'
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse'
}

// Union type for all shapes
export type ShapeSelection = RectangularShape | EllipseShape

export interface TransparentArea {
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  area: number
  centroid: {
    x: number
    y: number
  }
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

export interface VectorWizardProps {
  imageUrl: string
  isModal?: boolean
  hideTitle?: boolean
  modalOpen?: boolean
  modalTitle?: string
  apiEndpoint?: string
  onModalClose?: () => void
  showAdvancedSettings?: boolean
  onError?: (error: string) => void
  onApply?: (results: VectorResult[]) => void // Array of vector results with Shopify CDN URLs and bounds
}

export interface ProcessingResponse {
  success: boolean
  processedImageUrl: string
  transparentCount: number
  transparentAreas?: TransparentArea[]
  message: string
  error?: string
}

export interface ProcessingParameters {
  // Core Detection Parameters
  colorSimilarityThreshold: number
  maxAreaRatio: number
  featherRadius: number
  interiorGapFilling: boolean
  keepShadowHighlight: boolean

  // Seed Point Parameters
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
  backgroundDetectionThreshold: number
  edgeClarityThreshold: number
}

// Vector Conversion Parameters
export interface VectorConversionParameters {
  // Color mode settings
  colorMode: 'monochrome' | 'color' // default 'monochrome'
  colorCount: number // Number of colors for color mode (2-256), default 16

  // Basic Potrace settings (used in monochrome mode, threshold affects color quantization in color mode)
  threshold: number // 0-255, default 128

  // Advanced Potrace settings
  turdSize: number // Suppress speckles (0-100), default 2
  turnPolicy: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority' // default 'minority'
  alphaMax: number // Corner threshold (0-2), default 1.0
  optCurve: boolean // Optimize curves, default true
  optTolerance: number // Curve optimization tolerance (0-1), default 0.2

  // Background removal settings
  removeSolidBackground?: boolean // Remove white background before vectorization, default false
  bgRemovalTolerance?: number // Color tolerance for background removal (5-100), default 30
  removeWhiteBackground?: boolean // Also remove enclosed white areas, default false
}

// Vector Conversion Result
export interface VectorResult {
  shapeId: string
  svgDataUri?: string
  svgUrl?: string // If uploaded to Shopify
  bounds: BaseShape
  error?: string
}

// Vector Conversion Response
export interface VectorConversionResponse {
  success: boolean
  results: VectorResult[]
  error?: string
}
