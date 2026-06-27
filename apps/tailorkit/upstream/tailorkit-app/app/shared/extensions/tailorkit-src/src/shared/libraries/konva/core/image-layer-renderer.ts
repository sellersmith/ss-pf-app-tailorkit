import Konva from 'konva'
import type { KonvaEditorState } from '../../../../assets/handlers/event-handlers/image-editor'
import { computeSafeCachePixelRatio } from '../effects/utils'
import { compositeImageWithOverlay, type OverlayMetadata } from '../../../utils/overlay-compositor'
import type { CanvasContext, IMaskConfig } from './types'
import type { TemplateGroupManager } from './template-group-manager'

/**
 * Options for adding an image layer
 */
export interface AddImageLayerOptions {
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

/**
 * Handles image layer rendering for the Konva canvas
 */
export class ImageLayerRenderer {
  private context: CanvasContext
  private groupManager: TemplateGroupManager

  constructor(context: CanvasContext, groupManager: TemplateGroupManager) {
    this.context = context
    this.groupManager = groupManager
  }

  /**
   * Load and cache an image from URL
   */
  public async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.context.imageCache.has(url)) {
      this.context.metrics.cacheHits++
      return this.context.imageCache.get(url)!
    }

    this.context.metrics.cacheMisses++
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'Anonymous'
      image.src = url

      image.onload = () => {
        this.context.imageCache.set(url, image)
        resolve(image)
      }

