/**
 * MockupWizard Canvas Constants
 *
 * Centralized constants for canvas interaction, shape manipulation,
 * and UI elements to maintain consistency across the module.
 */

// Import shared constants from image-processing utilities
import {
  IMAGE_PROCESSING_THRESHOLDS,
  PROCESSING_TIMEOUTS as SHARED_PROCESSING_TIMEOUTS,
  PNG_QUALITY,
} from '~/utils/image-processing/constants'

export const CANVAS_CONSTANTS = {
  /**
   * Size of resize handles in pixels (at 1x zoom)
   */
  HANDLE_SIZE: 12,

  /**
   * Size of resize handles when hovered (at 1x zoom)
   */
  HANDLE_HOVER_SIZE: 14,

  /**
   * Threshold in pixels for edge detection (at 1x zoom)
   * Used to determine if a point is near a shape's edge
   */
  EDGE_THRESHOLD: 5,

  /**
   * Radius for seed point interaction area in pixels (at 1x zoom)
   */
  SEED_POINT_RADIUS: 12,

  /**
   * Minimum size for shapes (width/height) in pixels
   */
  MIN_SHAPE_SIZE: 20,

  /**
   * Detection multiplier for handle hit areas
   * Increases the clickable area around handles for easier interaction
   */
  HANDLE_DETECTION_MULTIPLIER: 2.0,

  /**
   * Size of delete button in pixels
   */
  DELETE_BUTTON_SIZE: 20,

  /**
   * Offset of delete button from shape corner
   */
  DELETE_BUTTON_OFFSET: 25,

  /**
   * Mobile-specific constants for better touch interaction
   */
  MOBILE_HANDLE_SIZE: 20,
  MOBILE_HANDLE_HOVER_SIZE: 24,
  MOBILE_HANDLE_DETECTION_MULTIPLIER: 3.0,
  MOBILE_EDGE_THRESHOLD: 15,
  MOBILE_SEED_POINT_RADIUS: 20,

  /**
   * Rotation handle constants
   */
  ROTATION_HANDLE_OFFSET: 25, // Distance from shape top edge to rotation handle center
  ROTATION_HANDLE_SIZE: 14, // Diameter of rotation handle circle
  MOBILE_ROTATION_HANDLE_SIZE: 22, // Larger rotation handle for mobile
  ROTATION_HANDLE_STEM_LENGTH: 15, // Length of the stem connecting handle to shape
} as const

/**
 * Canvas drawing style constants
 */
export const CANVAS_STYLES = {
  /**
   * Colors for shape selections
   */
  SELECTION: {
    STROKE: '#4444ff',
    FILL: 'rgba(68, 68, 255, 0.2)',
    LINE_WIDTH: 2,
  },

  /**
   * Colors for detected shapes
   */
  DETECTED: {
    STROKE: '#ff6600',
    STROKE_HOVERED: '#0066ff',
    FILL: 'rgba(255, 102, 0, 0.15)',
    FILL_HOVERED: 'rgba(0, 102, 255, 0.2)',
    LINE_WIDTH: 2,
    LINE_WIDTH_HOVERED: 3,
    OPACITY: 0.7,
    OPACITY_HOVERED: 0.9,
  },

  /**
   * Colors for current drawing
   */
  CURRENT_DRAWING: {
    STROKE: '#0088ff',
    FILL: 'rgba(0, 136, 255, 0.1)',
    LINE_WIDTH: 2,
    LINE_DASH: [5, 5],
  },

  /**
   * Colors for handles
   */
  HANDLE: {
    FILL: '#ffffff',
    STROKE: '#0066ff',
    LINE_WIDTH: 2,
    SHADOW_COLOR: 'rgba(0, 0, 0, 0.3)',
    SHADOW_BLUR: 2,
  },

  /**
   * Colors for seed points
   */
  SEED_POINT: {
    STROKE: '#ff4444',
    STROKE_HOVERED: '#ff6600',
    STROKE_SELECTED: '#0066ff',
    OUTLINE: '#ffffff',
  },

  /**
   * Colors for rotation handle
   */
  ROTATION_HANDLE: {
    FILL: '#ffffff',
    STROKE: '#0066ff',
    LINE_WIDTH: 2,
    STEM_COLOR: '#0066ff',
    SHADOW_COLOR: 'rgba(0, 0, 0, 0.3)',
    SHADOW_BLUR: 2,
  },

  /**
   * Colors and sizes for vector path drawing — matches VectorEditor styles
   */
  VECTOR_DRAWING: {
    NODE_RADIUS: 6,
    NODE_FILL: '#ffffff',
    NODE_STROKE: '#0066cc',
    NODE_SELECTED_FILL: '#0066cc',
    NODE_SELECTED_STROKE: '#003366',
    FIRST_NODE_STROKE: '#00cc44',
    FIRST_NODE_FILL_HOVERED: '#00cc44',
    PATH_STROKE: '#0066cc',
    PREVIEW_LINE_COLOR: '#66aaff',
    PREVIEW_LINE_DASH: [3, 3],
    CONTROL_HANDLE_COLOR: '#999999',
    CONTROL_POINT_FILL: '#ff6600',
    CONTROL_POINT_STROKE: '#666666',
    CONTROL_INDICATOR_STROKE: '#999999',
    CURVE_PREVIEW_STROKE: '#66aaff',
  },
} as const

/**
 * Image Processing Dimension Thresholds
 * Re-exports shared constants with MockupWizard-specific naming for backward compatibility
 */
