/**
 * Server-side auto-detect for mobile devices.
 *
 * Calls the existing background removal API (`POST /api/services`),
 * loads the returned transparent PNG, and extracts the alpha channel
 * as a binary mask — same shape as autoDetectLoader's InferenceResult.
 *
 * This avoids downloading the ~40MB ONNX model on mobile.
 */

import type { InferenceResult } from './autoDetectLoader'

/** Max dimension for the mask canvas — keeps contour extraction fast on mobile */
const MAX_MASK_SIZE = 1024

/**
 * Run server-side background removal and return a binary mask from the alpha channel.
 * The mask format matches autoDetectLoader.runInference() output so the contour
 * extraction pipeline (opencvLoader.contourFromMask) works identically.
 */
export async function runServerInference(image: HTMLImageElement): Promise<InferenceResult> {
  const origW = image.naturalWidth || image.width
  const origH = image.naturalHeight || image.height

  // Convert image to blob for upload
  const canvas = document.createElement('canvas')
  canvas.width = origW
  canvas.height = origH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to convert image to blob'))), 'image/png')
  })

  // Call existing background removal API
  const formData = new FormData()
  formData.append('action', 'remove-background')
  formData.append('image', new File([blob], 'product.png', { type: 'image/png' }))
  formData.append('type', 'ai')

  const response = await fetch('/api/services', { method: 'POST', body: formData })
  if (!response.ok) throw new Error(`Background removal failed: ${response.status}`)

  const json = await response.json()
  if (!json.success) throw new Error(json.error || 'Background removal failed')

  // Extract the result URL (API returns nested structure)
  const resultUrl
    = json.data?.data?.downloadUrl || json.data?.data?.previewUrl || json.data?.downloadUrl || json.data?.previewUrl
  if (!resultUrl) throw new Error('No result URL from background removal')

  // Load the transparent PNG
  const resultImg = await loadImage(resultUrl)
  const resultW = resultImg.naturalWidth || resultImg.width
  const resultH = resultImg.naturalHeight || resultImg.height

  // Downsample for mask extraction if needed
  const maxDim = Math.max(resultW, resultH)
  const scale = maxDim > MAX_MASK_SIZE ? MAX_MASK_SIZE / maxDim : 1
  const maskW = Math.round(resultW * scale)
  const maskH = Math.round(resultH * scale)

  // Draw onto a canvas and extract the alpha channel as a binary mask
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = maskW
  maskCanvas.height = maskH
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.drawImage(resultImg, 0, 0, maskW, maskH)
  const imageData = maskCtx.getImageData(0, 0, maskW, maskH)

  // Alpha channel → binary mask (opaque pixels = foreground)
  const binary = new Uint8ClampedArray(maskW * maskH)
  for (let i = 0; i < binary.length; i++) {
    binary[i] = imageData.data[i * 4 + 3] > 127 ? 255 : 0
  }

  return {
    mask: binary,
    width: maskW,
    height: maskH,
    originalWidth: origW,
    originalHeight: origH,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load background-removed image'))
    img.src = url
  })
}
