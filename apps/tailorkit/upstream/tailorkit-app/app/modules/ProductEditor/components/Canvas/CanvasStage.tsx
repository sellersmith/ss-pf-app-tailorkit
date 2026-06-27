import type Konva from 'konva'
import throttle from 'lodash/throttle'
import type { ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Stage } from 'react-konva'
import { useCanvasSize } from '~/components/canvas/hooks/useCanvasSize'
import { usePinchZoomContext } from '~/components/canvas/hooks/PinchZoomContext'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import {
  INTEGRATION_CANVAS_EDITOR_STAGE,
  LAYER_MASK_NAME,
  LAYER_NAME,
  TEMPLATE_EDITOR_CANVAS_CONTAINER,
} from '~/constants/canvas'
import { LAYER_BASE_PRODUCT_IMAGE } from '~/constants/integration'
import { useStore } from '~/libs/external-store'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import { getLayerIntegrationStoreById } from '~/stores/modules/integration/layerIntegration'
import type { ViewPort } from '~/types/template'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import findAndBindTransformerNodes from '~/components/canvas/utils/transformer'
import { INTEGRATION_EDITOR_TRANSMISSION_EVENTS } from '../../constants'
import useDevices from '~/utils/hooks/useDevice'

interface ICanvasStageProps {
  stageRef: RefObject<Konva.Stage>
  layerRef: RefObject<Konva.Layer>
  trRef: RefObject<Konva.Transformer>
  children: ReactNode
  viewport: ViewPort
  dimensions?: { width: number; height: number }
}

/**
 * This canvas stage contains all layer children inside and like a wrapper
 *
 * @param props
 * @returns {React.ReactElement}
 */
