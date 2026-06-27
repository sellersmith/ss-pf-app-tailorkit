import http from 'http'
import https from 'https'
import sharp from 'sharp'

/**
 * Find connected components of opaque pixels using flood fill
 */
function findConnectedComponents(
  pixels: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number = 1
): Array<{
  pixels: Array<{ x: number; y: number }>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}> {
  const visited = new Set<number>()
  const components: Array<{
    pixels: Array<{ x: number; y: number }>
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  }> = []

  // Directions for 8-connected neighbors (including diagonals)
  const directions = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]

  function isOpaque(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false
    const alphaIndex = (y * width + x) * 4 + 3
    return pixels[alphaIndex] >= alphaThreshold
  }

  function floodFill(
    startX: number,
    startY: number
  ): { pixels: Array<{ x: number; y: number }>; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
    const componentPixels: Array<{ x: number; y: number }> = []
    const stack = [{ x: startX, y: startY }]

    let minX = startX,
      maxX = startX,
      minY = startY,
      maxY = startY

    while (stack.length > 0) {
      const { x, y } = stack.pop()!
      const pixelIndex = y * width + x

      if (visited.has(pixelIndex) || !isOpaque(x, y)) {
        continue
      }

      visited.add(pixelIndex)
      componentPixels.push({ x, y })

      // Update bounds
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Add neighbors to stack
      for (const [dx, dy] of directions) {
        const newX = x + dx
        const newY = y + dy
        const newPixelIndex = newY * width + newX

        if (!visited.has(newPixelIndex) && isOpaque(newX, newY)) {
          stack.push({ x: newX, y: newY })
        }
      }
    }

    return {
      pixels: componentPixels,
      bounds: { minX, maxX, minY, maxY },
    }
  }

  // Find all connected components
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x

      if (!visited.has(pixelIndex) && isOpaque(x, y)) {
        const component = floodFill(x, y)
        if (component.pixels.length > 0) {
          components.push(component)
        }
      }
    }
  }

  return components
}

/**
 * Find the bounding box of all significant opaque pixels in an image
 * Ignores isolated pixel groups smaller than the specified threshold
 */
function findOpaqueBounds(
  pixels: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number = 1,
  minPixelGroupSize: number = 20
): { minX: number; maxX: number; minY: number; maxY: number; hasOpaquePixels: boolean; filteredComponents: number } {
  // Find all connected components
  const components = findConnectedComponents(pixels, width, height, alphaThreshold)

  // Filter components by size threshold
  const significantComponents = components.filter(component => component.pixels.length >= minPixelGroupSize)

  if (significantComponents.length === 0) {
    return {
      minX: 0,
      maxX: width - 1,
      minY: 0,
      maxY: height - 1,
      hasOpaquePixels: false,
      filteredComponents: components.length,
    }
  }

  // Find overall bounding box of all significant components
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (const component of significantComponents) {
    minX = Math.min(minX, component.bounds.minX)
    maxX = Math.max(maxX, component.bounds.maxX)
    minY = Math.min(minY, component.bounds.minY)
    maxY = Math.max(maxY, component.bounds.maxY)
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    hasOpaquePixels: true,
    filteredComponents: components.length - significantComponents.length,
  }
}

/**
 * Crop image to tightly fit all significant opaque content
 * Ignores isolated pixel groups smaller than minPixelGroupSize
 */
