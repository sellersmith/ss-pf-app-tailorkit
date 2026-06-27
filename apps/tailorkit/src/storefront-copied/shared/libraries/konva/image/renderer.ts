import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../runtime-konva'
import type { KonvaEditorState } from '../../../../assets/handlers/event-handlers/image-editor'
import { computeSafeCachePixelRatio } from '../effects/utils'
import { compositeImageWithOverlay, type OverlayMetadata } from '../../../utils/overlay-compositor'
import type { IMaskConfig } from '../core/konva-canvas-manager'
import { isIOS } from '../../../../assets/utils/devices'
import { MASK_COMPOSITE_CACHE_GROUP_NAME, type CachedGroupAttrs } from '../../../utils/konva-cache'

/** Maximum resolution scale multiplier for cache pixel ratio (iOS has stricter memory limits) */
const MAX_RESOLUTION_SCALE = isIOS() ? 2 : 4

/**
 * Get safe device pixel ratio for overlay compositing.
 * This ensures paths are rendered at high resolution for crisp edges on Retina displays.
 * iOS has stricter limits to prevent memory exhaustion.
 *
 * @param forSvg - If true, use higher DPR for SVG images to preserve vector crispness
 */
function getSafeDevicePixelRatio(forSvg = false): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  if (forSvg) {
    // SVG images need higher resolution to preserve vector crispness
    // Use 4x on iOS, 6x on desktop for crisp SVG rendering
    const maxSvgDpr = isIOS() ? 4 : 6
    return Math.min(dpr * 3, maxSvgDpr)
  }

  // For raster images, use standard limits to save memory
  // Cap DPR on iOS to prevent memory issues (max 2x)
  // Desktop can handle higher ratios (up to 3x)
  const maxDpr = isIOS() ? 2 : 3
  return Math.min(dpr, maxDpr)
}

/**
 * Checks if an image URL represents an SVG/vector image
 */
function isSvgImage(url: string): boolean {
  if (!url) return false

  // Check for SVG data URI
  if (url.startsWith('data:image/svg+xml')) {
    return true
  }

  // Check for SVG file extension in URL (handle query params)
  const urlWithoutQuery = url.toLowerCase().split('?')[0]
  return urlWithoutQuery.endsWith('.svg')
}

/**
 * Strip ALL filter effects from SVG content for print image generation.
 * Filter effects are for visualization only and should not be included
 * in physical engraving/printing output.
 *
 * This removes:
 * - All <filter> elements from <defs>
 * - All filter="url(#...)" attributes from elements
 * - All filter: url(#...) in inline styles
 *
 * NOTE: This function intentionally does NOT modify width/height attributes.
 * Preserving the original dimensions ensures consistent rendering behavior
 * between Template Editor Preview, Storefront Preview, and PNG export.
 *
 * @param svgContent - The SVG content string
 * @returns Modified SVG content with all filters stripped
 */
function stripFilterPresetsFromSvg(svgContent: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      console.warn('[stripFilterPresetsFromSvg] SVG parsing error, returning original')
      return svgContent
    }

    const svg = doc.documentElement
    let modified = false

    // NOTE: We intentionally do NOT modify width/height attributes here.
    // Previously, we set explicit width/height from viewBox to ensure consistent intrinsic dimensions.
    // However, this caused SVG content positioning issues in PNG export because:
    // 1. AI-generated vectors often have content that doesn't fill the entire viewBox
    // 2. Setting explicit dimensions that match viewBox causes 1:1 coordinate mapping
    // 3. This places content at its viewBox position instead of letting the browser center it
    //
    // The browser's SVG rendering engine handles dimension-less or percentage-based SVGs correctly
    // by using the viewBox for aspect ratio while allowing natural content positioning.
    // This matches the behavior of Template Editor Preview and Storefront Preview.

    // Remove ALL filter elements - print images don't need any filter effects
    const filters = svg.querySelectorAll('filter')
    if (filters.length > 0) {
      for (const filter of filters) {
        filter.remove()
      }
      modified = true
    }

    // Remove ALL filter attributes from elements
    const elementsWithFilter = svg.querySelectorAll('[filter]')
    if (elementsWithFilter.length > 0) {
      for (const el of elementsWithFilter) {
        el.removeAttribute('filter')
      }
      modified = true
    }

    // Remove filter properties from inline styles
    const elementsWithStyle = svg.querySelectorAll('[style]')
    for (const el of elementsWithStyle) {
      const style = el.getAttribute('style') || ''
      if (style.includes('filter')) {
        // Remove filter property from style
        const newStyle = style.replace(/filter\s*:\s*[^;]+;?/gi, '')
        if (newStyle.trim()) {
          el.setAttribute('style', newStyle)
        } else {
          el.removeAttribute('style')
        }
        modified = true
      }
    }

    // If no modifications were made, return original content
    if (!modified) {
      return svgContent
    }

    // Serialize back to string
    const serializer = new XMLSerializer()
    return serializer.serializeToString(svg)
  } catch (error) {
    console.warn('[stripFilterPresetsFromSvg] Error processing SVG:', error)
    return svgContent
  }
}

