/* eslint-disable max-lines */
import type Konva from 'konva'
import throttle from 'lodash/throttle'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  Fragment,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
} from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import {
  CANVAS_EDITOR_STAGE,
  LAYER_NAME,
  TEMPLATE_EDITOR_CANVAS_CONTAINER,
  LAYER_STROKE_COLOR,
  LAYER_STROKE_WIDTH,
  SELECTION_RECT_FILL_COLOR,
  SELECTION_RECT_STROKE_COLOR,
  INNER_EDIT_NODE_NAME,
  PREVIEW_IMAGE_NODE_NAME,
} from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import { getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { EOptionSet, optionSetDataKeys, type ImageOptionSet } from '~/types/psd'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'
import { calculateEffectiveDimension } from '~/utils/canvas/calculateEffectiveDimension'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import { useCanvasSize } from './hooks/useCanvasSize'
import { usePinchZoomContext } from './hooks/PinchZoomContext'
import { checkIntersection, stageToSceneCoords } from './utils'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { useTranslation } from 'react-i18next'
import CanvasContextMenu from './CanvasContextMenu'
import { ExportLayersPopover } from './ExportLayersPopover'
import { useCanvasContextMenu } from './hooks/useCanvasContextMenu'
import findAndBindTransformerNodes from './utils/transformer'
import useDevices from '~/utils/hooks/useDevice'

interface ICanvasStageProps {
  stageRef: RefObject<Konva.Stage>
  trRef: RefObject<Konva.Transformer | null>
  secondaryTrRef: RefObject<Konva.Transformer | null>
  layerRef: RefObject<Konva.Layer | null>
  children: ReactNode
  interactive?: boolean
  previewMode?: boolean
  isGrabbing: boolean
  scaleUpStageViewPort?: boolean
}

interface SelectOptions {
  selectSingleLayer: boolean
  metaKey: boolean
}

/**
 * This canvas stage contains all layer children inside and like a wrapper
 *
 * @param props
 * @returns {React.ReactElement}
 */
export default function CanvasStage(props: ICanvasStageProps) {
  const {
    stageRef,
    trRef,
    secondaryTrRef,
    layerRef,
    interactive,
    previewMode,
    isGrabbing,
    scaleUpStageViewPort = false,
  } = props
  const canvasSize = useCanvasSize(CANVAS_EDITOR_STAGE)
  const { widthByPixels, heightByPixels } = useCanvasDimension()

  // Get pinch zoom context to check if pinch was recently active
  const { wasPinchingRef } = usePinchZoomContext()
  const { isMobile } = useDevices()

  const stageViewport = useStore(TemplateEditorStore, state => state.viewport)
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)
  const { left, top, scale } = stageViewport

  const oldPos = useRef(null)
  const selectionRectRef = useRef<Konva.Rect>(null)
  const isDragging = useRef(false)
  const highlightedLayers = useRef<string[]>([]) // Track highlighted layers by ID

  // Store selection coordinates in scene coordinates
  const selection = useRef({
    visible: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  })

  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)

  const selectedIds = useMemo(() => {
    // Check if selecting single layer inside multiple layers being selecting
    // In MultiLayout element, multi layout can be clickedLayerStore and layer items inside can be checkedLayerStores
    const isSelectingSingleLayerInside = clickedLayerStore && checkedLayerStores.length > 0

    // Check if selecting normal condition single layer
    const isSelectingSingleLayer = clickedLayerStore

    // Check if selecting normal condition multiple layers
    const isSelectingMultipleLayers = checkedLayerStores.length > 0

    if (isSelectingSingleLayerInside) {
      return checkedLayerStores
        .filter((layerStore: TLayerStore) => Boolean(layerStore?.getState()))
        .map((checkedLayerStore: TLayerStore) => checkedLayerStore.getState()._id)
    }

    if (isSelectingSingleLayer) {
      return [clickedLayerStore.getState()._id]
    }

    if (isSelectingMultipleLayers) {
      return checkedLayerStores
        .filter((layerStore: TLayerStore) => Boolean(layerStore?.getState()))
        .map((checkedLayerStore: TLayerStore) => checkedLayerStore.getState()._id)
    }

    return []
  }, [checkedLayerStores, clickedLayerStore])

  const singleLayerSelectedInMultiLayers = useMemo(() => {
    return clickedLayerStore && checkedLayerStores.length > 1 ? clickedLayerStore : null
  }, [checkedLayerStores.length, clickedLayerStore])

  const setSelectedIds = useCallback(
    (
      ids: string[],
      opts: SelectOptions = {
        selectSingleLayer: false,
        metaKey: false,
      }
    ) => {
      const { selectSingleLayer, metaKey } = opts

      // Create temp variables
      let _clickedLayerStore: TLayerStore | null = null
      let _checkedLayerStores: TLayerStore[] = []

      // Set clicked layer store inside while selecting multiple layers
      if (ids.length === 1 && selectSingleLayer) {
        const isSelectingSingleLayerInside = ids[0] === singleLayerSelectedInMultiLayers?.getState()?._id

        // Only select single layer when not selecting and not hit meta key
        if (!isSelectingSingleLayerInside && !metaKey) {
          _clickedLayerStore = getLayerStoreById(ids[0])
        }

        // Deselect when hitting meta key
        else if (metaKey) {
          _clickedLayerStore = null
        }

        // Do-nothing with clicked layer store
        else {
          _clickedLayerStore = singleLayerSelectedInMultiLayers
        }

        _checkedLayerStores = selectedIds.map((id: string) => getLayerStoreById(id))
      }

      // Set checked layer store and clear clicked layer store when selecting multiple layers
      else if (ids.length > 1) {
        _clickedLayerStore = null
        _checkedLayerStores = ids.map(id => getLayerStoreById(id))
      }

      // Set clicked layer store if selecting one layer & clear checked layer store
      else if (ids.length === 1) {
        _clickedLayerStore = getLayerStoreById(ids[0])
        _checkedLayerStores = []
      }

      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: _clickedLayerStore,
          checkedLayerStores: _checkedLayerStores,
        },
      })
    },
    [selectedIds, singleLayerSelectedInMultiLayers]
  )

  /**
   * Updates the selection rectangle based on the current selection state
   */
  const updateSelectionRect = useCallback(() => {
    const node = selectionRectRef.current
    if (!node) return

    const { visible, x1, y1, x2, y2 } = selection.current

    node.setAttrs({
      visible,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      fill: SELECTION_RECT_FILL_COLOR,
      stroke: SELECTION_RECT_STROKE_COLOR,
      strokeWidth: 1 / scale, // Adjust stroke width based on scale
    })

    node.getLayer()?.batchDraw()
  }, [scale])

  /**
   * Clears all highlighted layers
   */
  const clearAllHighlights = useCallback(() => {
    const currentLayerRef = layerRef.current
    if (!currentLayerRef || highlightedLayers.current.length === 0) return

    // Remove highlight from all previously highlighted layers
    highlightedLayers.current.forEach(id => {
      const layer = currentLayerRef.findOne(`#${id}`)
      if (layer && !selectedIds.includes(id)) {
        layer.setAttrs({
          stroke: undefined,
          strokeWidth: 0,
        })
      }
    })

    // Reset highlighted layers
    highlightedLayers.current = []

    // Redraw the layer
    currentLayerRef.batchDraw()
  }, [layerRef, selectedIds])

  /**
   * Highlights layers that are within the selection rectangle
   */
  const updateLayerHighlights = useCallback(
    (selBox: { x: number; y: number; width: number; height: number }) => {
      const currentLayerRef = layerRef.current
      if (!currentLayerRef) return

      // Get all layers with LAYER_NAME
      const layers = currentLayerRef.find(`.${LAYER_NAME}`)

      // Clear previous highlights first
      clearAllHighlights()

      // New list of highlighted layers
      const newHighlightedLayers: string[] = []

      // Find layers that intersect with selection rectangle
      layers.forEach(layer => {
        const layerId = layer.id()

        // Skip already selected layers
        if (selectedIds.includes(layerId)) return

        // Check if this layer intersects with the selection box
        if (checkIntersection(layer, selBox, stageViewport)) {
          // Add stroke to highlight the layer
          layer.setAttrs({
            stroke: LAYER_STROKE_COLOR,
            strokeWidth: LAYER_STROKE_WIDTH / scale,
          })
          newHighlightedLayers.push(layerId)
        }
      })

      // Update the ref with new highlighted layers
      highlightedLayers.current = newHighlightedLayers

      // Redraw the layer
      currentLayerRef.batchDraw()
    },
    [clearAllHighlights, layerRef, scale, selectedIds, stageViewport]
  )

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

  const onMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Skip if in grabbing mode or selection is not active
      if (isGrabbing || !selection.current.visible) {
        return
      }

      const stage = e.target.getStage()
      if (!stage) return

      const pos = stage.getPointerPosition() || { x: 0, y: 0 }

      // Check if this is the start of a drag operation on a selected element
      // Skip selection rectangle updates in this case
      if (!isDragging.current && e.target !== stage && e.target.hasName(LAYER_NAME)) {
        const isSelected = selectedIds.includes(e.target.id())
        if (isSelected) {
          isDragging.current = true
          selection.current.visible = false
          updateSelectionRect()
          clearAllHighlights()
          return
        }
      }

      // Convert stage position to scene position to account for scale
      const scenePos = stageToSceneCoords(pos, stageViewport)

      selection.current.x2 = scenePos.x
      selection.current.y2 = scenePos.y

      // Update the selection rectangle
      updateSelectionRect()

      // Update layer highlighting
      const selBox = {
        x: Math.min(selection.current.x1, selection.current.x2),
        y: Math.min(selection.current.y1, selection.current.y2),
        width: Math.abs(selection.current.x2 - selection.current.x1),
        height: Math.abs(selection.current.y2 - selection.current.y1),
      }
      updateLayerHighlights(selBox)
    },
    [clearAllHighlights, isGrabbing, selectedIds, stageViewport, updateLayerHighlights, updateSelectionRect]
  )

  // Apply throttle outside of useCallback
  const throttledMouseMove = useMemo(() => throttle(onMouseMove, 10), [onMouseMove])

  const onMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Reset drag state
      isDragging.current = false

      // Skip if in grabbing mode or selection is not active
      if (isGrabbing || !selection.current.visible) {
        // Clear any highlights that might still be present
        clearAllHighlights()
        return
      }

      const { x1, y1, x2, y2 } = selection.current
      const moved = Math.abs(x1 - x2) > 5 / scale || Math.abs(y1 - y2) > 5 / scale

      if (moved) {
        // Create selection box
        const selBox = {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        }

        // Get layers and check for intersection
        const currentLayerRef = layerRef.current
        if (currentLayerRef) {
          const layers = currentLayerRef.find(`.${LAYER_NAME}`)

          // Filter layers that intersect with selection rectangle using our custom intersection check
          const selectedLayers = layers.filter(layer => {
            return checkIntersection(layer, selBox, stageViewport)
          })

          if (selectedLayers.length > 0) {
            const selectedLayerIds = selectedLayers.map(layer => layer.id())
            setSelectedIds(selectedLayerIds)
          }
        }
      }

      // Reset selection
      selection.current.visible = false
      updateSelectionRect()
      clearAllHighlights()
      oldPos.current = null
    },
    [clearAllHighlights, isGrabbing, layerRef, scale, setSelectedIds, stageViewport, updateSelectionRect]
  )

  const onClickTap = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
      // Skip completely if in grabbing mode
      if (isGrabbing) {
        return
      }

      // Reset drag tracking
      isDragging.current = false

      // Clear any highlights
      clearAllHighlights()

      // Check if we've moved the selection rectangle
      if (selection.current.visible) {
        const { x1, x2, y1, y2 } = selection.current
        const moved = Math.abs(x1 - x2) > 5 / scale || Math.abs(y1 - y2) > 5 / scale

        if (moved) {
          return
        }
      }

      const targetEvent = e.target

      if (!targetEvent) return

      const isElement = targetEvent.findAncestor('.elements-container')
      const isTransformer = targetEvent.findAncestor('Transformer')

      if (isElement || isTransformer) {
        return
      }

      const stage = targetEvent.getStage()
      if (!stage) return
      const pos = stage.getPointerPosition() || { x: 0, y: 0 }

      // Convert to scene coordinates
      const scenePos = stageToSceneCoords(pos, stageViewport)

      // Start selection only if clicking on empty stage
      // This prevents selection rectangle appearing when clicking on layers
      if (e.target === stage) {
        selection.current.visible = true
        selection.current.x1 = scenePos.x
        selection.current.y1 = scenePos.y
        selection.current.x2 = scenePos.x
        selection.current.y2 = scenePos.y
        updateSelectionRect()
      }

      const layer = layerRef.current
      const tr = trRef.current

      // if click on empty area - remove all selections and signal transformer reset
      if (targetEvent === stage || targetEvent.hasName(PREVIEW_IMAGE_NODE_NAME)) {
        setSelectedIds([])
        if (tr) {
          tr.nodes([])
          tr.getLayer()?.batchDraw()
        }
        return
      }

      // do nothing if clicked NOT on our layers (accept inner-edit node as a layer)
      // Resolve selectable node: prefer ancestor with layer name or inner-edit node
      let selectableNode: any = targetEvent
      if (!(targetEvent.hasName(LAYER_NAME) || targetEvent.hasName(INNER_EDIT_NODE_NAME))) {
        const layerAncestor = targetEvent.findAncestor(`.${LAYER_NAME}`)
        const innerEditAncestor = targetEvent.findAncestor(`.${INNER_EDIT_NODE_NAME}`)
        if (layerAncestor) {
          selectableNode = layerAncestor
        } else if (innerEditAncestor) {
          selectableNode = innerEditAncestor
        } else {
          return
        }
      }

      const shiftKey = e.evt.shiftKey
      const metaKey = e.evt.ctrlKey || e.evt.metaKey
      // Bind transformer to inner node when clicking in inner-edit mode (node may have class 'inner-edit-node')
      const isSelected = tr ? tr.nodes().indexOf(selectableNode) >= 0 : false
      if (!isSelected && tr && (selectableNode.hasName(INNER_EDIT_NODE_NAME) || selectableNode.hasName(LAYER_NAME))) {
        const nodeToSelect = selectableNode
        tr.nodes([nodeToSelect])
        tr.getLayer()?.batchDraw()
      }

      // If meta key is hold, select or deselect the clicked layer based on its current selection state
      if (metaKey) {
        if (isSelected) {
          setSelectedIds(selectedIds.filter((oldId: string) => oldId !== selectableNode.id()))
        } else {
          setSelectedIds([...selectedIds, selectableNode.id()])
        }
      }

      // If shift key is hold and layer is not selected, add it to selection
      else if (shiftKey) {
        if (isSelected) {
          return
        }

        setSelectedIds([...selectedIds, selectableNode.id()])
      }

      // Create a new selection from the clicked layer if not in multi-selection mode
      else {
        if (selectedIds.length > 1 && isSelected) {
          return
        }

        setSelectedIds([selectableNode.id()])
      }

      layer?.draw()
    },
    [
      clearAllHighlights,
      isGrabbing,
      layerRef,
      scale,
      selectedIds,
      setSelectedIds,
      stageViewport,
      trRef,
      updateSelectionRect,
    ]
  )

  /**
   * Handle touch start - only track deselect on empty, don't select elements
   * Selection is deferred to onTap to allow gesture disambiguation
   */
  const onTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      // Skip during pinch gesture (multi-touch)
      if (isMobile && e.evt.touches.length > 1) {
        return
      }
      // Only deselect when tapping empty area
      // Element selection is handled by onTap for proper gesture disambiguation
      checkDeselect(e)
    },
    [checkDeselect, isMobile]
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
    const currentLayerRef = layerRef.current
    const currentTransformerRef = trRef.current

    // Guard: transformer must exist
    if (!currentTransformerRef || !currentLayerRef) return

    // If stage is not available or unmounted, clear nodes to avoid Konva internal null refs
    const stage = currentLayerRef?.getStage()
    if (!stage) {
      currentTransformerRef.nodes([])
      return
    }

    // Helper to check if layer is transform-locked (individual mode without selected option)
    const isLayerTransformLocked = (layerStore: TLayerStore | null): boolean => {
      if (!layerStore) return false
      const state = layerStore.getState()
      const imageOptionSet = state.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
      if (!imageOptionSet) return false

      const editingMode = ((imageOptionSet as any)?.editingMode as 'sync' | 'individual') || 'sync'
      if (editingMode !== 'individual') return false

      const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
      const files: ImageOptionSet[] = (imageOptionSet.data as any)?.[dataKey] || []
      return !files.some(f => f.selecting)
    }

    // 1) Configure anchors based on selected text layer shape
    const configureAnchors = () => {
      const allAnchors = [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]

      // Check if the selected layer is transform-locked
      if (clickedLayerStore && isLayerTransformLocked(clickedLayerStore)) {
        currentTransformerRef.enabledAnchors([])
        currentTransformerRef.rotateEnabled(false)
        return
      }

      // Enable rotation by default
      currentTransformerRef.rotateEnabled(true)

      // If no single clicked layer, or not a text layer, enable all anchors
      if (!clickedLayerStore) {
        currentTransformerRef.enabledAnchors(allAnchors)
        return
      }

      const layerState = clickedLayerStore.getState()
      if (layerState.type !== 'text') {
        currentTransformerRef.enabledAnchors(allAnchors)
        return
      }

      // Preview mode: respect zone resizable/rotatable flags (simulate buyer experience)
      if (previewMode && layerState.shapeSettings?.movementBounds) {
        const { resizable, rotatable } = layerState.shapeSettings
        currentTransformerRef.enabledAnchors(resizable !== false ? allAnchors : [])
        currentTransformerRef.rotateEnabled(rotatable !== false)
        return
      }

      const textShape = layerState.settings?.textShape
      if (textShape === 'circle') {
        currentTransformerRef.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      } else {
        currentTransformerRef.enabledAnchors(allAnchors)
      }
    }

    configureAnchors()

    // CHARM layers are virtual — they manage their own Transformer in CharmNodeCanvasRenderer
    if (clickedLayerStore) {
      const layerType = clickedLayerStore.getState()?.type
      if (layerType === 'charm-node' || layerType === 'charm') {
        currentTransformerRef.nodes([])
        currentTransformerRef.getLayer()?.batchDraw()
        return
      }
    }

    // Find and bind transformer nodes
    findAndBindTransformerNodes(currentLayerRef, currentTransformerRef, selectedIds)
  }, [layerRef, trRef, selectedIds, clickedLayerStore, previewMode])

  const onHideTransformer = useCallback(() => {
    const currentLayerRef = layerRef.current
    const currentTransformerRef = trRef.current
    if (!currentLayerRef || !currentTransformerRef) return
    currentTransformerRef.nodes([])
    currentTransformerRef.getLayer()?.batchDraw()
  }, [layerRef, trRef])

  useEffect(() => {
    onUpdateTransformer()

    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, onUpdateTransformer)

    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, onUpdateTransformer)
    }
  }, [onUpdateTransformer])

  useEffect(() => {
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER, onHideTransformer)

    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER, onHideTransformer)
    }
  }, [onHideTransformer])

  // Update transformer of selecting single layer inside multiple layers being selected
  useEffect(() => {
    const currentLayerRef = layerRef.current
    const currentSecondaryTransformerRef = secondaryTrRef.current

    if (!currentLayerRef || !currentSecondaryTransformerRef) return

    if (singleLayerSelectedInMultiLayers) {
      const node = currentLayerRef.findOne(`#${singleLayerSelectedInMultiLayers.getState()._id}`)

      currentSecondaryTransformerRef.nodes(node ? [node] : [])
    } else {
      currentSecondaryTransformerRef.nodes([])
    }
  }, [layerRef, secondaryTrRef, selectedIds, singleLayerSelectedInMultiLayers])

  // Reset selection rectangle and highlights whenever grabbing mode changes
  useEffect(() => {
    if (isGrabbing) {
      // Reset selection state when entering grabbing mode
      selection.current.visible = false
      updateSelectionRect()
      clearAllHighlights()
    }
  }, [clearAllHighlights, isGrabbing, updateSelectionRect])

  // Track previous values for delta compensation on container-only resize
  const prevCanvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const prevContentKeyRef = useRef('')

  useEffect(() => {
    // Revaluate the viewport when the canvas size is changed
    const selector = TEMPLATE_EDITOR_CANVAS_CONTAINER
    const preview = TemplateEditorStore.getState().previewProductImage

    const { effectiveDimension, contentOffset } = calculateEffectiveDimension(
      { width: widthByPixels, height: heightByPixels },
      preview
    )

    // Build a key from content-related deps to detect if only container size changed
    const contentKey = [
      widthByPixels,
      heightByPixels,
      scaleUpStageViewPort,
      previewProductImage?.src,
      previewProductImage?.visible,
      previewProductImage?.left,
      previewProductImage?.top,
      previewProductImage?.width,
      previewProductImage?.height,
    ].join('|')

    const prev = prevCanvasSizeRef.current
    const contentChanged = contentKey !== prevContentKeyRef.current
    const containerResized
      = prev.width > 0 && prev.height > 0 && (canvasSize.width !== prev.width || canvasSize.height !== prev.height)

    if (containerResized && !contentChanged) {
      // Container-only resize (sidebar open/close): shift viewport to keep visual center stable
      const currentViewport = TemplateEditorStore.getState().viewport
      const deltaX = (canvasSize.width - prev.width) / 2
      const deltaY = (canvasSize.height - prev.height) / 2
      const _viewport = {
        scale: currentViewport.scale,
        left: currentViewport.left + deltaX,
        top: currentViewport.top + deltaY,
      }
      TemplateEditorStore.dispatch({ type: 'SET_VIEW_PORT', payload: { viewport: _viewport }, skipTrace: true })
    } else if (contentChanged || prev.width === 0 || prev.height === 0) {
      // Full recenter: only on initial load or real content changes
      const _viewport = evaluateStageViewPort(selector, effectiveDimension, scaleUpStageViewPort, contentOffset)
      TemplateEditorStore.dispatch({ type: 'SET_VIEW_PORT', payload: { viewport: _viewport }, skipTrace: true })
    }
    // else: nothing changed — skip to prevent spurious recenter from ResizeObserver reconnect

    prevCanvasSizeRef.current = { width: canvasSize.width, height: canvasSize.height }
    prevContentKeyRef.current = contentKey
  }, [
    canvasSize,
    scaleUpStageViewPort,
    widthByPixels,
    heightByPixels,
    previewProductImage?.src,
    previewProductImage?.visible,
    previewProductImage?.left,
    previewProductImage?.top,
    previewProductImage?.width,
    previewProductImage?.height,
  ])

  const { t } = useTranslation()

  /* ------------------------------------------------------------------ */
  /* Context menu & clipboard logic                                     */
  /* ------------------------------------------------------------------ */

  const { contextMenu, menuActions, onContextMenuHandler, onContextMenuClose, exportPopover, onExportPopoverClose }
    = useCanvasContextMenu({
      t,
      selectedIds,
      clickedLayerStore: clickedLayerStore || null,
      checkedLayerStores,
      interactive: interactive ?? true,
    })

  /* ---------------------- Context Menu Handler ----------------------- */

  useLayoutEffect(() => {
    updateSelectionRect()
  }, [canvasSize.width, canvasSize.height, updateSelectionRect])

  return (
    <Fragment>
      <Stage
        id={CANVAS_EDITOR_STAGE}
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
              onMouseDown: onClickTap,
              onTap: onTapHandler,
              onContextMenu: onContextMenuHandler,
            }
          : {})}
      >
        {props.children}

        {/* Selection Rectangle Layer - always last to appear on top */}
        <Layer>
          <Rect
            ref={selectionRectRef}
            visible={false}
            fill={SELECTION_RECT_FILL_COLOR}
            stroke={SELECTION_RECT_STROKE_COLOR}
            strokeWidth={1 / scale} // Adjust stroke width based on scale
          />
        </Layer>
      </Stage>

      {/* Right-click context menu */}
      <CanvasContextMenu
        open={contextMenu.open}
        anchor={contextMenu}
        onClose={onContextMenuClose}
        actions={menuActions}
      />

      {/* Export layers popover */}
      <ExportLayersPopover
        open={exportPopover.open}
        anchor={exportPopover}
        layerStores={exportPopover.layerStores}
        stageRef={stageRef}
        onClose={onExportPopoverClose}
      />
    </Fragment>
  )
}
