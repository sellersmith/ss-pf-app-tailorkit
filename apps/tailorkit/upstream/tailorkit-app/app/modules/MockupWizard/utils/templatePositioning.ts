import type { TemplatePosition } from '../types'
import type { TransparentArea } from '~/types/geometry'

/** Subset of TransparentArea fields needed for template positioning */
type TemplateArea = Pick<TransparentArea, 'boundingBox'> &
  Partial<Pick<TransparentArea, 'rotation' | 'sourceShapeDimensions' | 'inscribedRect'>>

/**
 * Template positioning utilities
 */

/**
 * Calculate template position based on positioning mode
 * Includes rotation if the area has a rotation property
 *
 * When the area has rotation and sourceShapeDimensions, we use the original
 * (unrotated) shape dimensions for template sizing instead of the axis-aligned
 * bounding box. This ensures the template fills the rotated shape correctly.
 */
export function calculateTemplatePosition(
  templateImage: HTMLImageElement,
  area: TemplateArea,
  mode: 'fit' | 'fill'
): TemplatePosition {
  const hasInscribedRect = area.inscribedRect?.width && area.inscribedRect?.height
  const hasRotation = area.rotation !== undefined && area.rotation !== 0
  const hasSourceDimensions = area.sourceShapeDimensions?.width && area.sourceShapeDimensions?.height

  // Priority: inscribedRect (vector paths) > sourceShapeDimensions (rotated rect/ellipse) > boundingBox
  let targetWidth: number
  let targetHeight: number
  let centerX: number
  let centerY: number
  let rotation: number | undefined

  if (hasInscribedRect) {
    // Vector path: use inscribed rectangle dimensions, center, and rotation
    targetWidth = area.inscribedRect.width
    targetHeight = area.inscribedRect.height
    centerX = area.inscribedRect.centerX
    centerY = area.inscribedRect.centerY
    rotation = area.inscribedRect.rotation
  } else if (hasRotation && hasSourceDimensions) {
    // Rotated rect/ellipse: use original unrotated shape dimensions
    targetWidth = area.sourceShapeDimensions.width
    targetHeight = area.sourceShapeDimensions.height
    centerX = area.boundingBox.x + area.boundingBox.width / 2
    centerY = area.boundingBox.y + area.boundingBox.height / 2
    rotation = area.rotation
  } else {
    // Default: use axis-aligned bounding box
    targetWidth = area.boundingBox.width
    targetHeight = area.boundingBox.height
    centerX = area.boundingBox.x + area.boundingBox.width / 2
    centerY = area.boundingBox.y + area.boundingBox.height / 2
    rotation = undefined
  }

  const templateAspect = templateImage.width / templateImage.height
  const targetAspect = targetWidth / targetHeight

  let drawWidth, drawHeight

  if (mode === 'fit') {
    if (templateAspect > targetAspect) {
      drawWidth = targetWidth
      drawHeight = targetWidth / templateAspect
    } else {
      drawWidth = targetHeight * templateAspect
      drawHeight = targetHeight
    }
  } else {
    if (templateAspect > targetAspect) {
      drawWidth = targetHeight * templateAspect
      drawHeight = targetHeight
    } else {
      drawWidth = targetWidth
      drawHeight = targetWidth / templateAspect
    }
  }

  const drawX = centerX - drawWidth / 2
  const drawY = centerY - drawHeight / 2

  return { x: drawX, y: drawY, width: drawWidth, height: drawHeight, rotation }
}

/**
 * Draw a template image with rotation applied
 */
function drawRotatedTemplate(
  ctx: CanvasRenderingContext2D,
  templateImage: HTMLImageElement,
  position: TemplatePosition
) {
  const rotation = position.rotation || 0

  if (rotation === 0) {
    // No rotation - draw normally
    ctx.drawImage(templateImage, position.x, position.y, position.width, position.height)
    return
  }

  // Calculate center of the template for rotation
  const centerX = position.x + position.width / 2
  const centerY = position.y + position.height / 2
  const radians = rotation * (Math.PI / 180)

  ctx.save()

  // Move to center, rotate, then draw centered
  ctx.translate(centerX, centerY)
  ctx.rotate(radians)
  ctx.drawImage(templateImage, -position.width / 2, -position.height / 2, position.width, position.height)

  ctx.restore()
}

/**
 * Draw composite image with templates
 */
