/**
 * Extends KonvaCanvasManager with customer-facing layer interaction:
 * Move (drag), Resize, Rotate — with per-layer capability flags.
 */

import Konva from 'konva'

import { KonvaCanvasManager } from '../../../shared/libraries/konva/core'
import { applyLayerRotation, type ImageLayerProps } from '../../../shared/libraries/konva/image'
import type { TextLayerProps } from '../../../shared/libraries/konva/text'
import { StorefrontLayerState } from '../../stores/storefront-layer-state'
import type { LayerInteractionFlags, LayerTransform } from '../../stores/storefront-layer-state'
import { StorefrontUndoStack } from '../../stores/storefront-undo-stack'
import { StorefrontLayerControls } from '../../components/layer-controls/StorefrontLayerControls'
import { StorefrontUndoRedoControls } from '../../components/layer-controls/StorefrontUndoRedoControls'

import {
  TRANSFORMER_STROKE,
  ANCHOR_FILL,
  ANCHOR_SIZE_DEFAULT,
  ANCHOR_SIZE_MOBILE,
  MIN_LAYER_SIZE,
  isMobile,
} from './constants'
import type { PendingInteractiveReg, SelectionChangeListener, ManagerContext, DragPlugin } from './constants'
import { shrinkTextNodeToContent, attachLogicalBoundsOverride } from './text-bounds'
import { attachDragHandlers } from './drag-handlers'
import { applyDeltaInReverse, applyDeltaForward } from './undo-redo'
import { resetLayer as resetLayerAction, deleteLayer as deleteLayerAction } from './layer-actions'
import { createZoneIndicator, showZoneIndicator, hideZoneIndicator } from './zone-indicator'
import { wrapNodeInMovementZoneClip, MOVEMENT_ZONE_CLIP_ATTR } from './movement-zone-clip'
import { buildZoneHitResources, isInsideZone } from './zone-hit-test'
import { readUndoRedoSetting } from './settings-utils'
import { initMobileTouchRelay } from './mobile-touch-relay'
import { findScaledAncestorGroup, getAncestorScaleX } from './scaled-ancestor'

// ─── Class ───────────────────────────────────────────────────────────────────

export class StorefrontInteractiveCanvasManager extends KonvaCanvasManager {
  private transformer: Konva.Transformer | null = null
  /** Separate layer so super.clear() (mainLayer.destroyChildren) doesn't destroy the transformer. */
  private transformerLayer: Konva.Layer | null = null
  private selectedNode: Konva.Node | null = null
  private interactiveNodes: Map<string, Konva.Node> = new Map()
  /** Transforms snapshotted before clear() so user edits survive content-change re-renders. */
  private _preservedTransforms: Map<string, { transform: LayerTransform; deleted: boolean }> = new Map()
  /** Consumed by the next addImageLayer/addTextLayer call to make that layer interactive. */
  private pendingReg: PendingInteractiveReg | null = null
  private layerControls: StorefrontLayerControls | null = null
  private undoRedoControls: StorefrontUndoRedoControls | null = null
  private undoRedoUnsubscribe: (() => void) | null = null
  private nodeCounter = 0
  private selectionListeners: Set<SelectionChangeListener> = new Set()
  private dragPlugins: Map<string, DragPlugin> = new Map()
  private canvasContainerEl: HTMLElement | null = null
  /** Gates the mobile DD event relay — true while any pointer interaction is active. */
  private _interactivePointerActive = false

  // ─── Initialization ────────────────────────────────────────────────────────

