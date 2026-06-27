import type { ProcessingParameters, ProcessingResponse, ShapeSelection } from '../types'
import { authenticatedFetch } from '~/shopify/fns.client'
import { processMockupMask as processMockupMaskClient, validateProcessingInput } from '../fns.client'
import { PROCESSING_TIMEOUTS } from '../constants'

/**
 * Image processing utilities
 */

/**
 * Process image using client-side functions
 */
export async function processImageClientSide(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: ProcessingParameters,
  maxDimension?: number
): Promise<ProcessingResponse> {
  try {
    // Validate input
    const validation = validateProcessingInput(shapeSelections)
    if (!validation.isValid) {
      return {
        success: false,
        processedImageUrl: '',
        transparentCount: 0,
        message: '',
        error: validation.error,
      }
    }

    // Process using client-side functions
    const result = await processMockupMaskClient(imageUrl, shapeSelections, processingParameters, {
      uploadViaAPI: false, // Don't upload, just return Base64
      featherRadius: processingParameters.featherRadius,
      maxDimension,
    })

    // Convert to ProcessingResponse format
    return {
      success: true,
      processedImageUrl: result.processedImageUrl || '',
      transparentCount: result.transparentCount,
      transparentAreas: result.transparentAreas,
      message: 'Image processed successfully on client-side',
      processedWidth: result.processedWidth,
      processedHeight: result.processedHeight,
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      scale: result.scale,
    }
  } catch (error) {
    console.error('Client-side processing error:', error)
    return {
      success: false,
      processedImageUrl: '',
      transparentCount: 0,
      message: '',
      error: error instanceof Error ? error.message : 'Client-side processing failed',
    }
  }
}

/**
 * Process image with timeout wrapper
 */
export async function processImageWithTimeout(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: ProcessingParameters,
  maxDimension?: number,
  timeoutMs: number = PROCESSING_TIMEOUTS.CLIENT_PROCESSING
): Promise<{ success: boolean; result?: ProcessingResponse; timedOut?: boolean }> {
  const abortController = new AbortController()

  try {
    const result = await Promise.race([
      // Client-side processing promise
      processImageClientSide(imageUrl, shapeSelections, processingParameters, maxDimension).then(res => ({
        type: 'result' as const,
        data: res,
      })),

      // Timeout promise
      new Promise<{ type: 'timeout' }>(resolve => {
        const timeoutId = setTimeout(() => {
          resolve({ type: 'timeout' })
        }, timeoutMs)

        // Clean up timeout if processing completes
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
        })
      }),
    ])

    if (result.type === 'result') {
      // Client-side processing succeeded
      return { success: true, result: result.data }
    }
    // Timeout occurred
    return { success: false, timedOut: true }
  } catch (error) {
    // Other errors
    console.error('Client-side processing failed:', error)
    return { success: false }
  } finally {
    // Clean up
    if (!abortController.signal.aborted) {
      abortController.abort()
    }
  }
}

/**
 * Process image with current parameters
 */
export async function processImage(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: ProcessingParameters,
  apiEndpoint: string
): Promise<ProcessingResponse> {
  // Create form data with URL instead of blob
  const formData = new FormData()
  formData.append('imageUrl', imageUrl)
  formData.append('shapeSelections', JSON.stringify(shapeSelections))
  formData.append('processingParameters', JSON.stringify(processingParameters))
  formData.append('featherRadius', processingParameters.featherRadius.toString())
  formData.append('uploadToShopify', 'false') // Don't upload to Shopify by default

  // Send to API using authenticated fetch
  const result: ProcessingResponse = await authenticatedFetch(apiEndpoint, {
    method: 'POST',
    body: formData,
  })

  return result
}

/**
 * Reprocess image with new parameters (for real-time adjustments)
 */
export async function reprocessImage(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: ProcessingParameters,
  apiEndpoint: string,
  signal?: AbortSignal
): Promise<ProcessingResponse> {
  // Create form data with URL instead of blob
  const formData = new FormData()
  formData.append('imageUrl', imageUrl)
  formData.append('shapeSelections', JSON.stringify(shapeSelections))
  formData.append('processingParameters', JSON.stringify(processingParameters))
  formData.append('featherRadius', processingParameters.featherRadius.toString())
  formData.append('uploadToShopify', 'false') // Don't upload to Shopify during reprocessing

  const result: ProcessingResponse = await authenticatedFetch(apiEndpoint, {
    method: 'POST',
    body: formData,
    signal,
  })

  return result
}

/**
 * Apply mask result and upload to Shopify if needed
 */
export async function applyMask(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: ProcessingParameters,
  apiEndpoint: string,
  processedImageUrl: string
): Promise<ProcessingResponse> {
  // If the processed image is already a Shopify URL, just use it
  if (processedImageUrl.startsWith('http')) {
    return {
      success: true,
      processedImageUrl,
      transparentCount: 0,
      message: 'Image already processed',
    }
  }

  // Otherwise, it's a Base64 data URL - upload to Shopify
  // Create form data with upload flag and URL instead of blob
  const formData = new FormData()
  formData.append('imageUrl', imageUrl)
  formData.append('shapeSelections', JSON.stringify(shapeSelections))
  formData.append('processingParameters', JSON.stringify(processingParameters))
  formData.append('featherRadius', processingParameters.featherRadius.toString())
  formData.append('uploadToShopify', 'true') // Upload to Shopify

  // Send to API using authenticated fetch
  const result: ProcessingResponse = await authenticatedFetch(apiEndpoint, {
    method: 'POST',
    body: formData,
  })

  return result
}
