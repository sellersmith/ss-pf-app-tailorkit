/* eslint-disable max-lines */
/**
 * StorefrontInteractiveCanvasManager
 *
 * Extends KonvaCanvasManager with customer-facing layer interaction:
 * Move (drag), Resize, Rotate — with per-layer capability flags.
 *
 * Key behaviors:
 * - Bounds check uses the layer center-point — prevents layers from being
 *   dragged fully off-canvas while still allowing edge overflow.
 * - Touch: single-finger drag to move, drag handles to resize/rotate.
 *   Pinch/two-finger gestures are intentionally not used.
 *
 * Architecture:
 *   StorefrontInteractiveCanvasManager
 *     ├── Extends KonvaCanvasManager (render pipeline stays the same)
 *     ├── Adds Konva.Transformer to a separate transformerLayer (survives canvas.clear())
 *     ├── Tracks "pending interactive registration" via setNextLayerInteractive()
 *     ├── Overrides addImageLayer/addTextLayer to apply interactivity
 *     ├── StorefrontLayerState (transform state + defaults)
 *     ├── StorefrontUndoStack (delta-based in-memory undo/redo)
 *     ├── StorefrontLayerControls (DOM overlay: Reset/Delete)
 *     └── StorefrontUndoRedoControls (DOM overlay: Undo/Redo + keyboard)
 */

import Konva from 'konva'
import { KonvaCanvasManager } from '../../shared/libraries/konva/core'
import type { ImageLayerProps } from '../../shared/libraries/konva/image'
import type { TextLayerProps } from '../../shared/libraries/konva/text'
import { StorefrontLayerState } from '../stores/storefront-layer-state'
import type { LayerInteractionFlags, LayerTransform } from '../stores/storefront-layer-state'
import { StorefrontUndoStack } from '../stores/storefront-undo-stack'
import type { LayerTransformSnapshot, UndoDelta } from '../stores/storefront-undo-stack'
import { StorefrontLayerControls } from '../components/layer-controls/StorefrontLayerControls'
import { StorefrontUndoRedoControls } from '../components/layer-controls/StorefrontUndoRedoControls'

// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSFORMER_STROKE = '#005bd3'
const ANCHOR_FILL = '#ffffff'
const ANCHOR_SIZE_DEFAULT = 16
const ANCHOR_SIZE_MOBILE = 22 // Larger touch targets for mobile usability
const MIN_LAYER_SIZE = 10 // px — minimum resize dimension
const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

// ─── Types ───────────────────────────────────────────────────────────────────

/** Pending interactive registration — used by setNextLayerInteractive() */
interface PendingInteractiveReg {
  layerId: string
  flags: LayerInteractionFlags
  defaultTransform: LayerTransform
}

type SelectionChangeListener = (layerId: string | null) => void

// ─── Class ───────────────────────────────────────────────────────────────────

export class StorefrontInteractiveCanvasManager extends KonvaCanvasManager {
  /** Konva Transformer — attached to selected interactive node */
  private transformer: Konva.Transformer | null = null

  /**
   * Separate Konva layer for the transformer.
   * Lives ABOVE mainLayer but is NOT touched by super.clear() which only
   * calls mainLayer.destroyChildren(). This means the transformer survives
   * canvas re-renders (e.g., when user changes an option).
   */
  private transformerLayer: Konva.Layer | null = null

  /** The currently selected interactive node */
  private selectedNode: Konva.Node | null = null

  /** Interactive node registry: nodeId → Konva node */
  private interactiveNodes: Map<string, Konva.Node> = new Map()

  /**
   * Snapshot of user transforms captured just before clear() wipes StorefrontLayerState.
   * Restored in registerInteractiveNode() after each layer is re-registered.
   *
   * Content changes (image source, text, option selection) trigger a full canvas re-render
   * (clear + redraw). Without this snapshot, layers would jump back to their template-default
   * position/size/rotation after every content update.
   * The snapshot is keyed by layerId and holds both the transform and the deleted flag.
   */
  private _preservedTransforms: Map<string, { transform: LayerTransform; deleted: boolean }> = new Map()

  /** Pending interactive registration for the NEXT addImageLayer/addTextLayer call */
  private pendingReg: PendingInteractiveReg | null = null

  /** DOM overlay controls */
  private layerControls: StorefrontLayerControls | null = null
  private undoRedoControls: StorefrontUndoRedoControls | null = null

  /** Auto-generated node counter — used as fallback ID when layerId not provided */
  private nodeCounter = 0

  /** Selection change listeners */
  private selectionListeners: Set<SelectionChangeListener> = new Set()