  /** Must be called after initStage. containerEl is used to position DOM overlay controls. */
  initInteractiveMode(containerEl: HTMLElement): void {
    this.canvasContainerEl = containerEl

    const stage = this.getStage()
    const mainLayer = this.getMainLayer()

    this.transformer = new Konva.Transformer({
      anchorSize: isMobile ? ANCHOR_SIZE_MOBILE : ANCHOR_SIZE_DEFAULT,
      anchorCornerRadius: 2,
      anchorStroke: TRANSFORMER_STROKE,
      anchorFill: ANCHOR_FILL,
      anchorStrokeWidth: 1.5,
      borderStroke: TRANSFORMER_STROKE,
      borderStrokeWidth: 1.5,
      ignoreStroke: true,
      rotateEnabled: true,
      resizeEnabled: true,
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < MIN_LAYER_SIZE || Math.abs(newBox.height) < MIN_LAYER_SIZE) return oldBox
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
      let newWidth = baseWidth * scaleX
      let newHeight = baseHeight * scaleY

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

      // Determine delta type (RESIZE vs ROTATE) by comparing rotation.
      const isRotate = prevTransform ? Math.abs(newTransform.rotation - prevTransform.rotation) > 0.5 : false
      const deltaType = isRotate ? 'ROTATE' : 'RESIZE'

      // Post-transform: keep text within the movement zone.
      const nodeFlags = StorefrontLayerState.getFlags(nodeId)
      if (nodeFlags?.movementBounds) {
        const zb = nodeFlags.movementBounds

        if (isRotate) {
          // After rotation, scale text down so its rotated AABB fits within zone.
          // Without this, wide text (e.g. 718px) at any significant angle produces
          // an AABB taller than the zone, causing the Transformer handles to float
          // far outside the zone while the text is clipped invisible.
          const rad = Math.abs((newTransform.rotation * Math.PI) / 180)
          const cosR = Math.abs(Math.cos(rad))
          const sinR = Math.abs(Math.sin(rad))
          const aabbW = newWidth * cosR + newHeight * sinR
          const aabbH = newWidth * sinR + newHeight * cosR
          const fitScale = Math.min(zb.width / aabbW, zb.height / aabbH, 1.0)

          if (fitScale < 1) {
            // Scale down to fit — apply via node scale (Groups have width=0)
            node.scaleX(node.scaleX() * fitScale)
            node.scaleY(node.scaleY() * fitScale)
            newWidth *= fitScale
            newHeight *= fitScale
            newTransform.width = newWidth
            newTransform.height = newHeight
          }

          // Center text in zone after rotation for maximum visibility.
          // Compute geometric center in zone-local coords (node is inside clip
          // group at zb.x, zb.y), then set position so center = zone center.
          const rotRad = (newTransform.rotation * Math.PI) / 180
          const cos = Math.cos(rotRad)
          const sin = Math.sin(rotRad)
          const centerOffX = (newWidth / 2) * cos - (newHeight / 2) * sin
          const centerOffY = (newWidth / 2) * sin + (newHeight / 2) * cos
          node.x(zb.width / 2 - centerOffX)
          node.y(zb.height / 2 - centerOffY)
          newTransform.x = node.x()
          newTransform.y = node.y()
          StorefrontLayerState.updateTransform(nodeId, newTransform)
          mainLayer.batchDraw()
          this.transformerLayer?.batchDraw()
        } else {
          // For resize: snap back only if center drifted outside zone.
          // Use template-space coords (relativeTo scaled ancestor) to match zone bounds.
          const scaledGroup = findScaledAncestorGroup(node)
          const refNode = scaledGroup ?? this.getStage()
          const nodeBox = node.getClientRect({ relativeTo: refNode })
          const cx = nodeBox.x + nodeBox.width / 2
          const cy = nodeBox.y + nodeBox.height / 2
          const resources = buildZoneHitResources(zb)
          if (!isInsideZone(cx, cy, zb, resources)) {
            const zCx = zb.x + zb.width / 2
            const zCy = zb.y + zb.height / 2
            let lo = 0
            let hi = 1
            let bestX = zCx
            let bestY = zCy
            for (let i = 0; i < 12; i++) {
              const mid = (lo + hi) / 2
              const mx = zCx + mid * (cx - zCx)
              const my = zCy + mid * (cy - zCy)
              if (isInsideZone(mx, my, zb, resources)) {
                lo = mid
                bestX = mx
                bestY = my
              } else {
                hi = mid
              }
            }
            node.x(node.x() + (bestX - cx))
            node.y(node.y() + (bestY - cy))
            newTransform.x = node.x()
            newTransform.y = node.y()
            StorefrontLayerState.updateTransform(nodeId, newTransform)
            mainLayer.batchDraw()
          }
        }
      }

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
    // touchend/touchmove: on mobile, handled conditionally in initMobileTouchRelay
    // (must reach window for Konva Transformer's window.addEventListener handlers).
    // On desktop (no touch), add blanket stop to prevent any theme-level listeners.
    if (!isMobile) {
      containerEl.addEventListener('touchend', _stopBubble, false)
      containerEl.addEventListener('touchmove', _stopBubble, { passive: false, capture: false })
    }

    // ── Touch: prevent scroll and zoom-wrapper conflict ─────────────────
    // Extracted to mobile-touch-relay.ts for modularity.
    initMobileTouchRelay(isMobile, stage, {
      getActive: () => this._interactivePointerActive,
      setActive: v => {
        this._interactivePointerActive = v
      },
      getSelectedNode: () => this.selectedNode,
      getTransformer: () => this.transformer,
    })

    // ── DOM Overlay Controls ──────────────────────────────────────────────
    this.layerControls = new StorefrontLayerControls(containerEl, { deleteBtn: true, resetBtn: true })

    // Only show undo/redo controls when enabled in app settings (default: off)
    const undoRedoEnabled = readUndoRedoSetting()
    if (undoRedoEnabled) {
      this.undoRedoControls = new StorefrontUndoRedoControls(containerEl, {
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
      })

      // Sync undo/redo button state — store unsubscribe fn for cleanup in dispose()
      this.undoRedoUnsubscribe = StorefrontUndoStack.subscribe((canUndo, canRedo) => {
        this.undoRedoControls?.update(canUndo, canRedo)
      })
    }
  }

  // ─── Public: Drag Plugin Registration ────────────────────────────────────

  /**
   * Register a drag plugin by name. Plugins extend drag behavior (e.g., charm snap-to-slot).
   * Duplicate names overwrite the previous plugin.
   */
  registerDragPlugin(name: string, plugin: DragPlugin): void {
    this.dragPlugins.set(name, plugin)
  }

  /** Get all registered drag plugins (used by drag-handlers) */
  getDragPlugins(): DragPlugin[] {
    return Array.from(this.dragPlugins.values())
  }

  // ─── Public: Interactive layer registration ────────────────────────────────

  /**
   * Clear preserved transforms whose IDs start with the given prefix.
   *
   * Used by charm-layer-renderer: charm IDs contain an index that SHIFTS when
   * a new charm is inserted (e.g., heart shifts from idx 1 → idx 2). The
   * preserved transform for the old index would be applied to the WRONG charm.
   * Clearing charm entries before re-rendering lets the renderer's own cache
   * (freeModePositionsCache) handle position/size preservation instead.
   */
  clearPreservedTransformsForPrefix(prefix: string): void {
    const toDelete: string[] = []
    this._preservedTransforms.forEach((_value, key) => {
      if (key.startsWith(prefix)) toDelete.push(key)
    })
    toDelete.forEach(key => this._preservedTransforms.delete(key))
  }

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
    // Skip shrinkTextNodeToContent for movement-zone layers — it adjusts node.x() for
    // text alignment which gets baked into drag positions. The print renderer clips to
    // movementBounds without this adjustment, causing text to leak outside the zone.
    const hasMovementZone = this.pendingReg?.flags?.movementBounds
    if (!hasMovementZone) {
      if (node instanceof Konva.Group) {
        const textChildren = node.find<Konva.Text>((n: Konva.Node) => n instanceof Konva.Text)
        const hasSVGImageChild = textChildren.length === 0

        if (hasSVGImageChild) {
          attachLogicalBoundsOverride(node, props.width || 0, props.height || 0)
        } else if (!isTextShapeContainer && !props.autoFitToContainer) {
          shrinkTextNodeToContent(node, props)
        }
      } else if (!isTextShapeContainer && !props.autoFitToContainer) {
        shrinkTextNodeToContent(node, props)
      }
    } else if (node instanceof Konva.Group) {
      const textChildren = node.find<Konva.Text>((n: Konva.Node) => n instanceof Konva.Text)
      if (textChildren.length === 0) {
        attachLogicalBoundsOverride(node, props.width || 0, props.height || 0)
      }
    }

    const pending = this.pendingReg
    this.pendingReg = null // Consume

    if (pending) {
      const { layerId, flags, defaultTransform } = pending

      // ── Movement zone clip group ───────────────────────────────────────────
      // When the layer has a movement zone, wrap the text node in a Konva.Group
      // with a clipFunc so text outside the zone boundary is hidden (clip mask).
      // The clip group becomes the new interactive target (drag/select/transform).
      // The zone indicator (visual border) is added outside the clip group so it
      // remains visible regardless of the clip region.
      if (flags.movementBounds) {
        // Use the node's current parent (scaled group with __groupScale) so the clip group
        // inherits the same coordinate transform. Adding to mainLayer directly would bypass
        // the __groupScale, causing position/size mismatch with other layers.
        const container = node.getParent() || this.getMainLayer()
        const { interactiveTarget } = wrapNodeInMovementZoneClip(node, layerId, flags.movementBounds, container)

        // defaultTransform from layer-renderer has canvas coords: (bounds.x + offsetX, bounds.y + offsetY).
        // The text is now at zone-local coords inside the clip group positioned at (bounds.x, bounds.y).
        // Convert to zone-local so StorefrontLayerState stores/restores group-local x/y correctly.
        const zoneLocalDefaultTransform: LayerTransform = {
          ...defaultTransform,
          x: defaultTransform.x - flags.movementBounds.x,
          y: defaultTransform.y - flags.movementBounds.y,
        }

        // Register the TEXT node (not clip group) as the interactive target.
        // The clip group is fixed — only the text inside is draggable.
        this.registerInteractiveNode(interactiveTarget, layerId, flags, zoneLocalDefaultTransform)
      } else {
        this.registerInteractiveNode(node, layerId, flags, defaultTransform)
      }
    }

    return node
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
    // Notify drag plugins to reset their state
    for (const plugin of this.dragPlugins.values()) plugin.onReset?.()

    // Deselect before clearing (detaches transformer, hides DOM overlays)
    this.deselectAll()

    // Clear interactive node registry
    this.interactiveNodes.clear()

    // Clear state store (fires beforeClear hooks first, e.g., charm cache sync)
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
    if (!(returnedNode instanceof Konva.Group)) {
      const parent = returnedNode.getParent()
      // Don't bubble up to a movement zone clip group — it is a fixed viewport,
      // not the interactive target. The text node inside is the drag target.
      if (parent instanceof Konva.Group && !parent.getAttr(MOVEMENT_ZONE_CLIP_ATTR)) {
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

        // Physically reposition the Konva node to match. Use applyLayerRotation so
        // rotation lands on the inner Image when the group was created with an
        // explicit rotation pivot (charm rendering) — otherwise rotation would compound
        // with the image's own rotation and pivot at the bbox top-left.
        target.x(pt.x)
        target.y(pt.y)
        applyLayerRotation(target, pt.rotation)
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
      if (isMobile) target.dragDistance(0) // Remove 3px threshold for touch
      attachDragHandlers(
        target,
        id,
        defaultTransform,
        () => this.getStage(),
        () => this.getDragPlugins(),
        flags
      )
    } else {
      target.draggable(false)
    }

    // Zone indicator: add to the same parent as the clip group so it inherits __groupScale.
    if (flags.movementBounds) {
      const mainLayer = this.getMainLayer()
      const zoneShape = createZoneIndicator(id, flags.movementBounds)
      // The clip group's parent is the scaled group (or mainLayer fallback).
      const grandParent = target.getParent()?.getParent()
      // Fallback to mainLayer when grandParent is Stage (no template group wrapping the layer)
      const clipParentContainer
        = grandParent && !(grandParent instanceof Konva.Stage) ? grandParent : this.getMainLayer()
      clipParentContainer.add(zoneShape)
      // Position indicator just above the clip group in z-order.
      const clipGroup = target.getParent()
      if (clipGroup) {
        zoneShape.setZIndex(clipGroup.getZIndex() + 1)
      } else {
        zoneShape.moveToTop()
      }
      zoneShape.getLayer()?.batchDraw()

      // Show on hover, hide when mouse leaves (unless selected)
      target.on('mouseover.zoneIndicator', () => {
        const isSelected = this.selectedNode === target
        if (!isSelected) showZoneIndicator(mainLayer, id)
      })
      target.on('mouseout.zoneIndicator', () => {
        const isSelected = this.selectedNode === target
        if (!isSelected) hideZoneIndicator(mainLayer, id)
      })
      // Show zone indicator during drag — mouseout fires mid-drag hiding it prematurely
      target.on('dragstart.zoneIndicator', () => {
        showZoneIndicator(mainLayer, id)
      })
      target.on('dragend.zoneIndicator', () => {
        const isSelected = this.selectedNode === target
        if (!isSelected) hideZoneIndicator(mainLayer, id)
      })
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
        if (flags.movable) {
          this._interactivePointerActive = true
          e.evt.preventDefault()
          e.evt.stopPropagation()
        }
        this.selectNode(target, id, flags)
      })
    }
  }

  // ─── Private: Selection ────────────────────────────────────────────────────

  private selectNode(node: Konva.Node, layerId: string, flags: LayerInteractionFlags): void {
    if (!this.transformer) return

    // Deselect previous: hide its zone indicator before switching
    if (this.selectedNode && this.selectedNode !== node) {
      const prevId = this.selectedNode.id()
      hideZoneIndicator(this.getMainLayer(), prevId)
    }

    // Update transformer flags based on per-layer capabilities
    this.transformer.resizeEnabled(flags.resizable)
    this.transformer.rotateEnabled(flags.rotatable)

    // Resize constraint: enforce minimum size + zone-aware maximum.
    // When movementBounds exists, cap each AABB dimension at the zone's longest side.
    // This prevents degenerate states (text 10x zone → only a sliver visible through clip)
    // while allowing natural resize at any rotation angle.
    // Note: this is a visual UX constraint, not print-safe enforcement — see plan for details.
    const zoneBounds = flags.movementBounds
    if (zoneBounds) {
      const stageScale = this.getStage().scaleX() || 1
      const groupScale = getAncestorScaleX(node)
      const maxDim = Math.max(zoneBounds.width, zoneBounds.height) * stageScale * groupScale
      this.transformer.boundBoxFunc((oldBox, newBox) => {
        if (Math.abs(newBox.width) < MIN_LAYER_SIZE) return oldBox
        if (Math.abs(newBox.width) > maxDim || Math.abs(newBox.height) > maxDim) return oldBox
        return newBox
      })
    } else {
      this.transformer.boundBoxFunc((oldBox, newBox) => (Math.abs(newBox.width) < MIN_LAYER_SIZE ? oldBox : newBox))
    }

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

    // Show zone indicator at full opacity when selected
    if (flags.movementBounds) {
      showZoneIndicator(this.getMainLayer(), layerId)
    }

    // Show DOM overlay controls with layer-type-appropriate buttons:
    // Charm layers → delete button (always); Text/image layers → reset button (when transform changed)
    if (this.layerControls && this.canvasContainerEl) {
      const isCharm = layerId.startsWith('charm-')
      this.layerControls.attachToNode(node, this.getStage(), {
        onDelete: () => this.deleteLayer(layerId),
        onReset: () => this.resetLayer(layerId),
      })
      // Set AFTER attachToNode — overrides the default hidden state set by detach()
      this.layerControls.setButtonVisibility({
        showDelete: isCharm,
        showReset: !isCharm,
      })
    }

    // Notify listeners
    this.selectionListeners.forEach(l => l(layerId))
  }

  private deselectAll(): void {
    if (!this.transformer) return

    // Hide zone indicator for the currently selected node before deselecting
    if (this.selectedNode) {
      hideZoneIndicator(this.getMainLayer(), this.selectedNode.id())
    }

    this.transformer.nodes([])
    this.transformer.visible(false)
    this.getMainLayer().batchDraw()
    this.transformerLayer?.batchDraw()

    this.layerControls?.detach()
    this.selectedNode = null

    this.selectionListeners.forEach(l => l(null))
  }

  // ─── Private: Build context for extracted helpers ──────────────────────────

  private _getContext(): ManagerContext {
    return {
      interactiveNodes: this.interactiveNodes,
      selectedNode: this.selectedNode,
      transformer: this.transformer,
      transformerLayer: this.transformerLayer,
      layerControls: this.layerControls,
      getMainLayer: () => this.getMainLayer(),
      deselectAll: () => this.deselectAll(),
    }
  }

  // ─── Public: Layer actions ─────────────────────────────────────────────────

  /**
   * Reset layer to merchant default position/size/rotation.
   * Text content and image source are preserved — only transform is reset.
   */
  resetLayer(layerId: string): void {
    resetLayerAction(layerId, this._getContext())
  }

  /**
   * Delete a layer immediately without confirmation dialog.
   * Uses soft-delete (hides node) and pushes DELETE delta to undo stack for undo support.
   */
  deleteLayer(layerId: string): void {
    deleteLayerAction(layerId, this._getContext())
  }

  // ─── Public: Undo / Redo ───────────────────────────────────────────────────

  undo(): void {
    const delta = StorefrontUndoStack.undo()
    if (!delta) return
    applyDeltaInReverse(delta, this._getContext())
  }

  redo(): void {
    const delta = StorefrontUndoStack.redo()
    if (!delta) return
    applyDeltaForward(delta, this._getContext())
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

  getTransformerLayer(): Konva.Layer | null {
    return this.transformerLayer
  }

  getInteractiveNodes(): Map<string, Konva.Node> {
    return this.interactiveNodes
  }

  // ─── Proxy methods for cross-bundle plugin access ─────────────────────────
  // These expose konva-bundle-scoped singletons (StorefrontLayerState, StorefrontUndoStack, Konva)
  // so that plugins in other IIFE bundles (e.g., charm-builder) can use the SAME instances
  // without importing them (which would create duplicates in each IIFE bundle).

  /** Proxy: StorefrontLayerState.getCurrent */
  getLayerCurrent(layerId: string): LayerTransform | undefined {
    return StorefrontLayerState.getCurrent(layerId)
  }

  /** Proxy: StorefrontLayerState.updateTransform */
  updateLayerTransform(layerId: string, transform: LayerTransform): void {
    StorefrontLayerState.updateTransform(layerId, transform)
  }

  /** Proxy: StorefrontUndoStack.push */
  pushUndoDelta(delta: {
    type: string
    layerId: string
    before: Record<string, unknown>
    after: Record<string, unknown>
  }): void {
    StorefrontUndoStack.push(delta as any)
  }

  /** Proxy: new Konva.Circle(...) — uses the shared Konva instance */
  createKonvaCircle(config: Record<string, unknown>): Konva.Circle {
    return new Konva.Circle(config as any)
  }

  // ─── Override: dispose ────────────────────────────────────────────────────

  override dispose(): void {
    // Dispose drag plugins
    for (const plugin of this.dragPlugins.values()) plugin.onDispose?.()
    this.dragPlugins.clear()

    this.deselectAll()
    this.layerControls?.destroy()
    this.undoRedoUnsubscribe?.()
    this.undoRedoUnsubscribe = null
    this.undoRedoControls?.destroy()
    this.interactiveNodes.clear()
    this.transformer?.destroy()
    this.transformer = null
    this.transformerLayer?.destroy()
    this.transformerLayer = null
    super.dispose()
  }
}