export default function CanvasStage(props: ICanvasStageProps) {
  const { stageRef, viewport, dimensions, layerRef, trRef } = props

  const interactive = true

  // Get pinch zoom context to check if pinch was recently active
  const { wasPinchingRef } = usePinchZoomContext()
  const { isMobile } = useDevices()

  const canvasSize = useCanvasSize(INTEGRATION_CANVAS_EDITOR_STAGE, dimensions)

  const { left, top, scale } = viewport

  const oldPos = useRef(null)
  const selection = useRef({
    visible: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  })

  const clickedLayerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)

  const selectedIds = useMemo(() => {
    // Check if selecting normal condition single layer
    const isSelectingSingleLayer = clickedLayerStore

    if (isSelectingSingleLayer) {
      return [clickedLayerStore.getState()._id]
    }

    return []
  }, [clickedLayerStore])
  // Recalculate viewport when canvas size changes
  useEffect(() => {
    if (!dimensions) return
    const _viewport = evaluateStageViewPort(TEMPLATE_EDITOR_CANVAS_CONTAINER, {
      width: dimensions.width,
      height: dimensions.height,
    })
    IntegrationStore.dispatch({
      type: 'UPDATE_VIEW_PORT',
      payload: { viewport: _viewport },
      skipTrace: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.width, canvasSize.height])

  const setSelectedIds = useCallback((ids: string[]) => {
    // Create temp variables
    let _clickedLayerStore: TLayerIntegrationStore | null = null

    // Set checked layer store and clear clicked layer store when selecting multiple layers
    if (ids.length > 1) {
      _clickedLayerStore = null
    }

    // Set clicked layer store if selecting one layer & clear checked layer store
    else if (ids.length === 1) {
      _clickedLayerStore = getLayerIntegrationStoreById(ids[0])
    }

    LayerIntegrationStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: {
        clickedLayerStore: _clickedLayerStore,
      },
    })
  }, [])

  const checkDeselect = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      // Deselect when clicked on empty area
      const clickedOnEmpty = e.target === e.target.getStage()

      if (clickedOnEmpty) {
        setSelectedIds([])
      }
    },
    [setSelectedIds]
  )

  const onMouseUp = useCallback(() => {
    oldPos.current = null
    selection.current.visible = false
    const { x1, x2, y1, y2 } = selection.current
    const moved = x1 !== x2 || y1 !== y2

    if (!moved) {
      return
    }
  }, [])

  const onMouseMove = throttle((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selection.current.visible) {
      return
    }

    const stage = e.target.getStage()

    if (!stage) {
      return
    }

    const pos = stage.getPointerPosition() || { x: 0, y: 0 }
    selection.current.x2 = pos.x
    selection.current.y2 = pos.y
  }, 16) // Throttled to 60 FPS

  // Apply throttle outside of useCallback
  const throttledMouseMove = useMemo(() => throttle(onMouseMove, 10), [onMouseMove])

  /**
   * Check if a point is within a node's bounding box (accounting for rotation)
   */
  const isPointInNode = useCallback((node: Konva.Node, point: { x: number; y: number }) => {
    const stage = node.getStage()
    if (!stage) return false

    // Get the node's client rect which accounts for rotation and transformations
    const box = node.getClientRect()

    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
  }, [])

  const onClickTap = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!e.target) {
        return
      }

      // These ancestor is hard code from Konva
      const isElement = e.target.findAncestor('.elements-container')
      const isTransformer = e.target.findAncestor('Transformer')

      if (isElement || isTransformer) {
        return
      }

      const stage = e.target.getStage()

      if (!stage) return

      const pos = stage.getPointerPosition() || { x: 0, y: 0 }

      // Start selection rectangle only when clicking on empty stage
      if (e.target === stage) {
        selection.current.visible = true
        selection.current.x1 = pos.x
        selection.current.y1 = pos.y
        selection.current.x2 = pos.x
        selection.current.y2 = pos.y
      }

      const layer = layerRef.current
      const tr = trRef.current

      // if click on empty area - remove all selections
      if (e.target === stage || e.target.attrs.name === LAYER_BASE_PRODUCT_IMAGE) {
        setSelectedIds([])
        return
      }

      // Set clicked layer store when clicking to the mask layer
      if (e.target.hasName(LAYER_MASK_NAME)) {
        const layerId = e.target.id().split('mask-')[1]
        LayerIntegrationStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            clickedLayerStore: getLayerIntegrationStoreById(layerId),
          },
        })

        return
      }

      // Resolve selectable node: prefer the node itself if it has the layer name,
      // otherwise try to find an ancestor with that name.
      let selectableNode: any = e.target
      if (!e.target.hasName(LAYER_NAME)) {
        const layerAncestor = e.target.findAncestor(`.${LAYER_NAME}`)
        if (!layerAncestor) {
          return
        }
        selectableNode = layerAncestor
      }

      const shiftKey = e.evt.shiftKey
      const nodesLength = tr ? tr.nodes().length : 0
      const isSelected = tr ? tr.nodes().indexOf(selectableNode) >= 0 : false

      // Handle select single layer (in selected layers) after selecting multi layers
      if (isSelected && nodesLength > 1) {
        setSelectedIds([selectableNode.id()])
      } else if (!shiftKey && !isSelected) {
        // if no key pressed and the node is not selected
        // select just one
        setSelectedIds([selectableNode.id()])
      } else if (shiftKey && isSelected) {
        // If we pressed keys and node was selected
        // We need to remove it from selection:
        setSelectedIds(selectedIds.filter(oldId => oldId !== selectableNode.id()))
      } else if (shiftKey && !isSelected) {
        // Add the node into selection
        setSelectedIds([...selectedIds, selectableNode.id()])
      }

      layer?.draw()
    },
    [layerRef, trRef, setSelectedIds, selectedIds]
  )

  /**
   * Handle mouse down with click-through support for layer selected via Layer Manager
   * If a layer is selected and the click is within its bounds, start dragging that layer
   * even if another layer is visually on top
   */
  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Skip if clicking on transformer handles
      const isTransformer = e.target.findAncestor('Transformer')
      if (isTransformer) {
        return
      }

      // Check if we have a layer selected via Layer Manager
      if (!clickedLayerStore || !layerRef.current) {
        // No layer selected, proceed with normal click handling
        onClickTap(e)
        return
      }

      const selectedLayerId = clickedLayerStore.getState()._id
      const stage = e.target.getStage()
      if (!stage) {
        onClickTap(e)
        return
      }

      // Find the selected layer's node
      const selectedNode = layerRef.current.findOne(`#${selectedLayerId}`)
      if (!selectedNode) {
        onClickTap(e)
        return
      }

      // Get pointer position in stage coordinates
      const pos = stage.getPointerPosition()
      if (!pos) {
        onClickTap(e)
        return
      }

      // Check if click is within the selected layer's bounds
      if (isPointInNode(selectedNode, pos)) {
        // The click is within the selected layer - check if another layer captured the event
        const clickedNode = e.target
        let clickedLayerNode: Konva.Node | null = null

        if (clickedNode.hasName(LAYER_NAME)) {
          clickedLayerNode = clickedNode
        } else {
          const ancestor = clickedNode.findAncestor(`.${LAYER_NAME}`)
          if (ancestor) {
            clickedLayerNode = ancestor
          }
        }

        // If click was captured by a different layer, start dragging the selected layer instead
        if (clickedLayerNode && clickedLayerNode.id() !== selectedLayerId) {
          e.cancelBubble = true

          // Prevent the overlapping layer from starting its drag
          // by temporarily disabling its draggable property
          const overlappingNodeWasDraggable = clickedLayerNode.draggable()
          if (overlappingNodeWasDraggable) {
            clickedLayerNode.draggable(false)
          }

          // Check if the selected node is draggable
          if (selectedNode.draggable()) {
            // Start dragging the selected layer programmatically
            selectedNode.startDrag(e.evt)
          }

          // Restore the overlapping layer's draggable property after a microtask
          // This ensures the drag start event has been fully processed
          if (overlappingNodeWasDraggable) {
            Promise.resolve().then(() => {
              clickedLayerNode.draggable(true)
            })
          }
          return
        }
      }

      // Normal click handling
      onClickTap(e)
    },
    [clickedLayerStore, layerRef, isPointInNode, onClickTap]
  )

  /**
   * Handle touch start with click-through support for layer selected via Layer Manager
   * Selection is deferred to onTap to allow gesture disambiguation
   */
  const onTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      // Skip during pinch gesture (multi-touch)
      if (isMobile && e.evt.touches.length > 1) {
        return
      }

      // Check if we have a layer selected via Layer Manager for touch drag support
      if (clickedLayerStore && layerRef.current) {
        const selectedLayerId = clickedLayerStore.getState()._id
        const stage = e.target.getStage()

        if (stage) {
          const selectedNode = layerRef.current.findOne(`#${selectedLayerId}`)
          const pos = stage.getPointerPosition()

          if (selectedNode && pos && isPointInNode(selectedNode, pos)) {
            // Check if another layer captured the touch event
            const touchedNode = e.target
            let touchedLayerNode: Konva.Node | null = null

            if (touchedNode.hasName(LAYER_NAME)) {
              touchedLayerNode = touchedNode
            } else {
              const ancestor = touchedNode.findAncestor(`.${LAYER_NAME}`)
              if (ancestor) {
                touchedLayerNode = ancestor
              }
            }

            // If touch was captured by a different layer, start dragging the selected layer
            if (touchedLayerNode && touchedLayerNode.id() !== selectedLayerId) {
              e.cancelBubble = true

              // Prevent the overlapping layer from starting its drag
              const overlappingNodeWasDraggable = touchedLayerNode.draggable()
              if (overlappingNodeWasDraggable) {
                touchedLayerNode.draggable(false)
              }

              if (selectedNode.draggable()) {
                selectedNode.startDrag(e.evt)
              }

              // Restore the overlapping layer's draggable property after a microtask
              if (overlappingNodeWasDraggable) {
                Promise.resolve().then(() => {
                  touchedLayerNode.draggable(true)
                })
              }
              return
            }
          }
        }
      }

      // Only deselect when tapping empty area
      // Element selection is handled by onTap for proper gesture disambiguation
      checkDeselect(e)
    },
    [checkDeselect, isMobile, clickedLayerStore, layerRef, isPointInNode]
  )

  /**
   * Handle tap events with pinch gesture awareness
   * Suppresses tap selection if a pinch gesture was recently active
   */
  const onTapHandler = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      // If this is a touch event and we were just pinching, skip selection
      // This prevents accidental selection when lifting fingers after pinch
      if (isMobile && e.evt instanceof TouchEvent && wasPinchingRef.current) {
        return
      }
      // For mouse events or non-pinching touch, proceed with normal selection
      onClickTap(e)
    },
    [onClickTap, wasPinchingRef, isMobile]
  )

  // Update transformer: bind nodes and configure anchors in a single place
  const onUpdateTransformer = useCallback(() => {
    if (!trRef.current || !layerRef.current) return

    // Find and bind transformer nodes
    findAndBindTransformerNodes(layerRef.current, trRef.current, selectedIds)

    // Bug fix eslint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerRef.current, trRef.current, selectedIds])

  useEffect(() => {
    onUpdateTransformer()

    Transmitter.listen(INTEGRATION_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, onUpdateTransformer)

    return () => {
      Transmitter.remove(INTEGRATION_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, onUpdateTransformer)
    }
  }, [onUpdateTransformer])

  return (
    <Stage
      id={INTEGRATION_CANVAS_EDITOR_STAGE}
      ref={stageRef}
      width={canvasSize.width}
      height={canvasSize.height}
      scale={{ x: scale, y: scale }}
      position={{ x: left, y: top }}
      // Events handler
      {...(interactive
        ? {
            onMouseUp: onMouseUp,
            onMouseMove: throttledMouseMove,
            onTouchStart: onTouchStart,
            onMouseDown: onMouseDown,
            onTap: onTapHandler,
          }
        : {})}
    >
      {props.children}
    </Stage>
  )
}
