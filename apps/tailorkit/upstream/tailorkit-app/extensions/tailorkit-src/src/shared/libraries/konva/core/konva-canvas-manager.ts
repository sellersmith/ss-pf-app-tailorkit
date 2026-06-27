import Konva from 'konva'
import type { StageConfig } from 'konva/lib/Stage'
import { addTextLayer as addTextLayerFn, type TextLayerProps } from '../text'
import { addImageLayer as addImageLayerFn, type ImageLayerProps } from '../image'
import { getShopifyImageInSpecificWidth } from '../../../../assets/fns/shopify-image-url'
import { isIOS } from '../../../../assets/utils/devices'

export interface IMaskConfig {
  src: string
  invert?: boolean
  globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
  smoothEdges?: boolean
  smoothingStrength?: number
}

interface KonvaCanvasConfig {
  width: number
  height: number
  pixelRatio?: number
  /**
   * Whether to automatically resize the canvas when the parent container is resized
   * DO NOT SET THIS VARIABLE TO TRUE IF WE NEED TO GET ORIGINAL SIZE OF THE CANVAS
   * @default false | undefined
   */
  autoResize?: boolean
  /** @deprecated */
  ratio?: number
  containerId: StageConfig['container']
  printAreaId?: string
}

interface PerformanceMetrics {
  fps: number
  renderTime: number
  layerCount: number
  cacheHits: number
  cacheMisses: number
}

interface ClippingGroup extends Konva.Group {
  contentGroup: Konva.Group
}

export class KonvaCanvasManager {
  private stage!: Konva.Stage
  private mainLayer!: Konva.Layer
  private config: KonvaCanvasConfig
  private imageCache: Map<string, HTMLImageElement>
  private lastFrameTime: number
  private metrics: PerformanceMetrics
  private frameCount: number
  private lastFpsUpdate: number
  private originalWidth: number
  private originalHeight: number
  private currentGroup: ClippingGroup | null = null
  private containerResizeObserver: ResizeObserver | null = null
  private parentResizeObserver: ResizeObserver | null = null
  private maskCanvasCache: Map<string, HTMLCanvasElement> = new Map()
  private originalKonvaPixelRatio: number | undefined

  constructor(config: KonvaCanvasConfig) {
    this.config = config
    this.originalWidth = config.width
    this.originalHeight = config.height
    this.imageCache = new Map()
    this.maskCanvasCache = new Map()
    this.metrics = {
      fps: 0,
      renderTime: 0,
      layerCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }
    this.frameCount = 0
    this.lastFpsUpdate = performance.now()
    this.lastFrameTime = performance.now()

    this.initStage()
    this.initPerformanceMonitoring()

    if (this.config.autoResize) {
      this.initResizeHandler()
    }
  }

  /**
   * Get the target container for adding elements
   * @returns The target container (content group or main layer)
   */
  private getTargetContainer() {
    return this.currentGroup?.contentGroup || this.mainLayer
  }

