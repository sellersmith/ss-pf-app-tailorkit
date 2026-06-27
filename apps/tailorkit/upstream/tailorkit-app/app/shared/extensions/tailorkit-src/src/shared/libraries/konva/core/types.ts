import type Konva from 'konva'
import type { KonvaEditorState } from '../../../../assets/handlers/event-handlers/image-editor'
import type { EffectConfig } from '../effects/types'
import type { OverlayMetadata } from '../../../utils/overlay-compositor'

/**
 * Font loader interface for dependency injection
 * Matches the FontLoader class signature
 */
export interface IFontLoader {
  loadFont(fontFamily?: string, fontSrc?: string): Promise<void>
}

/**
 * Mask configuration for image layers
 */
export interface IMaskConfig {
  src: string
  invert?: boolean
  globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
  smoothEdges?: boolean
  smoothingStrength?: number
}

// =============================================================================
// TEXT LAYER TYPES
// =============================================================================

/**
 * Props for text layer rendering
 * Extends Konva.TextConfig with TailorKit-specific options
 */
export interface TextLayerProps extends Konva.TextConfig {
  /** Automatically fit text to container bounds */
  autoFitToContainer?: boolean
  /** Text shape type */
  textShape?: 'none' | 'circle' | 'curve'
  /** Start angle for circle text (radians) */
  circleStartAngle?: number
  /** End angle for circle text (radians) */
  circleEndAngle?: number
  /** Number of wave peaks for curve text */
  curvePeaks?: number
  /** Bend percentage for curve text (-100 to 100) */
  curveBend?: number
  /** Effects to apply (drop shadows, inner shadows, etc.) */
  effects?: EffectConfig[]
  /** Custom font source URL */
  fontSrc?: string
  /** Legacy neon mode */
  neonMode?: 'none' | 'glow' | 'inverse'
  /** Legacy neon intensity */
  neonIntensity?: number
  /** Legacy neon X offset */
  neonOffsetX?: number
  /** Legacy neon Y offset */
  neonOffsetY?: number
}

/**
 * Result of text layer rendering
 * Can be Konva.Text (basic), Konva.TextPath, or Konva.Image (with effects/shapes)
 */
export type TextLayerResult = Konva.Text | Konva.TextPath | Konva.Image

/**
 * Dependencies for TextLayerRenderer
 */
export interface TextLayerRendererDeps {
  /** Function to get the target container for adding elements */
  getTargetContainer: () => Konva.Container
  /** Font loader instance (defaults to shared singleton) */
  fontLoader?: IFontLoader
}

// =============================================================================
// IMAGE LAYER TYPES (Future prep)
// =============================================================================

/**
 * Props for image layer rendering
 */
export interface ImageLayerProps {
  /** Image URL */
  url: string
  /** X position */
  x: number
  /** Y position */
  y: number
  /** Width */
  width: number
  /** Height */
  height: number
  /** Rotation in degrees */
  rotation?: number
  /** Mask configuration */
  maskConfig?: IMaskConfig
  /** Clip group state for advanced clipping */
  clipGroup?: KonvaEditorState
  /** Overlay configuration */
  overlay?: {
    overlaySvg: string
    overlayMetadata?: OverlayMetadata
  }
}

/**
 * Result of image layer rendering
 * Can be Konva.Image (simple) or Konva.Group (with clipping/masking)
 */
export type ImageLayerResult = Konva.Image | Konva.Group

/**
 * Dependencies for ImageLayerRenderer
 */
export interface ImageLayerRendererDeps {
  /** Function to get the target container for adding elements */
  getTargetContainer: () => Konva.Container
  /** Image cache for loaded images */
  imageCache: Map<string, HTMLImageElement>
  /** Mask canvas cache for processed masks */
  maskCanvasCache: Map<string, HTMLCanvasElement>
  /** Function to load an image */
  loadImage: (url: string, width?: number) => Promise<HTMLImageElement>
  /** Function to build processed mask canvas */
  buildProcessedMaskCanvas: (
    maskConfig: IMaskConfig,
    width: number,
    height: number
  ) => Promise<HTMLCanvasElement | null>
}
