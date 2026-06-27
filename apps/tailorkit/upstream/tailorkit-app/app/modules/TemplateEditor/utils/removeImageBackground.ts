import backgroundRemovalService from '~/services/BackgroundRemovalService'

/**
 * Remove background from an image using local AI or API fallback
 * Works independently without requiring store context or UI state management
 *
 * @param imageUrl - URL or data URL of the image to process
 * @param type - Type of background removal ('ai' for local, others for API fallback)
 * @returns Promise<{ processedUrl: string; imageEl: HTMLImageElement }>
 */
export async function removeImageBackground(
  imageUrl: string,
  type: string = 'ai'
): Promise<{ processedUrl: string; imageEl: HTMLImageElement }> {
  // Convert image URL to File object
  let file: File

  if (typeof imageUrl === 'string') {
    // If it's a URL, fetch it
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    file = new File([blob], 'image.png', { type: blob.type })
  } else {
    throw new Error('Unsupported image reference type')
  }

  // Try local processing first, fallback to API if it fails
  try {
    if (type === 'ai' && backgroundRemovalService.isAvailable()) {
      // Check if background removal service is available and initialized
      const modelInfo = backgroundRemovalService.getModelInfo()
      console.log('Using local background removal with Transformers.js with model info', modelInfo)

      // Use the background removal service
      const processedFile = await backgroundRemovalService.removeBackground(file)

      // Convert the processed file to a data URL
      const processedDataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(processedFile)
      })

      // Create image element for the processed image
      const imageEl = new Image()
      imageEl.src = processedDataUrl
      await new Promise<void>((resolve, reject) => {
        imageEl.onload = () => resolve()
        imageEl.onerror = () => reject(new Error('Failed to load processed image'))
      })

      return { processedUrl: processedDataUrl, imageEl }
    }

    throw new Error('Local background removal not available')
  } catch (localError) {
    console.warn('Local background removal failed, falling back to API:', localError)

    try {
      // Fallback to API approach
      console.log('Using API background removal fallback')

      // Prepare form data
      const formData = new FormData()
      formData.append('action', 'remove-background')
      formData.append('image', file)
      formData.append('type', type)

      // Call the API
      const apiResponse = await fetch('/api/services', {
        method: 'POST',
        body: formData,
      })

      const response = await apiResponse.json()

      if (response.success) {
        const result = response.data

        const resultImageUrl
          = result.data?.downloadUrl || result.data?.previewUrl || result.downloadUrl || result.previewUrl

        if (resultImageUrl) {
          // Create image element for the processed image
          const imageEl = new Image()
          imageEl.src = resultImageUrl
          await new Promise<void>((resolve, reject) => {
            imageEl.onload = () => resolve()
            imageEl.onerror = () => reject(new Error('Failed to load processed image from API'))
          })

          return { processedUrl: resultImageUrl, imageEl }
        }
        throw new Error('API background removal failed - no result URL')
      } else {
        throw new Error('API background removal failed')
      }
    } catch (apiError) {
      console.error('API background removal also failed:', apiError)
      throw new Error('Both local and API background removal failed')
    }
  }
}