  /** Ref to the canvas container element for DOM overlay */
  private canvasContainerEl: HTMLElement | null = null

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Initialize interactive mode.
   * Must be called after initStage (i.e., after KonvaCanvasManager constructor).
   *
   * @param containerEl - The DOM element containing the Konva canvas.
   *   Used to position DOM overlay controls.
   */
  initInteractiveMode(containerEl: HTMLElement): void {
    this.canvasContainerEl = containerEl

    const stage = this.getStage()
    const mainLayer = this.getMainLayer()

    // ── Transformer ───────────────────────────────────────────────────────
    this.transformer = new Konva.Transformer({
      anchorSize: isMobile ? ANCHOR_SIZE_MOBILE : ANCHOR_SIZE_DEFAULT,
      anchorCornerRadius: 4,
      anchorStroke: TRANSFORMER_STROKE,
      anchorFill: ANCHOR_FILL,
      anchorStrokeWidth: 2,
      borderStroke: TRANSFORMER_STROKE,
      borderStrokeWidth: 2,
      ignoreStroke: true,
      // Default: allow resize + rotate. Per-layer flags override via keepRatio + rotation.
      rotateEnabled: true,
      resizeEnabled: true,
      boundBoxFunc: (oldBox, newBox) => {
        // Enforce minimum size
        if (Math.abs(newBox.width) < MIN_LAYER_SIZE || Math.abs(newBox.height) < MIN_LAYER_SIZE) {
          return oldBox
        }
        return newBox
      },
    })

    // Shift-key rotation snapping (45° increments) — desktop only
    this.transformer.on('transform', e => {
      const evt = e.evt as MouseEvent | undefined
      const isShift = !!(evt && 'shiftKey' in evt && evt.shiftKey)
      this.transformer!.rotationSnaps(isShift ? [0, 45, 90, 135, 180, 225, 270, 315] : [])
    })

    // Track transform end → update state + push undo delta
    this.transformer.on('transformend', () => {
      if (!this.selectedNode) return
      const node = this.selectedNode
      const nodeId = node.id()

      const prevTransform = StorefrontLayerState.getCurrent(nodeId)
      const defaultTransform = StorefrontLayerState.getDefault(nodeId)
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      // Compute effective (visual) dimensions after the transform.
      //
      // Konva.Transformer sets scaleX/scaleY as the TOTAL accumulated scale
      // relative to the node's ORIGINAL dimensions (before any transform).
      // So we use the MERCHANT DEFAULT width/height as the base.
      //
      // For Konva.Image: bake the scale into explicit width/height (cleaner API).
      // For Konva.Group: keep scale on the group — resizing children is complex.
      const baseWidth = defaultTransform?.width ?? prevTransform?.width ?? 0
      const baseHeight = defaultTransform?.height ?? prevTransform?.height ?? 0
      const newWidth = baseWidth * scaleX
      const newHeight = baseHeight * scaleY

      if (node instanceof Konva.Image) {
        node.width(newWidth)
        node.height(newHeight)
        node.scaleX(1)
        node.scaleY(1)
      }
      // Groups: leave scaleX/scaleY in place; transformer tracks them from baseW/H.

      mainLayer.batchDraw()
      this.transformerLayer?.batchDraw()

      const newTransform: LayerTransform = {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight,
        rotation: node.rotation(),
      }

      StorefrontLayerState.updateTransform(nodeId, newTransform)

      // Determine delta type (RESIZE vs ROTATE) by comparing rotation
      const isRotate = prevTransform ? Math.abs(newTransform.rotation - prevTransform.rotation) > 0.5 : false
      const deltaType = isRotate ? 'ROTATE' : 'RESIZE'

      if (prevTransform) {
        StorefrontUndoStack.push({
          type: deltaType,
          layerId: nodeId,
          before: {
            x: prevTransform.x,
            y: prevTransform.y,
            width: prevTransform.width,
            height: prevTransform.height,
            rotation: prevTransform.rotation,
          },
          after: newTransform,
        })
      }
    })

    // Add transformer to a SEPARATE layer above mainLayer.
    // This ensures super.clear() (which calls mainLayer.destroyChildren()) does NOT
    // destroy the transformer when the canvas re-renders.
    this.transformerLayer = new Konva.Layer()
    stage.add(this.transformerLayer)
    this.transformerLayer.add(this.transformer)

    // ── Stage click → deselect ────────────────────────────────────────────
    stage.on('click tap', e => {
      if (e.target === stage) {
        this.deselectAll()
      }
    })

    // ── Theme DOM event interception ──────────────────────────────────────
    // Canvas sits inside .product__media (or equivalent), which Shopify themes
    // typically use as the target for:
    //   • Swiper/slider touchstart handlers (intercept touch → swipe, not drag)
    //   • Zoom lightbox click handlers on .product__media itself
    // We stop propagation at the canvas container boundary so these handlers
    // never fire when the user interacts with an interactive layer.
    //
    // We stop at BUBBLE phase (not capture) so Konva's own listeners on the
    // stage container still receive the event first.
    const _stopBubble = (e: Event) => e.stopPropagation()
    containerEl.addEventListener('mousedown', _stopBubble, false)
    containerEl.addEventListener('pointerdown', _stopBubble, false)
    containerEl.addEventListener('click', _stopBubble, false)
    // touchstart: passive:false required to allow calling preventDefault if needed later
    containerEl.addEventListener('touchstart', _stopBubble, { passive: false, capture: false })

    // ── Touch: prevent scroll when interacting with canvas ───────────────
    if (isMobile) {
      const stageContainer = stage.container()
      stageContainer.addEventListener(
        'touchmove',
        e => {
          // If a node is selected (being dragged/transformed), prevent scroll
          if (this.selectedNode) {
            e.preventDefault()
          }
        },
        { passive: false }
      )
    }

    // ── DOM Overlay Controls ──────────────────────────────────────────────
    this.layerControls = new StorefrontLayerControls(containerEl)

    this.undoRedoControls = new StorefrontUndoRedoControls(containerEl, {
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
    })

    // Sync undo/redo button state
    StorefrontUndoStack.subscribe((canUndo, canRedo) => {
      this.undoRedoControls?.update(canUndo, canRedo)
    })
  }

