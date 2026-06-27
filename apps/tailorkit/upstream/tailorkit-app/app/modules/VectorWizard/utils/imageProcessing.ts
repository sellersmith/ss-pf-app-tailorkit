import type { VectorConversionParameters, VectorConversionResponse, ShapeSelection } from '../types'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * Image processing utilities for vector conversion
 */

/**
 * Process image with current parameters - Convert to SVG vectors
 */
export async function processImage(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: VectorConversionParameters,
  apiEndpoint: string
): Promise<VectorConversionResponse> {
  // Convert image to blob
  const response = await fetch(imageUrl)
  const blob = await response.blob()

  // Filter out deleted markers before sending to server
  const validShapeSelections = shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected')

  // Create form data
  const formData = new FormData()
  formData.append('image', blob)
  formData.append('shapeSelections', JSON.stringify(validShapeSelections))
  formData.append('conversionParams', JSON.stringify(processingParameters))
  formData.append('uploadToShopify', 'false') // Don't upload to Shopify by default
  formData.append('fileName', 'vector-conversion')

  // Send to API using authenticated fetch
  const result: VectorConversionResponse = await authenticatedFetch(apiEndpoint, {
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
  processingParameters: VectorConversionParameters,
  apiEndpoint: string,
  signal?: AbortSignal
): Promise<VectorConversionResponse> {
  const response = await fetch(imageUrl)
  const blob = await response.blob()

  // Filter out deleted markers before sending to server
  const validShapeSelections = shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected')

  const formData = new FormData()
  formData.append('image', blob)
  formData.append('shapeSelections', JSON.stringify(validShapeSelections))
  formData.append('conversionParams', JSON.stringify(processingParameters))
  formData.append('uploadToShopify', 'false') // Don't upload to Shopify during reprocessing
  formData.append('fileName', 'vector-conversion')

  const result: VectorConversionResponse = await authenticatedFetch(apiEndpoint, {
    method: 'POST',
    body: formData,
    signal,
  })

  return result
}

/**
 * Upload SVG results to Shopify if needed
 */
export async function uploadVectors(
  imageUrl: string,
  shapeSelections: ShapeSelection[],
  processingParameters: VectorConversionParameters,
  apiEndpoint: string
): Promise<VectorConversionResponse> {
  // Convert to vectors and upload to Shopify
  const response = await fetch(imageUrl)
  const blob = await response.blob()

  // Filter out deleted markers before sending to server
  const validShapeSelections = shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected')

  // Create form data with upload flag
  const formData = new FormData()
  formData.append('image', blob)
  formData.append('shapeSelections', JSON.stringify(validShapeSelections))
  formData.append('conversionParams', JSON.stringify(processingParameters))
  formData.append('uploadToShopify', 'true') // Upload to Shopify
  formData.append('fileName', 'vector-conversion')

  // Send to API using authenticated fetch
  const result: VectorConversionResponse = await authenticatedFetch(apiEndpoint, {
    method: 'POST',
    body: formData,
  })

  return result
}

/**
 * Preload an image and return a promise
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
