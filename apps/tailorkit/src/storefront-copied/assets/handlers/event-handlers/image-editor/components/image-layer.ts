import type KonvaType from 'konva'
import type {
  KonvaEditorConfig,
  KonvaEditorState,
  KonvaEditorUpdateParams,
  MinimalTransformState,
} from '../types/editor-types'
import type { StageManager } from './stage-manager'
import { dispatchTransformEvent } from '../utils/event-utils'
import type { HistoryManager } from '../state/history-manager'
import type { ShapeAttrs } from '../utils/stage'
import { getCenter, getScaledDimensions, getTransformedTopLeft } from '../utils/stage'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import type { Context } from 'konva/lib/Context'

/**
 * Manages the image layer, clipping boundary, and image node
 *
 * COORDINATE SYSTEM EXPLANATION:
 * - The clipGroup is positioned at the top-left of the stage container with an offset
 * - The image node uses top-left positioning (no center offsets)
 * - An image at position (0,0) will be at the top-left of the clipGroup boundary
 * - For saved states, exact coordinates must be preserved including 0 values
 * - For new images, we calculate position to center it in the boundary
 */
export class ImageLayer {
  private Konva: typeof KonvaType

  // Konva nodes
  private clipGroup: KonvaType.Group | null = null
  private imageNode: KonvaType.Image | null = null
  private maskNode: KonvaType.Image | null = null
  private boundaryRect: KonvaType.Rect | null = null

  displayScale: number = 1

  // Image dimensions
  private originalDimensions = { width: 0, height: 0 }
  private scaledWidth = 0
  private scaledHeight = 0

  // Current image dimensions
  private currentWidth = 0
  private currentHeight = 0
  private zoomPercentage = 100

  // Mask configuration
  private maskConfig: {
    src: string
    invert?: boolean
    globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
    smoothEdges?: boolean
    smoothingStrength?: number
  } | null = null

  // Memory management for blob URLs
  private blobUrls = new Set<string>()

  // State flags
  private isDestroyed = false

  /**
   * Constructor
   */
  constructor(
    private stageManager: StageManager,
    private historyManager: HistoryManager,
    Konva: typeof KonvaType
  ) {
    this.Konva = Konva
  }

