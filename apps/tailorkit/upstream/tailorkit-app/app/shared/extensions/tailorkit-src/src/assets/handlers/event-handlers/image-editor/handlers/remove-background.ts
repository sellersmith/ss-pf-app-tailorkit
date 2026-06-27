import type { KonvaEditor } from '..'
import { removeBackgroundOnStorefront } from '../services/remove-background'
import { urlToFile } from '../upload-service'

/**
 * Interface for background removal handler options
 */
export interface RemoveBackgroundHandlerOptions {
  objectUrl: string
  konvaEditor: KonvaEditor
  onSuccess: (processedImageUrl: string, newImageElement: HTMLImageElement) => void
  onError: (error: Error) => void
  onLoadingStateChange: (isLoading: boolean, keepRemoveBackgroundDisabled?: boolean) => void
}

/**
 * Handler for removing background from images
 *
 * This handler encapsulates the complete background removal workflow:
 * 1. Validates inputs and sets loading state
 * 2. Converts image URL to File and calls the removal API
 * 3. Validates the API response
 * 4. Creates new image element and loads the processed image
 * 5. Replaces the image in the Konva editor while preserving transforms
 * 6. Calls success/error callbacks appropriately
 *
 * @param options - Configuration object for background removal
 */
export async function handleRemoveBackground(options: RemoveBackgroundHandlerOptions): Promise<void> {
  const { objectUrl, konvaEditor, onSuccess, onError, onLoadingStateChange } = options

  if (!konvaEditor) {
    onError(new Error('Editor is not available'))
    return
  }

  try {
    // 1. Set loading state - disable all controls and show loading
    onLoadingStateChange(true)

    // 2. Convert objectUrl to File and call API
    const imageFile = await urlToFile(objectUrl, 'image.png')
    const response = await removeBackgroundOnStorefront(imageFile)

    // 3. Validate response structure
    if (!response?.success || !response?.data?.success || !response?.data?.data?.downloadUrl) {
      throw new Error('Invalid response from background removal service')
    }

    // 4. Get the processed image URL
    const processedImageUrl = response.data.data.downloadUrl || response.data.data.previewUrl
    if (!processedImageUrl) {
      throw new Error('No processed image URL in response')
    }

    // 5. Create new image element and load the processed image
    const newImageElement = new Image()

    await new Promise<void>((resolve, reject) => {
      newImageElement.onload = () => {
        try {
          // 6. Replace the image using the editor's replaceImage method
          if (!konvaEditor) {
            reject(new Error('Editor is not available'))
            return
          }

          // Store current state before replacement
          const currentState = konvaEditor.getEditorState()

          const success = konvaEditor.replaceImage(newImageElement)

          if (success) {
            // Force a redraw to ensure the new image is visible
            setTimeout(() => {
              if (konvaEditor) {
                // Apply current state to maintain transformations
                konvaEditor.applyFullState(currentState)

                // Force update the editor to ensure the new image is properly rendered
                konvaEditor.updateEditor({
                  zoom: currentState.zoom,
                  rotation: currentState.rotation,
                  transformMode: 'fill',
                })
              }
              resolve()
            }, 100)
          } else {
            reject(new Error('Failed to replace image in editor'))
          }
        } catch (error) {
          reject(error)
        }
      }

      newImageElement.onerror = () => {
        reject(new Error('Failed to load processed image'))
      }

      // Set crossOrigin before src to avoid CORS issues
      newImageElement.crossOrigin = 'anonymous'
      newImageElement.src = processedImageUrl
    })

    // 7. Call success callback with processed image data
    onSuccess(processedImageUrl, newImageElement)

    // 8. Re-enable other controls (remove background button will be disabled by onLoadingStateChange)
    onLoadingStateChange(false, true) // true = keep remove background button disabled
  } catch (error) {
    console.error('Background removal failed:', error)

    // Call error callback
    onError(error instanceof Error ? error : new Error(String(error)))

    // Re-enable all controls
    onLoadingStateChange(false)
  }
}
