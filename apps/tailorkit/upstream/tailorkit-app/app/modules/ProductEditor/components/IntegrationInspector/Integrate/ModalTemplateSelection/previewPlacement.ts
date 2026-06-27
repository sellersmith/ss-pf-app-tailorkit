import type { TViewLayerIntegrationStore } from '~/stores/modules/integration/viewLayerIntegration'

export type PreviewSeed = { src: string; altText?: string } | null | undefined

export function computePreviewProductImageFromLayer(args: {
  previewSeed: PreviewSeed
  layerStore?: TViewLayerIntegrationStore
  productImageDimension?: { width?: number; height?: number } | null
  canvas: { width: number; height: number }
  /**
   * Set to true when creating/copying templates where layer store belongs to old print area.
   * When true, calculations are skipped to respect new template dimensions.
   * When false/undefined (default for edit flow), calculations use layer store dimensions.
   */
  skipLayerStoreCalculations?: boolean
}):
  | {
      src: string
      altText: string
      left?: number
      top?: number
      width?: number
      height?: number
      rotation?: number
    }
  | undefined {
  const { previewSeed, layerStore, productImageDimension, canvas, skipLayerStoreCalculations } = args
  if (!previewSeed) return undefined

  const imgW = productImageDimension?.width
  const imgH = productImageDimension?.height

  /**
   * Preview image positioning logic:
   *
   * When skipLayerStoreCalculations = true (copy/create flows):
   *   - Skip layer store calculations because it belongs to OLD print area
   *   - Canvas dimensions = NEW template dimensions (correct source)
   *   - Calculate scaling based on canvas dimensions to fit preview image properly
   *   - Center image without rotation/positioning (since print area is new)
   *
   * When skipLayerStoreCalculations = false/undefined (edit flow):
   *   - Perform calculations using layer store dimensions
   *   - Layer store and canvas represent the same entity
   *   - Calculate positioning based on print area vs canvas dimensions
   */

  // Handle copy/create flows: scale to fit canvas but don't use layer store positioning
  if (skipLayerStoreCalculations) {
    // If we have valid image dimensions, calculate scaling to fit canvas
    if (imgW && imgH && imgW > 0 && imgH > 0) {
      const canvasW = canvas.width || 0
      const canvasH = canvas.height || 0

      // Calculate scale to fit image within canvas while maintaining aspect ratio
      const scaleX = canvasW / imgW
      const scaleY = canvasH / imgH
      const scale = Math.min(scaleX, scaleY) // Use minimum to fit entire image

      const scaledWidth = imgW * scale
      const scaledHeight = imgH * scale

      // Center the image on canvas
      const left = (canvasW - scaledWidth) / 2
      const top = (canvasH - scaledHeight) / 2

      return {
        src: previewSeed.src,
        altText: previewSeed.altText || '',
        width: scaledWidth,
        height: scaledHeight,
        left,
        top,
        rotation: 0,
      }
    }

    // Fallback if no dimensions available
    return {
      src: previewSeed.src,
      altText: previewSeed.altText || '',
    }
  }

  const layerState = layerStore?.getState()
  if (layerState && imgW && imgH) {
    const canvasW = canvas.width || 0
    const canvasH = canvas.height || 0

    const layerW = layerState.width || canvasW
    const layerH = layerState.height || canvasH
    const layerX = layerState.x || 0
    const layerY = layerState.y || 0

    const scaleX = canvasW / (layerW || 1)
    const scaleY = canvasH / (layerH || 1)

    const width = imgW * scaleX
    const height = imgH * scaleY

    // Apply inverse rotation to translation so the visual alignment matches after rotation
    // Apply inverse rotation to the translation so that the rotated layer's top-left maps to canvas origin
    const theta = ((layerState.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const left = -(layerX * scaleX * cos + layerY * scaleY * sin)
    const top = layerX * scaleX * sin - layerY * scaleY * cos

    const result = {
      src: previewSeed.src,
      altText: previewSeed.altText || '',
      left,
      top,
      width,
      height,
      // Apply inverse rotation so image content cancels layer rotation
      rotation: typeof layerState.rotation === 'number' ? -layerState.rotation : 0,
    } as const

    return result
  }

  // Fallback: return simple preview when conditions aren't met
  return {
    src: previewSeed.src,
    altText: previewSeed.altText || '',
  }
}