  /**
   * Initialize the image layer
   */
  public async initialize(
    imageElement: HTMLImageElement,
    config: KonvaEditorConfig,
    transformerConfig?: Partial<TransformerConfig>
  ): Promise<boolean> {
    if (this.isDestroyed) return false

    // Store mask configuration
    this.maskConfig = config.maskConfig || null

    const { displayScale, originalDimensions, scaledWidth, scaledHeight } = getScaledDimensions(
      this.stageManager,
      imageElement,
      config
    )

    this.displayScale = displayScale
    this.originalDimensions = originalDimensions
    this.scaledWidth = scaledWidth
    this.scaledHeight = scaledHeight

    // Create outer clipping group (the print area/layer boundary)
    this.clipGroup = new this.Konva.Group({
      x: 0,
      y: 0,
      clipFunc: (ctx: Context) => {
        ctx.beginPath()
        ctx.rect(0, 0, this.scaledWidth, this.scaledHeight)
        ctx.closePath()
      },
      rotation: config.rotation,
    })

    // Add clipGroup to stage
    this.stageManager.addToLayer(this.clipGroup)

    // Add a visible boundary rectangle to show the clipping area
    // NOTE: We will move this to top after creating image and mask so the stroke
    // is not affected by any globalCompositeOperation used by the mask.
    this.boundaryRect = new this.Konva.Rect({
      x: 0,
      y: 0,
      width: this.scaledWidth,
      height: this.scaledHeight,
      stroke: '#999',
      strokeWidth: 3,
      dash: [5, 5],
      fill: 'transparent',
      listening: false,
    })
    this.clipGroup.add(this.boundaryRect)

    // Auto-size the image to fit within the boundary
    let initialWidth = this.originalDimensions.width
    let initialHeight = this.originalDimensions.height

    // Default to centering the image in the boundary
    let initialX = (this.scaledWidth - initialWidth) / 2
    let initialY = (this.scaledHeight - initialHeight) / 2

    // Check if we have saved state to restore
    // All saved state values must be present for reliable restoration
    const hasSavedState
      = config.initialWidth !== undefined
      && config.initialHeight !== undefined
      && config.initialX !== undefined
      && config.initialY !== undefined

    if (hasSavedState) {
      // Use saved dimensions and position - use nullish coalescing to preserve 0 values
      initialWidth = config.initialWidth!
      initialHeight = config.initialHeight!
      initialX = config.initialX ?? 0
      initialY = config.initialY ?? 0
    } else {
      // Auto-size logic for new images
      if (initialWidth > this.scaledWidth * 1.5 || initialHeight > this.scaledHeight * 1.5) {
        const imageScaleX = this.scaledWidth / initialWidth
        const imageScaleY = this.scaledHeight / initialHeight
        const imageScale = Math.min(imageScaleX, imageScaleY) * 0.9 // 90% of fit size

        initialWidth *= imageScale
        initialHeight *= imageScale

        // Recalculate position to center the image in the boundary
        initialX = (this.scaledWidth - initialWidth) / 2
        initialY = (this.scaledHeight - initialHeight) / 2
      }
    }

    // Set current dimensions
    this.currentWidth = initialWidth
    this.currentHeight = initialHeight

    // Set initial zoom percentage (ensure it's stored as percentage 1-100)
    this.zoomPercentage = Math.round((initialWidth / this.originalDimensions.width) * 100)

    // Create image node immediately with original image (synchronous)
    this.imageNode = new this.Konva.Image({
      image: imageElement,
      x: initialX,
      y: initialY,
      width: initialWidth,
      height: initialHeight,
      rotation: config.initialRotation || 0,
      name: 'uploadedImage',
      draggable: transformerConfig?.draggable ?? true,
      selectable: transformerConfig?.draggable ?? true,
      listening: true,
      // No offsetX/Y as we're using top-left positioning
    })

    this.clipGroup.add(this.imageNode)

    // Create a persistent mask node that stays fixed to the boundary.
    // This keeps the mask static while the uploaded image is resized or dragged.
    if (this.maskConfig) {
      try {
        const maskCanvas = await this.createProcessedMaskCanvas(this.scaledWidth, this.scaledHeight)

        if (maskCanvas) {
          this.maskNode = new this.Konva.Image({
            image: maskCanvas,
            x: 0,
            y: 0,
            width: this.scaledWidth,
            height: this.scaledHeight,
            listening: false,
            name: 'staticMask',
            // Use provided composition mode; default to destination-in
            globalCompositeOperation: this.maskConfig.globalCompositeOperation || 'destination-in',
          })

          // Ensure the mask is rendered after the uploaded image
          this.clipGroup.add(this.maskNode)
        }
      } catch (error) {
        console.error('Failed to create mask node:', error)
      }
    }

    // Ensure boundary stroke is visible above mask/image
    if (this.boundaryRect) {
      this.boundaryRect.moveToTop()
    }

    return true
  }

  /**
   * Change image zoom by percentage
   * @param zoomChange Percentage change (positive or negative)
   * @returns The new zoom percentage
   */
  public zoomImage(zoomChange: number, skipHistory = false): number {
    if (this.isDestroyed || !this.imageNode) {
      return this.zoomPercentage
    }

    // Calculate new dimensions
    const newZoomPercentage = this.zoomPercentage + zoomChange
    const scaleFactor = newZoomPercentage / 100

    const newWidth = this.originalDimensions.width * scaleFactor
    const newHeight = this.originalDimensions.height * scaleFactor

    // Don't allow dimensions to be smaller than minimum size
    if (newWidth < 20 || newHeight < 20) {
      return this.zoomPercentage
    }

    // Get current center position of the image
    const currentCenterX = this.imageNode.x() + this.currentWidth / 2
    const currentCenterY = this.imageNode.y() + this.currentHeight / 2

    // Update current dimensions
    this.currentWidth = newWidth
    this.currentHeight = newHeight
    this.zoomPercentage = newZoomPercentage

    // Calculate new position to maintain the center point
    const newX = currentCenterX - newWidth / 2
    const newY = currentCenterY - newHeight / 2

    // Apply new dimensions and position to image
    this.imageNode.width(newWidth)
    this.imageNode.height(newHeight)
    this.imageNode.position({
      x: newX,
      y: newY,
    })

    // Force transformer update if available
    const stage = this.stageManager.getStage()
    if (stage) {
      // This will trigger transformer update
      stage.fire('contentChange', { target: this.imageNode })
      this.stageManager.redraw()
    }

    // Dispatch transform event
    const container = this.stageManager.getContainer()
    if (container && !skipHistory) {
      dispatchTransformEvent(container, this.getState())
    }

    // Save state to history
    this.saveStateToHistory(skipHistory)

    return this.zoomPercentage
  }