  private initStage() {
    // Set pixelRatio if provided otherwise use device pixel ratio
    // Save original to restore in dispose() since Konva.pixelRatio is global
    if (this.config.pixelRatio) {
      this.originalKonvaPixelRatio = Konva.pixelRatio
      Konva.pixelRatio = this.config.pixelRatio
    }

    // Create stage with actual display dimensions
    this.stage = new Konva.Stage({
      container: this.config.containerId,
      width: this.config.width,
      height: this.config.height,
    })

    this.mainLayer = new Konva.Layer()
    this.stage.add(this.mainLayer)

    const container = this.stage.container()
    const printAreaId = this.config.printAreaId
    container.style.width = '100%'
    container.style.height = '100%'
    printAreaId && container.setAttribute('data-print-area', printAreaId)
    container.classList.add('emtlkit--canvas')

    if (this.config.autoResize) {
      // Use ResizeObserver to detect when container is added to DOM
      // and has proper dimensions
      this.containerResizeObserver = new ResizeObserver(() => {
        // Only run once when dimensions are non-zero
        const parent = container.parentElement
        if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
          this.updateSize()
          // Don't disconnect yet - we'll handle this in dispose()
        }
      })
      this.containerResizeObserver.observe(container)

      // Also run updateSize on initial load in case ResizeObserver misses it
      this.updateSize()
    }
  }

  private initPerformanceMonitoring() {
    this.stage.on('draw', () => {
      const currentTime = performance.now()

      this.frameCount++
      if (currentTime - this.lastFpsUpdate >= 1000) {
        this.metrics.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate))
        this.frameCount = 0
        this.lastFpsUpdate = currentTime
      }

      this.metrics.renderTime = currentTime - this.lastFrameTime
      this.lastFrameTime = currentTime
      this.metrics.layerCount = this.stage.find('Image, Text').length

      window.__tailorkit__.performance = this.metrics
    })
  }

  private initResizeHandler() {
    // Use ResizeObserver for more reliable resize detection
    const container = this.getContainer(this.config.containerId)
    if (container && container.parentElement) {
      this.parentResizeObserver = new ResizeObserver(() => {
        this.updateSize()
      })
      this.parentResizeObserver.observe(container.parentElement)
    }

    // Also keep window resize listener as a fallback
    window.addEventListener('resize', this.handleWindowResize)
  }

  private handleWindowResize = () => {
    this.updateSize()
  }

  private updateSize() {
    if (!this.config.containerId) {
      return
    }

    const containerId = this.config.containerId
    const container = this.getContainer(containerId)
    if (!container) {
      return
    }

    const parent = container.parentElement
    if (!parent) {
      return
    }

    // If parent has zero dimensions, it's not ready yet
    if (parent.clientWidth === 0 || parent.clientHeight === 0) {
      return
    }

    // Get parent dimensions
    const parentWidth = parent.clientWidth
    const parentHeight = parent.clientHeight

    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = parentWidth / this.originalWidth
    const scaleY = parentHeight / this.originalHeight
    const scale = Math.min(scaleX, scaleY)

    // Update container size
    const newWidth = this.originalWidth * scale
    const newHeight = this.originalHeight * scale

    container.style.width = `${newWidth}px`
    container.style.height = `${newHeight}px`

    // Center the container if needed
    container.style.margin = '0 auto'

    // Update stage size
    this.stage.width(newWidth)
    this.stage.height(newHeight)

    // Scale stage content
    this.stage.scale({ x: scale, y: scale })
    this.stage.batchDraw()
  }

  private async loadImage(url: string, width?: number): Promise<HTMLImageElement> {
    // Resolve display width: prefer caller-provided width, then canvas DOM width
    // (which clamps the request), then fall back to the raw URL.
    // For Shopify CDN images, appending `&width=N` triggers two beneficial
    // server-side behaviors:
    //   1. resize to the requested width (smaller payload, less GPU memory)
    //   2. transcode source format to a web-supported format — notably HEIC
    //      and HEIF uploads from iPhone photo libraries get served as JPG/PNG
    // Without this transform the raw `.heic` URL fails to render in Konva
    // even though Shopify's CDN sometimes returns PNG bytes — the browser's
    // image decoder behavior is inconsistent for mismatched extensions and
    // the iPhone-original sizes (e.g. 4032x3024) blow past the canvas budget.
    // This transform was present in the original Konva manager (pre-Aug 2025
    // refactor) and was inadvertently dropped during the move from
    // app/shared/extensions/.../assets/utils to shared/libraries/konva/core.
    // Use stage.container() — the mounted DOM div — to clamp by visible width.
    // stage.toCanvas() returns a detached offscreen canvas (no parentNode), so
    // its dimensions cannot be relied on for layout-relative sizing.
    // Multiply by devicePixelRatio so the requested source matches the retina
    // backing-store size. Without this, a modal whose CSS canvas is e.g. 296px
    // requests `&width=296` from the CDN and upscales 4× into the 1184px
    // backing, which also defeats the resolutionScale boost in
    // image/renderer.ts (relies on naturalWidth/layerWidth > 1).
    // iOS DPR caps at 2 to match the Safari ~67M-pixel canvas-area limit
    // already enforced in init-canvas.ts (iPhone retina reports dpr=3).
    const containerEl = this.stage?.container()
    const baseWidth = width ? (containerEl?.offsetWidth ? Math.min(containerEl.offsetWidth, width) : width) : undefined
    const rawDpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    const effectiveDpr = isIOS() ? Math.min(rawDpr, 2) : rawDpr
    const displayWidth = baseWidth ? Math.ceil(baseWidth * effectiveDpr) : undefined
    const src = displayWidth ? getShopifyImageInSpecificWidth(url, displayWidth) : url

    // Cache by transformed src so different requested widths get distinct entries
    if (this.imageCache.has(src)) {
      this.metrics.cacheHits++
      return this.imageCache.get(src)!
    }

    this.metrics.cacheMisses++
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'Anonymous'

      image.src = src

      image.onload = () => {
        this.imageCache.set(src, image)
        resolve(image)
      }

      image.onerror = reject
    })
  }

  /**
   * Build a processed mask canvas sized to the target dimensions. The mask
   * luminance is converted to alpha (respecting invert and smoothing), which
   * can be used as a static overlay via globalCompositeOperation.
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
      if (this.maskCanvasCache.has(cacheKey)) {
        return this.maskCanvasCache.get(cacheKey)!
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
      this.maskCanvasCache.set(cacheKey, maskCanvas)
      return maskCanvas
    } catch (error) {
      console.error('Error building processed mask canvas:', error)
      return null
    }
  }

  /**
   * Apply smoothing to mask canvas
   */
  private applyCanvasSmoothing(maskCtx: CanvasRenderingContext2D, maskCanvas: HTMLCanvasElement, strength: number) {
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

  public getStage(): Konva.Stage {
    return this.stage
  }

  public getMainLayer(): Konva.Layer {
    return this.mainLayer
  }

  public getContainer(containerId: KonvaCanvasConfig['containerId']): HTMLDivElement | null {
    if (!containerId) return null

    return containerId instanceof HTMLDivElement
      ? containerId
      : (document.getElementById(containerId) as HTMLDivElement | null)
  }

  public startTemplateGroup(
    template: { l: number; t: number; r: number },
    mask?: { w: number; h: number; l: number; t: number; r: number },
    scale?: { x?: number; y?: number }
  ) {
    if (mask) {
      // Cast the group to our custom interface
      this.currentGroup = new Konva.Group({
        name: 'GROUP_LAYER_NAME',
        clipFunc: ctx => {
          ctx.save()
          ctx.translate(mask.l, mask.t)
          ctx.rotate((mask.r * Math.PI) / 180)
          ctx.rect(0, 0, mask.w, mask.h)
          ctx.restore()
        },
      }) as ClippingGroup

      this.mainLayer.add(this.currentGroup)

      // Create a content group inside the clipping group to handle template position and rotation
      const contentGroup = new Konva.Group({
        x: template.l,
        y: template.t,
        rotation: template.r,
      })

      this.currentGroup.add(contentGroup)
      this.currentGroup.contentGroup = contentGroup

      // Apply optional scale at content group level to mirror admin renderer behavior
      if (scale && (typeof scale.x === 'number' || typeof scale.y === 'number')) {
        const sx = typeof scale.x === 'number' ? scale.x : 1
        const sy = typeof scale.y === 'number' ? scale.y : 1
        contentGroup.scale({ x: sx, y: sy })
      }

      // Create invisible rectangle that represents the mask
      const maskRect = new Konva.Rect({
        name: 'LAYER_MASK_NAME',
        x: mask.l,
        y: mask.t,
        width: mask.w,
        height: mask.h,
        rotation: mask.r,
        fill: 'rgba(0, 0, 0, 0)', // invisible
        listening: false,
      })

      this.currentGroup.add(maskRect)
    } else {
      // If there's no mask, we still need to create a group for the template!
      this.currentGroup = new Konva.Group({
        name: 'GROUP_LAYER_NAME',
        x: template.l,
        y: template.t,
        rotation: template.r,
      }) as ClippingGroup

      this.mainLayer.add(this.currentGroup)

      // Store the group itself as the content group since we don't need a separate one
      this.currentGroup.contentGroup = this.currentGroup

      // Apply optional scale on the group directly
      if (scale && (typeof scale.x === 'number' || typeof scale.y === 'number')) {
        const sx = typeof scale.x === 'number' ? scale.x : 1
        const sy = typeof scale.y === 'number' ? scale.y : 1
        this.currentGroup.scale({ x: sx, y: sy })
      }
    }

    return this.currentGroup
  }

  public endTemplateGroup() {
    this.currentGroup = null
    this.mainLayer.batchDraw()
  }

  public async addImageLayer(props: ImageLayerProps): Promise<Konva.Image | Konva.Group> {
    return addImageLayerFn(this.getTargetContainer(), props, {
      loadImage: (url, width) => this.loadImage(url, width),
      buildProcessedMaskCanvas: (maskConfig, width, height) => this.buildProcessedMaskCanvas(maskConfig, width, height),
    })
  }

  public async addTextLayer(props: TextLayerProps): Promise<Konva.Text | Konva.TextPath | Konva.Image | Konva.Group> {
    return addTextLayerFn(this.getTargetContainer(), props)
  }

  public clearCache() {
    this.imageCache.clear()
    this.maskCanvasCache.clear()
    this.metrics.cacheHits = 0
    this.metrics.cacheMisses = 0
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  public clear() {
    this.currentGroup = null
    this.mainLayer.destroyChildren()
    // Skip batchDraw() here — painting the blank frame causes a visible flash.
    // The next addImageLayer/addTextLayer call will trigger draw() with new content,
    // so the canvas transitions directly from old content → new content without a blank frame.
  }

  public dispose() {
    // Clean up resize observers
    if (this.containerResizeObserver) {
      this.containerResizeObserver.disconnect()
      this.containerResizeObserver = null
    }

    if (this.parentResizeObserver) {
      this.parentResizeObserver.disconnect()
      this.parentResizeObserver = null
    }

    // Remove window event listener
    window.removeEventListener('resize', this.handleWindowResize)

    // Restore original Konva.pixelRatio if we modified it
    if (this.originalKonvaPixelRatio !== undefined) {
      Konva.pixelRatio = this.originalKonvaPixelRatio
    }

    // Clear image cache
    this.clearCache()

    // Destroy Konva stage
    if (this.stage) {
      this.stage.destroy()
    }
  }
}