  // ─── Public: Interactive layer registration ────────────────────────────────

  /**
   * Register the NEXT addImageLayer/addTextLayer call as interactive.
   * Must be called immediately before addImageLayer/addTextLayer.
   *
   * @param layerId - Stable ID for this layer (from Layer.i).
   * @param flags - Per-layer capability flags.
   * @param defaultTransform - Merchant-default position/size/rotation (for Reset).
   */
  setNextLayerInteractive(layerId: string, flags: LayerInteractionFlags, defaultTransform: LayerTransform): void {
    this.pendingReg = { layerId, flags, defaultTransform }
  }

  // ─── Override: addImageLayer ───────────────────────────────────────────────

  override async addImageLayer(props: ImageLayerProps): Promise<Konva.Image | Konva.Group> {
    const node = await super.addImageLayer(props)

    const pending = this.pendingReg
    this.pendingReg = null // Consume

    if (pending) {
      const { layerId, flags, defaultTransform } = pending
      this.registerInteractiveNode(node, layerId, flags, defaultTransform)
    }

    return node
  }

  // ─── Override: addTextLayer ────────────────────────────────────────────────

  override async addTextLayer(props: TextLayerProps): Promise<Konva.Text | Konva.TextPath | Konva.Image | Konva.Group> {
    const node = await super.addTextLayer(props)

    // Tag text-shape containers (circle, curve, custom, fill-shape) so the transformer
    // can apply distinct styling (dashed border) to indicate container-based resizing
    const isTextShapeContainer = props.textShape && props.textShape !== 'none'
    if (isTextShapeContainer) {
      ;(node as Konva.Node).setAttr('_isTextShapeContainer', true)
    }

    // ── Fix bounding box to match actual/logical text content ─────────────────
    // The renderer creates nodes sized to ds.w × ds.h (merchant's template container),
    // which is much larger than the actual rendered text.
    //
    // Three renderer output shapes, three fixes:
    //
    // (A) Konva.Text (fast path, no effects, no textShape):
    //     → Measure actual text width, adjust x for alignment, set height='auto'
    //     → Skip: autoFitToContainer (text fills container by design)
    //     → Skip: isTextShapeContainer (container IS the shape)
    //
    // (B) Konva.Group with Konva.Text children (legacy effects, pre-Dec-2025):
    //     → Same as (A) applied to all Text children in the group
    //     → Skip: same conditions as (A)
    //
    // (C) Konva.Group with Konva.Image child (SVG rendering — effects or text-shape):
    //     The SVG image is pre-rendered with curveExtensionPadding / effectPadding that
    //     can be 100+ px beyond the container. We can't resize the SVG, so instead we
    //     override getClientRect() on the Group to return the logical bounds (safeW × safeH).
    //     → Applies to ALL SVG-image groups (both isTextShapeContainer and effects)
    if (node instanceof Konva.Group) {
      const textChildren = node.find<Konva.Text>((n: Konva.Node) => n instanceof Konva.Text)
      const hasSVGImageChild = textChildren.length === 0

      if (hasSVGImageChild) {
        // Case (C): SVG-image group — override getClientRect to logical bounds
        this._attachLogicalBoundsOverride(node, props.width || 0, props.height || 0)
      } else if (!isTextShapeContainer && !props.autoFitToContainer) {
        // Case (B): legacy effects group with Konva.Text children
        this._shrinkTextNodeToContent(node, props)
      }
    } else if (!isTextShapeContainer && !props.autoFitToContainer) {
      // Case (A): Konva.Text fast path
      this._shrinkTextNodeToContent(node, props)
    }

    const pending = this.pendingReg
    this.pendingReg = null // Consume

    if (pending) {
      const { layerId, flags, defaultTransform } = pending
      this.registerInteractiveNode(node, layerId, flags, defaultTransform)
    }

    return node
  }