  /**
   * Auto-fit the image to the boundary
   * @returns The calculated zoom percentage
   */
  public autoFitImageToBoundary(skipHistory = false): number {
    if (this.isDestroyed || !this.imageNode) {
      return this.zoomPercentage
    }

    // Auto-fit the image to the boundary
    const scaleX = this.scaledWidth / this.originalDimensions.width
    const scaleY = this.scaledHeight / this.originalDimensions.height

    // Decrease for small padding if needed
    const scaleFactor = 1
    const scale = Math.min(scaleX, scaleY) * scaleFactor

    // Calculate new dimensions
    const newWidth = this.originalDimensions.width * scale
    const newHeight = this.originalDimensions.height * scale

    // Update current dimensions
    this.currentWidth = newWidth
    this.currentHeight = newHeight

    // Store zoom as percentage value (e.g. 90 means 90%)
    this.zoomPercentage = Math.round(scale * 100)

    // Center the image in the boundary
    const centerX = (this.scaledWidth - newWidth) / 2
    const centerY = (this.scaledHeight - newHeight) / 2

    this.imageNode.position({
      x: centerX,
      y: centerY,
    })

    this.imageNode.width(newWidth)
    this.imageNode.height(newHeight)

    // Reset rotation
    this.imageNode.rotation(0)

    // Force transformer update if available
    const stage = this.stageManager.getStage()
    if (stage) {
      // This will trigger transformer update
      stage.fire('contentChange', { target: this.imageNode })
      this.stageManager.redraw()
    }

    // Dispatch transform event
    const container = this.stageManager.getContainer()
    if (container && !skipHistory) {
      dispatchTransformEvent(container, this.getState())
    }

    // Save state to history
    this.saveStateToHistory(skipHistory)

    return this.zoomPercentage
  }

  /**
   * Update the image editor based on UI controls
   */
  public updateEditor(params: KonvaEditorUpdateParams): void {
    if (this.isDestroyed || !this.imageNode || this.historyManager.inHistoryOperation()) {
      return
    }

    // 1. Get current attributes from the visual node
    const attrs: ShapeAttrs = {
      x: this.imageNode.x(),
      y: this.imageNode.y(),
      width: this.imageNode.width(),
      height: this.imageNode.height(),
      rotation: this.imageNode.rotation(),
    }

    // 2. Calculate the current geometric center
    const center = getCenter(attrs)

    // 3. Compute new desired dimensions and rotation
    const newWidth = this.originalDimensions.width * (params.zoom / 100)
    const newHeight = this.originalDimensions.height * (params.zoom / 100)
    const newRotation = params.rotation

    // 4. Compute new top-left position to keep the geometric center fixed
    const newPos = getTransformedTopLeft(center, newWidth, newHeight, newRotation)

    // 5. Apply new attributes to the Konva node
    this.imageNode.position({ x: newPos.x, y: newPos.y })
    this.imageNode.width(newWidth)
    this.imageNode.height(newHeight)
    this.imageNode.rotation(newRotation)

    this.currentWidth = newWidth
    this.currentHeight = newHeight
    this.zoomPercentage = params.zoom

    // Force transformer update if available
    const stage = this.stageManager.getStage()
    if (stage) {
      stage.fire('contentChange', { target: this.imageNode })
      this.stageManager.redraw()
    }

    // Save state to history
    setTimeout(() => {
      this.saveStateToHistory()
    }, 50)
  }