export async function cropToOpaqueContent(
  input: Buffer | string,
  options: {
    alphaThreshold?: number
    minPixelGroupSize?: number
    outputFormat?: 'buffer' | 'base64'
    padding?: number
    maintainAspectRatio?: boolean
    minSize?: { width: number; height: number }
    maxSize?: { width: number; height: number }
    onProgress?: (message: string, progress: number) => void
  } = {}
): Promise<Buffer | string> {
  const {
    alphaThreshold = 1,
    minPixelGroupSize = 20,
    outputFormat = 'buffer',
    padding = 0,
    maintainAspectRatio = false,
    minSize,
    maxSize,
    onProgress,
  } = options

  try {
    if (onProgress) onProgress('Loading image...', 0)

    // Load image buffer
    let imageBuffer: Buffer
    if (typeof input === 'string') {
      if (onProgress) onProgress('Downloading image...', 10)
      imageBuffer = await downloadImageFromUrl(input)
    } else {
      imageBuffer = input
    }

    // Get image metadata
    const image = sharp(imageBuffer)
    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Invalid image dimensions')
    }

    if (onProgress) onProgress('Analyzing image content...', 30)

    // Convert to RGBA format to ensure alpha channel
    const { data: pixels } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    // Find bounding box of significant opaque pixels (filtering out small isolated groups)
    if (onProgress) onProgress('Finding significant opaque content bounds...', 50)
    const bounds = findOpaqueBounds(pixels, width, height, alphaThreshold, minPixelGroupSize)

    if (onProgress && bounds.filteredComponents > 0) {
      onProgress(
        `Filtered out ${bounds.filteredComponents} small pixel groups (< ${minPixelGroupSize} pixels each)`,
        60
      )
    }

    if (!bounds.hasOpaquePixels) {
      if (onProgress) onProgress('No significant opaque content found...', 100)

      if (outputFormat === 'base64') {
        const base64 = imageBuffer.toString('base64')
        return `data:image/png;base64,${base64}`
      }
      return imageBuffer
    }

    // Calculate crop dimensions with padding
    let cropX = Math.max(0, bounds.minX - padding)
    let cropY = Math.max(0, bounds.minY - padding)
    let cropWidth = Math.min(width - cropX, bounds.maxX - bounds.minX + 1 + padding * 2)
    let cropHeight = Math.min(height - cropY, bounds.maxY - bounds.minY + 1 + padding * 2)

    // Apply minimum size constraints
    if (minSize) {
      if (cropWidth < minSize.width) {
        const extraWidth = minSize.width - cropWidth
        cropX = Math.max(0, cropX - Math.floor(extraWidth / 2))
        cropWidth = Math.min(width - cropX, minSize.width)
      }
      if (cropHeight < minSize.height) {
        const extraHeight = minSize.height - cropHeight
        cropY = Math.max(0, cropY - Math.floor(extraHeight / 2))
        cropHeight = Math.min(height - cropY, minSize.height)
      }
    }

    // Maintain aspect ratio if requested
    if (maintainAspectRatio) {
      const aspectRatio = cropWidth / cropHeight
      const originalAspectRatio = width / height

      if (aspectRatio !== originalAspectRatio) {
        if (aspectRatio > originalAspectRatio) {
          // Crop is wider, adjust height
          const newHeight = cropWidth / originalAspectRatio
          const heightDiff = newHeight - cropHeight
          cropY = Math.max(0, cropY - Math.floor(heightDiff / 2))
          cropHeight = Math.min(height - cropY, newHeight)
        } else {
          // Crop is taller, adjust width
          const newWidth = cropHeight * originalAspectRatio
          const widthDiff = newWidth - cropWidth
          cropX = Math.max(0, cropX - Math.floor(widthDiff / 2))
          cropWidth = Math.min(width - cropX, newWidth)
        }
      }
    }

    // Perform the crop
    if (onProgress) onProgress('Cropping image...', 70)
    let croppedImage = sharp(imageBuffer).extract({
      left: Math.round(cropX),
      top: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    })

    // Apply maximum size constraints if specified
    if (maxSize && (cropWidth > maxSize.width || cropHeight > maxSize.height)) {
      if (onProgress) onProgress('Resizing to maximum size...', 85)

      croppedImage = croppedImage.resize(maxSize.width, maxSize.height, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
    }

    // Generate output
    if (onProgress) onProgress('Generating output...', 90)
    const outputBuffer = await croppedImage.png().toBuffer()

    if (outputFormat === 'base64') {
      if (onProgress) onProgress('Encoding to base64...', 95)
      const base64 = outputBuffer.toString('base64')
      if (onProgress) onProgress('Completed!', 100)
      return `data:image/png;base64,${base64}`
    }

    if (onProgress) onProgress('Completed!', 100)

    return outputBuffer
  } catch (error) {
    console.error('Error cropping image:', error)
    throw error
  }
}

// Convenience functions
export async function cropToOpaqueContentFromUrl(
  url: string,
  options: Omit<Parameters<typeof cropToOpaqueContent>[1], 'outputFormat'> & {
    outputFormat?: 'buffer' | 'base64'
  } = {}
): Promise<Buffer | string> {
  return cropToOpaqueContent(url, options)
}

