/**
 * Zone-aware renderer for customer-created text layers with a movementBounds zone.
 *
 * Group mode (single-click): Zone Group id=layerId, name=LAYER_NAME → Transformer targets zone.
 * Content mode (double-click): id/name swapped to text node → Transformer rebinds to text.
 * Preview mode: simulates buyer interaction — text draggable within zone, zone fixed.
 */

import { ZONE_STROKE_COLOR } from 'extensions/tailorkit-src/src/shared/constants/movement-zone'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { Group, Rect } from 'react-konva'
import { INNER_EDIT_NODE_NAME, LAYER_NAME } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import {
  MUTATION_LAYER_FROM_INSPECTOR_EVENTS,
  TEMPLATE_EDITOR_TRANSMISSION_EVENTS,
} from '~/modules/TemplateEditor/constants'
import type { TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { MovementBounds, ShapeSetting } from '~/types/psd'
import { GUIDE_LINE_NAME } from '~/components/canvas/constants'
import { clearGuides } from '~/utils/canvas/snappingObject'
import { buildZoneClipFunc } from './TextMovementZoneOverlay.client'
import { ZoneBorderShape } from './TextMovementZoneBorder.client'
import { registerDesignSnapshot, unregisterDesignSnapshot } from './preview-design-snapshot-registry'
import { useZoneTextInteraction } from './useZoneTextInteraction.client'
import { TextElementRendererComponent } from './renderer.client'
import type { TextCanvasWithZoneProps } from './renderer.client'
import { scaleSvgPath } from '~/components/canvas/elements/Text/utils/movement-zone-path-transform.client'

// Cast to accept extra Konva passthrough props when bypassing withInteractiveElement HOC
type TextRendererDirectProps = TextCanvasWithZoneProps & {
  id: string
  spriteRef: React.RefObject<Konva.Node | null>
  name?: string
  draggable?: boolean
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number }
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void
  onTransformEnd?: (e: KonvaEventObject<Event>) => void
  listening?: boolean
}
const TextRendererDirect = TextElementRendererComponent as ComponentType<TextRendererDirectProps>

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_MODE_FILL = 'rgba(0,91,211,0.04)'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextWithZoneGroupRendererProps {
  layerStore: TLayerStore
  previewMode?: boolean
  /** Virtual bounds for free-movement preview (no zone configured in admin) */
  virtualBounds?: MovementBounds
  onChangeCircleStartAngle?: (value: number) => void
  onChangeCircleEndAngle?: (value: number) => void
  onChangeCurveBend?: (value: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

function TextWithZoneGroupRendererComponent({
  layerStore,
  previewMode,
  virtualBounds,
  onChangeCircleStartAngle,
  onChangeCircleEndAngle,
  onChangeCurveBend,
}: TextWithZoneGroupRendererProps) {
  const [contentMode, setContentMode] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const textRef = useRef<Konva.Node>(null)
  // Updated BEFORE scale-reset in handleZoneGroupTransformEnd to avoid 1-frame transformer flicker
  const effectiveBoundsRef = useRef<MovementBounds | null>(null)
  // Snapshot design state on preview entry; restored on exit to prevent buyer interactions bleeding into Design tab
  const designSnapshotRef = useRef<{
    left: number
    top: number
    width: number
    height: number
    rotate: number
    shapeSettings: ShapeSetting | undefined
  } | null>(null)

  const layerId = useStore(layerStore, s => s._id)
  const shapeSettings = useStore(layerStore, s => s.shapeSettings)
  const locked = useStore(layerStore, s => s.locked)

  const clickedLayerStore = useStore(LayerStoreSelection, s => s.clickedLayerStore)
  const isSelected = useMemo(() => clickedLayerStore?.getState()?._id === layerId, [clickedLayerStore, layerId])

  // Preview mode: simulate buyer interaction — text is movable within zone,
  // but zone itself is fixed (no group drag/resize/double-click).
  // Force content mode so text is directly draggable.
  const isPreview = Boolean(previewMode)

  const bounds = (shapeSettings?.movementBounds || virtualBounds) as MovementBounds

  // Must sync synchronously during render — Konva flushes batchDraw before useEffect fires,
  // calling getClientRect override that reads this ref.
  if (bounds) effectiveBoundsRef.current = bounds

  // On mount: rebind transformer (handles mid-session zone mode enable where selectedIds unchanged)
  useEffect(() => {
    setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
  }, [])

  useEffect(() => {
    if (!isSelected) setContentMode(false)
  }, [isSelected])

  const exitContentMode = useCallback(() => setContentMode(false), [])
  const enterContentMode = useCallback(() => setContentMode(true), [])

  // Rebind transformer after contentMode changes and React re-renders with new id/name
  useEffect(() => {
    setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
  }, [contentMode])

  useEffect(() => {
    if (!contentMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitContentMode()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [contentMode, exitContentMode])

  // Snapshot design position/size/rotation on preview entry; restore on exit or unmount.
  // This keeps preview purely simulative — buyer interactions don't bleed into Design tab.
  // Also registers the snapshot in a module-level registry so the save flow can read
  // design values even when save is triggered while still in preview mode.
  useEffect(() => {
    if (!isPreview) return
    const s = layerStore.getState()
    const snapshot = {
      left: s.left ?? 0,
      top: s.top ?? 0,
      width: s.width ?? 0,
      height: s.height ?? 0,
      rotate: s.rotate ?? 0,
      shapeSettings: s.shapeSettings,
    }
    designSnapshotRef.current = snapshot
    registerDesignSnapshot(layerId, snapshot)
    return () => {
      unregisterDesignSnapshot(layerId)
      if (designSnapshotRef.current) {
        const snap = designSnapshotRef.current
        designSnapshotRef.current = null
        layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: snap } })
      }
    }
  }, [isPreview, layerId, layerStore])

  const handleZoneGroupDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      // dragend bubbles — ignore if target is the text node (content mode drag)
      if (e.target !== e.currentTarget) return

      const node = e.target as Konva.Group
      const newX = node.x()
      const newY = node.y()
      // Don't reset node.x(0)/y(0) — causes a 1-frame visual jump to (0,0)
      // before React re-renders with the correct position. The node stays at
      // its dragged position; React-Konva reconciles prop x={newBounds.x} on
      // re-render without any visible glitch.

      const layer = node.getLayer()
      if (layer) clearGuides(layer, GUIDE_LINE_NAME)

      const current = layerStore.getState()
      const defX = current.shapeSettings?.defaultOffsetX ?? 0
      const defY = current.shapeSettings?.defaultOffsetY ?? 0

      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            left: newX + defX,
            top: newY + defY,
            shapeSettings: {
              ...(current.shapeSettings ?? {}),
              movementBounds: { ...bounds, x: newX, y: newY },
            },
          },
        },
      })
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
        id: layerId,
        elementData: layerStore.getState(),
      })
      setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
    },
    [bounds, layerId, layerStore]
  )

  const handleZoneGroupTransformEnd = useCallback(
    (e: KonvaEventObject<Event>) => {
      const node = e.target as Konva.Group
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      // Capture x/y BEFORE scale-reset: left/top anchors shift node position during resize
      const nodeX = node.x()
      const nodeY = node.y()

      const newW = Math.max(20, bounds.width * scaleX)
      const newH = Math.max(20, bounds.height * scaleY)

      // Update ref before scale-reset so getClientRect override sees correct dims immediately
      effectiveBoundsRef.current = { ...bounds, x: nodeX, y: nodeY, width: newW, height: newH }

      // Reset scale without resetting position — leave nodeX/Y for React-Konva controlled render
      node.scaleX(1)
      node.scaleY(1)

      const layer = node.getLayer()
      if (layer) clearGuides(layer, GUIDE_LINE_NAME)

      const current = layerStore.getState()
      const defX = current.shapeSettings?.defaultOffsetX ?? 0
      const defY = current.shapeSettings?.defaultOffsetY ?? 0

      // Rescale pathData to match new zone dimensions so modal and storefront stay in sync.
      // Without this, pathData stays in the old coordinate space after zone resize.
      const vbW = bounds.pathViewBox?.width || bounds.width
      const vbH = bounds.pathViewBox?.height || bounds.height
      const pathScaleX = newW / vbW
      const pathScaleY = newH / vbH
      const updatedPathData = bounds.pathData ? scaleSvgPath(bounds.pathData, pathScaleX, pathScaleY) : bounds.pathData

      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            shapeSettings: {
              ...(current.shapeSettings ?? {}),
              movementBounds: {
                ...bounds,
                x: nodeX,
                y: nodeY,
                width: newW,
                height: newH,
                ...(updatedPathData ? { pathData: updatedPathData, pathViewBox: { width: newW, height: newH } } : {}),
              },
              defaultOffsetX: defX,
              defaultOffsetY: defY,
            },
          },
        },
      })
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
        id: layerId,
        elementData: layerStore.getState(),
      })
      setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
    },
    [bounds, layerId, layerStore]
  )

  // Zone-constrained drag/transform handlers for the text node inside the zone
  const { textDragBoundFunc, handleTextDragMove, handleTextDragEnd, handleTextTransformEnd } = useZoneTextInteraction({
    textRef,
    bounds,
    layerStore,
    isPreview,
    layerId,
  })

  // Preview: select on text click; deselection handled by document handler below.
  const handlePreviewClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isPreview) return
      e.cancelBubble = true
      if (!isSelected) {
        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: { clickedLayerStore: layerStore, checkedLayerStores: [] },
        })
      }
    },
    [isPreview, isSelected, layerStore]
  )

  // Deselect when clicking outside the text node in preview mode.
  // Uses document mousedown (not CanvasStage) because clicks in DOM space around the canvas
  // never reach Konva's Stage event system.
  useEffect(() => {
    if (!isPreview || !isSelected) return

    const handleDocumentMouseDown = (e: MouseEvent) => {
      if (LayerStoreSelection.getState().clickedLayerStore !== layerStore) return

      const node = textRef.current
      const stage = node?.getStage()

      if (e.target instanceof HTMLCanvasElement && stage) {
        const pos = stage.getPointerPosition()
        const hit = pos ? (stage as Konva.Stage).getIntersection(pos) : null
        // Keep selected if hit is the text node itself or a transformer anchor
        if (hit === node || hit?.findAncestor?.(`#${node?.id()}`) || hit?.findAncestor?.('Transformer')) return
      }

      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: { clickedLayerStore: null, checkedLayerStores: [] },
      })
      const tr = node?.getLayer()?.findOne?.('Transformer') as Konva.Transformer | null
      if (tr) {
        tr.nodes([])
        tr.getLayer()?.batchDraw()
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [isPreview, isSelected, layerStore])

  // Preview transformer: style to match storefront, bind to text node, constrain resize to zone
  useEffect(() => {
    if (!isSelected || !isPreview) return

    const { movable, resizable, rotatable } = shapeSettings ?? {}
    const hasAnyInteraction = movable === true || resizable === true || rotatable === true
    if (!hasAnyInteraction) return

    const node = textRef.current
    if (!node) return
    const layer = node.getLayer()
    if (!layer) return
    const tr = layer.findOne('Transformer') as Konva.Transformer | null
    if (!tr) return

    tr.visible(true)
    tr.anchorCornerRadius(2)
    tr.anchorFill('#ffffff')
    tr.anchorStroke(ZONE_STROKE_COLOR)
    tr.anchorStrokeWidth(1.5)
    tr.borderStrokeWidth(1.5)

    tr.resizeEnabled(resizable === true)
    tr.rotateEnabled(rotatable === true)

    if (bounds) {
      const stageScale = node.getStage()?.scaleX() || 1
      const maxDim = Math.max(bounds.width, bounds.height) * stageScale
      tr.boundBoxFunc(
        (
          _oldBox: {
            x: number
            y: number
            width: number
            height: number
            rotation: number
          },
          newBox: {
            x: number
            y: number
            width: number
            height: number
            rotation: number
          }
        ) => {
          if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return _oldBox
          if (Math.abs(newBox.width) > maxDim || Math.abs(newBox.height) > maxDim) return _oldBox
          return newBox
        }
      )
    }

    tr.nodes([node])
    layer.batchDraw()
    setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
  }, [isSelected, isPreview, shapeSettings, bounds, layerId])

  // Clip path in zone-local coords (Group is offset to bounds.x/y, so clip at 0,0)
  const clipFunc = useCallback((ctx: Konva.Context) => buildZoneClipFunc({ ...bounds, x: 0, y: 0 })(ctx), [bounds])

  // Ref callback that patches Konva internals once on mount:
  // - getClientRect: reads effectiveBoundsRef (updated before scale-reset) to avoid 1-frame flicker
  // - drawHit: removes clipFunc so ALL text pixels are hittable (including overflow outside zone boundary)
  //   Deselection is handled by the document mousedown handler checking stage.getIntersection()
  const setupZoneGroup = useCallback((node: Konva.Group | null) => {
    if (!node) return
    if ((node as Konva.Group & { __getClientRectOverridden?: boolean }).__getClientRectOverridden) return
    ;(node as Konva.Group & { __getClientRectOverridden?: boolean }).__getClientRectOverridden = true

    node.getClientRect = (config?: {
      skipTransform?: boolean
      skipShadow?: boolean
      skipStroke?: boolean
      relativeTo?: Konva.Container
    }) => {
      const b = effectiveBoundsRef.current
      const w = b?.width ?? 0
      const h = b?.height ?? 0
      if (config?.skipTransform) return { x: 0, y: 0, width: w, height: h }
      const transform = node.getAbsoluteTransform()
      const pts = [
        transform.point({ x: 0, y: 0 }),
        transform.point({ x: w, y: 0 }),
        transform.point({ x: 0, y: h }),
        transform.point({ x: w, y: h }),
      ]
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
    }
    // Patch drawHit to remove clipFunc so all text pixels are hittable even when overflowing zone.
    // We cast through `unknown` because Konva's drawHit overload returns `this` (Group) but our
    // patched version is void — the return value is never used by Konva's hit-detection code.
    ;(node as unknown as { drawHit: (...args: unknown[]) => void }).drawHit = function (...args: unknown[]) {
      const self = this as Konva.Group
      const savedClipFunc = self.clipFunc()
      self.clipFunc(null)
      try {
        ;(Object.getPrototypeOf(self) as { drawHit: (...a: unknown[]) => void }).drawHit.call(self, ...args)
      } finally {
        self.clipFunc(savedClipFunc)
      }
    }
  }, [])

  if (!bounds) return null

  // id/name swap: group mode → zone group is transformer target; content/preview → text node is target
  const effectiveContentMode = isPreview || contentMode
  const zoneGroupId = effectiveContentMode ? `${layerId}-zone` : layerId
  const zoneGroupName = effectiveContentMode ? '' : LAYER_NAME
  const textNodeId = effectiveContentMode ? layerId : `${layerId}-inner`
  const textNodeName = effectiveContentMode ? INNER_EDIT_NODE_NAME : ''

  return (
    <>
      {/* Zone border — sibling of clip group so it's always fully visible */}
      <ZoneBorderShape
        bounds={bounds}
        isSelected={isSelected}
        isHovered={isHovered}
        contentMode={isPreview ? false : contentMode}
      />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Group
        ref={setupZoneGroup}
        id={zoneGroupId}
        name={zoneGroupName}
        x={bounds.x}
        y={bounds.y}
        draggable={!isPreview && !effectiveContentMode && !locked}
        clipFunc={clipFunc as ((ctx: Konva.Context) => void) | undefined}
        onDragEnd={isPreview ? undefined : handleZoneGroupDragEnd}
        onTransformEnd={isPreview ? undefined : handleZoneGroupTransformEnd}
        onDblClick={isPreview ? undefined : enterContentMode}
        onMouseDown={isPreview ? handlePreviewClick : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Stable keys prevent React from re-keying by position when the conditional
            tint Rect mounts/unmounts (e.g., when isSelected toggles). Without keys,
            position-based reconciliation can unmount the text offset Group, which
            destroys the SVG text inside the clip and makes the layer disappear. */}

        {/* Sizer: group mode → listening so empty-area click selects zone; content/preview → not listening */}
        <Rect
          key="zone-sizer"
          x={0}
          y={0}
          width={bounds.width}
          height={bounds.height}
          fill="transparent"
          listening={!effectiveContentMode}
        />

        {/* Fill tint — group mode selected only (hidden in content mode to avoid visual offset) */}
        {isSelected && !effectiveContentMode && (
          <Rect
            key="zone-tint"
            x={0}
            y={0}
            width={bounds.width}
            height={bounds.height}
            fill={GROUP_MODE_FILL}
            listening={false}
          />
        )}

        {/* Offset back to canvas coords so TextRendererDirect uses state.left/top as-is */}
        <Group key="zone-text-offset" x={-bounds.x} y={-bounds.y}>
          <TextRendererDirect
            id={textNodeId}
            name={textNodeName}
            layerStore={layerStore}
            previewMode={previewMode}
            onChangeCircleStartAngle={onChangeCircleStartAngle}
            onChangeCircleEndAngle={onChangeCircleEndAngle}
            onChangeCurveBend={onChangeCurveBend}
            spriteRef={textRef}
            draggable={effectiveContentMode && (isPreview ? shapeSettings?.movable !== false : !locked)}
            dragBoundFunc={effectiveContentMode ? textDragBoundFunc : undefined}
            onDragMove={effectiveContentMode ? handleTextDragMove : undefined}
            onDragEnd={effectiveContentMode ? handleTextDragEnd : undefined}
            onTransformEnd={effectiveContentMode ? handleTextTransformEnd : undefined}
            listening={effectiveContentMode || undefined}
          />
        </Group>
      </Group>
    </>
  )
}

export const TextWithZoneGroupRenderer = memo(TextWithZoneGroupRendererComponent)
