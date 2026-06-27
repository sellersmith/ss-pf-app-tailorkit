/**
 * Configuration options for HoverZoomManager
 */
export interface HoverZoomConfig {
  /** The container element to attach mouse events to */
  containerElement: HTMLElement
  /** The canvas element to magnify */
  canvasElement: HTMLCanvasElement
  /** Diameter of the lens in pixels (default: 150) */
  lensSize?: number
  /** Magnification level (default: 2) */
  magnification?: number
}

/**
 * Internal configuration with defaults applied
 */
export interface HoverZoomConfigResolved {
  containerElement: HTMLElement
  canvasElement: HTMLCanvasElement
  lensSize: number
  magnification: number
}
