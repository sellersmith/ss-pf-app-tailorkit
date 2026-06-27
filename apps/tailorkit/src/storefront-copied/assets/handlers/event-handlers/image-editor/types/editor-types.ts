// Types for the Konva image editor

export interface KonvaEditorConfig {
  width: number
  height: number
  rotation: number
  initialZoom: number
  initialRotation: number
  // Optional initial position for restoring existing images
  initialX?: number
  initialY?: number
  initialWidth?: number
  initialHeight?: number
  // Optional mask configuration
  maskConfig?: {
    src: string
    invert?: boolean
    globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
    smoothEdges?: boolean
    smoothingStrength?: number
  }
}

export interface KonvaEditorState {
  /** Zoom percentage (100 = 100%) */
  zoom: number
  /** Rotation in degrees */
  rotation: number
  /** Transform mode */
  transform: 'fill' | 'crop'
  /** Position X in scaled coordinates (relative to clipGroup) */
  x: number
  /** Position Y in scaled coordinates (relative to clipGroup) */
  y: number
  /** Width in scaled coordinates */
  width: number
  /** Height in scaled coordinates */
  height: number
  /** Width in original (unscaled) coordinates */
  absoluteWidth: number
  /** Height in original (unscaled) coordinates */
  absoluteHeight: number
  /** Absolute X in original coordinates */
  absoluteX?: number
  /** Absolute Y in original coordinates */
  absoluteY?: number
}

export interface KonvaEditorUpdateParams {
  /** Zoom percentage (100 = 100%) */
  zoom: number
  rotation: number
  transformMode: 'fill' | 'crop'
}

export interface KonvaEditor {
  autoFitImageToBoundary: (skipHistory?: boolean) => number
  zoomImage: (zoomChange: number, skipHistory?: boolean) => number
  updateEditor: (params: KonvaEditorUpdateParams) => void
  resetEditor: () => void
  getEditorState: () => KonvaEditorState
  cleanup: () => void
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  replaceImage: (newImageElement: HTMLImageElement) => boolean
  applyFullState: (state: Partial<KonvaEditorState>) => void
  // NEW: Loading overlay helpers
  showLoadingOverlay?: () => void
  hideLoadingOverlay?: () => void
}

// Simple state object that only stores primitive values:
export interface MinimalTransformState {
  x: number
  y: number
  rotation: number
  width?: number
  height?: number
  // We keep these for backward compatibility, but they're not used anymore
  scaleX: number
  scaleY: number
}