  /**
   * Reset the editor to initial state
   */
  public resetEditor(): void {
    if (this.isDestroyed || !this.imageNode || this.historyManager.inHistoryOperation()) {
      return
    }

    // Auto-fit image
    this.autoFitImageToBoundary(false)

    // Redraw
    this.stageManager.redraw()

    // Save reset state to history
    setTimeout(() => {
      this.saveStateToHistory()
    }, 50)
  }

  /**
   * Get the current state of the editor
   */
  public getState(): KonvaEditorState {
    if (this.isDestroyed || !this.imageNode) {
      return {
        zoom: this.zoomPercentage,
        rotation: 0,
        transform: 'fill',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        absoluteWidth: 0,
        absoluteHeight: 0,
      }
    }

    // Get current zoom percentage - ensure it's always stored as percentage (1-100)
    const zoom = this.zoomPercentage

    // Get rotation and round to nearest integer
    const rotation = Math.round(this.imageNode.rotation() || 0)

    // Get position and dimensions directly from the image node
    const x = this.imageNode.x()
    const y = this.imageNode.y()
    const width = this.imageNode.width()
    const height = this.imageNode.height()

    // Calculate absolute (unscaled) dimensions and positions
    const absoluteWidth = width / this.displayScale
    const absoluteHeight = height / this.displayScale
    const absoluteX = x / this.displayScale
    const absoluteY = y / this.displayScale

    return {
      zoom,
      rotation,
      transform: 'fill',
      x,
      y,
      width,
      height,
      absoluteWidth,
      absoluteHeight,
      absoluteX,
      absoluteY,
    }
  }

  /**
   * Save current state to history
   */
  private saveStateToHistory(skipHistory = false): void {
    if (this.isDestroyed || !this.imageNode) {
      return
    }

    // Create a minimal state with only primitive values
    const state: MinimalTransformState = {
      x: this.imageNode.x(),
      y: this.imageNode.y(),
      scaleX: 1, // We're not using scale anymore
      scaleY: 1, // We're not using scale anymore
      rotation: this.imageNode.rotation(),
      // Store current image dimensions
      width: this.currentWidth,
      height: this.currentHeight,
    }

    // Save to history manager
    this.historyManager.saveState(state, skipHistory)
  }

  /**
   * Apply a state from history
   */
  public applyState(state: MinimalTransformState): void {
    if (this.isDestroyed || !this.imageNode) {
      return
    }

    // Apply dimensions first
    if (state.width && state.height) {
      this.currentWidth = state.width
      this.currentHeight = state.height

      // Calculate zoom percentage from width
      this.zoomPercentage = Math.round((state.width / this.originalDimensions.width) * 100)

      // Set dimensions
      this.imageNode.width(state.width)
      this.imageNode.height(state.height)
    }

    // Apply rotation
    this.imageNode.rotation(state.rotation)

    // Apply position
    // Use nullish coalescing to preserve 0 coordinates
    this.imageNode.position({
      x: state.x ?? 0,
      y: state.y ?? 0,
    })

    // Force stage update to ensure visual correctness
    this.stageManager.redraw()

    // Force transformer update if available
    const stage = this.stageManager.getStage()
    if (stage) {
      // This will trigger transformer update
      stage.fire('contentChange', { target: this.imageNode })
      stage.batchDraw()
    }

    // Dispatch transform event
    const container = this.stageManager.getContainer()
    if (container) {
      dispatchTransformEvent(container, this.getState())
    }
  }

  /**
   * Get image node for transformer
   */
  public getImageNode(): KonvaType.Image | null {
    return this.imageNode
  }

