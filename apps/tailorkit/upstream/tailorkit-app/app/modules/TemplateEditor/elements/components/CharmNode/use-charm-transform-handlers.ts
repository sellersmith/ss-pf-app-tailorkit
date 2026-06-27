/**
 * Custom hook: charm transform handlers (drag-end, transform-end, scale sync)
 *
 * Extracted from CharmNodeCanvasRenderer to keep file size manageable.
 * Handles FIXED-mode snap-to-node, uniform scale sync across all products,
 * and sibling CHARM layer store updates.
 */
import { useCallback } from 'react'
import type Konva from 'konva'
import type { TLayerStore } from '~/stores/modules/layer'
import type { CharmSlotNode } from '~/types/psd'
import { CHARM_THUMB_SIZE, CHARM_THUMB_OFFSET, SNAP_THRESHOLD, getAnchorYOffset } from './charm-node-utils'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'

import type { CharmInstance } from './charm-canvas-types'

/** Find nearest node to a given (x, y) position */
export function findNearestNode(nodes: CharmSlotNode[], cx: number, cy: number): CharmSlotNode | null {
  if (nodes.length === 0) return null
  let bestDist = Infinity
  let best = nodes[0]
  for (const nd of nodes) {
    const dx = cx - nd.x
    const dy = cy - nd.y
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      best = nd
    }
  }
  return best
}

/**
 * Find nearest node within snap threshold.
 * Distance is measured from node center to the nearest EDGE of the charm
 * (not charm center), so snapping triggers when any part of the charm is close.
 */
export function findNearestNodeWithinThreshold(
  nodes: CharmSlotNode[],
  cx: number,
  cy: number,
  threshold: number,
  charmHalfSize: number = 0
): { node: CharmSlotNode; dist: number } | null {
  if (nodes.length === 0) return null
  let bestDist = Infinity
  let best: CharmSlotNode | null = null
  for (const nd of nodes) {
    // Distance from node to nearest edge of charm bounding box
    const dx = Math.max(Math.abs(cx - nd.x) - charmHalfSize, 0)
    const dy = Math.max(Math.abs(cy - nd.y) - charmHalfSize, 0)
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < bestDist) {
      bestDist = d
      best = nd
    }
  }
  if (!best || bestDist > threshold) return null
  return { node: best, dist: bestDist }
}

/** Compute snapped position for a charm relative to its nearest node (used for DRAG) */
export function snapToNode(
  nodes: CharmSlotNode[],
  x: number,
  y: number,
  scale: number,
  anchorPosition?: 'top' | 'center' | 'bottom'
): { x: number; y: number } {
  const nearest = findNearestNode(nodes, x, y)
  if (!nearest) return { x, y }
  return {
    x: nearest.x,
    y: nearest.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, scale),
  }
}

/**
 * Re-snap a charm to its SAME assigned node with a new scale (used for RESIZE).
 * Matches by x-coordinate (exact after FIXED snap) to avoid jumping to a different node
 * when the stored y drifts due to scale-dependent offset.
 */
export function reSnapToSameNode(
  nodes: CharmSlotNode[],
  storedX: number,
  newScale: number,
  anchorPosition?: 'top' | 'center' | 'bottom'
): { x: number; y: number } | null {
  // In FIXED mode, charm.x always equals node.x exactly after snap
  const assignedNode = nodes.find(n => Math.abs(n.x - storedX) < 1) || findNearestNode(nodes, storedX, 0) // fallback: nearest by x only
  if (!assignedNode) return null
  return {
    x: assignedNode.x,
    y: assignedNode.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, newScale),
  }
}

/** Find charm instance currently assigned to a given node (by x-match, exact after FIXED snap) */
export function findCharmAtNode(
  charmInstances: CharmInstance[],
  node: CharmSlotNode,
  excludeInstanceId: string
): CharmInstance | null {
  return charmInstances.find(c => c.instanceId !== excludeInstanceId && Math.abs(c.transform.x - node.x) < 1) || null
}

/** Sync a CHARM child layer store with position/size/rotation from the parent transform */
export function syncCharmLayerStore(instanceId: string, x: number, y: number, rotation: number, scale: number) {
  const layer = getCharmLayerByInstanceId(instanceId)
  if (!layer) return
  layer.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: {
        left: x,
        top: y,
        rotate: rotation,
        width: CHARM_THUMB_SIZE * scale,
        height: CHARM_THUMB_SIZE * scale,
      },
    },
    skipTrace: true,
  })
}