/**
 * Process SVG URL to strip filter presets for print images.
 * Fetches the SVG content, strips filter presets, and returns a data URL.
 *
 * @param url - The SVG URL (can be a regular URL or data URI)
 * @returns Data URL of the modified SVG, or original URL on error
 */
async function processSvgForPrint(url: string): Promise<string> {
  try {
    let svgContent: string

    if (url.startsWith('data:image/svg+xml')) {
      // Extract content from data URI
      if (url.includes('base64,')) {
        const base64Content = url.split('base64,')[1]
        svgContent = atob(base64Content)
      } else {
        // URL-encoded data URI
        const encodedContent = url.split(',')[1]
        svgContent = decodeURIComponent(encodedContent)
      }
    } else {
      // Fetch SVG from URL
      const response = await fetch(url)
      if (!response.ok) {
        console.warn('[processSvgForPrint] Failed to fetch SVG:', response.status)
        return url
      }
      svgContent = await response.text()
    }

    // Strip filter presets
    const modifiedSvg = stripFilterPresetsFromSvg(svgContent)

    // Convert back to data URL
    const base64 = btoa(unescape(encodeURIComponent(modifiedSvg)))
    return `data:image/svg+xml;base64,${base64}`
  } catch (error) {
    console.warn('[processSvgForPrint] Error processing SVG for print:', error)
    return url
  }
}

/**
 * Konva node attribute that signals "rotation pivot lives on a child Image, not on
 * this group". Read via `node.getAttr(ROTATION_DELEGATE_ATTR)`. Set by `addImageLayer`
 * when the caller passes a non-zero `rotationOrigin` offset; consumed by
 * `applyLayerRotation` so all rotation updates go through the right node.
 */
export const ROTATION_DELEGATE_ATTR = '_rotationOnInnerImage'

/**
 * Set rotation on the node that owns the rotation pivot. When the node is a Group
 * marked with ROTATION_DELEGATE_ATTR (created by `addImageLayer` with an explicit
 * rotation pivot), the rotation is applied to its inner Konva.Image — where the
 * matching `offsetX/offsetY` was configured. Otherwise rotation is applied directly.
 *
 * Use this everywhere a layer's rotation is updated (drag-snap, transformer-end,
 * preserve-restore) so rotation always lands on the same node that holds the pivot
 * configuration. Without it, rotation can compound across two nodes and pivot at the
 * wrong point.
 */
export function applyLayerRotation(node: Konva.Node, rotation: number): void {
  if (node.getAttr(ROTATION_DELEGATE_ATTR) && node instanceof KonvaRuntime.Group) {
    const inner = node.findOne<Konva.Image>('Image')
    if (inner) {
      inner.rotation(rotation)
      return
    }
  }
  node.rotation(rotation)
}

export interface ImageLayerProps {
  url: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  maskConfig?: IMaskConfig
  clipGroup?: KonvaEditorState
  overlay?: {
    overlaySvg: string
    overlayMetadata?: OverlayMetadata
  }
  /**
   * Skip rendering filter presets (debossing, embossing, hot-foil-stamping, laser-engraving)
   * When true, overlay paths render with original fill/stroke colors without filter effects.
   * Used for print image generation where filter effects are for visualization only.
   * @default false
   */
  skipFilterPresets?: boolean
  /**
   * Rotation pivot for the rendered image, expressed in bbox-local coordinates
   * (where (0, 0) is the visible bbox top-left and (width, height) is the bottom-right).
   *
   * Accepted values:
   * - 'top-left' (default): equivalent to `{ offsetX: 0, offsetY: 0 }`. Backward-compatible.
   * - 'center': equivalent to `{ offsetX: width/2, offsetY: height/2 }`.
   * - `{ offsetX, offsetY }`: explicit pivot in bbox-local space. The visible bbox top-left
   *   still lands at the caller's `(x, y)`; only the rotation pivot moves.
   *
   * Used by charm rendering to align the rotation pivot with the slot anchor point
   * (top / center / bottom), so a slot rotation visually anchors the charm at the slot.
   * Currently only honored on the simple (no clipGroup, no maskConfig) path.
   * @default 'top-left'
   */
  rotationOrigin?: 'top-left' | 'center' | { offsetX: number; offsetY: number }
}

