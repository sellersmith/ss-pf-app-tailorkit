/**
 * TextMovementZoneOverlay — clip function helper.
 *
 * Provides `buildZoneClipFunc` for clipping a Konva Group to the zone shape.
 * Used by TextWithZoneGroupRenderer (admin canvas) and potentially storefront renderers.
 *
 * The visual overlay (border, handles, drag) is fully handled by TextWithZoneGroupRenderer,
 * which follows the standard TailorKit Image+Mask pattern with Konva Transformer.
 */

import type Konva from 'konva'
import type { MovementBounds } from '~/types/psd'

export type ZoneMode = 'group' | 'content'

/**
 * Build clipFunc for a Konva Group so content outside the zone shape is hidden.
 *
 * IMPORTANT: The `bounds` passed here must be in the Group's LOCAL coordinate space.
 * When the zone Group is positioned at {x: bounds.x, y: bounds.y}, pass
 * `{...bounds, x: 0, y: 0}` so the clip region aligns with the Group origin.
 */
export function buildZoneClipFunc(bounds: MovementBounds) {
  return (ctx: Konva.Context) => {
    // Skip zone clip for the hit canvas so text that overflows the zone boundary
    // remains clickable. Konva uses a separate hit canvas for click/touch detection —
    // if clipFunc restricts the hit canvas too, clicking on text overflow returns no
    // hit pixel → no selection. Visual (scene) clipping is unaffected.
    // Konva.Context internals: _canvas.isHit distinguishes hit vs scene canvas
    const isHitCanvas = Boolean((ctx as unknown as { _canvas?: { isHit?: boolean } })._canvas?.isHit)
    if (isHitCanvas) {
      ctx.rect(-10000, -10000, 20000, 20000)
      return
    }

    const { type, x, y, width, height, pathData, pathViewBox } = bounds

    if (type === 'ellipse') {
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
    } else if (type === 'path' && pathData) {
      const vbW = pathViewBox?.width ?? 0
      const vbH = pathViewBox?.height ?? 0
      if (vbW > 0 && vbH > 0) {
        // Konva's clipFunc contract:
        //   1. Konva calls ctx._context.beginPath() — clears the current path
        //   2. Konva calls clipFunc(ctx)            — our code runs here
        //   3. Konva calls ctx._context.clip()      — clips to the current path
        //
        // Problem: Path2D cannot be pushed onto the canvas current path stack.
        // Calling native.clip(path2D) directly bypasses the current path, but then
        // Konva's step 3 clip() runs on the EMPTY current path → zero-area clip → nothing visible.
        //
        // Solution (two-step):
        //   a) Apply polygon clip directly on the raw context via raw.clip(path2D).
        //   b) Also draw the bounding box onto the current path via ctx.rect().
        //      Konva's step 3 then clips to the bbox.
        //      Effective clip = polygon (step a) ∩ bbox (step b) = polygon (since polygon ⊂ bbox). ✓
        //
        // Konva.Context wraps the native context; access it via _context internal
        const raw = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
        const m = new DOMMatrix().translate(x, y).scale(width / vbW, height / vbH)
        const scaled = new Path2D()
        scaled.addPath(new Path2D(pathData), m)
        raw.clip(scaled, 'nonzero')
        // Add bbox to Konva's current path so Konva's clip() call produces a valid intersection
        ctx.rect(x, y, width, height)
      } else {
        ctx.rect(x, y, width, height)
      }
    } else {
      ctx.rect(x, y, width, height)
    }
  }
}
