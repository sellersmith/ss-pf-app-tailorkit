import type { RefObject } from 'react'
import type Konva from 'konva'
import { CANVAS_EDITOR_LAYER } from '~/constants/canvas'
import { LAYER_BASE_PRODUCT_IMAGE } from '~/constants/integration'
import { restoreClonedCache } from '~/utils/konva-cache'
import { blobToBase64 } from '~/utils/file-types'

/**
 * Export mockup canvas layer as base64 data URL
 * This function exports the CANVAS_EDITOR_LAYER (including all customizations)
 * and converts it to a base64 data URL that can be sent directly in API requests
 * without uploading to Shopify store.
 *
 * @param stageRef - Reference to the Konva Stage
 * @returns Promise resolving to base64 data URL string or null if export fails
 *
 * @example
 * ```typescript
 * const { stageRef } = useIntegrationEditorContext()
 * const dataUrl = await exportMockupCanvasAsDataUrl(stageRef)
 * if (dataUrl) {
 *   // Use dataUrl in API request
 * }
 * ```
 */
export async function exportMockupCanvasAsDataUrl(stageRef: RefObject<Konva.Stage>): Promise<string | null> {
  if (!stageRef.current) {
    console.warn('[exportMockupCanvasAsDataUrl] Stage ref is not available')
    return null
  }

  const stage = stageRef.current

  try {
    // Clone the stage to perform transformations without affecting the user's view
    const clonedStage = stage.clone({
      width: stage.width(),
      height: stage.height(),
      scale: { x: 1, y: 1 }, // Set the cloned stage's scale to 1
      position: { x: 0, y: 0 }, // Set the cloned stage's position to default
    })

    const canvasLayer = clonedStage.findOne(`#${CANVAS_EDITOR_LAYER}`)

    if (!canvasLayer) {
      clonedStage.destroy()
      console.warn('[exportMockupCanvasAsDataUrl] Canvas layer not found')
      return null
    }

    // Restore cache for all cached groups (inner shadows, etc.)
    // IMPORTANT: Cache pixelRatio must match toBlob pixelRatio to prevent white line artifacts
    restoreClonedCache(canvasLayer) // Uses default pixelRatio to match toBlob({ pixelRatio: 1 })

    const baseProductImageLayer = clonedStage.findOne(`#${LAYER_BASE_PRODUCT_IMAGE}`)
    const width = baseProductImageLayer?.width()
    const height = baseProductImageLayer?.height()

    if (!width || !height) {
      clonedStage.destroy()
      console.warn('[exportMockupCanvasAsDataUrl] Invalid dimensions')
      return null
    }

    // Export canvas layer to blob and convert to base64 data URL
    return new Promise<string | null>(resolve => {
      const timeoutId = setTimeout(() => {
        clonedStage.destroy()
        console.warn('[exportMockupCanvasAsDataUrl] Export timeout')
        resolve(null)
      }, 10000) // 10 second timeout

      setTimeout(() => {
        canvasLayer.toBlob({
          width,
          height,
          pixelRatio: 1,
          mimeType: 'image/webp',
          quality: 0.8,
          callback: async blob => {
            clearTimeout(timeoutId)
            clonedStage.destroy() // Clean up the cloned stage

            if (!blob) {
              console.warn('[exportMockupCanvasAsDataUrl] Failed to generate blob')
              resolve(null)
              return
            }

            try {
              // Convert blob to base64 data URL
              const dataUrl = await blobToBase64(blob)
              resolve(dataUrl)
            } catch (error) {
              console.error('[exportMockupCanvasAsDataUrl] Failed to convert blob to base64:', error)
              resolve(null)
            }
          },
        })
      }, 50) // Small delay to ensure cache restoration completes
    })
  } catch (error) {
    console.error('[exportMockupCanvasAsDataUrl] Error exporting canvas:', error)
    return null
  }
}
