import { useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { calculateOnInitTemplate } from '~/utils/canvas/zoom'
import { preloadOpenCV } from '../../utils/opencvLoader'
import { performRedraw } from './canvas-redraw'
import type { UseInteractionStateReturn } from './use-interaction-state'
import type { UseCanvasZoomReturn } from './use-canvas-zoom'
import type { ShapeSelection } from '../../types'
import type { DrawingMode } from './types'

interface CanvasEffectsParams {
  image: HTMLImageElement | null
  imageLoaded: boolean
  canvasRef: React.RefObject<HTMLCanvasElement>
  containerRef: React.RefObject<HTMLDivElement>
  getCanvasContext: () => CanvasRenderingContext2D | null
  shapeSelections: ShapeSelection[]
  shapeSelectionsRef: React.MutableRefObject<ShapeSelection[]>
  interaction: UseInteractionStateReturn
  zoom: UseCanvasZoomReturn
  isMobileView: boolean
  onZoomChange?: (state: { scale: number; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void }) => void
  nodeEditingRef: React.MutableRefObject<{
    isActive: boolean
    renderNodes: (ctx: CanvasRenderingContext2D) => void
    isDragging: boolean
  }>
  shapeToolRef: React.MutableRefObject<{
    isDrawing: boolean
    currentSelection: ShapeSelection | null
    renderDrawingState: (ctx: CanvasRenderingContext2D) => void
    switchShapeType: (t: 'rectangle' | 'ellipse') => void
  }>
  isVectorModeRef: React.MutableRefObject<boolean>
  vectorToolRef: React.MutableRefObject<{
    isDrawing: boolean
    renderDrawingState: (ctx: CanvasRenderingContext2D) => void
  }>
  isMagicWandModeRef: React.MutableRefObject<boolean>
  magicWandRef: React.MutableRefObject<{
    hasOverlay: boolean
    renderOverlay: (ctx: CanvasRenderingContext2D, fn: (ix: number, iy: number) => { x: number; y: number }) => void
  }>
  isAutoDetectModeRef: React.MutableRefObject<boolean>
  autoDetectRef: { readonly current: { hasOverlay: boolean; renderOverlay: (ctx: CanvasRenderingContext2D) => void } }
  isPaintModeRef: React.MutableRefObject<boolean>
  paintToolRef: {
    readonly current: {
      hasOverlay: boolean
      renderOverlay: (ctx: CanvasRenderingContext2D, viewport: { scale: number; left: number; top: number }) => void
    }
  }
  paintTool: { hasOverlay: boolean; isPainting: boolean; strokeVersion: number }
  vectorTool: {
    isDrawing: boolean
    drawingPath: unknown
    isDrawDragging: boolean
    drawDragCurrent: unknown
    hoveredDrawingNodeIndex: unknown
    drawPreviewPos: unknown
  }
  nodeEditing: {
    isActive: boolean
    hoveredNodeIndex: number | null
    hoveredCp: unknown
    isDragging: boolean
    selectedNodeIndex: number | null
    marqueeVersion: number
  }
  magicWand: { overlayPath: unknown }
  autoDetect: { overlayPath: unknown }
  shapeTool: { isDrawing: boolean; currentSelection: ShapeSelection | null }
  nodeEditingDeleteSelectedRef: React.MutableRefObject<(() => boolean) | null>
  isVectorMode: boolean
  isMagicWandMode: boolean
  isAutoDetectMode: boolean
  deleteShape: (index: number) => void
  onVectorModeEnter?: () => void
  isAutoDetectProcessing: boolean
  setTipIndex: (fn: (i: number) => number) => void
  autoDetectTipsLength: number
  handleTouchStart: (e: TouchEvent) => void
  handleTouchMove: (e: TouchEvent) => void
  handleTouchEnd: () => void
  mobileMode: DrawingMode
  setMobileMode: React.Dispatch<React.SetStateAction<DrawingMode>>
  /** Native wheel handler for zoom/pan — called from non-passive wheel listener */
  handleWheel: (event: WheelEvent) => void
}

export function useCanvasEffects(p: CanvasEffectsParams) {
  const {
    image,
    imageLoaded,
    canvasRef,
    containerRef,
    getCanvasContext,
    shapeSelections,
    shapeSelectionsRef,
    interaction,
    zoom,
    isMobileView,
    onZoomChange,
    nodeEditingRef,
    shapeToolRef,
    isVectorModeRef,
    vectorToolRef,
    isMagicWandModeRef,
    magicWandRef,
    isAutoDetectModeRef,
    autoDetectRef,
    vectorTool,
    nodeEditing,
    magicWand,
    autoDetect,
    shapeTool,
    nodeEditingDeleteSelectedRef,
    deleteShape,
    onVectorModeEnter,
    isAutoDetectProcessing,
    setTipIndex,
    autoDetectTipsLength,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    mobileMode,
    setMobileMode,
  } = p

  const redrawRequestRef = useRef<number | null>(null)

  const resizeCanvasToContainer = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return null
    // Use clientWidth/clientHeight (excludes border) to match the canvas CSS display size.
    // offsetWidth includes the container border, which causes a coordinate mismatch
    // since the absolutely-positioned canvas fills only the padding box (content area).
    const w = container.clientWidth
    const h = container.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      const dims = { width: w, height: h }
      zoom.setContainerDimension(dims)
      return dims
    }
    return { width: canvas.width, height: canvas.height }
  }, [canvasRef, containerRef, zoom])

  // Initialize canvas when image loads
  useEffect(() => {
    if (image && imageLoaded && canvasRef.current && containerRef.current) {
      zoom.setDimension({ width: image.width, height: image.height })
      const dims = resizeCanvasToContainer()
      if (!dims) return
      if (!zoom.viewportInitializedRef.current) {
        zoom.setViewport(
          calculateOnInitTemplate(dims.width, dims.height, { width: image.width, height: image.height }, false)
        )
        zoom.viewportInitializedRef.current = true
      }
      preloadOpenCV()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, imageLoaded])

  // Keep canvas internal resolution in sync when the container resizes
  // (e.g. dynamic scrollableHeight in simplified flow, window resize)
  useEffect(() => {
    const container = containerRef.current
    if (!container || !image) return

    const observer = new ResizeObserver(() => {
      resizeCanvasToContainer()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, image, resizeCanvasToContainer])

  // Expose zoom controls
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange({
        scale: zoom.viewport.scale,
        zoomIn: zoom.zoomIn,
        zoomOut: zoom.zoomOut,
        resetZoom: zoom.resetZoom,
      })
    }
  }, [zoom.viewport.scale, zoom.zoomIn, zoom.zoomOut, zoom.resetZoom, onZoomChange])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (nodeEditingDeleteSelectedRef.current?.()) return
        if (interaction.selectedShapeIndex !== null) {
          deleteShape(interaction.selectedShapeIndex)
          interaction.setSelectedShapeIndex(null)
        }
      }
      if (e.key === 'Shift' && shapeToolRef.current.isDrawing && shapeToolRef.current.currentSelection) {
        e.preventDefault()
        shapeToolRef.current.switchShapeType(
          shapeToolRef.current.currentSelection.type === 'rectangle' ? 'ellipse' : 'rectangle'
        )
      }
      if (
        (e.key === 'e' || e.key === 'E')
        && !isVectorModeRef.current
        && !isMagicWandModeRef.current
        && !isAutoDetectModeRef.current
      ) {
        e.preventDefault()
        setMobileMode((prev: DrawingMode) => (prev === 'rectangle' ? 'ellipse' : 'rectangle'))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    interaction,
    deleteShape,
    nodeEditingDeleteSelectedRef,
    shapeToolRef,
    isAutoDetectModeRef,
    isMagicWandModeRef,
    isVectorModeRef,
    setMobileMode,
  ])

  // Notify parent when vector drawing starts
  useEffect(() => {
    if (vectorTool.isDrawing && onVectorModeEnter) onVectorModeEnter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vectorTool.isDrawing])

  // Cycle auto-detect processing tips
  useEffect(() => {
    if (!isAutoDetectProcessing) {
      setTipIndex(() => 0)
      return
    }
    const interval = setInterval(() => setTipIndex(i => (i + 1) % autoDetectTipsLength), 5000)
    return () => clearInterval(interval)
  }, [isAutoDetectProcessing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Non-passive wheel listener: prevents page scroll and handles zoom/pan.
  // Must be native (not React onWheel) because passive listeners can't preventDefault.
  const handleWheelRef = useRef(p.handleWheel)
  handleWheelRef.current = p.handleWheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      handleWheelRef.current(e)
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [canvasRef])

  // Touch event listeners (non-passive for preventDefault support)
  // Registered for ALL modes including pan so manipulation (move/resize/rotate)
  // works when a shape is selected in Select/Pan mode.
  useEffect(() => {
    if (!isMobileView) return
    const canvas = canvasRef.current
    if (!canvas) return
    const onStart = (e: TouchEvent) => handleTouchStart(e)
    const onMove = (e: TouchEvent) => handleTouchMove(e)
    const onEnd = () => handleTouchEnd()
    const onCancel = () => handleTouchEnd()
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd, { passive: false })
    canvas.addEventListener('touchcancel', onCancel, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      canvas.removeEventListener('touchcancel', onCancel)
    }
  }, [isMobileView, mobileMode, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef])

  // Canvas redraw
  useEffect(() => {
    if (redrawRequestRef.current) cancelAnimationFrame(redrawRequestRef.current)
    redrawRequestRef.current = requestAnimationFrame(() =>
      performRedraw({
        canvasRef,
        image,
        getCanvasContext,
        shapeSelectionsRef,
        selectedShapeIndexRef: interaction.selectedShapeIndexRef,
        viewportRef: zoom.viewportRef,
        isMovingRef: interaction.isMovingRef,
        isResizingRef: interaction.isResizingRef,
        isRotatingRef: interaction.isRotatingRef,
        movingShapeIndexRef: interaction.movingShapeIndexRef,
        resizingShapeIndexRef: interaction.resizingShapeIndexRef,
        isMobileView,
        nodeEditingRef,
        shapeToolRef,
        isVectorModeRef,
        vectorToolRef,
        isMagicWandModeRef,
        magicWandRef,
        isAutoDetectModeRef,
        autoDetectRef,
        isPaintModeRef: p.isPaintModeRef,
        paintToolRef: p.paintToolRef,
      })
    )
    return () => {
      if (redrawRequestRef.current) cancelAnimationFrame(redrawRequestRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shapeSelections,
    image,
    canvasRef,
    getCanvasContext,
    shapeTool.isDrawing,
    shapeTool.currentSelection,
    interaction.isMoving,
    interaction.movingShapeIndex,
    interaction.isResizing,
    interaction.resizingShapeIndex,
    interaction.isRotating,
    interaction.rotatingShapeIndex,
    interaction.selectedShapeIndex,
    zoom.viewport,
    vectorTool.isDrawing,
    vectorTool.drawingPath,
    vectorTool.isDrawDragging,
    vectorTool.drawDragCurrent,
    vectorTool.hoveredDrawingNodeIndex,
    vectorTool.drawPreviewPos,
    nodeEditing.isActive,
    nodeEditing.hoveredNodeIndex,
    nodeEditing.hoveredCp,
    nodeEditing.isDragging,
    nodeEditing.selectedNodeIndex,
    nodeEditing.marqueeVersion,
    magicWand.overlayPath,
    autoDetect.overlayPath,
    p.paintTool.hasOverlay,
    p.paintTool.isPainting,
    p.paintTool.strokeVersion,
  ])
}
