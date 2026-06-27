import type KonvaType from 'konva'
import { EventManager } from '../utils/event-utils'

/**
 * Manages the Konva stage and root layer
 */
export class StageManager {
  private Konva: typeof KonvaType
  private stage: KonvaType.Stage | null = null
  private layer: KonvaType.Layer | null = null
  private background: KonvaType.Rect | null = null
  private gridElements: KonvaType.Node[] = []
  private eventManager = new EventManager()
  private isDestroyed = false
  private resizeObserver: ResizeObserver | null = null
  private containerElement: HTMLElement | null = null

  // Container dimensions
  public containerWidth = 0
  public containerHeight = 0

  constructor(Konva: typeof KonvaType) {
    this.Konva = Konva
  }

  /**
   * Initialize the Konva stage in the given container
   */
  public initialize(containerId: string): boolean {
    const container = document.getElementById(containerId)
    if (!container) {
      console.error('Container not found:', containerId)
      return false
    }

    // Store container for later use
    this.containerElement = container

    // Force container to have a size if needed
    if (!container.clientWidth || !container.clientHeight) {
      container.style.width = '100%'
      container.style.minWidth = '270px'
      container.style.height = '270px'
    }

    // Calculate container dimensions
    this.containerWidth = container.clientWidth || 270
    this.containerHeight = container.clientHeight || 270

    // Create stage with explicit pixel dimensions
    this.stage = new this.Konva.Stage({
      container: containerId,
      width: this.containerWidth,
      height: this.containerHeight,
    })

    // Create layer
    this.layer = new this.Konva.Layer()
    this.stage.add(this.layer)

    // Create a transparent grid background
    this.createGridBackground()

    // Set container styles
    container.style.position = 'relative'

    const konvaContent = container.querySelector('.konvajs-content') as HTMLElement
    if (konvaContent) {
      konvaContent.style.margin = '0 auto'
    }

    // Setup resize observer for responsive canvas
    this.setupResizeHandling(container)

    return true
  }

  /**
   * Setup resize observer to handle container size changes
   */
  private setupResizeHandling(container: HTMLElement): void {
    // Create resize observer to detect container size changes
    this.resizeObserver = new ResizeObserver(entries => {
      // We only have one element being observed
      const entry = entries[0]
      if (entry) {
        this.updateDimensions()
      }
    })

    // Start observing the container
    this.resizeObserver.observe(container)
  }

  /**
   * Create a transparent grid background
   */
  private createGridBackground(): void {
    if (!this.layer) return

    // Clear any previous grid elements
    this.removeGridElements()

    // Create a group for all grid elements
    const gridGroup = new this.Konva.Group({
      listening: false,
    })
    this.layer.add(gridGroup)
    this.gridElements.push(gridGroup)

    // Make sure the grid group is at the bottom of the layer
    gridGroup.moveToBottom()

    // Create background rect
    this.background = new this.Konva.Rect({
      x: 0,
      y: 0,
      width: this.containerWidth,
      height: this.containerHeight,
      fill: 'transparent',
      listening: false,
    })
    gridGroup.add(this.background)

    // Checkerboard pattern settings
    const squareSize = 10
    const lightColor = '#ffffff'
    const darkColor = '#e0e0e0'

    // Create checkerboard pattern
    for (let y = 0; y < this.containerHeight; y += squareSize) {
      for (let x = 0; x < this.containerWidth; x += squareSize) {
        // Determine if this square should be light or dark
        const isEvenRow = Math.floor(y / squareSize) % 2 === 0
        const isEvenCol = Math.floor(x / squareSize) % 2 === 0
        const color = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol) ? lightColor : darkColor

        // Create square
        const square = new this.Konva.Rect({
          x: x,
          y: y,
          width: squareSize,
          height: squareSize,
          fill: color,
          listening: false,
        })
        gridGroup.add(square)
      }
    }
  }

  /**
   * Remove all grid elements from the layer
   */
  private removeGridElements(): void {
    if (!this.layer) return

    // Remove and destroy all grid elements
    this.gridElements.forEach(element => {
      element.remove()
      element.destroy()
    })

    // Clear the array
    this.gridElements = []

    // Reset background reference
    this.background = null
  }

  /**
   * Update dimensions based on current container size
   */
  public updateDimensions(): void {
    if (this.isDestroyed || !this.stage || !this.layer || !this.containerElement) return

    // Get current container dimensions
    const newWidth = this.containerElement.clientWidth
    const newHeight = this.containerElement.clientHeight

    // Only update if dimensions actually changed
    if (newWidth !== this.containerWidth || newHeight !== this.containerHeight) {
      // Update stored dimensions
      this.containerWidth = newWidth
      this.containerHeight = newHeight

      // Resize stage
      this.stage.width(newWidth)
      this.stage.height(newHeight)

      // Update grid background
      this.createGridBackground()

      // Redraw to apply changes
      this.redraw()

      // Emit a custom event that components can listen for
      if (this.stage) {
        this.stage.fire('stageResize', {
          width: newWidth,
          height: newHeight,
        })
      }
    }
  }

  /**
   * Add a node to the stage's layer
   */
  public addToLayer(node: KonvaType.Shape | KonvaType.Group): void {
    if (this.isDestroyed || !this.layer) return
    this.layer.add(node)

    // Ensure any grid elements stay at the bottom
    this.ensureGridIsAtBottom()
  }

  /**
   * Ensure grid elements are at the bottom of the layer
   */
  private ensureGridIsAtBottom(): void {
    if (this.isDestroyed || !this.layer) return

    // If we have grid elements, move them to the bottom
    if (this.gridElements.length > 0) {
      this.gridElements.forEach(element => {
        element.moveToBottom()
      })
    }
  }

  /**
   * Register an event handler on a Konva node
   */
  public addEventHandler(node: KonvaType.Node, event: string, handler: Function): void {
    if (this.isDestroyed) return
    this.eventManager.addKonvaEventHandler(node, event, handler)
  }

  /**
   * Get the stage container element
   */
  public getContainer(): HTMLElement | null {
    if (this.isDestroyed || !this.stage) return null

    const container = this.stage.container()
    return container instanceof HTMLElement ? container : null
  }

  /**
   * Trigger a layer redraw
   */
  public redraw(): void {
    if (this.isDestroyed || !this.layer) return
    this.layer.batchDraw()
  }

  /**
   * Get the stage instance
   */
  public getStage(): KonvaType.Stage | null {
    return this.stage
  }

  /**
   * Get the layer instance
   */
  public getLayer(): KonvaType.Layer | null {
    return this.layer
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    this.isDestroyed = true

    // Clean up event handlers
    this.eventManager.cleanup()

    // Remove grid elements
    this.removeGridElements()

    // Clean up resize observer
    if (this.resizeObserver && this.containerElement) {
      this.resizeObserver.unobserve(this.containerElement)
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    try {
      if (this.layer) {
        this.layer.remove()
        this.layer.destroy()
        this.layer = null
      }

      if (this.stage) {
        this.stage.destroyChildren()
        this.stage.destroy()
        this.stage = null
      }
    } catch (e) {
      console.error('Error during Konva stage cleanup:', e)
    }

    this.containerElement = null
  }
}