export function drawCompositeImage(
  canvas: HTMLCanvasElement,
  originalImage: HTMLImageElement,
  templateImages: HTMLImageElement[],
  transparentAreas: any[],
  maskImageUrl: string | null | undefined,
  templatePositioningMode: 'fit' | 'fill',
  onPositionsCalculated?: (positions: TemplatePosition[]) => void,
  scaleFactor: number = 1.0,
  /** Override calculated positions with user-adjusted positions from the manipulator */
  positionOverrides?: TemplatePosition[],
  /** When true, apply fit/fill calculation to positionOverrides (initial seed from area bounds).
   *  When false (default), use positionOverrides directly (user-manipulated exact positions). */
  fitOverrides: boolean = false,
  /** When true, skip mask layer — template composites on top of full product image */
  noMask: boolean = false
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Apply scale factor for mobile memory optimization
  const scaledWidth = Math.round(originalImage.width * scaleFactor)
  const scaledHeight = Math.round(originalImage.height * scaleFactor)

  // Set canvas dimensions with scale factor applied
  canvas.width = scaledWidth
  canvas.height = scaledHeight

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Enable high-quality downscaling if scaling
  if (scaleFactor !== 1.0) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }

  // 1. Draw base original image (scaled)
  ctx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight)

  // 2. Draw template images — use position overrides if provided (from manipulator),
  //    otherwise calculate positions from transparent areas
  const calculatedPositions: TemplatePosition[] = []

  if (positionOverrides && positionOverrides.length > 0) {
    // Use override positions — either directly (user-manipulated) or fit-adjusted
    // (initial seed from area bounds where template should maintain aspect ratio).
    positionOverrides.forEach((position, index) => {
      const templateImage = templateImages[index]
      if (templateImage) {
        if (fitOverrides) {
          // Initial seed: fit template inside area bounds (maintain aspect ratio)
          const area = { boundingBox: position, rotation: position.rotation }
          const fitted = calculateTemplatePosition(templateImage, area, templatePositioningMode)
          calculatedPositions.push(fitted)
          drawRotatedTemplate(ctx, templateImage, fitted)
        } else {
          // User-manipulated: draw at exact position the user chose
          calculatedPositions.push(position)
          drawRotatedTemplate(ctx, templateImage, position)
        }
      }
    })
  } else if (transparentAreas.length > 0) {
    // Calculate positions from transparent areas (initial draw)
    if (transparentAreas.length > 1 && templateImages.length === 1) {
      // Multiple transparent areas with 1 template: use the largest area (primary shape)
      // instead of combining all areas — small artifact areas (e.g., 1px strips from
      // image downscale interpolation) would inflate the combined bounding box.
      const templateImage = templateImages[0]
      const primaryArea = transparentAreas.reduce((best: any, curr: any) => (curr.area > best.area ? curr : best))
      const position = calculateTemplatePosition(templateImage, primaryArea, templatePositioningMode)
      calculatedPositions.push(position)
      drawRotatedTemplate(ctx, templateImage, position)
    } else {
      transparentAreas.forEach((area, index) => {
        const templateImage = templateImages[index]
        if (templateImage) {
          const position = calculateTemplatePosition(templateImage, area, templatePositioningMode)
          calculatedPositions.push(position)
          drawRotatedTemplate(ctx, templateImage, position)
        }
      })
    }
  }

  // NOTE: Positions callback is now called AFTER mask image loads successfully
  // to prevent infinite render loops caused by synchronous state updates

  // 3. Load and draw mask on top with standard blending (scaled to match canvas)
  // Skip mask step entirely when noMask=true — template is already on top of full product image
  if (noMask) {
    onPositionsCalculated?.(calculatedPositions)
    return
  }

  // Validate mask image URL before attempting to load
  if (!maskImageUrl) {
    console.error('[MockupWizard] Failed to load mask image: URL is empty or undefined')
    return
  }

  const isBase64 = maskImageUrl.startsWith('data:')
  const urlPreview = isBase64
    ? `base64 (length: ${maskImageUrl.length}, first 50 chars: ${maskImageUrl.substring(0, 50)}...)`
    : maskImageUrl.substring(0, 100)

  // Check for potentially truncated base64 data
  if (isBase64 && !maskImageUrl.includes(',')) {
    console.error('[MockupWizard] Failed to load mask image: Base64 URL appears malformed (missing comma separator)', {
      urlLength: maskImageUrl.length,
      preview: urlPreview,
    })
    return
  }

  // Validate base64 string format
  if (isBase64) {
    const base64Part = maskImageUrl.split(',')[1]
    if (!base64Part) {
      console.error('[MockupWizard] Failed to load mask image: No base64 data after comma', {
        urlLength: maskImageUrl.length,
      })
      return
    }

    // Check for invalid characters in base64
    const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/
    // Only check a sample to avoid processing entire string
    const sampleSize = Math.min(1000, base64Part.length)
    const sample = base64Part.substring(0, sampleSize)
    if (!validBase64Regex.test(sample)) {
      console.error('[MockupWizard] Failed to load mask image: Base64 contains invalid characters', {
        sample: sample.substring(0, 100),
        urlLength: maskImageUrl.length,
      })
      return
    }

    // Check for proper padding (base64 length should be multiple of 4)
    if (base64Part.length % 4 !== 0) {
      console.error('[MockupWizard] Failed to load mask image: Base64 has incorrect padding', {
        base64Length: base64Part.length,
        remainder: base64Part.length % 4,
      })
      return
    }
  }

  const maskImg = new Image()
  maskImg.crossOrigin = 'anonymous'
  maskImg.onload = () => {
    // Use the mask to blend the template with the product surface.
    // Instead of drawing the processed mask over the original (which degrades quality),
    // extract only the alpha channel from the mask and use it to composite:
    // - Where mask is opaque: show original image (product surface on top of template)
    // - Where mask is transparent: show the template underneath
    // This preserves the original image quality outside the template area.

    // Create a temporary canvas to extract the mask's alpha and apply it to the original image
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = scaledWidth
    maskCanvas.height = scaledHeight
    const maskCtx = maskCanvas.getContext('2d')

    if (maskCtx) {
      // Draw the ORIGINAL image (not the processed mask) into the mask canvas
      maskCtx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight)

      // Use 'destination-in' to keep only the pixels where the mask is opaque
      // This creates: original image visible where mask is opaque, transparent where mask is transparent
      maskCtx.globalCompositeOperation = 'destination-in'
      maskCtx.drawImage(maskImg, 0, 0, scaledWidth, scaledHeight)

      // Draw this composited result (original image masked to opaque areas) on top of the main canvas
      // This covers the template with the original product surface, preserving image quality
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(maskCanvas, 0, 0)
    } else {
      // Fallback: draw mask directly (legacy behavior)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(maskImg, 0, 0, scaledWidth, scaledHeight)
    }

    // Notify caller of calculated positions AFTER successful composite completion
    // This prevents infinite loops by not triggering state updates until drawing is fully complete
    onPositionsCalculated?.(calculatedPositions)

    // Cleanup image object to free memory
    // IMPORTANT: Nullify handlers BEFORE clearing src to prevent re-triggering
    maskImg.onload = null
    maskImg.onerror = null
    maskImg.src = ''
  }
  maskImg.onerror = event => {
    // Detailed error logging for debugging
    const errorDetails = {
      urlType: isBase64 ? 'base64' : 'remote',
      urlLength: maskImageUrl.length,
      preview: urlPreview,
      canvasSize: `${scaledWidth}x${scaledHeight}`,
      errorEvent: event,
    }

    console.error('[MockupWizard] Failed to load mask image:', errorDetails)

    // Log memory info if available (helps identify memory exhaustion)
    if (typeof window !== 'undefined' && 'performance' in window) {
      const perf = window.performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
      if (perf.memory) {
        console.error('[MockupWizard] Memory at failure:', {
          usedMB: (perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
          limitMB: (perf.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2),
        })
      }
    }

    // Cleanup image object on error
    // IMPORTANT: Nullify handlers BEFORE clearing src to prevent infinite loop
    // Setting src = '' could trigger another error, so we must remove handlers first
    maskImg.onload = null
    maskImg.onerror = null
    maskImg.src = ''

    // Always call the callback on error so callers can reset their drawing-in-progress guard.
    // Without this, isDrawingRef in ResultView stays true permanently after a mask load failure,
    // silently blocking all subsequent Fit/Fill/Fallback redraws.
    onPositionsCalculated?.(calculatedPositions)
  }
  maskImg.src = maskImageUrl
}