      image.onerror = reject
    })
  }

  /**
   * Build a processed mask canvas sized to the target dimensions.
   * The mask luminance is converted to alpha (respecting invert and smoothing).
   */
  private async buildProcessedMaskCanvas(
    maskConfig: IMaskConfig,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement | null> {
    try {
      const { src: maskSrc, invert = false, smoothEdges = true, smoothingStrength = 0.25 } = maskConfig

      // Create unique cache key
      const cacheKey = `${maskSrc}-${width}-${height}-${invert}-processed-${smoothEdges}-${smoothingStrength}`
      if (this.context.maskCanvasCache.has(cacheKey)) {
        return this.context.maskCanvasCache.get(cacheKey)!
      }

      // Load mask image
      const maskImage = await this.loadImage(maskSrc)

      // Create and process mask canvas
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = width
      maskCanvas.height = height
      const maskCtx = maskCanvas.getContext('2d')
      if (!maskCtx) return null

      maskCtx.clearRect(0, 0, width, height)
      maskCtx.drawImage(maskImage, 0, 0, width, height)

      const imageData = maskCtx.getImageData(0, 0, width, height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        const alpha = invert ? gray : 255 - gray
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = alpha
      }
      maskCtx.putImageData(imageData, 0, 0)

      if (smoothEdges) {
        this.applyCanvasSmoothing(maskCtx, maskCanvas, smoothingStrength)
      }

      // Cache and return
      this.context.maskCanvasCache.set(cacheKey, maskCanvas)
      return maskCanvas
    } catch (error) {
      console.error('Error building processed mask canvas:', error)
      return null
    }
  }

  /**
   * Apply smoothing to mask canvas
   */
  private applyCanvasSmoothing(
    maskCtx: CanvasRenderingContext2D,
    maskCanvas: HTMLCanvasElement,
    strength: number
  ): void {
    try {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = maskCanvas.width
      tempCanvas.height = maskCanvas.height
      const tempCtx = tempCanvas.getContext('2d')

      if (tempCtx) {
        // Copy current state to temp canvas
        tempCtx.drawImage(maskCanvas, 0, 0)

        // Apply smoothing
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        maskCtx.imageSmoothingEnabled = true
        maskCtx.imageSmoothingQuality = 'high'

        // Draw with slight scaling for smoothing effect
        const scale = 1 + strength * 0.02
        const offsetX = ((scale - 1) / 2) * maskCanvas.width
        const offsetY = ((scale - 1) / 2) * maskCanvas.height

        maskCtx.drawImage(tempCanvas, -offsetX, -offsetY, maskCanvas.width * scale, maskCanvas.height * scale)
      }
    } catch (error) {
      console.warn('Canvas smoothing failed:', error)
    }
  }

  /**
   * Create final masked image by combining original image with processed mask
   */
  private createMaskedImage(
    originalImage: HTMLImageElement,
    maskCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    globalCompositeOperation: string,
    smoothEdges: boolean,
    smoothingStrength: number
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw original image
      ctx.save()
      ctx.imageSmoothingEnabled = smoothEdges
      if (smoothEdges) {
        ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
      }
      ctx.drawImage(originalImage, 0, 0, width, height)
      ctx.restore()

      // Apply mask
      ctx.save()
      ctx.globalCompositeOperation = globalCompositeOperation as GlobalCompositeOperation
      ctx.imageSmoothingEnabled = smoothEdges
      if (smoothEdges) {
        ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
      }
      ctx.drawImage(maskCanvas, 0, 0)
      ctx.restore()

      // Convert to HTMLImageElement
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }

        const url = URL.createObjectURL(blob)
        const maskedImg = new Image()
        maskedImg.crossOrigin = 'anonymous'
        maskedImg.onload = () => {
          URL.revokeObjectURL(url)
          resolve(maskedImg)
        }
        maskedImg.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load masked image'))
        }
        maskedImg.src = url
      }, 'image/png')
    })
  }

  /**
   * Add an image layer to the canvas
   */
  public async addImageLayer(options: AddImageLayerOptions): Promise<Konva.Image | Konva.Group> {
    const { url, x, y, width, height, rotation = 0, maskConfig, clipGroup, overlay } = options

    let imageUrl = url

    // If overlay data is provided, composite the image with the SVG overlay first
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
      }
    }

    const image = await this.loadImage(imageUrl)

    // If clipGroup is provided, create a clipping container
    if (clipGroup) {
      return this.createClippedImageLayer(image, x, y, width, height, rotation, maskConfig, clipGroup)
    }

    // Standard image without clipping
    return this.createStandardImageLayer(image, x, y, width, height, rotation, maskConfig)
  }

  /**
   * Create a clipped image layer
   */
  private async createClippedImageLayer(
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    maskConfig: IMaskConfig | undefined,
    clipGroup: KonvaEditorState
  ): Promise<Konva.Group> {
    // Create a group to handle clipping
    const clipContainer = new Konva.Group({
      x,
      y,
      rotation: rotation,
    })

    const clipWidth = width
    const clipHeight = height

    // Apply clipFunc to create the clipping boundary
    clipContainer.clipFunc(ctx => {
      ctx.beginPath()
      ctx.rect(0, 0, clipWidth, clipHeight)
      ctx.closePath()
    })

    // Create the visible boundary rectangle
    const boundaryRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: clipWidth,
      height: clipHeight,
      fill: 'transparent',
      listening: false,
    })
    clipContainer.add(boundaryRect)

    // Create an isolated group to contain image + mask
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

    // Apply dimensions from clipGroup state
    const imgW = (clipGroup.absoluteWidth as number) || width
    const imgH = (clipGroup.absoluteHeight as number) || height
    konvaImage.width(imgW)
    konvaImage.height(imgH)

    // Apply position from clipGroup state
    const imgX = (clipGroup.absoluteX as number) ?? 0
    const imgY = (clipGroup.absoluteY as number) ?? 0
    konvaImage.x(imgX)
    konvaImage.y(imgY)

    // Apply rotation to the image if specified in clipGroup
    if (clipGroup.rotation !== undefined) {
      konvaImage.rotation(clipGroup.rotation)
    }

    imageGroup.add(konvaImage)

    // If a mask is provided, overlay a static mask node
    if (maskConfig && maskConfig.src) {
      const processedMask = await this.buildProcessedMaskCanvas(maskConfig, clipWidth, clipHeight)
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
        imageGroup.add(maskNode)
      }
    }

    clipContainer.add(imageGroup)

    const safePR = computeSafeCachePixelRatio(clipWidth, clipHeight, false)
    imageGroup.cache({ pixelRatio: safePR })

    // Add to target container
    const targetContainer = this.groupManager.getTargetContainer()
    targetContainer.add(clipContainer)

    // Ensure boundary is visible above mask
    boundaryRect.moveToTop()

    return clipContainer
  }

  /**
   * Create a standard image layer without clipping
   */
  private async createStandardImageLayer(
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    maskConfig: IMaskConfig | undefined
  ): Promise<Konva.Image> {
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

    const targetContainer = this.groupManager.getTargetContainer()
    imageGroup.add(konvaImage)

    // Static mask overlay for non-clipped image
    if (maskConfig && maskConfig.src) {
      const processedMask = await this.buildProcessedMaskCanvas(maskConfig, width, height)
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

  /**
   * Clear all image and mask caches
   */
  public clearCache(): void {
    this.context.imageCache.clear()
    this.context.maskCanvasCache.clear()
    this.context.metrics.cacheHits = 0
    this.context.metrics.cacheMisses = 0
  }
}
