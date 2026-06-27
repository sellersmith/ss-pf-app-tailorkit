/**
 * HoverZoomLens
 *
 * Visual lens component that displays a magnified circular view
 * of the canvas content following the mouse cursor.
 */
export class HoverZoomLens {
  private element: HTMLDivElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private size: number
  private isVisible = false

  constructor(size: number) {
    this.size = size
    this.createElement()
  }

  /**
   * Create the lens DOM elements
   */
  private createElement(): void {
    // Create outer container
    this.element = document.createElement('div')
    this.element.className = 'emtlkit--hover-zoom-lens'
    this.element.style.cssText = `
      position: fixed;
      width: ${this.size}px;
      height: ${this.size}px;
      border-radius: 50%;
      border: 2px solid rgba(0, 0, 0, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
      display: none;
      background: white;
    `

    // Create internal canvas for magnified content
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.size
    this.canvas.height = this.size
    this.canvas.style.cssText = `
      display: block;
      border-radius: 50%;
    `

    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context for hover zoom lens')
    }
    this.ctx = ctx

    this.element.appendChild(this.canvas)
    document.body.appendChild(this.element)
  }

  /**
   * Show the lens
   */
  public show(): void {
    if (!this.isVisible) {
      this.element.style.display = 'block'
      this.isVisible = true
    }
  }

  /**
   * Hide the lens
   */
  public hide(): void {
    if (this.isVisible) {
      this.element.style.display = 'none'
      this.isVisible = false
    }
  }

  /**
   * Update the lens position to follow the cursor
   * Centers the lens on the cursor position
   */
  public updatePosition(clientX: number, clientY: number): void {
    const offset = this.size / 2
    let left = clientX - offset
    let top = clientY - offset

    // Clamp to viewport bounds
    const maxLeft = window.innerWidth - this.size
    const maxTop = window.innerHeight - this.size
    left = Math.max(0, Math.min(left, maxLeft))
    top = Math.max(0, Math.min(top, maxTop))

    this.element.style.left = `${left}px`
    this.element.style.top = `${top}px`
  }

  /**
   * Update the lens content with magnified view of the source canvas
   *
   * @param sourceCanvas - The canvas to sample from
   * @param x - X position relative to the canvas (mouse position)
   * @param y - Y position relative to the canvas (mouse position)
   * @param magnification - Zoom level (e.g., 2 = 2x magnification)
   */
  public updateContent(
    sourceCanvas: HTMLCanvasElement,
    x: number,
    y: number,
    magnification: number
  ): void {
    // Calculate the source region size (smaller than lens size due to magnification)
    const sourceRadius = this.size / magnification / 2

    // Clear the lens canvas
    this.ctx.clearRect(0, 0, this.size, this.size)

    // Calculate source coordinates (centered on mouse position)
    const sourceX = x - sourceRadius
    const sourceY = y - sourceRadius
    const sourceWidth = sourceRadius * 2
    const sourceHeight = sourceRadius * 2

    // Draw magnified content
    // Source region is smaller, destination is full lens size = magnification
    try {
      this.ctx.drawImage(
        sourceCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        this.size,
        this.size
      )
    } catch {
      // Canvas might be tainted or unavailable, ignore
    }
  }

  /**
   * Clean up and remove lens from DOM
   */
  public destroy(): void {
    this.element.remove()
  }
}
