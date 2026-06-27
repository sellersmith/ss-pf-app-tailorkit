/**
 * HoverZoomManager
 *
 * Manages the hover zoom lens feature for desktop users.
 * Attaches mouse event listeners to the canvas container and
 * displays a magnifying lens following the cursor.
 *
 * This feature only activates on desktop devices - mobile/tablet
 * users have pinch-zoom via the <tailorkit-zoom> component.
 */

import { HoverZoomLens } from './HoverZoomLens'
import type { HoverZoomConfig, HoverZoomConfigResolved } from './types'
import { isMobile } from '../../utils/devices'

const DEFAULT_LENS_SIZE = 150
const DEFAULT_MAGNIFICATION = 2

export class HoverZoomManager {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private lens: HoverZoomLens | null = null
  private config: HoverZoomConfigResolved
  private isInitialized = false

  constructor(config: HoverZoomConfig) {
    // Only initialize on desktop devices
    if (isMobile()) {
      return
    }

    this.container = config.containerElement
    this.canvas = config.canvasElement
    this.config = {
      containerElement: config.containerElement,
      canvasElement: config.canvasElement,
      lensSize: config.lensSize ?? DEFAULT_LENS_SIZE,
      magnification: config.magnification ?? DEFAULT_MAGNIFICATION,
    }

    this.initialize()
  }

  /**
   * Initialize the hover zoom feature
   */
  private initialize(): void {
    if (this.isInitialized) return

    this.lens = new HoverZoomLens(this.config.lensSize)
    this.attachListeners()
    this.isInitialized = true
  }

  /**
   * Attach mouse event listeners to the container
   */
  private attachListeners(): void {
    this.container.addEventListener('mouseenter', this.onMouseEnter)
    this.container.addEventListener('mousemove', this.onMouseMove)
    this.container.addEventListener('mouseleave', this.onMouseLeave)
  }

  /**
   * Detach mouse event listeners
   */
  private detachListeners(): void {
    this.container.removeEventListener('mouseenter', this.onMouseEnter)
    this.container.removeEventListener('mousemove', this.onMouseMove)
    this.container.removeEventListener('mouseleave', this.onMouseLeave)
  }

  /**
   * Handle mouse entering the canvas area
   */
  private onMouseEnter = (): void => {
    this.lens?.show()
  }

  /**
   * Handle mouse movement over the canvas
   * Updates lens position and magnified content
   */
  private onMouseMove = (e: MouseEvent): void => {
    if (!this.lens) return

    // Get canvas position relative to viewport
    const rect = this.canvas.getBoundingClientRect()

    // Calculate mouse position relative to canvas
    // Account for any scaling between canvas display size and internal size
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Update lens position (centered on cursor)
    this.lens.updatePosition(e.clientX, e.clientY)

    // Update lens content with magnified view
    this.lens.updateContent(this.canvas, x, y, this.config.magnification)
  }

  /**
   * Handle mouse leaving the canvas area
   */
  private onMouseLeave = (): void => {
    this.lens?.hide()
  }

  /**
   * Update the canvas reference (e.g., after re-render)
   */
  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
  }

  /**
   * Clean up and remove all resources
   */
  public destroy(): void {
    if (!this.isInitialized) return

    this.detachListeners()
    this.lens?.destroy()
    this.lens = null
    this.isInitialized = false
  }
}
