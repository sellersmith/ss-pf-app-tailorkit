import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { Arrow, Circle, Group, Rect, Text, Transformer } from 'react-konva'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ImageLoadingStore } from '~/stores/modules/image-loading-store'
import type { CharmNodeSettings, CharmProductRef } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { LAYER_STROKE_WIDTH, ROTATION_SNAPS } from '~/constants/canvas'
import {
  NODE_RADIUS,
  NODE_FILL,
  NODE_STROKE,
  NODE_FONT_SIZE,
  NODE_TEXT_FILL,
  NODE_SELECTED_STROKE,
  NODE_OCCUPIED_FILL,
  NODE_OCCUPIED_STROKE,
  NODE_OCCUPIED_TEXT_FILL,
  DELETE_RADIUS,
  DELETE_OFFSET,
  CHARM_THUMB_OFFSET,
  ADD_NODE_CURSOR,
  stopBubble,
  getAnchorYOffset,
  getOccupiedNodeIds,
} from './charm-node-utils'
import { CharmThumbnail } from './CharmThumbnail.client'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'
import { useCharmTransformHandlers, reSnapToSameNode, syncCharmLayerStore } from './use-charm-transform-handlers'
import {
  useLiveCharmProducts,
  getCharmDisplayData,
} from '~/modules/TemplateEditor/components/Outline/ToolSidebar/panels/hooks/useLiveCharmProducts'
import { getCachedImage } from './charm-image-cache'
import type { CharmInstance } from './charm-canvas-types'
import { useCharmKeyboardHandler } from './use-charm-keyboard-handler'

interface CharmNodeCanvasRendererProps {
  layerStore: TLayerStore
  previewMode?: boolean
}

