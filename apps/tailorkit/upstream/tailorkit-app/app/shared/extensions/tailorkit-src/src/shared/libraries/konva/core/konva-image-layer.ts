import Konva from 'konva'
import type { KonvaEditorState } from '../../../../assets/handlers/event-handlers/image-editor'
import { computeSafeCachePixelRatio } from '../effects/utils'
import { compositeImageWithOverlay, type OverlayMetadata } from '../../../utils/overlay-compositor'
import type { IMaskConfig } from './konva-canvas-manager'

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
  } = props

  const { loadImage, buildProcessedMaskCanvas } = deps

  let imageUrl = url

  // If overlay data is provided, composite the image with the SVG overlay first
  // Skip hasVisualOverlay check - if overlaySvg exists, always try to composite
  // The compositing function handles missing metadata with sensible defaults
  if (overlay?.overlaySvg) {
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
      })
      imageUrl = composited.dataUrl
    } catch (error) {
      console.error('Failed to composite image with overlay, using original image:', error)
      // Fall back to original image if compositing fails
    }
  }

  const image = await loadImage(imageUrl, width)

  // If clipGroup is provided, create a clipping container
  if (clipGroup) {
    // Create a group to handle clipping - use original x,y
    const clipContainer = new Konva.Group({
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
    const boundaryRect = new Konva.Rect({
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
    const imageGroup = new Konva.Group({
      x: 0,
      y: 0,
      listening: false,
    })

    // Create image with proper positioning
    const konvaImage = new Konva.Image({
      image: image,
      listening: false,
    })

    // Apply dimensions from clipGroup state, fallback to given width/height
    // On storefront the image node is placed within the container using
    // absolute metrics; for print, we want to reproduce that placement inside
    // the clip container whose size is the container width/height above.
    const imgW = (clipGroup.absoluteWidth as number) || width
    const imgH = (clipGroup.absoluteHeight as number) || height
    konvaImage.width(imgW)
    konvaImage.height(imgH)

    // Apply position from clipGroup state - top-left based; fallback to (0,0)
    // The absoluteX/Y are relative to the same container used on storefront.
    const imgX = (clipGroup.absoluteX as number) ?? 0
    const imgY = (clipGroup.absoluteY as number) ?? 0
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
    if (maskConfig && maskConfig.src) {
      const processedMask = await buildProcessedMaskCanvas(maskConfig, clipWidth, clipHeight)
      if (processedMask) {
        const maskNode = new Konva.Image({
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
      }
    }

    // Add the imageGroup first, then cache the group with a safe pixel ratio
    clipContainer.add(imageGroup)

    const safePR = computeSafeCachePixelRatio(clipWidth, clipHeight, false)
    imageGroup.cache({ pixelRatio: safePR })

    // Add to target container
    targetContainer.add(clipContainer)

    // Ensure boundary is visible above mask
    boundaryRect.moveToTop()

    return clipContainer
  }

  // Standard image without clipping - isolate image + mask inside a group
  const imageGroup = new Konva.Group({
    x,
    y,
    listening: false,
  })
  const konvaImage = new Konva.Image({
    x: 0,
    y: 0,
    image: image,
    width,
    height,
    rotation,
    listening: false,
  })
  // Avoid caching the child when we will cache the parent group

  // Add to content group if exists, otherwise main layer
  imageGroup.add(konvaImage)

  // Static mask overlay for non-clipped image
  if (maskConfig && maskConfig.src) {
    const processedMask = await buildProcessedMaskCanvas(maskConfig, width, height)
    if (processedMask) {
      const maskNode = new Konva.Image({
        image: processedMask,
        x: 0,
        y: 0,
        width,
        height,
        listening: false,
        globalCompositeOperation: maskConfig.globalCompositeOperation || 'destination-in',
      })
      imageGroup.add(maskNode)
    }
  }

  // Cache the group so composite is scoped to image + mask only
  const safePR = computeSafeCachePixelRatio(width, height, false)
  imageGroup.cache({ pixelRatio: safePR })
  targetContainer.add(imageGroup)

  return konvaImage
}
