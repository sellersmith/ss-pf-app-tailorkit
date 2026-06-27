/**
 * Text bounding box fix helpers for StorefrontInteractiveCanvasManager.
 *
 * Handles shrinking rendered text nodes to fit actual content and overriding
 * getClientRect() on SVG-image groups to return logical bounds.
 */

import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../../../shared/libraries/konva/runtime-konva'
import type { TextLayerProps } from '../../../shared/libraries/konva/text'

/**
 * Shrink a rendered text node's bounding box to fit the actual text content.
 *
 * Called for Konva.Text (case A) and Konva.Group with Text children (case B).
 * SVG-image groups use attachLogicalBoundsOverride instead.
 */
export function shrinkTextNodeToContent(node: Konva.Node, props: TextLayerProps): void {
  const containerW = props.width || 0
  if (containerW <= 0) return

  const align = (props.align as string) || 'left'

  const applyToTextNode = (textNode: Konva.Text): void => {
    const actualW = textNode.getTextWidth()
    if (actualW <= 0 || actualW >= containerW) return

    let dx = 0
    if (align === 'center') dx = (containerW - actualW) / 2
    else if (align === 'right') dx = containerW - actualW

    textNode.x(textNode.x() + dx)
    textNode.width(actualW)
    // Konva 10.x: auto-height = 'auto' string (NOT 0 — 0 makes getHeight() return 0)
    ;(textNode as any).setAttr('height', 'auto')
  }

  if (node instanceof KonvaRuntime.Text) {
    applyToTextNode(node)
  } else if (node instanceof KonvaRuntime.Group) {
    // Legacy effects path: group wraps Konva.Text children (main + shadow copies)
    const textChildren = node.find<Konva.Text>((n: Konva.Node) => n instanceof KonvaRuntime.Text)
    const firstText = textChildren[0]
    if (firstText && firstText.getTextWidth() > 0 && firstText.getTextWidth() < containerW) {
      for (const child of textChildren) applyToTextNode(child)
    }
  }
}

/**
 * Override getClientRect() on an SVG-image Group to return the logical
 * bounds (safeW × safeH) instead of the full image bounds.
 *
 * Why: SVG rendering pads the image beyond safeW × safeH for effects and
 * curve extension (curveExtensionPadding = amplitude + fontSize/2), which can
 * be 100+ px extra on each side. The Transformer wraps around the full padded
 * image, making the selection box much larger than the actual text.
 *
 * Fix: replace getClientRect() on the group to return the logical (0, 0, safeW, safeH)
 * area in stage coordinates by transforming the 4 corners through the absolute transform.
 * The visual SVG image is unchanged — effects/curves still render at full padded dimensions.
 */
export function attachLogicalBoundsOverride(group: Konva.Group, safeW: number, safeH: number): void {
  if (safeW <= 0 || safeH <= 0) return

  const logicalW = safeW
  const logicalH = safeH

  const g = group as Konva.Group & { getClientRect: Konva.Node['getClientRect'] }
  g.getClientRect = function (this: Konva.Group, config?: { relativeTo?: Konva.Node; skipTransform?: boolean }) {
    // When skipTransform is requested, return local logical bounds directly
    if (config?.skipTransform) {
      return { x: 0, y: 0, width: logicalW, height: logicalH }
    }

    // Compute the 4 corners of the logical rect, apply absolute transform
    const transform = (this as unknown as Konva.Node).getAbsoluteTransform(config?.relativeTo)
    const corners = [
      { x: 0, y: 0 },
      { x: logicalW, y: 0 },
      { x: logicalW, y: logicalH },
      { x: 0, y: logicalH },
    ]
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const c of corners) {
      const tp = transform.point(c)
      if (tp.x < minX) minX = tp.x
      if (tp.x > maxX) maxX = tp.x
      if (tp.y < minY) minY = tp.y
      if (tp.y > maxY) maxY = tp.y
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
}