  /**
   * Shrink a rendered text node's bounding box to fit the actual text content.
   *
   * Called for Konva.Text (case A) and Konva.Group with Text children (case B).
   * SVG-image groups use _attachLogicalBoundsOverride instead.
   */
  private _shrinkTextNodeToContent(node: Konva.Node, props: TextLayerProps): void {
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

    if (node instanceof Konva.Text) {
      applyToTextNode(node)
    } else if (node instanceof Konva.Group) {
      // Legacy effects path: group wraps Konva.Text children (main + shadow copies)
      const textChildren = node.find<Konva.Text>((n: Konva.Node) => n instanceof Konva.Text)
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
   * Fix: add a transparent Konva.Rect at (0, 0, safeW, safeH) inside the group,
   * then replace getClientRect() on the group to delegate to this marker rect.
   * The marker's getClientRect() accounts for the group's transforms (position,
   * rotation, scale) and returns the correct stage-coordinate bounds. The visual
   * SVG image is unchanged — effects/curves still render at full padded dimensions.
   */
  private _attachLogicalBoundsOverride(group: Konva.Group, safeW: number, safeH: number): void {
    if (safeW <= 0 || safeH <= 0) return

    // Override getClientRect directly using getAbsoluteTransform.
    // Reason: the SVG image child is padded (-maxPad,-maxPad, safeW+2*pad, safeH+2*pad),
    // so the default Group.getClientRect unions all children and returns a large rect.
    // We replace it to return the logical (0,0,safeW,safeH) area in stage coordinates.
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

  // ─── Override: clear ───────────────────────────────────────────────────────

  override clear(): void {
    // Snapshot user transforms before wiping state.
    // Content changes (image source, option selection, text) trigger a full
    // canvas re-render. We save the current user-modified transforms here so
    // registerInteractiveNode() can re-apply them after re-rendering.
    this._preservedTransforms.clear()
    for (const layerId of StorefrontLayerState.getAllLayerIds()) {
      const transform = StorefrontLayerState.getCurrent(layerId)
      if (transform) {
        this._preservedTransforms.set(layerId, {
          transform: { ...transform },
          deleted: StorefrontLayerState.isDeleted(layerId),
        })
      }
    }
    // Deselect before clearing (detaches transformer, hides DOM overlays)
    this.deselectAll()

    // Clear interactive node registry
    this.interactiveNodes.clear()

    // Clear state store
    StorefrontLayerState.clearAll()

    // Note: Do NOT clear undo stack here. It's cleared on Add to Cart instead.

    // super.clear() calls mainLayer.destroyChildren().
    // The transformer lives on a SEPARATE transformerLayer (not mainLayer),
    // so it is NOT affected by this clear. ✓
    super.clear()
  }

  // ─── Private: Resolve the correct interactive target node ────────────────

  /**
   * Resolve which Konva node should be the interactive target (drag/select/transform).
   *
   * Problem: some renderer paths return a LEAF node (e.g. `konvaImage`) that is a
   * child of a parent Group (`imageGroup`) which holds the actual (x, y) position.
   * Registering the leaf as draggable causes two issues:
   *   1. The leaf moves WITHIN its parent group — the parent group's x/y never changes.
   *   2. node.x() / node.y() return coordinates relative to the parent, not the canvas.
   *
   * Rule:
   * - If the returned node is NOT a Group and its immediate parent IS a Group
   *   → use the parent Group (it owns the layer-level x, y position).
   * - Otherwise (already a Group, or direct child of a Konva.Layer)
   *   → use the returned node as-is.
   *
   * Covers:
   *   • Standard image path  → returns konvaImage (child of imageGroup) → use imageGroup
   *   • ClipGroup image path → returns clipContainer (Group)            → use clipContainer
   *   • SVG text path        → returns group (Group)                    → use group
   *   • Simple text path     → returns textNode (direct Layer child)    → use textNode
   */
  private resolveInteractiveTarget(returnedNode: Konva.Node): Konva.Node {
    // Resolve to the parent Group when the returned node is a leaf child —
    // the parent Group owns the layer-level (x, y) position.
    if (!(returnedNode instanceof Konva.Group)) {
      const parent = returnedNode.getParent()
      if (parent instanceof Konva.Group) {
        return parent
      }
    }
    return returnedNode
  }

  // ─── Private: Register interactive node ───────────────────────────────────

  private registerInteractiveNode(
    node: Konva.Node,
    layerId: string,
    flags: LayerInteractionFlags,
    defaultTransform: LayerTransform
  ): void {
    const target = this.resolveInteractiveTarget(node)

    const id = layerId || `tlk-interactive-${++this.nodeCounter}`
    target.id(id)

    // Enable hit detection on the full ancestor/descendant chain. Konva skips
    // hit-testing for nodes with listening:false, and cached nodes retain stale
    // empty hit canvases — both must be fixed.
    target.listening(true)

    // Walk UP: enable listening on ancestors up to mainLayer
    let ancestor = target.getParent()
    while (ancestor && !(ancestor instanceof Konva.Layer)) {
      if (!ancestor.listening()) {
        ancestor.listening(true)
        if (ancestor.isCached()) ancestor.clearCache()
      }
      ancestor = ancestor.getParent()
    }

    // Walk DOWN: enable listening on all descendants.
    // NOTE: Pass a predicate function (not a CSS string) to find(). Konva's
    // _isMatch only handles className/nodeType strings; "Node" matches nothing.
    // A predicate (() => true) uses the function branch and returns all descendants.
    if (target instanceof Konva.Group) {
      target
        .find<Konva.Node>(() => true)
        .forEach((child: Konva.Node) => {
          if (!child.listening()) child.listening(true)
          if (child.isCached()) child.clearCache()
        })
    }

    // Clear target's own stale cache (if it was cached while listening:false)
    if (target.isCached()) target.clearCache()

    // Register in state store (sets current = defaultTransform)
    StorefrontLayerState.register(id, defaultTransform, flags)

    // Restore user's pre-re-render transform if available.
    // clear() snapshots transforms before wiping state. If the user had moved/
    // resized/rotated this layer before the content change that triggered the
    // re-render, we restore their state here instead of using the template default.
    const preserved = this._preservedTransforms.get(id)
    if (preserved) {
      const { transform: pt, deleted } = preserved
      const isDefaultPos
        = Math.abs(pt.x - defaultTransform.x) < 0.5
        && Math.abs(pt.y - defaultTransform.y) < 0.5
        && Math.abs(pt.width - defaultTransform.width) < 0.5
        && Math.abs(pt.height - defaultTransform.height) < 0.5
        && Math.abs(pt.rotation - defaultTransform.rotation) < 0.1
      if (!isDefaultPos || deleted) {
        // Update state store to reflect user's transform
        StorefrontLayerState.updateTransform(id, pt)

        // Physically reposition the Konva node to match
        target.x(pt.x)
        target.y(pt.y)
        target.rotation(pt.rotation)
        target.scaleX(1)
        target.scaleY(1)
        if (target instanceof Konva.Image) {
          // Image: restore explicit width/height
          target.width(pt.width)
          target.height(pt.height)
        } else if (target instanceof Konva.Group) {
          // Groups resize via scaleX/Y — restore scale from ratio of preserved vs default dimensions.
          const defaultW = defaultTransform.width > 0 ? defaultTransform.width : 1
          const defaultH = defaultTransform.height > 0 ? defaultTransform.height : 1
          const scaleX = pt.width / defaultW
          const scaleY = pt.height / defaultH
          // Only apply if meaningfully different from 1 (avoids unnecessary redraws)
          if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
            target.scaleX(scaleX)
            target.scaleY(scaleY)
          }
        }

        // Restore soft-delete state
        if (deleted) {
          StorefrontLayerState.markDeleted(id)
          target.visible(false)
        }
      }
    }

    // Register in local registry (target is the node used for drag/select/transform)
    this.interactiveNodes.set(id, target)

    // Configure draggability
    if (flags.movable) {
      target.draggable(true)
      this.attachDragHandlers(target, id, defaultTransform)
    } else {
      target.draggable(false)
    }

    // Click/tap to select
    target.on('click.interactive tap.interactive', e => {
      e.cancelBubble = true
      this.selectNode(target, id, flags)
    })

    // Mobile: allow single-finger drag (multi-touch gestures intentionally disabled)
    if (isMobile) {
      target.on('touchstart.interactive', e => {
        // Only handle single-touch
        const touch = e.evt as TouchEvent
        if (touch.touches.length > 1) {
          target.stopDrag()
          return
        }
        e.cancelBubble = true
        this.selectNode(target, id, flags)
      })
    }
  }

  // ─── Private: Drag handlers ────────────────────────────────────────────────

  private attachDragHandlers(node: Konva.Node, layerId: string, defaultTransform: LayerTransform): void {
    // Note: stageWidth/Height are computed dynamically in dragmove to handle
    // autoResize changes after handler setup. We use the original canvas size
    // (stage size ÷ scale) since node coordinates are in the un-scaled space.

    // Capture position at drag start for undo delta
    let dragStartTransform: LayerTransform | null = null

    node.on('dragstart.interactive', () => {
      const cur = StorefrontLayerState.getCurrent(layerId)
      dragStartTransform = cur ? { ...cur } : null
    })

    node.on('dragend.interactive', () => {
      const newX = node.x()
      const newY = node.y()
      const cur = StorefrontLayerState.getCurrent(layerId) ?? defaultTransform

      const newTransform: LayerTransform = {
        ...cur,
        x: newX,
        y: newY,
      }

      StorefrontLayerState.updateTransform(layerId, newTransform)

      if (dragStartTransform) {
        const before: Partial<LayerTransformSnapshot> = {
          x: dragStartTransform.x,
          y: dragStartTransform.y,
        }
        const after: Partial<LayerTransformSnapshot> = { x: newX, y: newY }

        // Only push delta if position actually changed
        if (Math.abs(newX - dragStartTransform.x) > 0.5 || Math.abs(newY - dragStartTransform.y) > 0.5) {
          StorefrontUndoStack.push({
            type: 'MOVE',
            layerId,
            before,
            after,
          })
        }
      }
    })

    // Bounds check: center-point of layer must stay inside canvas.
    // Uses getClientRect() to handle both Image and Group nodes correctly,
    // including rotated/scaled groups where direct width() is unreliable.
    node.on('dragmove.interactive', () => {
      const stage = this.getStage()
      // Compute original canvas size dynamically (handles autoResize after setup)
      const originalWidth = stage.width() / (stage.scaleX() || 1)
      const originalHeight = stage.height() / (stage.scaleY() || 1)

      // Get axis-aligned bounding box in stage coordinates
      const box = node.getClientRect({ relativeTo: stage })
      const halfW = box.width / 2
      const halfH = box.height / 2

      // Current center in stage coordinates
      const cx = box.x + halfW
      const cy = box.y + halfH

      // Clamp center to canvas bounds
      const clampedCx = Math.min(Math.max(cx, 0), originalWidth)
      const clampedCy = Math.min(Math.max(cy, 0), originalHeight)

      if (clampedCx !== cx || clampedCy !== cy) {
        // Adjust node position by the delta
        node.x(node.x() + (clampedCx - cx))
        node.y(node.y() + (clampedCy - cy))
      }
    })
  }

  // ─── Private: Selection ────────────────────────────────────────────────────

  private selectNode(node: Konva.Node, layerId: string, flags: LayerInteractionFlags): void {
    if (!this.transformer) return

    // Update transformer flags based on per-layer capabilities
    this.transformer.resizeEnabled(flags.resizable)
    this.transformer.rotateEnabled(flags.rotatable)

    // Always show solid border for all layers
    this.transformer.borderEnabled(true)
    this.transformer.borderDash([])
    this.transformer.borderStroke(TRANSFORMER_STROKE)

    // Attach transformer to node
    this.transformer.nodes([node])
    this.transformer.visible(true)
    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()

    this.selectedNode = node

    // Show DOM overlay controls
    if (this.layerControls && this.canvasContainerEl) {
      this.layerControls.attachToNode(node, this.getStage(), {
        onReset: () => this.resetLayer(layerId),
        onDelete: () => this.deleteLayer(layerId),
      })
    }

    // Notify listeners
    this.selectionListeners.forEach(l => l(layerId))
  }

  private deselectAll(): void {
    if (!this.transformer) return

    this.transformer.nodes([])
    this.transformer.visible(false)
    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()

    this.layerControls?.detach()
    this.selectedNode = null

    this.selectionListeners.forEach(l => l(null))
  }

  // ─── Public: Layer actions ─────────────────────────────────────────────────

  /**
   * Reset layer to merchant default position/size/rotation.
   * Text content and image source are preserved — only transform is reset.
   */
  resetLayer(layerId: string): void {
    const node = this.interactiveNodes.get(layerId)
    if (!node) return

    const before = StorefrontLayerState.getCurrent(layerId)
    const defaults = StorefrontLayerState.resetToDefault(layerId)
    if (!defaults) return

    // Apply defaults to Konva node
    node.x(defaults.x)
    node.y(defaults.y)
    node.rotation(defaults.rotation)
    // Reset scale to 1 (removes any accumulated scale from previous transforms)
    node.scaleX(1)
    node.scaleY(1)
    // For Konva.Image: also restore explicit width/height
    if (node instanceof Konva.Image) {
      node.width(defaults.width)
      node.height(defaults.height)
    }
    // For Konva.Group: scaleX/Y reset above is sufficient to restore original visual size

    // Ensure node is visible (in case it was previously deleted and re-added)
    node.visible(true)

    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()

    // Update transformer position if this node is selected
    if (this.selectedNode === node && this.transformer) {
      this.transformer.forceUpdate()
      this.layerControls?.updatePosition()
    }

    // Push undo delta
    if (before) {
      StorefrontUndoStack.push({
        type: 'RESET',
        layerId,
        before: {
          x: before.x,
          y: before.y,
          width: before.width,
          height: before.height,
          rotation: before.rotation,
        },
        after: {
          x: defaults.x,
          y: defaults.y,
          width: defaults.width,
          height: defaults.height,
          rotation: defaults.rotation,
        },
      })
    }
  }

  /**
   * Delete a layer immediately without confirmation dialog.
   * Uses soft-delete (hides node) and pushes DELETE delta to undo stack for undo support.
   */
  deleteLayer(layerId: string): void {
    const node = this.interactiveNodes.get(layerId)
    if (!node) {
      console.warn(`[TailorKit] deleteLayer: node not found for layerId="${layerId}"`)
      return
    }

    const before = StorefrontLayerState.getCurrent(layerId)

    // Deselect if this is the selected node
    if (this.selectedNode === node) {
      this.deselectAll()
    }

    // Hide node visually (soft-delete for undo support)
    node.visible(false)
    StorefrontLayerState.markDeleted(layerId)

    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()

    // Push undo delta
    if (before) {
      StorefrontUndoStack.push({
        type: 'DELETE',
        layerId,
        before: {
          x: before.x,
          y: before.y,
          width: before.width,
          height: before.height,
          rotation: before.rotation,
          deleted: false,
        },
        after: {
          ...before,
          deleted: true,
        },
      })
    }
  }

  // ─── Public: Undo / Redo ───────────────────────────────────────────────────

  undo(): void {
    const delta = StorefrontUndoStack.undo()
    if (!delta) return
    this.applyDeltaInReverse(delta)
  }

  redo(): void {
    const delta = StorefrontUndoStack.redo()
    if (!delta) return
    this.applyDeltaForward(delta)
  }

  private applyDeltaInReverse(delta: UndoDelta): void {
    const { layerId, before, type } = delta

    // CONTENT delta — DOM-based undo; caller's undoFn handles all DOM + re-render
    if (type === 'CONTENT') {
      if (delta.undoFn) {
        this.deselectAll()
        delta.undoFn()
      }
      return
    }

    const node = this.interactiveNodes.get(layerId)
    if (!node) return

    if (type === 'DELETE') {
      // Undo delete = restore node
      node.visible(true)
      StorefrontLayerState.restoreDeleted(layerId)
    } else {
      // Restore previous transform
      if (before.x !== undefined) node.x(before.x)
      if (before.y !== undefined) node.y(before.y)
      if (before.rotation !== undefined) node.rotation(before.rotation)
      node.scaleX(1)
      node.scaleY(1)
      if (node instanceof Konva.Image) {
        if (before.width !== undefined) node.width(before.width)
        if (before.height !== undefined) node.height(before.height)
      } else if (node instanceof Konva.Group) {
        // Groups resize via scaleX/Y, not explicit width/height — recompute scale from stored width vs default.
        const defaultTransform = StorefrontLayerState.getDefault(layerId)
        if (defaultTransform && before.width !== undefined && before.height !== undefined) {
          const defaultW = defaultTransform.width > 0 ? defaultTransform.width : 1
          const defaultH = defaultTransform.height > 0 ? defaultTransform.height : 1
          const scaleX = before.width / defaultW
          const scaleY = before.height / defaultH
          if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
            node.scaleX(scaleX)
            node.scaleY(scaleY)
          }
        }
      }

      // For MOVE deltas, before/after only carry x/y — width is undefined. Fall back to
      // current state to avoid zeroing out stored dimensions.
      const currentTransform = StorefrontLayerState.getCurrent(layerId)
      const stateWidth = before.width ?? (node instanceof Konva.Image ? node.width() : (currentTransform?.width ?? 0))
      const stateHeight
        = before.height ?? (node instanceof Konva.Image ? node.height() : (currentTransform?.height ?? 0))
      StorefrontLayerState.updateTransform(layerId, {
        x: before.x ?? node.x(),
        y: before.y ?? node.y(),
        width: stateWidth,
        height: stateHeight,
        rotation: before.rotation ?? node.rotation(),
      })
    }

    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()
    if (this.selectedNode === node && this.transformer) {
      this.transformer.forceUpdate()
      this.layerControls?.updatePosition()
    }
  }

  private applyDeltaForward(delta: UndoDelta): void {
    const { layerId, after, type } = delta

    // CONTENT delta — DOM-based redo; caller's redoFn handles all DOM + re-render
    if (type === 'CONTENT') {
      if (delta.redoFn) {
        this.deselectAll()
        delta.redoFn()
      }
      return
    }

    const node = this.interactiveNodes.get(layerId)
    if (!node) return

    if (type === 'DELETE') {
      // Redo delete = hide again
      if (this.selectedNode === node) this.deselectAll()
      node.visible(false)
      StorefrontLayerState.markDeleted(layerId)
    } else {
      if (after.x !== undefined) node.x(after.x)
      if (after.y !== undefined) node.y(after.y)
      if (after.rotation !== undefined) node.rotation(after.rotation)
      node.scaleX(1)
      node.scaleY(1)
      if (node instanceof Konva.Image) {
        if (after.width !== undefined) node.width(after.width)
        if (after.height !== undefined) node.height(after.height)
      } else if (node instanceof Konva.Group) {
        // Groups resize via scaleX/Y, not explicit width/height — recompute scale from stored width vs default.
        const defaultTransform = StorefrontLayerState.getDefault(layerId)
        if (defaultTransform && after.width !== undefined && after.height !== undefined) {
          const defaultW = defaultTransform.width > 0 ? defaultTransform.width : 1
          const defaultH = defaultTransform.height > 0 ? defaultTransform.height : 1
          const scaleX = after.width / defaultW
          const scaleY = after.height / defaultH
          if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
            node.scaleX(scaleX)
            node.scaleY(scaleY)
          }
        }
      }

      // For MOVE deltas, before/after only carry x/y — width is undefined. Fall back to
      // current state to avoid zeroing out stored dimensions.
      const currentTransform = StorefrontLayerState.getCurrent(layerId)
      const stateWidth = after.width ?? (node instanceof Konva.Image ? node.width() : (currentTransform?.width ?? 0))
      const stateHeight
        = after.height ?? (node instanceof Konva.Image ? node.height() : (currentTransform?.height ?? 0))
      StorefrontLayerState.updateTransform(layerId, {
        x: after.x ?? node.x(),
        y: after.y ?? node.y(),
        width: stateWidth,
        height: stateHeight,
        rotation: after.rotation ?? node.rotation(),
      })
    }

    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()
    if (this.selectedNode === node && this.transformer) {
      this.transformer.forceUpdate()
      this.layerControls?.updatePosition()
    }
  }

  // ─── Public: Selection listeners ──────────────────────────────────────────

  onSelectionChange(listener: SelectionChangeListener): () => void {
    this.selectionListeners.add(listener)
    return () => this.selectionListeners.delete(listener)
  }

  // ─── Public: Getters ──────────────────────────────────────────────────────

  getSelectedLayerId(): string | null {
    return this.selectedNode?.id() ?? null
  }

  isInteractiveLayer(layerId: string): boolean {
    return this.interactiveNodes.has(layerId)
  }

  // ─── Override: dispose ────────────────────────────────────────────────────

  override dispose(): void {
    this.deselectAll()
    this.layerControls?.destroy()
    this.undoRedoControls?.destroy()
    this.interactiveNodes.clear()
    this.transformer?.destroy()
    this.transformer = null
    this.transformerLayer?.destroy()
    this.transformerLayer = null
    super.dispose()
  }
}