export interface ImageLayerDeps {
  loadImage: (url: string, width?: number) => Promise<HTMLImageElement>
  buildProcessedMaskCanvas: (
    maskConfig: IMaskConfig,
    width: number,
    height: number
  ) => Promise<HTMLCanvasElement | null>
}

export async function addImageLayer(
  targetContainer: Konva.Group | Konva.Layer,
  props: ImageLayerProps,
  deps: ImageLayerDeps
): Promise<Konva.Image | Konva.Group> {
  const {
    url,
    x,
    y,
    width,
    height,
    rotation = 0,
    maskConfig,
    clipGroup,
    overlay,
    skipFilterPresets = false,
    rotationOrigin = 'top-left',
  } = props

  const { loadImage, buildProcessedMaskCanvas } = deps

  let imageUrl = url

  // Check if the source is an SVG for adaptive quality rendering
  const isSourceSvg = isSvgImage(url)

  // For print images (skipFilterPresets=true), strip filter presets from SVG sources
  // Filter presets (debossing, embossing, etc.) are for visualization only
  if (skipFilterPresets && isSourceSvg) {
    imageUrl = await processSvgForPrint(imageUrl)
  }

  // If overlay data is provided and NO clipGroup, composite the image with the SVG overlay first
  // When clipGroup exists, we apply the overlay as a separate layer AFTER clipping
  // This ensures the overlay aligns with the visible (clipped) portion of the image
  if (overlay?.overlaySvg && !clipGroup) {
    try {
      const composited = await compositeImageWithOverlay({
        imageUrl: url,
        overlay: {
          combinedSvg: overlay.overlaySvg,
          metadata: overlay.overlayMetadata || {
            imageWidth: width,
            imageHeight: height,
            hasClipPaths: true,
            hasFilters: true,
            hasDrawnPaths: true,
          },
        },
        targetWidth: width,
        targetHeight: height,
        // Pass higher DPR for SVG images to preserve vector crispness
        devicePixelRatio: getSafeDevicePixelRatio(isSourceSvg),
      })
      imageUrl = composited.dataUrl
    } catch (error) {
      console.error('Failed to composite image with overlay, using original image:', error)
    }
  }

  const image = await loadImage(imageUrl, width)

  // Calculate the resolution scale factor between natural image size and target render size
  // This ensures we don't lose quality when caching images that are larger than their display size
  // Guard against zero dimensions to prevent division by zero
  const naturalWidth = image.naturalWidth > 0 ? image.naturalWidth : width
  const naturalHeight = image.naturalHeight > 0 ? image.naturalHeight : height
  const safeWidth = width > 0 ? width : 1
  const safeHeight = height > 0 ? height : 1
  const resolutionScaleX = naturalWidth / safeWidth
  const resolutionScaleY = naturalHeight / safeHeight
  const resolutionScale = Math.max(resolutionScaleX, resolutionScaleY, 1)

  // If clipGroup is provided, create a clipping container
  if (clipGroup) {
    // Create a group to handle clipping - use original x,y
    const clipContainer = new KonvaRuntime.Group({
      x,
      y,
      rotation: rotation,
    })

    // Create the clipping rectangle
    // Use the container dimensions for the clipping boundary to match template
    const clipWidth = width
    const clipHeight = height

    // Apply clipFunc to create the clipping boundary
    // Now using top-left based coordinates (0,0) instead of centered coordinates
    clipContainer.clipFunc(ctx => {
      ctx.beginPath()
      ctx.rect(0, 0, clipWidth, clipHeight)
      ctx.closePath()
    })

    // Create the visible boundary rectangle - now at (0,0)
    const boundaryRect = new KonvaRuntime.Rect({
      x: 0,
      y: 0,
      width: clipWidth,
      height: clipHeight,
      // stroke: '#999',
      // strokeWidth: 5,
      // dash: [5, 5],
      fill: 'transparent',
      listening: false,
    })
    clipContainer.add(boundaryRect)

    // Create an isolated group to contain image + mask so compositing
    // doesn't affect other canvas elements
    const imageGroup = new KonvaRuntime.Group({
      x: 0,
      y: 0,
      listening: false,
    })

    // Create image with proper positioning
    const konvaImage = new KonvaRuntime.Image({
      image: image,
      listening: false,
    })

    // Apply dimensions from clipGroup state, fallback to given width/height
    // On storefront the image node is placed within the container using
    // absolute metrics; for print, we want to reproduce that placement inside
    // the clip container whose size is the container width/height above.
    //
    // If absoluteWidth/absoluteHeight are not set (e.g., AI-generated vectors without editing),
    // calculate dimensions that preserve the image's aspect ratio while fitting within the container.
    // Only applies to SVG images to maintain backward compatibility with raster images.
    let imgW = (clipGroup.absoluteWidth as number) || 0
    let imgH = (clipGroup.absoluteHeight as number) || 0

    // Check for SVG once and reuse for both dimension and position logic
    const isSvg = isSvgImage(url)

    // Track whether we calculated dimensions using aspect ratio logic
    // This is used to determine if we should also auto-center the image
    let usedAspectRatioCalculation = false

    if (!imgW || !imgH) {
      if (isSvg) {
        // Calculate dimensions that preserve aspect ratio and fit within container
        const imgAspect = naturalWidth / naturalHeight
        const containerAspect = width / height

        if (imgAspect > containerAspect) {
          // Image is wider than container - fit to width
          imgW = width
          imgH = width / imgAspect
        } else {
          // Image is taller than container - fit to height
          imgH = height
          imgW = height * imgAspect
        }
        usedAspectRatioCalculation = true
      } else {
        // For raster images, use container dimensions (backward compatible behavior)
        imgW = width
        imgH = height
      }
    }

    konvaImage.width(imgW)
    konvaImage.height(imgH)

    // Apply position from clipGroup state - top-left based
    // If we calculated aspect-ratio-preserving dimensions (usedAspectRatioCalculation=true),
    // center the image within the container regardless of whether clipGroup has explicit position values.
    // This ensures AI-generated vectors are centered even when order data has position=0 stored.
    let imgX = (clipGroup.absoluteX as number) ?? 0
    let imgY = (clipGroup.absoluteY as number) ?? 0

    // Center SVG images when we calculated dimensions using aspect ratio logic
    // Previously we checked `hasExplicitPosition` but this caused issues when order data
    // stored position=0 explicitly, skipping centering even though dimensions were recalculated.
    if (isSvg && usedAspectRatioCalculation && (imgW !== width || imgH !== height)) {
      imgX = (width - imgW) / 2
      imgY = (height - imgH) / 2
    }

    konvaImage.x(imgX)
    konvaImage.y(imgY)

    // Apply rotation to the image if specified in clipGroup
    if (clipGroup.rotation !== undefined) {
      konvaImage.rotation(clipGroup.rotation)
    }

    // Avoid caching both image and group to prevent excessive offscreen canvas sizes on iOS
    // We'll cache the parent imageGroup later with a safe pixel ratio

    // Add image into the isolated group
    imageGroup.add(konvaImage)

    // If a mask is provided, overlay a static mask node sized to the clip
    if (maskConfig?.src) {
      const processedMask = await buildProcessedMaskCanvas(maskConfig, clipWidth, clipHeight)
      if (processedMask) {
        const maskNode = new KonvaRuntime.Image({
          image: processedMask,
          x: 0,
          y: 0,
          width: clipWidth,
          height: clipHeight,
          listening: false,
          globalCompositeOperation: maskConfig.globalCompositeOperation || 'destination-in',
        })
        // No need to cache the mask separately if we cache its parent group
        imageGroup.add(maskNode)

        /**
         * Mark group for cache restoration during export.
         * This ensures the mask composite operation is properly cached
         * when the stage is cloned for download/export operations.
         * Without this, the globalCompositeOperation won't work correctly
         * and black areas of the mask will be visible instead of transparent.
         */
        imageGroup.name(MASK_COMPOSITE_CACHE_GROUP_NAME)

        /**
         * Store cache dimensions as data attributes for cache restoration during export.
         * These attributes are read by restoreClonedCache() to recreate the cache
         * with exact dimensions, preventing rendering artifacts.
         */
        const groupAttrs = imageGroup.attrs as CachedGroupAttrs
        groupAttrs['data-cache-width'] = clipWidth
        groupAttrs['data-cache-height'] = clipHeight
      }
    }

    // If overlay is provided with clipGroup, we need to composite the overlay with the
    // visible/clipped portion of the image. The challenge is that:
    // - The overlay (SVG clip paths, filters) is designed for the container dimensions
    // - The user's image may be larger/smaller/positioned differently within the container
    //
    // Solution: Extract the visible portion of the image, composite with overlay,
    // then use that as the final image. We do this by:
    // 1. Drawing the positioned/scaled image onto a temp canvas at container size
    // 2. Compositing that with the overlay
    // 3. Using the result as the display image (no longer need clipGroup positioning)
    if (overlay?.overlaySvg) {
      try {
        // Create a canvas at the clip/container dimensions
        const extractCanvas = document.createElement('canvas')
        extractCanvas.width = clipWidth
        extractCanvas.height = clipHeight
        const extractCtx = extractCanvas.getContext('2d')

        if (extractCtx) {
          // Draw the image at its clipGroup position/scale onto this canvas
          // This extracts just the visible portion
          extractCtx.save()
          if (clipGroup.rotation) {
            // Handle rotation if needed - rotate around center
            extractCtx.translate(clipWidth / 2, clipHeight / 2)
            extractCtx.rotate((clipGroup.rotation * Math.PI) / 180)
            extractCtx.translate(-clipWidth / 2, -clipHeight / 2)
          }
          extractCtx.drawImage(image, imgX, imgY, imgW, imgH)
          extractCtx.restore()

          const extractedDataUrl = extractCanvas.toDataURL('image/png')

          // Now composite the overlay with the extracted visible image
          const composited = await compositeImageWithOverlay({
            imageUrl: extractedDataUrl,
            overlay: {
              combinedSvg: overlay.overlaySvg,
              metadata: overlay.overlayMetadata || {
                imageWidth: clipWidth,
                imageHeight: clipHeight,
                hasClipPaths: true,
                hasFilters: true,
                hasDrawnPaths: true,
              },
            },
            targetWidth: clipWidth,
            targetHeight: clipHeight,
            // Pass higher DPR for SVG images to preserve vector crispness
            devicePixelRatio: getSafeDevicePixelRatio(isSourceSvg),
          })

          // Replace the konvaImage with the composited result
          const compositedImage = await loadImage(composited.dataUrl, clipWidth)
          konvaImage.image(compositedImage)
          konvaImage.x(0)
          konvaImage.y(0)
          konvaImage.width(clipWidth)
          konvaImage.height(clipHeight)
          konvaImage.rotation(0)
        }
      } catch (error) {
        console.error('Failed to apply overlay to clipped image:', error)
      }
    }

    // Add the imageGroup first, then cache the group with a safe pixel ratio
    clipContainer.add(imageGroup)

    // Calculate cache pixel ratio that preserves image quality
    // Account for both memory limits and actual image resolution vs display size
    // Use higher quality for SVG images to preserve vector crispness
    const basePR = computeSafeCachePixelRatio(clipWidth, clipHeight, { forSvg: isSvg })
    const cappedScale = Math.min(resolutionScale, MAX_RESOLUTION_SCALE)
    const adjustedPR = Math.min(basePR * cappedScale, MAX_RESOLUTION_SCALE)
    imageGroup.cache({ pixelRatio: adjustedPR })

    // Add to target container
    targetContainer.add(clipContainer)

    // Ensure boundary is visible above mask
    boundaryRect.moveToTop()

    return clipContainer
  }

  // Standard image without clipping - isolate image + mask inside a group
  // For SVG images without clipGroup (e.g., AI-generated vectors that skip image editor),
  // preserve aspect ratio by fitting the image within the container dimensions.
  // This matches the behavior of Template Editor Preview (KonvaImageWithMask.client.tsx).
  // The browser handles SVG viewBox scaling and internal content positioning automatically
  // via preserveAspectRatio - we just need to center based on the image's natural dimensions.
  // Raster images are NOT affected to maintain backward compatibility.
  const isSvg = isSvgImage(url)
  const imgAspect = naturalWidth / naturalHeight
  const containerAspect = width / height

  let renderWidth = width
  let renderHeight = height
  let offsetX = 0
  let offsetY = 0

  // For SVG images, apply aspect ratio preservation and centering
  // Uses naturalWidth/naturalHeight which come from the SVG's viewBox or width/height attributes
  // This matches Template Editor Preview behavior exactly
  if (isSvg && Math.abs(imgAspect - containerAspect) > 0.01) {
    if (imgAspect > containerAspect) {
      // Image is wider than container - fit to width
      renderWidth = width
      renderHeight = width / imgAspect
      offsetY = (height - renderHeight) / 2
    } else {
      // Image is taller than container - fit to height
      renderHeight = height
      renderWidth = height * imgAspect
      offsetX = (width - renderWidth) / 2
    }
  }

  // Resolve the requested rotation pivot into bbox-local offset values. The pivot is
  // applied to the Konva.Image (rotation lives on the image, matching legacy behavior
  // for non-mask layers); offsetX/Y on the image shifts its rotation pivot inside the
  // bbox while the visible bbox top-left still lands at the caller's (x, y).
  // Only honored on the simple path (no maskConfig, no clipGroup) so masked / clipped
  // images keep existing template editor behavior.
  let pivotX = 0
  let pivotY = 0
  if (!maskConfig?.src) {
    if (rotationOrigin === 'center') {
      pivotX = renderWidth / 2
      pivotY = renderHeight / 2
    } else if (typeof rotationOrigin === 'object' && rotationOrigin !== null) {
      pivotX = rotationOrigin.offsetX
      pivotY = rotationOrigin.offsetY
    }
  }

  const imageGroup = new KonvaRuntime.Group({
    x,
    y,
    rotation: maskConfig?.src ? rotation : 0,
    listening: false,
  })
  const konvaImage = new KonvaRuntime.Image({
    x: offsetX + pivotX,
    y: offsetY + pivotY,
    image: image,
    width: renderWidth,
    height: renderHeight,
    rotation: maskConfig?.src ? 0 : rotation,
    offsetX: pivotX,
    offsetY: pivotY,
    listening: false,
  })

  // Mark the group when its rotation pivot lives on the inner image (offsetX/Y on the
  // Konva.Image, not the group). Any consumer that wants to update the layer's
  // rotation MUST go through `applyLayerRotation` so it lands on the inner image —
  // setting rotation on the group would compound with the image's own rotation and
  // pivot at the bbox top-left, producing the swap-rotation visual bug. The marker
  // makes this contract self-documenting instead of a latent invariant.
  if (pivotX !== 0 || pivotY !== 0) {
    imageGroup.setAttr(ROTATION_DELEGATE_ATTR, true)
  }
  // Avoid caching the child when we will cache the parent group

  // Add to content group if exists, otherwise main layer
  imageGroup.add(konvaImage)

  // Static mask overlay for non-clipped image
  if (maskConfig?.src) {
    const processedMask = await buildProcessedMaskCanvas(maskConfig, width, height)
    if (processedMask) {
      const maskNode = new KonvaRuntime.Image({
        image: processedMask,
        x: 0,
        y: 0,
        width,
        height,
        listening: false,
        globalCompositeOperation: maskConfig.globalCompositeOperation || 'destination-in',
      })
      imageGroup.add(maskNode)

      /**
       * Mark group for cache restoration during export.
       * This ensures the mask composite operation is properly cached
       * when the stage is cloned for download/export operations.
       * Without this, the globalCompositeOperation won't work correctly
       * and black areas of the mask will be visible instead of transparent.
       */
      imageGroup.name(MASK_COMPOSITE_CACHE_GROUP_NAME)

      /**
       * Store cache dimensions as data attributes for cache restoration during export.
       * These attributes are read by restoreClonedCache() to recreate the cache
       * with exact dimensions, preventing rendering artifacts.
       */
      const groupAttrs = imageGroup.attrs as CachedGroupAttrs
      groupAttrs['data-cache-width'] = width
      groupAttrs['data-cache-height'] = height
    }
  }

  // Cache the group so composite is scoped to image + mask only
  // Calculate cache pixel ratio that preserves image quality
  // Account for both memory limits and actual image resolution vs display size
  // Use higher quality for SVG images to preserve vector crispness
  const basePR = computeSafeCachePixelRatio(width, height, { forSvg: isSvg })
  const cappedScale = Math.min(resolutionScale, MAX_RESOLUTION_SCALE)
  const adjustedPR = Math.min(basePR * cappedScale, MAX_RESOLUTION_SCALE)
  imageGroup.cache({ pixelRatio: adjustedPR })
  targetContainer.add(imageGroup)

  return konvaImage
}
