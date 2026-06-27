import Konva from 'konva'
import type { CanvasContext, ClippingGroup, TemplatePosition, MaskPosition, ScaleConfig } from './types'

/**
 * Manages template groups and clipping for the Konva canvas
 */
export class TemplateGroupManager {
  private context: CanvasContext
  private currentGroup: ClippingGroup | null = null

  constructor(context: CanvasContext) {
    this.context = context
  }

  /**
   * Get the current active template group
   */
  public getCurrentGroup(): ClippingGroup | null {
    return this.currentGroup
  }

  /**
   * Get the target container for adding elements
   * Returns the content group if inside a template group, otherwise the main layer
   */
  public getTargetContainer(): Konva.Group | Konva.Layer {
    return this.currentGroup?.contentGroup || this.context.mainLayer
  }

  /**
   * Start a new template group with optional clipping mask
   */
  public startTemplateGroup(
    template: TemplatePosition,
    mask?: MaskPosition,
    scale?: ScaleConfig
  ): ClippingGroup {
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

      this.context.mainLayer.add(this.currentGroup)

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

      this.context.mainLayer.add(this.currentGroup)

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

  /**
   * End the current template group and trigger redraw
   */
  public endTemplateGroup(): void {
    this.currentGroup = null
    this.context.mainLayer.batchDraw()
  }

  /**
   * Clear the current group reference (used during canvas clear)
   */
  public clearCurrentGroup(): void {
    this.currentGroup = null
  }
}