export const IMAGE_DIMENSIONS = {
  SERVER_DOWNSCALE_THRESHOLD: IMAGE_PROCESSING_THRESHOLDS.SERVER_DOWNSCALE,
  DESKTOP_FORCE_SERVER_THRESHOLD: IMAGE_PROCESSING_THRESHOLDS.DESKTOP_FORCE_SERVER,
  DESKTOP_DOWNSCALE_THRESHOLD: IMAGE_PROCESSING_THRESHOLDS.DESKTOP_DOWNSCALE,
  MOBILE_FORCE_SERVER_THRESHOLD: IMAGE_PROCESSING_THRESHOLDS.MOBILE_FORCE_SERVER,
  MOBILE_DOWNSCALE_THRESHOLD: IMAGE_PROCESSING_THRESHOLDS.MOBILE_DOWNSCALE,
} as const

/**
 * Processing Timeout Values (in milliseconds)
 * Re-exports shared constants with MockupWizard-specific naming for backward compatibility
 */
export const PROCESSING_TIMEOUTS = {
  CLIENT_PROCESSING: SHARED_PROCESSING_TIMEOUTS.CLIENT,
  REPROCESSING_DEBOUNCE: SHARED_PROCESSING_TIMEOUTS.DEBOUNCE,
  IMAGE_DOWNLOAD: SHARED_PROCESSING_TIMEOUTS.DOWNLOAD,
} as const

/**
 * UI Debounce & Retry Values (in milliseconds)
 * Controls responsiveness and retry behavior for UI operations
 */
export const UI_TIMINGS = {
  /**
   * Canvas redraw debounce
   * Prevents memory pressure from rapid parameter changes
   */
  CANVAS_REDRAW_DEBOUNCE: 100,
} as const

/**
 * Image Export Quality Settings
 * Re-exports shared constants for backward compatibility
 */
export const IMAGE_QUALITY = {
  PNG_COMPRESSION_LEVEL: PNG_QUALITY.COMPRESSION_LEVEL,
  PNG_ADAPTIVE_FILTERING: PNG_QUALITY.ADAPTIVE_FILTERING,
  PNG_PALETTE: PNG_QUALITY.PALETTE,
} as const

/**
 * Magic Wand Tool Constants
 */
export const MAGIC_WAND_CONSTANTS = {
  /** Max dimension (px) of the downsampled image used for flood fill */
  MAX_DOWNSAMPLE_SIZE: 800,

  /** Default tolerance for flood fill (0–255) */
  DEFAULT_TOLERANCE: 30,

  /** Min / max tolerance range for the slider */
  MIN_TOLERANCE: 0,
  MAX_TOLERANCE: 100,

  /** Debounce delay (ms) for tolerance slider re-runs */
  TOLERANCE_DEBOUNCE_MS: 150,

  /** Minimum contour area (in downsampled pixels) to accept */
  MIN_CONTOUR_AREA: 50,

  /** Epsilon factor for Douglas-Peucker simplification (fraction of perimeter).
   *  Higher = fewer points = smoother curves. 0.008 gives ~20-40 well-spaced points. */
  APPROX_EPSILON_FACTOR: 0.008,

  /** Overlay fill color (semi-transparent blue) */
  OVERLAY_FILL: 'rgba(0, 120, 255, 0.25)',

  /** Overlay stroke color */
  OVERLAY_STROKE: '#0078ff',
} as const

/**
 * Paint Tool Constants (freehand overlay painting + eraser)
 */
export const PAINT_CONSTANTS = {
  DEFAULT_BRUSH_SIZE: 20,
  MIN_BRUSH_SIZE: 5,
  MAX_BRUSH_SIZE: 50,
  BRUSH_SIZE_STEP: 5,
  /** Overlay fill color for painted regions (green tint) */
  OVERLAY_FILL: 'rgba(0, 180, 120, 0.4)',
  /** Brush cursor stroke color */
  CURSOR_STROKE: '#333333',
  /** Eraser cursor stroke color */
  CURSOR_ERASER_STROKE: '#ff4444',
} as const

/**
 * Auto-Detect Tool Constants (BiRefNet_lite subject detection)
 */
export const AUTO_DETECT_CONSTANTS = {
  /** HuggingFace model ID */
  MODEL_ID: 'onnx-community/BiRefNet_lite',

  /** Epsilon factor for Douglas-Peucker contour simplification (fraction of width) */
  CONTOUR_EPSILON_FACTOR: 0.005,

  /** Minimum mask coverage (fraction of image area) to accept */
  MIN_MASK_COVERAGE: 0.005,

  /** Inference timeout in milliseconds (WASM backend is slower than WebGPU) */
  INFERENCE_TIMEOUT_MS: 120_000,

  /** Overlay fill color for auto-detect preview */
  OVERLAY_FILL: 'rgba(120, 0, 255, 0.25)',

  /** Overlay stroke color */
  OVERLAY_STROKE: '#7800ff',

  /** Fallback timeout (ms) — inject a center rectangle if auto-detect hasn't
   *  succeeded within this period, so merchants aren't blocked on slow connections. */
  FALLBACK_TIMEOUT_MS: 15_000,

  /** Phase labels */
  PHASES: {
    IDLE: 'idle',
    DOWNLOADING: 'downloading',
    INITIALIZING: 'initializing',
    INFERRING: 'inferring',
    CONTOURING: 'contouring',
    PREVIEW: 'preview',
    ERROR: 'error',
  } as const,
} as const