  /**
   * Update clip group position after container resize
   */
  public updatePositionAfterResize(): void {
    if (this.isDestroyed || !this.clipGroup) return

    // Get current rotation value
    const rotation = this.clipGroup.rotation()

    // Calculate center of container
    const containerCenterX = this.stageManager.containerWidth / 2
    const containerCenterY = this.stageManager.containerHeight / 2

    // Position the clip group at the center of the container
    this.clipGroup.position({
      x: containerCenterX,
      y: containerCenterY,
    })

    // Set offset to half the width/height to make rotation happen around center
    this.clipGroup.offset({
      x: this.scaledWidth / 2,
      y: this.scaledHeight / 2,
    })

    // Set rotation
    this.clipGroup.rotation(rotation)

    this.stageManager.redraw()
  }

  /**
   * Load image from URL and convert to blob URL to prevent tainted canvas
   */
  private async loadImage(url: string): Promise<HTMLImageElement> {
    try {
      const imageUrl = new URL(url, window.location.href)
      const currentUrl = new URL(window.location.href)

      // For cross-origin images, fetch and convert to blob URL to prevent tainted canvas
      if (imageUrl.origin !== currentUrl.origin) {
        return await this.loadImageAsBlob(url)
      }
      return await this.loadImageDirect(url)
    } catch (e) {
      return this.loadImageAsBlob(url)
    }
  }

  /**
   * Load image directly (for same-origin images)
   */
  private loadImageDirect(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = document.createElement('img') as HTMLImageElement

      image.onload = () => {
        resolve(image)
      }
      image.onerror = error => {
        console.error('Failed to load image directly:', url, error)
        reject(error)
      }
      image.src = url
    })
  }

  /**
   * Load image as blob URL to prevent tainted canvas issues
   */
  private async loadImageAsBlob(url: string): Promise<HTMLImageElement> {
    try {
      // Fetch the image as blob
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()

      // Create blob URL
      const blobUrl = URL.createObjectURL(blob)
      this.blobUrls.add(blobUrl)

      return new Promise((resolve, reject) => {
        const image = document.createElement('img') as HTMLImageElement

        image.onload = () => {
          URL.revokeObjectURL(blobUrl)
          this.blobUrls.delete(blobUrl)
          resolve(image)
        }
        image.onerror = error => {
          console.error('Failed to load blob image:', error)
          URL.revokeObjectURL(blobUrl)
          this.blobUrls.delete(blobUrl)
          reject(error)
        }
        image.src = blobUrl
      })
    } catch (error) {
      console.error('Failed to fetch image as blob:', url, error)
      throw error
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
   * Build a processed mask canvas sized to the boundary. This converts the
   * mask image luminance to alpha (respecting invert and smoothing options)
   * so we can use it as a static compositing source in Konva.
   */
  private async createProcessedMaskCanvas(width: number, height: number): Promise<HTMLCanvasElement | null> {
    if (!this.maskConfig) return null

    const { src: maskSrc, invert = false, smoothEdges = true, smoothingStrength = 0.25 } = this.maskConfig

    // Load the mask image (handle cross-origin safely)
    const maskImage = await this.loadImage(maskSrc)

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = width
    maskCanvas.height = height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return null

    maskCtx.clearRect(0, 0, width, height)
    // Draw and scale the provided mask asset to the boundary size
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

    return maskCanvas
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.isDestroyed = true

    try {
      // Clean up nodes in reverse creation order
      if (this.imageNode) {
        this.imageNode.remove()
        this.imageNode.destroy()
        this.imageNode = null
      }

      if (this.boundaryRect) {
        this.boundaryRect.remove()
        this.boundaryRect.destroy()
        this.boundaryRect = null
      }

      if (this.maskNode) {
        this.maskNode.remove()
        this.maskNode.destroy()
        this.maskNode = null
      }

      if (this.clipGroup) {
        this.clipGroup.remove()
        this.clipGroup.destroy()
        this.clipGroup = null
      }

      // Revoke all blob URLs
      this.blobUrls.forEach(url => URL.revokeObjectURL(url))
      this.blobUrls.clear()
    } catch (e) {
      console.error('Error during image layer cleanup:', e)
    }

    // Clear dimensions
    this.originalDimensions = { width: 0, height: 0 }
    this.scaledWidth = 0
    this.scaledHeight = 0
    this.currentWidth = 0
    this.currentHeight = 0
    this.zoomPercentage = 100
  }
}