export function CharmNodeCanvasRenderer({ layerStore, previewMode }: CharmNodeCanvasRendererProps) {
  const settings = useStore(layerStore, state => state.settings) as CharmNodeSettings | undefined
  const dimension = useStore(TemplateEditorStore, state => state.dimension)
  const stageRef = useStore(TemplateEditorStore, state => state.stageRef)

  const nodes = useMemo(() => settings?.nodes || [], [settings?.nodes])
  const isAddingNodeMode = settings?.isAddingNodeMode || false
  const displayStyle = settings?.displayStyle || 'FIXED'
  const linkedProducts = useMemo(() => settings?.linkedProducts || [], [settings?.linkedProducts])

  // Fetch latest product images from Shopify — charms always show current image
  const productIds = useMemo(
    () => linkedProducts.map((p: CharmProductRef) => p.shopifyProductId).filter(Boolean),
    [linkedProducts]
  )
  const { liveProducts, isLoading: isLiveFetching } = useLiveCharmProducts(productIds)

  // Preload snapshot images immediately (optimistic: often same as live URL → instant display)
  useEffect(() => {
    for (const p of linkedProducts) {
      if (p.thumbnailUrl) getCachedImage(p.thumbnailUrl)
    }
  }, [linkedProducts])

  // Build display URL map: while fetching live data → empty string (forces shimmer, never shows stale image)
  // Once resolved → use live URL (if same as snapshot, already cached → instant)
  const charmDisplayUrlMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of linkedProducts) {
      if (isLiveFetching) {
        map.set(p._id, '') // shimmer until we know the correct URL
      } else {
        const display = getCharmDisplayData(p.shopifyProductId, p.selectedVariantId, liveProducts, p)
        map.set(p._id, display.thumbnailUrl)
      }
    }
    return map
  }, [linkedProducts, liveProducts, isLiveFetching])

  // Ensure this CHARM_NODE layer is the active layer in the global selection store
  const selectThisLayer = useCallback(() => {
    const current = LayerStoreSelection.getState().clickedLayerStore
    if (current !== layerStore) {
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: { clickedLayerStore: layerStore, checkedLayerStores: [] },
      })
    }
  }, [layerStore])

  // --- Ephemeral UI-only local states (nodes aren't layers, no global store equivalent) ---
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [highlightedSlotNodeId, setHighlightedSlotNodeId] = useState<string | null>(null)
  // Preview mode: track active drag to show/hide node dots (matches storefront UX)
  const [isDragging, setIsDragging] = useState(false)
  // Safety: reset isDragging on unmount (in case drag is interrupted mid-flight)
  useEffect(() => {
    return () => {
      setIsDragging(false)
    }
  }, [])

  // --- Selection derived from global LayerStoreSelection (same pattern as text/image layers) ---
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  // Single transformer for selected charm image (Konva ref — can't be stored in global store)
  const trRef = useRef<Konva.Transformer>(null)
  const selectedImageNodeRef = useRef<Konva.Image | null>(null)
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null)

  // Flat list of all charm instances across all products
  const charmInstances = useMemo<CharmInstance[]>(() => {
    return linkedProducts.flatMap((product: CharmProductRef) =>
      (product.transforms || []).map(t => ({
        product,
        instanceId: t.instanceId,
        transform: t,
      }))
    )
  }, [linkedProducts])

  // Which slot nodes have charms snapped to them (FIXED mode visual distinction)
  const occupiedNodeIds = useMemo(
    () =>
      displayStyle === 'FIXED'
        ? getOccupiedNodeIds(
            nodes,
            charmInstances.map(c => c.transform)
          )
        : new Set<string>(),
    [displayStyle, nodes, charmInstances]
  )

  // --- Derive selection state from global store (replaces local useState) ---
  // Primary selected charm = the one in clickedLayerStore (drives transformer + inspector)
  const primaryInstanceId = useMemo(() => {
    if (!clickedLayerStore) return null
    for (const { instanceId } of charmInstances) {
      const charmLayer = getCharmLayerByInstanceId(instanceId)
      if (charmLayer === clickedLayerStore) return instanceId
    }
    return null
  }, [clickedLayerStore, charmInstances])

  // All selected instances = clickedLayerStore + checkedLayerStores (for multi-select visual)
  const selectedInstanceIds = useMemo(() => {
    const selected = new Set<string>()
    for (const { instanceId } of charmInstances) {
      const charmLayer = getCharmLayerByInstanceId(instanceId)
      if (!charmLayer) continue
      if (charmLayer === clickedLayerStore || checkedLayerStores.includes(charmLayer)) {
        selected.add(instanceId)
      }
    }
    return selected
  }, [clickedLayerStore, checkedLayerStores, charmInstances])

  // Derive selected product ID from primary instance
  const selectedProductId = useMemo(() => {
    if (!primaryInstanceId) return null
    return charmInstances.find(c => c.instanceId === primaryInstanceId)?.product._id ?? null
  }, [primaryInstanceId, charmInstances])

  // Batch lookup loading states for all charm instances (single subscription)
  const loadingStates = useStore(ImageLoadingStore, state => state)
  const charmLoadingMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const { instanceId } of charmInstances) {
      const charmLayer = getCharmLayerByInstanceId(instanceId)
      const layerId = charmLayer?.getState()?._id
      const isLoading = layerId ? (loadingStates[layerId]?.isLoading ?? false) : false
      map.set(instanceId, isLoading)
    }
    return map
  }, [charmInstances, loadingStates])

  const canvasWidth = dimension?.width || 500
  const canvasHeight = dimension?.height || 500

  // Attach/detach transformer when charm selection changes (editor only)
  useEffect(() => {
    if (previewMode) return
    const tr = trRef.current
    if (!tr) return

    if (primaryInstanceId && selectedImageNodeRef.current) {
      tr.nodes([selectedImageNodeRef.current])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [previewMode, primaryInstanceId])

  // --- Custom cursor for adding mode (only in FIXED, editor only) ---
  useEffect(() => {
    if (previewMode || displayStyle !== 'FIXED') return

    const stage = stageRef?.current
    if (!stage) return
    const container = stage.container()
    if (!container) return

    // Reset cursor to default (covers both exit-from-adding and non-adding states)
    const resetCursor = () => {
      container.style.setProperty('cursor', 'default', 'important')
      setTimeout(() => container.style.removeProperty('cursor'), 50)
    }

    if (!isAddingNodeMode) {
      resetCursor()
      return
    }

    // Adding mode: set custom cursor and re-apply on mousemove to override Konva
    container.style.setProperty('cursor', ADD_NODE_CURSOR, 'important')
    const applyCursor = () => container.style.setProperty('cursor', ADD_NODE_CURSOR, 'important')
    container.addEventListener('mousemove', applyCursor)

    return () => {
      container.removeEventListener('mousemove', applyCursor)
      resetCursor()
    }
  }, [previewMode, isAddingNodeMode, displayStyle, stageRef])

  // P1-6: Keyboard navigation and delete for selected charms (editor only)
  useCharmKeyboardHandler({
    previewMode,
    selectedInstanceIds,
    primaryInstanceId,
    charmInstances,
    layerStore,
    selectThisLayer,
    selectedImageNodeRef,
  })

  // Click canvas to add node at click position
  const handleCanvasClick = useCallback(
    (e: any) => {
      if (!isAddingNodeMode) return
      selectThisLayer()

      const stage = e.target.getStage()
      if (!stage) return

      const pointerPos = stage.getPointerPosition()
      if (!pointerPos) return

      const viewport = TemplateEditorStore.getState().viewport
      const x = (pointerPos.x - viewport.left) / viewport.scale
      const y = (pointerPos.y - viewport.top) / viewport.scale

      layerStore.dispatch({
        type: 'ADD_CHARM_SLOT_NODE',
        payload: {
          node: {
            _id: uuid(),
            x,
            y,
            slotLimit: 1,
            label: '',
          },
        },
      })
    },
    [isAddingNodeMode, layerStore, selectThisLayer]
  )

  const handleNodeDragEnd = useCallback(
    (nodeId: string, e: any) => {
      const { x, y } = e.target.position()
      const node = nodes.find(n => n._id === nodeId)

      // Update node position
      layerStore.dispatch({
        type: 'UPDATE_CHARM_SLOT_NODE',
        payload: { nodeId, updates: { x, y } },
      })

      // FIXED mode: move charm assigned to this node along with it
      if (displayStyle === 'FIXED' && node) {
        for (const { product, instanceId, transform } of charmInstances) {
          if (Math.abs(transform.x - node.x) < 1) {
            const newY = y + getAnchorYOffset(settings?.anchorPosition, CHARM_THUMB_OFFSET, transform.scale)
            layerStore.dispatch({
              type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
              payload: {
                productId: product._id,
                instanceId,
                transform: { ...transform, x, y: newY },
              },
            })
            syncCharmLayerStore(instanceId, x, newY, transform.rotation, transform.scale)
          }
        }
      }
    },
    [layerStore, displayStyle, nodes, charmInstances, settings?.anchorPosition]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      layerStore.dispatch({
        type: 'DELETE_CHARM_SLOT_NODE',
        payload: { nodeId },
      })
      setSelectedNodeId(null)
    },
    [layerStore]
  )

  // Extracted handlers: selection, drag lifecycle, transform-end re-snap + uniform scale sync
  const {
    handleCharmDragStart,
    handleCharmDragMove,
    handleCharmSelectCore,
    handleCharmDragEndCore,
    handleCharmTransformEnd,
  } = useCharmTransformHandlers({
    layerStore,
    displayStyle,
    anchorPosition: settings?.anchorPosition,
    nodes,
    charmInstances,
    primaryInstanceId,
    selectedProductId,
    selectedImageNodeRef,
    dragStartPositionRef,
    setHighlightedSlotNodeId,
    setSelectedNodeId,
  })

  // Memoized callback maps for stable references (prevents CharmThumbnail re-renders)
  const charmCallbacks = useMemo(() => {
    const callbacks = new Map<
      string,
      {
        onSelect: (imageNode: Konva.Image, e?: MouseEvent) => void
        onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
      }
    >()

    for (const { product, instanceId } of charmInstances) {
      callbacks.set(instanceId, {
        onSelect: (imageNode: Konva.Image, e?: MouseEvent) => {
          handleCharmSelectCore(product._id, instanceId, imageNode, e?.shiftKey ?? false)
        },
        onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
          if (previewMode) setIsDragging(true)
          handleCharmDragStart(e)
        },
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
          handleCharmDragEndCore(product._id, instanceId, e)
          if (previewMode) setIsDragging(false)
        },
      })
    }

    return callbacks
  }, [charmInstances, handleCharmSelectCore, handleCharmDragStart, handleCharmDragEndCore, previewMode])

  // Clear selections when entering adding mode (editor only)
  useEffect(() => {
    if (previewMode) return
    if (isAddingNodeMode) {
      setSelectedNodeId(null)
      selectThisLayer()
      selectedImageNodeRef.current = null
    }
  }, [previewMode, isAddingNodeMode, selectThisLayer])

  // Auto-clear selectedNodeId when global selection moves away (editor only)
  useEffect(() => {
    if (previewMode) return
    if (!clickedLayerStore) {
      setSelectedNodeId(null)
      selectedImageNodeRef.current = null
      return
    }
    if (clickedLayerStore === layerStore) return
    const isChildCharm = charmInstances.some(({ instanceId }) => {
      const charmLayer = getCharmLayerByInstanceId(instanceId)
      return charmLayer === clickedLayerStore
    })
    if (!isChildCharm) {
      setSelectedNodeId(null)
      selectedImageNodeRef.current = null
    }
  }, [previewMode, clickedLayerStore, layerStore, charmInstances])

  // Handle node click — select node, clear charm selection via global store
  const handleNodeClick = useCallback(
    (nodeId: string, isCurrentlySelected: boolean) => {
      selectThisLayer() // Sets clickedLayerStore to CHARM_NODE → clears charm selection
      setSelectedNodeId(isCurrentlySelected ? null : nodeId)
      selectedImageNodeRef.current = null
    },
    [selectThisLayer]
  )

  return (
    <Group listening>
      {/* Click overlay for adding nodes / deselect — editor only, FIXED mode */}
      {!previewMode && displayStyle === 'FIXED' && isAddingNodeMode && (
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill="transparent"
          listening
          onClick={handleCanvasClick}
          onTap={handleCanvasClick}
        />
      )}
      {/* Charm instances in isolated Group — Konva moves dragged nodes to top of parent,
          so a separate Group ensures charms never z-overlap the node markers Group below */}
      <Group listening>
        {charmInstances.map(({ product, instanceId, transform }) => {
          const callbacks = charmCallbacks.get(instanceId)
          if (!callbacks) return null
          // FIXED mode: slot.rotation is the canonical angle for any charm pinned to that slot.
          // Mirror storefront behavior (charm-drag-plugin overrides charm rotation with slot.r)
          // so the editor preview reflects admin-set slot rotation immediately, even when
          // the charm was placed via defaultCharm assignment instead of a drag-and-drop.
          // Use the slot rotation always (including 0) when a matching slot exists — using
          // truthy fallback would let stale 15° charm transforms leak into 0° slots after a
          // swap, leaving both swapped charms tilted instead of resetting to the slot angle.
          const matchingSlot = displayStyle === 'FIXED' ? nodes.find(n => Math.abs(n.x - transform.x) < 1) : undefined
          const effectiveTransform = matchingSlot ? { ...transform, rotation: matchingSlot.rotation ?? 0 } : transform
          return (
            <CharmThumbnail
              key={`charm-${instanceId}`}
              instanceId={instanceId}
              thumbnailUrl={charmDisplayUrlMap.get(product._id) || ''}
              transform={effectiveTransform}
              isLoading={charmLoadingMap.get(instanceId) ?? false}
              title={product.title}
              isSelected={selectedInstanceIds.has(instanceId)}
              anchorPosition={displayStyle === 'FIXED' ? settings?.anchorPosition : undefined}
              onSelect={callbacks.onSelect}
              onDragStart={callbacks.onDragStart}
              onDragMove={handleCharmDragMove}
              onDragEnd={callbacks.onDragEnd}
            />
          )
        })}
      </Group>

      {/* Node markers — separate Group ensures nodes always render on top of charms */}
      {/* Preview mode: only shown during active drag (matches storefront UX) */}
      {displayStyle === 'FIXED'
        && (!previewMode || isDragging)
        && nodes.map((node, index) => {
          const isSelected = !previewMode && selectedNodeId === node._id
          const isHovered = !previewMode && hoveredNodeId === node._id
          const isHighlighted = highlightedSlotNodeId === node._id
          const isOccupied = occupiedNodeIds.has(node._id)
          return (
            <Group
              key={node._id}
              x={node.x}
              y={node.y}
              draggable={!previewMode && !isAddingNodeMode}
              listening={!previewMode}
              onMouseDown={!previewMode ? stopBubble : undefined}
              onMouseEnter={
                !previewMode
                  ? e => {
                      setHoveredNodeId(node._id)
                      const stage = e.target.getStage()
                      if (stage) stage.container().style.cursor = 'pointer'
                    }
                  : undefined
              }
              onMouseLeave={
                !previewMode
                  ? e => {
                      setHoveredNodeId(null)
                      const stage = e.target.getStage()
                      if (stage) stage.container().style.cursor = ''
                    }
                  : undefined
              }
              onClick={
                !previewMode
                  ? e => {
                      e.cancelBubble = true
                      handleNodeClick(node._id, isSelected)
                    }
                  : undefined
              }
              onTap={
                !previewMode
                  ? e => {
                      e.cancelBubble = true
                      handleNodeClick(node._id, isSelected)
                    }
                  : undefined
              }
              onDragEnd={!previewMode ? e => handleNodeDragEnd(node._id, e) : undefined}
            >
              <Circle
                x={0}
                y={0}
                radius={NODE_RADIUS}
                fill={isHighlighted ? '#C4B5FD' : isOccupied ? NODE_OCCUPIED_FILL : NODE_FILL}
                stroke={
                  isSelected || isHovered || isHighlighted
                    ? NODE_SELECTED_STROKE
                    : isOccupied
                      ? NODE_OCCUPIED_STROKE
                      : NODE_STROKE
                }
                strokeWidth={isSelected ? 2.5 : isHovered || isHighlighted ? 2 : 1.5}
                scaleX={isHighlighted ? 1.3 : 1}
                scaleY={isHighlighted ? 1.3 : 1}
              />

              {/* Rotation indicator — small arrow at slot center pointing to slot.rotation. Editor only, hidden when r=0. */}
              {!previewMode && !!node.rotation && (
                <Arrow
                  points={[0, 0, NODE_RADIUS + 8, 0]}
                  stroke={NODE_SELECTED_STROKE}
                  fill={NODE_SELECTED_STROKE}
                  strokeWidth={1.5}
                  pointerLength={5}
                  pointerWidth={5}
                  rotation={node.rotation}
                  listening={false}
                />
              )}

              {/* Node label — editor only */}
              {!previewMode && (
                <Text
                  x={-NODE_RADIUS}
                  y={-NODE_FONT_SIZE / 2}
                  width={NODE_RADIUS * 2}
                  text={`#${index + 1}`}
                  fontSize={NODE_FONT_SIZE}
                  fill={isOccupied ? NODE_OCCUPIED_TEXT_FILL : NODE_TEXT_FILL}
                  align="center"
                  listening={false}
                />
              )}

              {/* Delete handle (X) — editor only, shown when node is selected */}
              {!previewMode && isSelected && (
                <Fragment>
                  <Circle
                    x={DELETE_OFFSET}
                    y={-DELETE_OFFSET}
                    radius={DELETE_RADIUS}
                    fill="#EF4444"
                    onMouseDown={stopBubble}
                    onClick={e => {
                      e.cancelBubble = true
                      handleDeleteNode(node._id)
                    }}
                    onTap={e => {
                      e.cancelBubble = true
                      handleDeleteNode(node._id)
                    }}
                  />
                  <Text
                    x={DELETE_OFFSET - 4}
                    y={-DELETE_OFFSET - 5}
                    text="×"
                    fontSize={12}
                    fill="#FFFFFF"
                    fontStyle="bold"
                    listening={false}
                  />
                </Fragment>
              )}
            </Group>
          )
        })}

      {/* Single Transformer for selected charm — editor only */}
      {/* FIXED mode: no resize/rotate (charms snap to fixed slots)
          FREE mode: full resize/rotate with all anchors */}
      {!previewMode && (
        <Transformer
          ref={trRef}
          visible={!!primaryInstanceId}
          anchorCornerRadius={20}
          anchorFill={NODE_STROKE}
          borderStroke={NODE_STROKE}
          borderStrokeWidth={LAYER_STROKE_WIDTH}
          ignoreStroke
          rotateEnabled={displayStyle !== 'FIXED'}
          keepRatio
          enabledAnchors={
            displayStyle === 'FIXED'
              ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              : [
                  'top-left',
                  'top-right',
                  'bottom-left',
                  'bottom-right',
                  'top-center',
                  'middle-left',
                  'middle-right',
                  'bottom-center',
                ]
          }
          onMouseDown={stopBubble}
          onTransformEnd={handleCharmTransformEnd}
          onTransform={(evt: any) => {
            if (!trRef.current) return
            // Drag-rotate snap angles. Shift always uses the legacy 45° cadence so
            // power users can override; otherwise we honor the panel-level snapStep
            // (admin-configured) so canvas drag-rotate matches per-slot snap cadence.
            const panelSnap = settings?.snapStep ?? 0
            const computedSnaps = panelSnap > 0 ? Array.from({ length: 360 / panelSnap }, (_, i) => i * panelSnap) : []
            trRef.current.rotationSnaps(evt.evt.shiftKey ? ROTATION_SNAPS : computedSnaps)

            // Real-time visual sync: scale + position for all charms during transform
            // (store dispatch happens on onTransformEnd — this is just visual feedback)
            const node = selectedImageNodeRef.current
            if (!node || !selectedProductId) return
            const newScale = node.scaleX()
            const layer = node.getLayer()

            // FIXED mode: re-snap PRIMARY charm to its SAME node using stored x
            // (Konva Transformer drifts position during scale — must correct it)
            if (displayStyle === 'FIXED' && nodes.length > 0) {
              const primaryT = charmInstances.find(c => c.instanceId === primaryInstanceId)?.transform
              if (primaryT) {
                const snapped = reSnapToSameNode(nodes, primaryT.x, newScale, settings?.anchorPosition)
                if (snapped) {
                  node.x(snapped.x)
                  node.y(snapped.y)
                }
              }
            }

            // Sync siblings: scale + re-snap position
            for (const { instanceId, transform: sibT } of charmInstances) {
              if (instanceId === primaryInstanceId) continue
              const siblingNode = layer?.findOne(`#charm-${instanceId}`) as Konva.Image | undefined
              if (siblingNode) {
                siblingNode.scaleX(newScale)
                siblingNode.scaleY(newScale)
                if (displayStyle === 'FIXED' && nodes.length > 0) {
                  const snapped = reSnapToSameNode(nodes, sibT.x, newScale, settings?.anchorPosition)
                  if (snapped) {
                    siblingNode.x(snapped.x)
                    siblingNode.y(snapped.y)
                  }
                }
              }
            }
            layer?.batchDraw()
          }}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 10 || newBox.height < 10) return oldBox
            return newBox
          }}
        />
      )}
    </Group>
  )
}