export async function cropToOpaqueContentFromBuffer(
  buffer: Buffer,
  options: Omit<Parameters<typeof cropToOpaqueContent>[1], 'outputFormat'> & {
    outputFormat?: 'buffer' | 'base64'
  } = {}
): Promise<Buffer | string> {
  return cropToOpaqueContent(buffer, options)
}

/**
 * Create an OpenAI-compatible image edit mask without input image
 * Creates a geometric mask based on canvas dimensions and mask area
 * Opaque areas (alpha=255) = preserve original image
 * Transparent areas (alpha=0) = edit with AI
 */
export async function createOpenAIMask(
  canvasDimensions: { width: number; height: number },
  maskArea: { x: number; y: number; width: number; height: number },
  options: {
    outputFormat?: 'buffer' | 'base64'
    featherRadius?: number
    compressionLevel?: number
    quality?: number
    backgroundColor?: { r: number; g: number; b: number; a?: number }
    maskShape?: 'rectangle' | 'ellipse' | 'rounded-rectangle'
    borderRadius?: number
    onProgress?: (message: string, progress: number) => void
  } = {}
): Promise<Buffer | string> {
  const {
    outputFormat = 'buffer',
    featherRadius = 0,
    compressionLevel = 6,
    quality = 100,
    backgroundColor = { r: 255, g: 255, b: 255, a: 255 },
    maskShape = 'rectangle',
    borderRadius = 0,
    onProgress,
  } = options

  try {
    if (onProgress) onProgress('Starting mask creation...', 0)

    // Validate OpenAI supported sizes
    const { width: canvasWidth, height: canvasHeight } = canvasDimensions

    // Clamp mask area to canvas bounds
    const clampedMask = {
      x: Math.max(0, Math.min(maskArea.x, canvasWidth)),
      y: Math.max(0, Math.min(maskArea.y, canvasHeight)),
      width: Math.max(0, Math.min(maskArea.width, canvasWidth - maskArea.x)),
      height: Math.max(0, Math.min(maskArea.height, canvasHeight - maskArea.y)),
    }

    // Ensure mask doesn't exceed canvas bounds
    clampedMask.width = Math.min(clampedMask.width, canvasWidth - clampedMask.x)
    clampedMask.height = Math.min(clampedMask.height, canvasHeight - clampedMask.y)

    if (onProgress) onProgress('Creating mask data...', 30)

    // Create mask buffer (fully opaque = preserve original image)
    const maskData = Buffer.alloc(canvasWidth * canvasHeight * 4)

    // Fill with background color (opaque)
    for (let i = 0; i < maskData.length; i += 4) {
      maskData[i] = backgroundColor.r // R
      maskData[i + 1] = backgroundColor.g // G
      maskData[i + 2] = backgroundColor.b // B
      maskData[i + 3] = backgroundColor.a || 255 // A
    }

    if (onProgress) onProgress('Creating mask shape...', 50)

    // Create transparent area based on shape
    if (maskShape === 'rectangle') {
      // Simple rectangle
      for (let y = clampedMask.y; y < clampedMask.y + clampedMask.height; y++) {
        for (let x = clampedMask.x; x < clampedMask.x + clampedMask.width; x++) {
          const pixelIndex = (y * canvasWidth + x) * 4
          maskData[pixelIndex] = 0 // R
          maskData[pixelIndex + 1] = 0 // G
          maskData[pixelIndex + 2] = 0 // B
          maskData[pixelIndex + 3] = 0 // A (transparent)
        }
      }
    } else if (maskShape === 'ellipse') {
      // Elliptical mask
      const centerX = clampedMask.x + clampedMask.width / 2
      const centerY = clampedMask.y + clampedMask.height / 2
      const radiusX = clampedMask.width / 2
      const radiusY = clampedMask.height / 2

      for (let y = clampedMask.y; y < clampedMask.y + clampedMask.height; y++) {
        for (let x = clampedMask.x; x < clampedMask.x + clampedMask.width; x++) {
          const dx = (x - centerX) / radiusX
          const dy = (y - centerY) / radiusY

          if (dx * dx + dy * dy <= 1) {
            const pixelIndex = (y * canvasWidth + x) * 4
            maskData[pixelIndex] = 0 // R
            maskData[pixelIndex + 1] = 0 // G
            maskData[pixelIndex + 2] = 0 // B
            maskData[pixelIndex + 3] = 0 // A (transparent)
          }
        }
      }
    } else if (maskShape === 'rounded-rectangle') {
      // Rounded rectangle
      const radius = Math.min(borderRadius, Math.min(clampedMask.width, clampedMask.height) / 2)

      for (let y = clampedMask.y; y < clampedMask.y + clampedMask.height; y++) {
        for (let x = clampedMask.x; x < clampedMask.x + clampedMask.width; x++) {
          let isInside = true

          // Check if pixel is in corner radius area
          const localX = x - clampedMask.x
          const localY = y - clampedMask.y

          // Top-left corner
          if (localX < radius && localY < radius) {
            const dx = radius - localX
            const dy = radius - localY
            isInside = dx * dx + dy * dy <= radius * radius
          }
          // Top-right corner
          else if (localX >= clampedMask.width - radius && localY < radius) {
            const dx = localX - (clampedMask.width - radius)
            const dy = radius - localY
            isInside = dx * dx + dy * dy <= radius * radius
          }
          // Bottom-left corner
          else if (localX < radius && localY >= clampedMask.height - radius) {
            const dx = radius - localX
            const dy = localY - (clampedMask.height - radius)
            isInside = dx * dx + dy * dy <= radius * radius
          }
          // Bottom-right corner
          else if (localX >= clampedMask.width - radius && localY >= clampedMask.height - radius) {
            const dx = localX - (clampedMask.width - radius)
            const dy = localY - (clampedMask.height - radius)
            isInside = dx * dx + dy * dy <= radius * radius
          }

          if (isInside) {
            const pixelIndex = (y * canvasWidth + x) * 4
            maskData[pixelIndex] = 0 // R
            maskData[pixelIndex + 1] = 0 // G
            maskData[pixelIndex + 2] = 0 // B
            maskData[pixelIndex + 3] = 0 // A (transparent)
          }
        }
      }
    }

    // Apply feathering/blur if requested
    let processedMaskData = maskData
    if (featherRadius > 0) {
      if (onProgress) onProgress('Applying feathering...', 70)

      const sharp = await import('sharp').then(m => m.default)
      processedMaskData = await sharp(maskData, {
        raw: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
        },
      })
        .blur(featherRadius)
        .raw()
        .toBuffer()
    }

    // Convert to PNG using Sharp
    if (onProgress) onProgress('Generating mask PNG...', 80)
    const sharp = await import('sharp').then(m => m.default)
    const maskBuffer = await sharp(processedMaskData, {
      raw: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
      },
    })
      .png({
        compressionLevel,
        quality,
      })
      .toBuffer()

    if (onProgress) onProgress('Mask creation completed!', 100)

    // Return based on output format
    if (outputFormat === 'base64') {
      const base64 = maskBuffer.toString('base64')
      return `data:image/png;base64,${base64}`
    }

    return maskBuffer
  } catch (error) {
    console.error('Error creating OpenAI mask:', error)
    throw error
  }
}

/**
 * Utility functions
 */
export function downloadImageFromUrl(url: string, timeout: number = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http

    const request = protocol.get(url, (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`))
        return
      }

      const chunks: any[] = []
      response.on('data', (chunk: any) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    })

    request.setTimeout(timeout, () => {
      request.destroy()
      reject(new Error('Download timeout'))
    })

    request.on('error', reject)
  })
}

/**
 * Get image dimensions from a URL
 * @param url - Image URL to fetch and analyze
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Object with width and height, or null on error
 */
export async function getImageDimensions(
  url: string,
  timeout: number = 30000
): Promise<{ width: number; height: number } | null> {
  try {
    const imageBuffer = await downloadImageFromUrl(url, timeout)
    const metadata = await sharp(imageBuffer).metadata()

    if (!metadata.width || !metadata.height) {
      console.error('[getImageDimensions] Invalid image dimensions')
      return null
    }

    return {
      width: metadata.width,
      height: metadata.height,
    }
  } catch (error) {
    console.error('[getImageDimensions] Error:', error)
    return null
  }
}