interface UseCharmTransformHandlersArgs {
  layerStore: TLayerStore
  displayStyle: 'FIXED' | 'FREE'
  anchorPosition?: 'top' | 'center' | 'bottom'
  nodes: CharmSlotNode[]
  charmInstances: CharmInstance[]
  primaryInstanceId: string | null
  selectedProductId: string | null
  selectedImageNodeRef: React.MutableRefObject<Konva.Image | null>
  dragStartPositionRef: React.MutableRefObject<{ x: number; y: number } | null>
  setHighlightedSlotNodeId: (id: string | null) => void
  setSelectedNodeId: (id: string | null) => void
}

/**
 * Returns memoized drag-end and transform-end handlers for charm instances.
 * Handles FIXED mode snap, uniform scale sync, and CHARM layer store updates.
 */
export function useCharmTransformHandlers({
  layerStore,
  displayStyle,
  anchorPosition,
  nodes,
  charmInstances,
  primaryInstanceId,
  selectedProductId,
  selectedImageNodeRef,
  dragStartPositionRef,
  setHighlightedSlotNodeId,
  setSelectedNodeId,
}: UseCharmTransformHandlersArgs) {
  // Capture drag-start position for cancel-drag in FIXED mode
  const handleCharmDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragStartPositionRef.current = { x: e.target.x(), y: e.target.y() }
    },
    [dragStartPositionRef]
  )

  // FIXED mode: highlight nearest slot node during drag (only within threshold)
  const handleCharmDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (displayStyle !== 'FIXED' || nodes.length === 0) return
      const halfSize = CHARM_THUMB_OFFSET * e.target.scaleX()
      const result = findNearestNodeWithinThreshold(nodes, e.target.x(), e.target.y(), SNAP_THRESHOLD, halfSize)
      setHighlightedSlotNodeId(result?.node._id ?? null)
    },
    [displayStyle, nodes, setHighlightedSlotNodeId]
  )

  // Core handler for drag end — in FIXED mode, snap charm to nearest node
  const handleCharmDragEndCore = useCallback(
    (productId: string, instanceId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const dragNode = e.target
      let x = dragNode.x()
      let y = dragNode.y()
      let rotation = dragNode.rotation()
      const scale = dragNode.scaleX()

      // FIXED mode: snap to nearest node within threshold, or cancel drag
      if (displayStyle === 'FIXED' && nodes.length > 0) {
        const halfSize = CHARM_THUMB_OFFSET * scale
        const result = findNearestNodeWithinThreshold(nodes, x, y, SNAP_THRESHOLD, halfSize)
        if (!result) {
          // Beyond threshold → cancel drag, return to original position
          const orig = dragStartPositionRef.current
          if (orig) {
            dragNode.x(orig.x)
            dragNode.y(orig.y)
            dragNode.getLayer()?.batchDraw()
          }
          setHighlightedSlotNodeId(null)
          return
        }
        // Within threshold → check slot limit and swap
        const targetNode = result.node
        const occupant = findCharmAtNode(charmInstances, targetNode, instanceId)
        const targetOccupancy = charmInstances.filter(c => Math.abs(c.transform.x - targetNode.x) < 1).length

        // Slot limit: can't snap here if at capacity and no swap possible
        if (targetOccupancy >= (targetNode.slotLimit || 1) && !occupant) {
          const orig = dragStartPositionRef.current
          if (orig) {
            dragNode.x(orig.x)
            dragNode.y(orig.y)
            dragNode.getLayer()?.batchDraw()
          }
          setHighlightedSlotNodeId(null)
          dragStartPositionRef.current = null
          return
        }

        if (occupant) {
          // SWAP: dragged charm → target node, occupant → dragged charm's old node
          const origPos = dragStartPositionRef.current
          if (!origPos) return
          const oldNode = nodes.find(n => Math.abs(n.x - origPos.x) < 1)
          if (!oldNode) return

          const draggedNewX = targetNode.x
          const draggedNewY = targetNode.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, scale)
          const occupantNewX = oldNode.x
          const occupantNewY
            = oldNode.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, occupant.transform.scale)

          // FIXED mode: slot is the canonical source of rotation. Use the destination
          // slot's rotation for both swapped charms (default 0 when undefined). Using
          // `??` instead of `||` is critical so an explicit slot.rotation === 0 actually
          // resets the charm's rotation rather than falling back to its prior orientation —
          // otherwise swapping a 0° charm into a 15° slot leaves the displaced occupant
          // stuck at 15° even after it returns to a 0° slot.
          const draggedRotation = targetNode.rotation ?? 0
          const occupantRotation = oldNode.rotation ?? 0

          // Update Konva nodes
          dragNode.x(draggedNewX)
          dragNode.y(draggedNewY)
          dragNode.rotation(draggedRotation)
          const layer = dragNode.getLayer()
          const occupantKonvaNode = layer?.findOne(`#charm-${occupant.instanceId}`) as Konva.Image | undefined
          if (occupantKonvaNode) {
            occupantKonvaNode.x(occupantNewX)
            occupantKonvaNode.y(occupantNewY)
            occupantKonvaNode.rotation(occupantRotation)
          }
          layer?.batchDraw()

          // Persist both to store
          layerStore.dispatch({
            type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
            payload: {
              productId,
              instanceId,
              transform: { x: draggedNewX, y: draggedNewY, rotation: draggedRotation, scale },
            },
          })
          layerStore.dispatch({
            type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
            payload: {
              productId: occupant.product._id,
              instanceId: occupant.instanceId,
              transform: {
                x: occupantNewX,
                y: occupantNewY,
                rotation: occupantRotation,
                scale: occupant.transform.scale,
              },
            },
          })

          // Sync CHARM layers
          syncCharmLayerStore(instanceId, draggedNewX, draggedNewY, draggedRotation, scale)
          syncCharmLayerStore(
            occupant.instanceId,
            occupantNewX,
            occupantNewY,
            occupantRotation,
            occupant.transform.scale
          )

          // Swap defaultCharm assignments between nodes
          const draggedProduct = charmInstances.find(c => c.instanceId === instanceId)?.product
          if (draggedProduct) {
            layerStore.dispatch({
              type: 'ASSIGN_DEFAULT_CHARM',
              payload: { nodeId: targetNode._id, charm: draggedProduct },
            })
          }
          layerStore.dispatch({
            type: 'ASSIGN_DEFAULT_CHARM',
            payload: { nodeId: oldNode._id, charm: occupant.product },
          })

          setHighlightedSlotNodeId(null)
          dragStartPositionRef.current = null
          return
        }

        // No occupant → normal snap. FIXED mode: slot is the canonical source of
        // rotation, so always sync the charm to slot.rotation (default 0 when undefined)
        // — otherwise a charm dragged from a 15° slot to a 0° slot would keep its 15°.
        x = targetNode.x
        y = targetNode.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, scale)
        rotation = targetNode.rotation ?? 0
        dragNode.rotation(rotation)
        dragNode.x(x)
        dragNode.y(y)
        dragNode.getLayer()?.batchDraw()

        // Update defaultCharm: move from old node to new node
        const origPos = dragStartPositionRef.current
        const oldNode = origPos ? nodes.find(n => Math.abs(n.x - origPos.x) < 1) : null
        if (oldNode && oldNode._id !== targetNode._id) {
          layerStore.dispatch({ type: 'UNASSIGN_DEFAULT_CHARM', payload: { nodeId: oldNode._id } })
        }
        const draggedProduct = charmInstances.find(c => c.instanceId === instanceId)?.product
        if (draggedProduct) {
          layerStore.dispatch({
            type: 'ASSIGN_DEFAULT_CHARM',
            payload: { nodeId: targetNode._id, charm: draggedProduct },
          })
        }
      }

      setHighlightedSlotNodeId(null)

      layerStore.dispatch({
        type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
        payload: { productId, instanceId, transform: { x, y, rotation, scale } },
      })

      syncCharmLayerStore(instanceId, x, y, rotation, scale)
      dragStartPositionRef.current = null
    },
    [layerStore, displayStyle, anchorPosition, nodes, charmInstances, setHighlightedSlotNodeId, dragStartPositionRef]
  )

  // Persist charm transform after resize/rotate
  // Syncs scale to ALL charm instances and re-snaps to node in FIXED mode
  const handleCharmTransformEnd = useCallback(() => {
    if (!primaryInstanceId || !selectedProductId) return
    const node = selectedImageNodeRef.current
    if (!node) return

    const rotation = node.rotation()
    const scale = node.scaleX()

    // Use stored position to find which node this charm belongs to,
    // NOT the Konva node position which drifts during transform
    const primaryInstance = charmInstances.find(c => c.instanceId === primaryInstanceId)
    let x = primaryInstance?.transform.x ?? node.x()
    let y = primaryInstance?.transform.y ?? node.y()

    // FIXED mode: re-snap to SAME node with new scale (offset depends on scale)
    // Uses reSnapToSameNode to match by x-coordinate, avoiding jump to different node
    if (displayStyle === 'FIXED') {
      const snapped = reSnapToSameNode(nodes, x, scale, anchorPosition)
      if (snapped) {
        x = snapped.x
        y = snapped.y
      }
    } else {
      // FREE mode: use Konva's actual position
      x = node.x()
      y = node.y()
    }
    node.x(x)
    node.y(y)
    node.getLayer()?.batchDraw()

    layerStore.dispatch({
      type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
      payload: { productId: selectedProductId, instanceId: primaryInstanceId, transform: { x, y, rotation, scale } },
    })

    // Sync primary CHARM layer
    syncCharmLayerStore(primaryInstanceId, x, y, rotation, scale)

    // Re-snap, reposition Konva nodes, and persist ALL other charm instances
    const layer = node.getLayer()
    for (const { product, instanceId, transform: sibT } of charmInstances) {
      if (instanceId === primaryInstanceId) continue

      let sibX = sibT.x
      let sibY = sibT.y
      if (displayStyle === 'FIXED') {
        const snapped = reSnapToSameNode(nodes, sibX, scale, anchorPosition)
        if (snapped) {
          sibX = snapped.x
          sibY = snapped.y
        }
      }

      // Update sibling Konva node position on canvas
      const siblingNode = layer?.findOne(`#charm-${instanceId}`) as Konva.Image | undefined
      if (siblingNode) {
        siblingNode.x(sibX)
        siblingNode.y(sibY)
      }

      // Persist sibling transform to charm store
      layerStore.dispatch({
        type: 'UPDATE_CHARM_PRODUCT_TRANSFORM',
        payload: {
          productId: product._id,
          instanceId,
          transform: { x: sibX, y: sibY, rotation: sibT.rotation, scale },
        },
      })

      syncCharmLayerStore(instanceId, sibX, sibY, sibT.rotation, scale)
    }
    layer?.batchDraw()
  }, [
    primaryInstanceId,
    selectedProductId,
    layerStore,
    charmInstances,
    displayStyle,
    anchorPosition,
    nodes,
    selectedImageNodeRef,
  ])

  // Core handler for charm selection — dispatches to global LayerStoreSelection (same as text/image)
  const handleCharmSelectCore = useCallback(
    (productId: string, instanceId: string, imageNode: Konva.Image, shiftKey: boolean = false) => {
      const charmLayer = getCharmLayerByInstanceId(instanceId)
      selectedImageNodeRef.current = imageNode
      setSelectedNodeId(null)

      if (shiftKey && charmLayer) {
        // Multi-select: toggle charm in the global selection set
        const { checkedLayerStores: checked, clickedLayerStore: clicked } = LayerStoreSelection.getState()
        const allSelected = new Set(checked)
        if (clicked && clicked !== layerStore) allSelected.add(clicked)

        if (allSelected.has(charmLayer)) {
          allSelected.delete(charmLayer)
        } else {
          allSelected.add(charmLayer)
        }

        const remaining = [...allSelected]
        const newPrimary = allSelected.has(charmLayer) ? charmLayer : remaining[0] || layerStore
        const newChecked = remaining.filter(s => s !== newPrimary)

        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: { clickedLayerStore: newPrimary, checkedLayerStores: newChecked },
        })
      } else {
        // Single select — clear multi-select, set this charm as primary
        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: { clickedLayerStore: charmLayer || layerStore, checkedLayerStores: [] },
        })
      }
    },
    [layerStore, selectedImageNodeRef, setSelectedNodeId]
  )

  return {
    handleCharmDragStart,
    handleCharmDragMove,
    handleCharmDragEndCore,
    handleCharmTransformEnd,
    handleCharmSelectCore,
  }
}
