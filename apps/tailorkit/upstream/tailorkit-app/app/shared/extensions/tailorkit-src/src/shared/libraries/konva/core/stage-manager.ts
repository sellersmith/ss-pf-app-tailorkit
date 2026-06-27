import Konva from 'konva'
import type { KonvaCanvasConfig, PerformanceMetrics } from './types'

/**
 * Manages Konva stage lifecycle, including initialization,
 * resize handling, and performance monitoring.
 */
export class StageManager {
  private stage!: Konva.Stage
  private mainLayer!: Konva.Layer
  private config: KonvaCanvasConfig
  private originalWidth: number
  private originalHeight: number
  private containerResizeObserver: ResizeObserver | null = null
  private parentResizeObserver: ResizeObserver | null = null

  // Performance tracking
  private frameCount: number = 0
  private lastFpsUpdate: number
  private lastFrameTime: number
  private metrics: Pick<PerformanceMetrics, 'fps' | 'renderTime' | 'layerCount'>

  constructor(config: KonvaCanvasConfig) {
    this.config = config
    this.originalWidth = config.width
    this.originalHeight = config.height
    this.lastFpsUpdate = performance.now()
    this.lastFrameTime = performance.now()
    this.metrics = {
      fps: 0,
      renderTime: 0,
      layerCount: 0,
    }

    this.initStage()
    this.initPerformanceMonitoring()

    if (this.config.autoResize) {
      this.initResizeHandler()
    }
  }

  /**
   * Initialize the Konva stage and main layer
   */
  private initStage(): void {
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

  /**
   * Set up performance monitoring via draw events
   */
  private initPerformanceMonitoring(): void {
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

      window.__tailorkit__.performance = this.metrics as PerformanceMetrics
    })
  }

  /**
   * Initialize resize handlers for responsive canvas
   */
  private initResizeHandler(): void {
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

  /**
   * Handle window resize events
   */
  private handleWindowResize = (): void => {
    this.updateSize()
  }

  /**
   * Update stage size to fit parent container while maintaining aspect ratio
   */
  public updateSize(): void {
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

  /**
   * Get the container element
   */
  public getContainer(containerId: KonvaCanvasConfig['containerId']): HTMLDivElement | null {
    if (!containerId) return null

    return containerId instanceof HTMLDivElement
      ? containerId
      : (document.getElementById(containerId) as HTMLDivElement | null)
  }

  /**
   * Get the Konva stage instance
   */
  public getStage(): Konva.Stage {
    return this.stage
  }

  /**
   * Get the main layer
   */
  public getMainLayer(): Konva.Layer {
    return this.mainLayer
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): Pick<PerformanceMetrics, 'fps' | 'renderTime' | 'layerCount'> {
    return { ...this.metrics }
  }

  /**
   * Clean up resources and observers
   */
  public dispose(): void {
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

    // Destroy Konva stage
    if (this.stage) {
      this.stage.destroy()
    }
  }
}
