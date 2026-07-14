/**
 * Mobile touch relay for Konva DragAndDrop and Transformer on storefront.
 *
 * Shopify themes stop touchmove/touchend propagation on the canvas container,
 * blocking both Konva DD (regular drag) and Konva Transformer (resize/rotate anchors).
 *
 * Two strategies:
 *   Regular drag   → relay via DD._drag() from konvaContent; stopPropagation there.
 *   Anchor drag    → Transformer uses window.addEventListener('touchmove'/'touchend').
 *                    When transformerInteracting=true, skip stopPropagation so events
 *                    reach window. Swiper can't interfere: its touchstart was already
 *                    blocked by _stopBubble in initInteractiveMode.
 *
 * NOTE: init-canvas.ts must NOT stop touchmove/touchend unconditionally on mobile+interactive
 * or events will never reach window. See init-canvas.ts event registration.
 */

import type Konva from 'konva'
import { DD } from 'konva/lib/DragAndDrop' // Konva 10.0.12 internal API — re-verify on upgrade

export interface MobileTouchRelayContext {
  getActive: () => boolean
  setActive: (v: boolean) => void
  getSelectedNode: () => Konva.Node | null
  getTransformer: () => Konva.Transformer | null
}

/** No-op on desktop. Must be called after transformer + stage are ready. */
export function initMobileTouchRelay(isMobile: boolean, stage: Konva.Stage, ctx: MobileTouchRelayContext): void {
  if (!isMobile) return

  const stageContainer = stage.container()
  // Allow native single-finger pan in any direction so the page can scroll vertically
  // AND the slideshow (Swiper) can swipe horizontally when the finger is on the canvas.
  // Pinch (multi-finger) stays blocked → library JS handles zoom.
  // Layer drag / transformer anchors still work because their touchstart handlers
  // call preventDefault to cancel the browser pan for that specific gesture.
  stageContainer.style.touchAction = 'pan-x pan-y'

  // True while dragging a transformer anchor (resize/rotate).
  // touchmove/touchend must reach window so Transformer's window listeners fire.
  let transformerInteracting = false

  // Reset transformer state on OS-level cancel (incoming call, system gesture, etc.)
  // without this, transformerInteracting would stay true permanently after a cancel.
  const resetTransformerState = () => {
    transformerInteracting = false
    ctx.setActive(false)
  }

  stageContainer.addEventListener(
    'touchmove',
    e => {
      if (!transformerInteracting) e.stopPropagation()
      // Only block page scroll while actively dragging a layer or transformer anchor.
      // Using getSelectedNode() here would block scroll whenever a layer was previously
      // selected — even when the finger is not on the layer.
      if (ctx.getActive() || transformerInteracting) e.preventDefault()
    },
    { passive: false }
  )

  stageContainer.addEventListener(
    'touchend',
    e => {
      if (!transformerInteracting) e.stopPropagation()
    },
    false
  )

  stageContainer.addEventListener('touchcancel', resetTransformerState, false)

  const konvaContent = stageContainer.querySelector('.konvajs-content') as HTMLElement | null
  if (konvaContent) {
    const stopIfActive = (e: Event) => {
      if (ctx.getActive()) e.stopPropagation()
    }
    konvaContent.addEventListener('pointerdown', stopIfActive, false)
    konvaContent.addEventListener('touchstart', stopIfActive, { passive: false, capture: false })

    // Relay to DD for regular node drag; skip when transformer anchor is active.
    const feedDragIfActive = (e: Event) => {
      if (!ctx.getActive() || transformerInteracting) return
      e.stopPropagation()
      DD._drag(e)
    }
    konvaContent.addEventListener('pointermove', feedDragIfActive, false)
    konvaContent.addEventListener('touchmove', feedDragIfActive, { passive: false, capture: false })

    // End regular drag; skip when transformer is active (window.touchend handles its cleanup).
    // setActive(false) only for regular drag — transformer resets active in transformend handler.
    const feedEndAndReset = (e: Event) => {
      if (ctx.getActive() && !transformerInteracting) {
        e.stopPropagation()
        DD._endDragBefore(e)
        DD._endDragAfter(e)
        ctx.setActive(false)
      }
    }
    konvaContent.addEventListener('pointerup', feedEndAndReset, false)
    konvaContent.addEventListener('pointercancel', feedEndAndReset, false)
    konvaContent.addEventListener('touchend', feedEndAndReset, false)
    konvaContent.addEventListener('touchcancel', feedEndAndReset, false)
  }

  // Konva events fire synchronously before the native event bubbles to konvaContent,
  // so this flag is set before stopIfActive runs.
  const transformer = ctx.getTransformer()
  if (transformer) {
    transformer.on('mousedown.transformerMobile touchstart.transformerMobile', e => {
      ctx.setActive(true)
      transformerInteracting = true
      // Cancel the browser's pan-y commitment for this gesture so vertical drag of an
      // anchor (resize/rotate) doesn't scroll the page instead of resizing.
      const native = e.evt as TouchEvent | MouseEvent | undefined
      if (native && typeof native.preventDefault === 'function' && native.cancelable) {
        native.preventDefault()
      }
    })
    // Fires after window.touchend → _handleMouseUp; resets both flags.
    transformer.on('transformend.transformerMobile', () => {
      transformerInteracting = false
      ctx.setActive(false)
    })
  }
}
