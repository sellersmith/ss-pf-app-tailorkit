import type { KonvaCanvasManager } from '../../shared/libraries/konva/core/konva-canvas-manager'

declare global {
  interface Window {
    __tailorkit__: {
      performance?: {
        fps: number
        renderTime: number
        layerCount: number
        cacheHits: number
        cacheMisses: number
      }
      [key: string]: any
    }
  }
}

export interface TailorKitProductPersonalizerBase extends HTMLElement {
  canvasManager: KonvaCanvasManager
  ratio: number
  productPersonalizer: any
  settings: any
  steps: { [key: string]: any }[]
  processingImages: boolean
  images: { [url: string]: HTMLImageElement }
}

interface ProductPersonalizer {
  i: string
  lis: any[]
  pi?: {
    // width
    w: number
    // height
    h: number
    // left
    l: number
    // right
    r: number
    // top
    t: number
    // product image url
    u: string
  }
  // Optional presentational views
  views?: Array<{
    _id?: string
    title?: string
    baseImage?: { u: string; w: number; h: number } | null
    backgroundImage?: { u: string; w: number; h: number } | null
    maskImage?: { u: string; w: number; h: number } | null
    enableClippingMask?: boolean
    layers?: string[]
    overrides?: Record<
      string,
      { x?: number; y?: number; width?: number; height?: number; rotation?: number; visible?: boolean }
    >
  }>
}

export class TailorKitProductPersonalizer extends HTMLElement implements TailorKitProductPersonalizerBase {
  declare canvasManager: KonvaCanvasManager
  declare ratio: number
  declare productPersonalizer: any
  declare settings: any
  declare steps: { [key: string]: any }[]
  declare processingImages: boolean
  declare images: { [url: string]: HTMLImageElement }
}
