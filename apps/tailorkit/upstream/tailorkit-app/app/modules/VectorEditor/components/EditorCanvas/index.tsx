/* eslint-disable max-len */
/* eslint-disable max-lines */
/**
 * EditorCanvas - Canvas component for rendering and interacting with SVG paths
 * Uses hybrid approach: SVGPreviewLayer for effects rendering, Canvas for interaction elements
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import {
  serializePathCommands,
  findSegmentAtPoint,
  createEmptyDefs,
  stringToPaint,
  findClosestNodeInPath,
  findConnectedSegment,
  buildSegmentPathD,
  calculatePathBounds,
  calculatePathCenter,
  calculateEffectGroups,
} from '../../utils/svg'
import type { Point, ParsedSvgExtended, ParsedPathExtended, PathCommand } from '../../utils/svg'
import type {
  EditorCanvasProps,
  EditorCanvasRef,
  DragState,
  HoveredSegment,
  SelectionRect,
  HoveredConnectedSegment,
  ConnectedSegment,
  ResizeHandleType,
} from '../../types'
import { useViewport } from '../../hooks/useViewport'
import useTouchGestures, { getTouchCoordinates } from '../../hooks/useTouchGestures'
import {
  NODE_RADIUS,
  CONTROL_POINT_RADIUS,
  HIT_TOLERANCE,
  SELECTION_DRAG_THRESHOLD,
  ROTATION_HANDLE_OFFSET,
  ROTATION_HANDLE_RADIUS,
  RESIZE_HANDLE_SIZE,
  RESIZE_HANDLE_HIT_TOLERANCE,
  COLORS,
  MIN_SCALE,
  MAX_SCALE,
  RULER_SIZE,
} from '../../constants'
import SVGPreviewLayer from './SVGPreviewLayer'
import RasterBackgroundLayer from './RasterBackgroundLayer'
import PreviewBackgroundLayer from './PreviewBackgroundLayer'
import { renderGrid } from './GridOverlay'
import { renderGuidelines, findGuidelineAtPosition } from './GuidelinesOverlay'
import { RulerOverlay } from './RulerOverlay'
import { getShapeById, isUnifiedGridShape } from '../../constants/shapes'
import { snapPoint, snapBounds } from '../../utils/snap'
import styles from './styles.module.css'
import { Button, ButtonGroup } from '@shopify/polaris'
import { MinusIcon, PlusIcon, SearchIcon } from '@shopify/polaris-icons'

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(function EditorCanvas(
  {
    parsedSvg,
    pathStyles,
    defs,
    // Consolidated selection state (Set-based only)
    selectedPathIndices,
    selectedNodeIndices,
    editorMode,
    drawingPath,
    isStartingNewSubpath,
    // Predefined shape props
    selectedPredefinedShape,
    shapeDragStart,
    shapeDragCurrent,
    // Consolidated selection callbacks (Set-based only)
    onPathIndicesChange,
    onNodeIndicesChange,
    onNodeMove,
    onNodeMoveEnd,
    onControlPointMove,
    onControlPointMoveEnd,
    onMultiNodeMove,
    onMultiNodeMoveEnd,
    onPathMove,
    onPathMoveEnd,
    onNodeInsert,
    onDrawPathClick,
    onDrawPathCurve,
    onDrawPathQuadratic,
    onCloseDrawingPath,
    onCloseDrawingPathWithCurve,
    // Drawing curve type (Feature 1)
    drawingCurveType = 'cubic',
    // Mobile modifier toggles (Feature 2)
    mobileInsertNodeMode,
    mobileMultiSelectMode,
    mobileSelectionRectMode,
    // Extend mode props (Feature 3)
    isExtendMode,
    extendFromNode,
    onExtendPath,
    onCloseExtendPath,
    onCanvasInteraction,
    // Predefined shape callbacks
    onShapeDragStart,
    onShapeDragMove,
    onShapeDragEnd,
    // Rotation callbacks
    onRotationChange,
    onRotationChangeEnd,
    // Resize callbacks
    onResizeChange,
    onResizeChangeEnd,
    // Overlay mode props
    isOverlayMode,
    imageInfo,
    imageColorAdjustments,
    clipPathIndices,
    holePathIndices,
    adjustmentMasks,
    // Block click actions when popover/sidebar is visible (only allow pan/zoom)
    isPopoverOrSidebarOpen,
    // Callback to close sidebar when clicking on canvas
    onCloseSidebar,
    // Hide path selection feedback (stroke + nodes) - keep bounding box and transform handles
    hidePathSelectionFeedback,
    // Edit mode settings for overlays (grid, ruler)
    editModeSettings,
    gridSettings,
    guidelines,
    onGuidelineAdd,
    onGuidelineUpdate,
    onGuidelineRemove,
    // Preview image from TemplateEditor (non-editable environmental background)
    previewImageConfig,
    workspaceDimensions,
  },
  ref
) {
  // Derive primary selection from Sets for backward compatibility with internal logic
  const selectedPathIndex = selectedPathIndices.size > 0 ? [...selectedPathIndices][0] : null
  const selectedNodeIndex = selectedNodeIndices.size > 0 ? [...selectedNodeIndices][0] : null

  // Helper function to update node selection (wraps onNodeIndicesChange for convenience)
  const onSelectedNodesChange = useCallback(
    (indices: Set<number>) => {
      onNodeIndicesChange(indices)
    },
    [onNodeIndicesChange]
  )

  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null) // Background canvas (viewBox overlay)
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null) // Interaction canvas (nodes, handles, selection)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mobile hint state - tracks if user has interacted to auto-hide hints
  const [hasInteracted, setHasInteracted] = useState(false)

  // Canvas size state
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  // Edit mode overlay state
  const [draggingGuidelineId, setDraggingGuidelineId] = useState<string | null>(null)
  const [hoveredGuidelineId, setHoveredGuidelineId] = useState<string | null>(null)
  // Mouse position in SVG coordinates for ruler indicator (currently unused setter for future enhancement)
  const [mousePositionSvg] = useState<Point | null>(null)
  // Track the dragging guideline's axis for proper coordinate updates
  const draggingGuidelineAxisRef = useRef<'x' | 'y' | null>(null)

  // Device pixel ratio for HiDPI/retina display support
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  // Viewport management via hook
  const {
    scale,
    offset,
    scaleRef,
    offsetRef,
    commitViewport,
    screenToSvg,
    svgToScreen,
    zoomIn: viewportZoomIn,
    zoomOut: viewportZoomOut,
    resetViewport: viewportResetZoom,
    handleWheel: viewportHandleWheel,
  } = useViewport({ parsedSvg, canvasSize })

  // Expose zoom methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: viewportZoomIn,
      zoomOut: viewportZoomOut,
      resetZoom: viewportResetZoom,
    }),
    [viewportZoomIn, viewportZoomOut, viewportResetZoom]
  )

  // Touch gesture handling for mobile
  const initialPinchScaleRef = useRef(1)
  const { handleTouchStart: processTouchStart, handleTouchMove: processTouchMove } = useTouchGestures({
    onPinchStart: () => {
      initialPinchScaleRef.current = scaleRef.current
      gestureBaseOffsetRef.current = { ...offsetRef.current }
      gestureBaseScaleRef.current = scaleRef.current
    },
    onPinchMove: (center, pinchScale) => {
      // Apply pinch zoom relative to initial scale (aligned with MockupWizard pattern)
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, initialPinchScaleRef.current * pinchScale))
      const zoomRatio = newScale / scaleRef.current - 1

      // Zoom toward pinch center (MockupWizard pattern)
      offsetRef.current = {
        x: offsetRef.current.x - (center.x - offsetRef.current.x) * zoomRatio,
        y: offsetRef.current.y - (center.y - offsetRef.current.y) * zoomRatio,
      }
      scaleRef.current = newScale
      requestRender()
      applySvgLayerGestureTransform()
    },
    onPinchEnd: () => {
      clearSvgLayerGestureTransform()
      commitViewport()
    },
    onLongPress: position => {
      // Long press for node insertion (alternative to Alt+Click) when hovering over a segment
      if (editorMode === 'edit' && selectedPathIndex !== null && hoveredSegment) {
        onNodeInsert?.(hoveredSegment.pathIndex, hoveredSegment.segmentIndex, hoveredSegment.position, hoveredSegment.t)
        setHoveredSegment(null)
      }
      // Selection rectangle mode is now toggle-based via toolbar button, not long-press
    },
    onDoubleTap: () => {
      // Double tap to reset zoom
      viewportResetZoom()
    },
  })

  // RAF batching for smooth rendering
  const rafIdRef = useRef<number | null>(null)
  const needsRenderRef = useRef(false)

  // Interaction tracking refs (to avoid callback recreation)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const isInteractingRef = useRef(false)
  // Track if touch was blocked due to popover/sidebar being open (to skip touchEnd processing)
  const touchBlockedByPopoverRef = useRef(false)
  // Track if touch is currently handling an interaction (to skip synthesized mouse events on mobile)
  const isTouchActiveRef = useRef(false)

  // Layer refs for direct DOM transform during touch gestures (real-time feedback).
  // All three positioned layers receive the same delta transform so they stay in sync
  // without waiting for commitViewport() to trigger a React re-render.
  const svgPreviewLayerRef = useRef<HTMLDivElement>(null)
  const rasterBackgroundLayerRef = useRef<HTMLDivElement>(null)
  const previewBackgroundLayerRef = useRef<HTMLDivElement>(null)
  // Baseline viewport at gesture start — used to compute CSS transform delta
  const gestureBaseOffsetRef = useRef<Point>({ x: 0, y: 0 })
  const gestureBaseScaleRef = useRef<number>(1)

  const applySvgLayerGestureTransform = useCallback(() => {
    const dx = offsetRef.current.x - gestureBaseOffsetRef.current.x
    const dy = offsetRef.current.y - gestureBaseOffsetRef.current.y
    const sr = scaleRef.current / gestureBaseScaleRef.current
    const transform
      = Math.abs(sr - 1) < 0.0001 ? `translate(${dx}px, ${dy}px)` : `translate(${dx}px, ${dy}px) scale(${sr})`
    for (const el of [
      svgPreviewLayerRef.current,
      rasterBackgroundLayerRef.current,
      previewBackgroundLayerRef.current,
    ]) {
      if (el) {
        el.style.transformOrigin = '0 0'
        el.style.transform = transform
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearSvgLayerGestureTransform = useCallback(() => {
    for (const el of [
      svgPreviewLayerRef.current,
      rasterBackgroundLayerRef.current,
      previewBackgroundLayerRef.current,
    ]) {
      if (el) {
        el.style.transform = ''
        el.style.transformOrigin = ''
      }
    }
  }, [])

  // Hover state for path highlighting
  const [hoveredPathIndex, setHoveredPathIndex] = useState<number | null>(null)

  // Hover state for segment highlighting (for node insertion)
  const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(null)

  // Hover state for connected segment highlighting (for subpath selection)
  const [hoveredConnectedSegment, setHoveredConnectedSegment] = useState<HoveredConnectedSegment | null>(null)

  // Draw mode preview state (cursor position for preview line)
  const [drawPreviewPos, setDrawPreviewPos] = useState<Point | null>(null)

  // Extend mode preview state (cursor position for extend preview line)
  const [extendPreviewPos, setExtendPreviewPos] = useState<Point | null>(null)

  // Extend mode hover state for closeable endpoint (opposite endpoint of the path)
  const [isHoveringExtendCloseNode, setIsHoveringExtendCloseNode] = useState(false)

  // Draw mode drag state (for click-and-drag curve creation)
  const [drawDragStart, setDrawDragStart] = useState<Point | null>(null)
  const [drawDragCurrent, setDrawDragCurrent] = useState<Point | null>(null)
  const [isDrawDragging, setIsDrawDragging] = useState(false)

  // Track if we're closing the path with a potential drag (to create curve on close)
  const [closingNodeIndex, setClosingNodeIndex] = useState<number | null>(null)

  // Hover state for drawing path nodes (for manual path closing)
  const [hoveredDrawingNodeIndex, setHoveredDrawingNodeIndex] = useState<number | null>(null)

  // Key state for node insertion (Option/Alt key)
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false)

  // Key state for additive selection (Shift key)
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false)

  // Combined modifiers (keyboard OR mobile toggle) - Feature 2
  const effectiveAltPressed = isAltKeyPressed || mobileInsertNodeMode || false
  const effectiveShiftPressed = isShiftKeyPressed || mobileMultiSelectMode || false

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Selection rectangle state for multi-node selection
  const [isPendingSelection, setIsPendingSelection] = useState(false)
  const [isDrawingSelection, setIsDrawingSelection] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)

  // Pending drag state - waiting for drag threshold before actual dragging
  const [isPendingDrag, setIsPendingDrag] = useState(false)
  const [pendingDragInfo, setPendingDragInfo] = useState<DragState | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)

  // Pending segment selection - if user clicks without dragging, select the segment
  const pendingSegmentSelectionRef = useRef<{
    segment: ConnectedSegment
    isShiftHeld: boolean
    pathIndex?: number // Path index for multi-path selection handling
  } | null>(null)

  // Touch-specific selection state for long-press initiated selection
  const [isTouchSelectionMode, setIsTouchSelectionMode] = useState(false)
  const [touchSelectionStart, setTouchSelectionStart] = useState<{ x: number; y: number } | null>(null)

  // Rotation drag state
  const [isRotating, setIsRotating] = useState(false)
  const [rotationStartAngle, setRotationStartAngle] = useState(0)
  const rotationCenterRef = useRef<Point | null>(null)
  // Store original rotations for all paths being rotated (for multi-path rotation)
  const originalRotationsRef = useRef<Map<number, { rotation: number; origin: Point }>>(new Map())
  // Store which paths are being rotated
  const rotatingPathIndicesRef = useRef<Set<number>>(new Set())
  // Store current rotation delta during drag (for live feedback rendering)
  const currentRotationDeltaRef = useRef<number>(0)

  // Resize drag state (8-point resize handles)
  const [isResizing, setIsResizing] = useState(false)
  const [resizingHandle, setResizingHandle] = useState<ResizeHandleType | null>(null)
  const resizeStartBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null)
  const resizeStartMouseRef = useRef<Point | null>(null)
  const resizeCenterRef = useRef<Point | null>(null)
  // Store which paths are being resized
  const resizingPathIndicesRef = useRef<Set<number>>(new Set())
  // Store original commands for all paths being resized
  const originalCommandsRef = useRef<Map<number, PathCommand[]>>(new Map())

  // Helper to update selected nodes
  const setSelectedNodeIndices = useCallback(
    (indices: Set<number>) => {
      onSelectedNodesChange(indices)
    },
    [onSelectedNodesChange]
  )

  // Build ParsedSvgExtended for SVGPreviewLayer (combines paths with extended styles)
  const parsedSvgExtended = useMemo((): ParsedSvgExtended => {
    const effectiveDefs = defs || createEmptyDefs()
    return {
      ...parsedSvg,
      defs: effectiveDefs,
      paths: parsedSvg.paths.map((path, index): ParsedPathExtended => {
        const existingStyle = pathStyles?.get(index)
        const defaultStyle = {
          fill: stringToPaint(path.fill || 'none'),
          stroke: path.stroke ? stringToPaint(path.stroke) : undefined,
          strokeWidth: path.strokeWidth,
          fillRule: path.fillRule,
          opacity: 1,
          mixBlendMode: 'normal' as const,
        }

        // Build transform string from pathRotation if present
        let transform: string | undefined
        if (path.pathRotation && path.pathRotation !== 0) {
          const center = path.pathRotationOrigin || calculatePathCenter(path.commands)
          transform = `rotate(${path.pathRotation} ${center.x} ${center.y})`
        }

        return {
          ...path,
          // Always preserve fillRule from original path, even when existingStyle exists
          style: existingStyle ? { ...defaultStyle, ...existingStyle, fillRule: path.fillRule } : defaultStyle,
          transform,
        }
      }),
    }
  }, [parsedSvg, pathStyles, defs])

  // Compute effect groups for SVG-only mode (non-overlay mode)
  // Effect groups determine which paths are affected by each clip/hole path
  // In overlay mode, clip/hole effects are handled by raster compositing instead
  const effectGroups = useMemo(() => {
    if (isOverlayMode) return undefined

    return calculateEffectGroups(parsedSvg.paths.length, clipPathIndices || [], holePathIndices || [])
  }, [isOverlayMode, parsedSvg.paths.length, clipPathIndices, holePathIndices])

  // Resize observer with HiDPI support
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width
        const newHeight = entry.contentRect.height
        setCanvasSize({
          width: newWidth,
          height: newHeight,
        })

        // Update canvas buffer sizes for HiDPI displays
        const dpr = window.devicePixelRatio || 1
        dprRef.current = dpr

        // Update background canvas
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = newWidth * dpr
          canvas.height = newHeight * dpr
        }

        // Update interaction canvas
        const interactionCanvas = interactionCanvasRef.current
        if (interactionCanvas) {
          interactionCanvas.width = newWidth * dpr
          interactionCanvas.height = newHeight * dpr
        }
        // Note: CSS size is set via className, not style
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // Track Alt/Option key for node insertion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setIsAltKeyPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        setIsAltKeyPressed(false)
      }
    }

    const handleBlur = () => {
      setIsAltKeyPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Track Shift key for additive selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        setIsShiftKeyPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        setIsShiftKeyPressed(false)
      }
    }

    const handleBlur = () => {
      setIsShiftKeyPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Reset hasInteracted when editor mode changes
  useEffect(() => {
    setHasInteracted(false)
  }, [editorMode])

  // Reset touch selection state when editor mode changes
  useEffect(() => {
    setIsTouchSelectionMode(false)
    setTouchSelectionStart(null)
  }, [editorMode])

  // Reset touch selection state when selection rect mode is disabled
  useEffect(() => {
    if (!mobileSelectionRectMode && isTouchSelectionMode) {
      setIsTouchSelectionMode(false)
      setTouchSelectionStart(null)
      setSelectionRect(null)
    }
  }, [mobileSelectionRectMode, isTouchSelectionMode])

  // Global event handlers for guideline dragging
  // This is needed because mouseUp may occur over the ruler (which has higher z-index)
  // and won't be captured by the interaction canvas
  useEffect(() => {
    if (!draggingGuidelineId || !draggingGuidelineAxisRef.current) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvas = interactionCanvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const svgPos = screenToSvg(screenX, screenY)
      const newPosition = draggingGuidelineAxisRef.current === 'x' ? svgPos.x : svgPos.y

      if (onGuidelineUpdate) {
        onGuidelineUpdate(draggingGuidelineId, newPosition)
      }
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const canvas = interactionCanvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Check if guideline should be removed (dragged into ruler area)
      const shouldRemove
        = draggingGuidelineAxisRef.current === 'x'
          ? screenX < RULER_SIZE // Vertical guideline dragged into left ruler
          : screenY < RULER_SIZE // Horizontal guideline dragged into top ruler

      if (shouldRemove && onGuidelineRemove) {
        onGuidelineRemove(draggingGuidelineId)
      }

      setDraggingGuidelineId(null)
      draggingGuidelineAxisRef.current = null
      isInteractingRef.current = false
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggingGuidelineId, screenToSvg, onGuidelineUpdate, onGuidelineRemove])

  // Find which path contains the given screen position
  const findPathAtPosition = useCallback(
    (screenX: number, screenY: number): number | null => {
      const canvas = canvasRef.current
      if (!canvas || !parsedSvg) return null

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      const svgPos = screenToSvg(screenX, screenY)

      // Check paths in reverse order (top-most/last rendered first)
      for (let i = parsedSvg.paths.length - 1; i >= 0; i--) {
        const path = parsedSvg.paths[i]
        const pathD = serializePathCommands(path.commands)
        const path2D = new Path2D(pathD)

        if (ctx.isPointInPath(path2D, svgPos.x, svgPos.y, path.fillRule || 'nonzero')) {
          return i
        }
      }

      return null
    },
    [parsedSvg, screenToSvg]
  )

  // Check if a point is outside the viewBox boundaries
  const isOutsideViewBox = useCallback(
    (x: number, y: number): boolean => {
      if (!parsedSvg?.viewBox) return false
      const vb = parsedSvg.viewBox
      return x < vb.x || x > vb.x + vb.width || y < vb.y || y > vb.y + vb.height
    },
    [parsedSvg]
  )

  // Render background canvas - draws viewBox overlay and border
  const renderBackgroundCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !parsedSvg) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use refs for real-time viewport values
    const currentScale = scaleRef.current
    const currentOffset = offsetRef.current
    const dpr = dprRef.current

    // Clear canvas (account for DPR scaled buffer)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context and apply transforms
    ctx.save()

    // Scale for HiDPI display first
    ctx.scale(dpr, dpr)

    // Then apply viewport transforms
    ctx.translate(currentOffset.x, currentOffset.y)
    ctx.scale(currentScale, currentScale)

    // Draw viewBox boundary (overlay outside bounds + dashed border)
    const vb = parsedSvg.viewBox
    if (vb) {
      // Draw semi-transparent overlay outside viewBox
      ctx.save()
      ctx.fillStyle = COLORS.viewBoxOverlay

      // Create a path that covers everything EXCEPT the viewBox using evenodd fill
      ctx.beginPath()
      // Outer rectangle (large enough to cover any zoom/pan area)
      const padding = 100000
      ctx.rect(vb.x - padding, vb.y - padding, vb.width + padding * 2, vb.height + padding * 2)
      // Inner rectangle (viewBox) - counter-clockwise to create hole
      ctx.moveTo(vb.x, vb.y)
      ctx.lineTo(vb.x, vb.y + vb.height)
      ctx.lineTo(vb.x + vb.width, vb.y + vb.height)
      ctx.lineTo(vb.x + vb.width, vb.y)
      ctx.closePath()
      ctx.fill('evenodd')
      ctx.restore()

      // Draw viewBox border (dashed line)
      ctx.strokeStyle = COLORS.viewBoxBoundary
      ctx.lineWidth = 1 / currentScale
      ctx.setLineDash([6 / currentScale, 4 / currentScale])
      ctx.strokeRect(vb.x, vb.y, vb.width, vb.height)
      ctx.setLineDash([])

      // Draw grid overlay (if enabled)
      if (editModeSettings?.showGrid && gridSettings) {
        renderGrid({
          ctx,
          viewBox: vb,
          scale: currentScale,
          offset: currentOffset,
          gridSettings,
          canvasSize,
        })
      }
    }

    ctx.restore()
  }, [parsedSvg, scaleRef, offsetRef, editModeSettings, gridSettings, canvasSize])

  // Render interaction canvas - draws selection outlines, nodes, handles, previews
  const renderInteractionCanvas = useCallback(() => {
    const canvas = interactionCanvasRef.current
    if (!canvas || !parsedSvg) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use refs for real-time viewport values
    const currentScale = scaleRef.current
    const currentOffset = offsetRef.current
    const dpr = dprRef.current

    // Clear canvas (account for DPR scaled buffer)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context and apply transforms
    ctx.save()

    // Scale for HiDPI display first
    ctx.scale(dpr, dpr)

    // Then apply viewport transforms
    ctx.translate(currentOffset.x, currentOffset.y)
    ctx.scale(currentScale, currentScale)

    // Draw selection/hover outlines for paths (paths are rendered by SVGPreviewLayer)
    parsedSvg.paths.forEach((path, pathIndex) => {
      const pathD = serializePathCommands(path.commands)
      const path2D = new Path2D(pathD)

      // Apply rotation transform if path has rotation
      const hasRotation = path.pathRotation && path.pathRotation !== 0
      if (hasRotation) {
        const center = path.pathRotationOrigin || calculatePathCenter(path.commands)
        ctx.save()
        ctx.translate(center.x, center.y)
        ctx.rotate(((path.pathRotation ?? 0) * Math.PI) / 180)
        ctx.translate(-center.x, -center.y)
      }

      // Check if this path is marked as clip, hole, or adjustment mask
      const isClipPath = clipPathIndices?.includes(pathIndex) ?? false
      const isHolePath = holePathIndices?.includes(pathIndex) ?? false
      const isAdjustmentMaskPath = adjustmentMasks?.some(m => m.pathIndex === pathIndex) ?? false

      // Draw clip/hole/adjustment mask path indicators (dashed outlines)
      if (isClipPath || isHolePath || isAdjustmentMaskPath) {
        ctx.save()
        ctx.strokeStyle = isClipPath ? COLORS.clipPath : isHolePath ? COLORS.holePath : COLORS.adjustmentMaskPath
        ctx.lineWidth = 2.5 / currentScale
        const dashPattern = isClipPath
          ? COLORS.clipPathDash
          : isHolePath
            ? COLORS.holePathDash
            : COLORS.adjustmentMaskPathDash
        ctx.setLineDash(dashPattern.map(d => d / currentScale))
        ctx.stroke(path2D)
        ctx.setLineDash([])
        ctx.restore()
      }

      // Draw invisible path indicator (paths with no fill and no stroke)
      // This provides visual feedback so users can see and interact with invisible paths
      const hasNoFill = !path.fill || path.fill === 'none'
      const hasNoStroke = !path.stroke || path.stroke === 'none'
      const isInvisiblePath = hasNoFill && hasNoStroke && !isClipPath && !isHolePath && !isAdjustmentMaskPath
      if (isInvisiblePath) {
        ctx.save()
        ctx.strokeStyle = COLORS.invisiblePath
        ctx.lineWidth = 1.5 / currentScale
        ctx.setLineDash(COLORS.invisiblePathDash.map(d => d / currentScale))
        ctx.stroke(path2D)
        ctx.setLineDash([])
        ctx.restore()
      }

      // Draw selection outline for selected paths (primary or in multi-selection)
      // Skip selection outline when hidePathSelectionFeedback is true (e.g., Filters panel is open)
      const isSelected = pathIndex === selectedPathIndex || selectedPathIndices.has(pathIndex)
      if (!hidePathSelectionFeedback) {
        if (isSelected) {
          // Use different color for primary vs secondary selection
          ctx.strokeStyle = pathIndex === selectedPathIndex ? COLORS.selectedPath : COLORS.selectedPath
          ctx.lineWidth = 2 / currentScale
          ctx.stroke(path2D)
        } else if (pathIndex === hoveredPathIndex) {
          // Draw hover outline for hovered path
          ctx.strokeStyle = COLORS.hoveredPath
          ctx.lineWidth = 1.5 / currentScale
          ctx.setLineDash([4 / currentScale, 4 / currentScale])
          ctx.stroke(path2D)
          ctx.setLineDash([])
        }
      }

      // Restore context if rotation was applied
      if (hasRotation) {
        ctx.restore()
      }
    })

    // Draw nodes for selected path (in SVG coordinate space)
    // Scale node/control point sizes inversely to maintain constant screen size
    const nodeRadius = NODE_RADIUS / currentScale
    const controlPointRadius = CONTROL_POINT_RADIUS / currentScale

    // Helper to get unified bounds for all selected paths (for rotation handle positioning)
    const getUnifiedSelectedPathBounds = (): {
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
      center: Point
    } | null => {
      const indices
        = selectedPathIndices.size > 0
          ? Array.from(selectedPathIndices)
          : selectedPathIndex !== null
            ? [selectedPathIndex]
            : []
      if (indices.length === 0) return null

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const idx of indices) {
        const p = parsedSvg.paths[idx]
        if (!p) continue
        const pathBounds = calculatePathBounds(p.commands)
        minX = Math.min(minX, pathBounds.minX)
        minY = Math.min(minY, pathBounds.minY)
        maxX = Math.max(maxX, pathBounds.maxX)
        maxY = Math.max(maxY, pathBounds.maxY)
      }
      if (!isFinite(minX)) return null

      return {
        bounds: { minX, minY, maxX, maxY },
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      }
    }

    // Draw connected segment highlight if hovering over any selected path
    // This works for both single and multi-path selection
    // Skip when hidePathSelectionFeedback is true (e.g., Filters panel is open)
    if (
      hoveredConnectedSegment
      && selectedPathIndices.has(hoveredConnectedSegment.pathIndex)
      && !hidePathSelectionFeedback
    ) {
      const hoveredPath = parsedSvg.paths[hoveredConnectedSegment.pathIndex]
      const segment = hoveredConnectedSegment.segment
      const segmentPathD = buildSegmentPathD(hoveredPath.commands, segment)
      const segmentPath2D = new Path2D(segmentPathD)

      // Apply rotation transform if the hovered path has rotation
      const hasHoveredPathRotation = hoveredPath.pathRotation && hoveredPath.pathRotation !== 0
      if (hasHoveredPathRotation) {
        const center = hoveredPath.pathRotationOrigin || calculatePathCenter(hoveredPath.commands)
        ctx.save()
        ctx.translate(center.x, center.y)
        ctx.rotate(((hoveredPath.pathRotation ?? 0) * Math.PI) / 180)
        ctx.translate(-center.x, -center.y)
      }

      // Draw fill for closed segments only
      if (segment.isClosed) {
        ctx.fillStyle = COLORS.closedSegmentFill
        ctx.fill(segmentPath2D)
      }

      // Draw stroke for all segments (different colors for closed vs unclosed)
      ctx.strokeStyle = segment.isClosed ? COLORS.closedSegmentStroke : COLORS.unclosedSegmentStroke
      ctx.lineWidth = 3 / currentScale
      ctx.stroke(segmentPath2D)

      if (hasHoveredPathRotation) {
        ctx.restore()
      }
    }

    // Only draw nodes and handles when exactly one path is selected
    // For multi-path selection, we don't show individual nodes
    // Skip node rendering when hidePathSelectionFeedback is true (e.g., Filters panel is open)
    if (selectedPathIndex !== null && selectedPathIndices.size === 1 && !hidePathSelectionFeedback) {
      const path = parsedSvg.paths[selectedPathIndex]

      // Apply rotation transform for selected path's nodes and handles
      const hasSelectedPathRotation = path.pathRotation && path.pathRotation !== 0
      if (hasSelectedPathRotation) {
        const center = path.pathRotationOrigin || calculatePathCenter(path.commands)
        ctx.save()
        ctx.translate(center.x, center.y)
        ctx.rotate(((path.pathRotation ?? 0) * Math.PI) / 180)
        ctx.translate(-center.x, -center.y)
      }

      // Always draw all nodes when a path is selected
      path.commands.forEach((command, nodeIndex) => {
        // Determine if this node is selected
        const isSelected = nodeIndex === selectedNodeIndex || selectedNodeIndices.has(nodeIndex)

        // Skip Z commands for node drawing
        if (command.type.toUpperCase() === 'Z') return

        // Draw control point lines and circles for bezier curves (only for primary selected node)
        if (nodeIndex === selectedNodeIndex && (command.cp1 || command.cp2 || command.cp)) {
          ctx.strokeStyle = COLORS.controlPointLine
          ctx.lineWidth = 1 / currentScale
          ctx.setLineDash([3 / currentScale, 3 / currentScale])

          // For cp1: draw line from PREVIOUS node to cp1 (cp1 controls curve leaving previous point)
          if (command.cp1 && nodeIndex > 0) {
            const prevCommand = path.commands[nodeIndex - 1]
            ctx.beginPath()
            ctx.moveTo(prevCommand.x, prevCommand.y)
            ctx.lineTo(command.cp1.x, command.cp1.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(command.cp1.x, command.cp1.y, controlPointRadius, 0, Math.PI * 2)
            ctx.fillStyle = COLORS.controlPoint
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.lineWidth = 1 / currentScale
            ctx.setLineDash([])
            ctx.stroke()
          }

          // For cp2: draw line from CURRENT node to cp2 (cp2 controls curve arriving at current point)
          if (command.cp2) {
            ctx.setLineDash([3 / currentScale, 3 / currentScale])
            ctx.strokeStyle = COLORS.controlPointLine
            ctx.lineWidth = 1 / currentScale
            ctx.beginPath()
            ctx.moveTo(command.x, command.y)
            ctx.lineTo(command.cp2.x, command.cp2.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(command.cp2.x, command.cp2.y, controlPointRadius, 0, Math.PI * 2)
            ctx.fillStyle = COLORS.controlPoint
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.lineWidth = 1 / currentScale
            ctx.setLineDash([])
            ctx.stroke()
          }

          // For quadratic bezier cp: draw line from CURRENT node to cp
          if (command.cp) {
            ctx.setLineDash([3 / currentScale, 3 / currentScale])
            ctx.strokeStyle = COLORS.controlPointLine
            ctx.lineWidth = 1 / currentScale
            ctx.beginPath()
            ctx.moveTo(command.x, command.y)
            ctx.lineTo(command.cp.x, command.cp.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(command.cp.x, command.cp.y, controlPointRadius, 0, Math.PI * 2)
            ctx.fillStyle = COLORS.controlPoint
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.lineWidth = 1 / currentScale
            ctx.setLineDash([])
            ctx.stroke()
          }

          ctx.setLineDash([])
        }

        // Draw node circle (in SVG coordinates)
        ctx.beginPath()
        ctx.arc(command.x, command.y, nodeRadius, 0, Math.PI * 2)

        // Determine node color based on state
        if (nodeIndex === selectedNodeIndex) {
          // Primary selected: filled dark blue
          ctx.fillStyle = COLORS.selectedNode
          ctx.strokeStyle = COLORS.selectedNodeBorder
          ctx.fill()
          ctx.lineWidth = 2 / currentScale
          ctx.stroke()
        } else if (isSelected) {
          // Multi-selected: filled light blue
          ctx.fillStyle = COLORS.multiSelectedNode
          ctx.strokeStyle = COLORS.multiSelectedNodeBorder
          ctx.fill()
          ctx.lineWidth = 2 / currentScale
          ctx.stroke()
        } else {
          // Unselected node: stroked circle only (no fill) for clear visual distinction
          ctx.strokeStyle = COLORS.unselectedNodeBorder
          ctx.lineWidth = 2 / currentScale
          ctx.stroke()
        }
      })

      // Restore context if rotation was applied
      if (hasSelectedPathRotation) {
        ctx.restore()
      }
    }

    // Draw rotation and resize handles when path(s) are selected but no nodes are selected
    // This works for both single and multi-path selection
    const shouldShowRotationHandle
      = selectedPathIndices.size > 0
      && selectedNodeIndex === null
      && selectedNodeIndices.size === 0
      && editorMode === 'edit'

    if (shouldShowRotationHandle) {
      // Use unified bounds for consistent positioning with hit detection
      // This ensures the handle position matches where hit detection expects it
      const unifiedBounds = getUnifiedSelectedPathBounds()
      if (unifiedBounds) {
        const { bounds, center } = unifiedBounds
        const handleOffset = ROTATION_HANDLE_OFFSET / currentScale
        const handleRadius = ROTATION_HANDLE_RADIUS / currentScale

        // Apply rotation transform for the feedback rectangle
        // During active rotation: use the live rotation delta from currentRotationDeltaRef
        // When not rotating: use the path's stored rotation (for single-path selection only)
        let hasHandleRotation = false
        let handleRotationCenter: Point | null = null
        let handleRotationAngle = 0

        if (isRotating && rotationCenterRef.current) {
          // During active rotation drag - use the live delta and rotation center
          hasHandleRotation = true
          handleRotationCenter = rotationCenterRef.current
          // Get the original rotation for the selected paths and add the current delta
          const firstRotatingIdx = rotatingPathIndicesRef.current.values().next().value
          const originalRotation
            = firstRotatingIdx !== undefined ? originalRotationsRef.current.get(firstRotatingIdx)?.rotation || 0 : 0
          handleRotationAngle = originalRotation + currentRotationDeltaRef.current
        } else if (selectedPathIndices.size === 1 && selectedPathIndex !== null) {
          // Not rotating - use path's stored rotation for single-path selection
          const selectedPath = parsedSvg.paths[selectedPathIndex]
          if (selectedPath?.pathRotation && selectedPath.pathRotation !== 0) {
            hasHandleRotation = true
            handleRotationCenter = selectedPath.pathRotationOrigin || center
            handleRotationAngle = selectedPath.pathRotation
          }
        }

        if (hasHandleRotation && handleRotationCenter) {
          ctx.save()
          ctx.translate(handleRotationCenter.x, handleRotationCenter.y)
          ctx.rotate((handleRotationAngle * Math.PI) / 180)
          ctx.translate(-handleRotationCenter.x, -handleRotationCenter.y)
        }

        // Calculate handle position (above center of bounding box)
        const handleX = center.x
        const handleY = bounds.minY - handleOffset

        // Draw line from center to rotation handle
        ctx.strokeStyle = COLORS.rotationHandleLine
        ctx.lineWidth = 1.5 / currentScale
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(center.x, bounds.minY)
        ctx.lineTo(handleX, handleY)
        ctx.stroke()

        // Draw rotation handle circle
        ctx.beginPath()
        ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2)
        ctx.fillStyle = isRotating ? COLORS.selectedNode : COLORS.rotationHandle
        ctx.fill()
        ctx.strokeStyle = COLORS.rotationHandleBorder
        ctx.lineWidth = 2 / currentScale
        ctx.stroke()

        // Draw inner filled circle
        ctx.beginPath()
        ctx.arc(handleX, handleY, handleRadius * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        // Draw 8-point resize handles around the bounding box
        const resizeHandleSize = RESIZE_HANDLE_SIZE / currentScale
        const halfSize = resizeHandleSize / 2

        const resizeHandles = [
          { x: bounds.minX, y: bounds.minY }, // tl
          { x: bounds.maxX, y: bounds.minY }, // tr
          { x: bounds.maxX, y: bounds.maxY }, // br
          { x: bounds.minX, y: bounds.maxY }, // bl
          { x: center.x, y: bounds.minY }, // n
          { x: center.x, y: bounds.maxY }, // s
          { x: bounds.maxX, y: center.y }, // e
          { x: bounds.minX, y: center.y }, // w
        ]

        // Draw dashed bounding box
        ctx.strokeStyle = COLORS.selectionRect
        ctx.lineWidth = 1 / currentScale
        ctx.setLineDash([4 / currentScale, 4 / currentScale])
        ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
        ctx.setLineDash([])

        // Draw resize handles as squares
        resizeHandles.forEach(handle => {
          ctx.fillStyle = isResizing ? COLORS.selectedNode : COLORS.resizeHandleFill
          ctx.strokeStyle = COLORS.resizeHandleBorder
          ctx.lineWidth = 1.5 / currentScale
          ctx.fillRect(handle.x - halfSize, handle.y - halfSize, resizeHandleSize, resizeHandleSize)
          ctx.strokeRect(handle.x - halfSize, handle.y - halfSize, resizeHandleSize, resizeHandleSize)
        })

        // Restore context if rotation was applied
        if (hasHandleRotation && handleRotationCenter) {
          ctx.restore()
        }
      }
    }

    // Draw hovered segment highlight (for node insertion) - in SVG coordinates
    if (hoveredSegment) {
      const path = parsedSvg.paths[hoveredSegment.pathIndex]
      const segmentIndex = hoveredSegment.segmentIndex
      const prevCmd = path.commands[segmentIndex - 1]
      const cmd = path.commands[segmentIndex]

      if (prevCmd && cmd) {
        ctx.strokeStyle = COLORS.segmentHighlight
        ctx.lineWidth = 3 / currentScale
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(prevCmd.x, prevCmd.y)

        if (cmd.type === 'C' || cmd.type === 'c') {
          ctx.bezierCurveTo(cmd.cp1!.x, cmd.cp1!.y, cmd.cp2!.x, cmd.cp2!.y, cmd.x, cmd.y)
        } else if (cmd.type === 'Q' || cmd.type === 'q') {
          ctx.quadraticCurveTo(cmd.cp!.x, cmd.cp!.y, cmd.x, cmd.y)
        } else {
          ctx.lineTo(cmd.x, cmd.y)
        }
        ctx.stroke()

        // Draw insertion point indicator
        ctx.beginPath()
        ctx.arc(hoveredSegment.position.x, hoveredSegment.position.y, (NODE_RADIUS + 2) / currentScale, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.insertionPoint
        ctx.fill()
        ctx.strokeStyle = COLORS.insertionPointBorder
        ctx.lineWidth = 2 / currentScale
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(hoveredSegment.position.x, hoveredSegment.position.y, 2 / currentScale, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.insertionPointInner
        ctx.fill()
      }
    }

    // Draw in-progress path (draw mode) - in SVG coordinates
    if (drawingPath && drawingPath.length > 0) {
      ctx.strokeStyle = COLORS.drawingPath
      ctx.lineWidth = 2 / currentScale
      ctx.setLineDash([5 / currentScale, 5 / currentScale])
      ctx.beginPath()

      drawingPath.forEach((cmd, idx) => {
        if (idx === 0 || cmd.type === 'M' || cmd.type === 'm') {
          ctx.moveTo(cmd.x, cmd.y)
        } else if (cmd.type === 'C' || cmd.type === 'c') {
          // Render cubic bezier curve
          ctx.bezierCurveTo(cmd.cp1!.x, cmd.cp1!.y, cmd.cp2!.x, cmd.cp2!.y, cmd.x, cmd.y)
        } else if (cmd.type === 'Q' || cmd.type === 'q') {
          // Render quadratic bezier curve
          ctx.quadraticCurveTo(cmd.cp!.x, cmd.cp!.y, cmd.x, cmd.y)
        } else {
          ctx.lineTo(cmd.x, cmd.y)
        }
      })
      ctx.stroke()
      ctx.setLineDash([])

      // Draw nodes for drawing path
      // Find current subpath start for closeable node detection
      let currentSubpathStart = 0
      for (let i = drawingPath.length - 1; i >= 0; i--) {
        if (drawingPath[i].type === 'M') {
          currentSubpathStart = i
          break
        }
        if (drawingPath[i].type === 'Z') {
          currentSubpathStart = i + 1
          break
        }
      }

      drawingPath.forEach((cmd, index) => {
        // Skip rendering Z command nodes (they don't have meaningful positions)
        if (cmd.type === 'Z') return

        ctx.beginPath()
        ctx.arc(cmd.x, cmd.y, nodeRadius, 0, Math.PI * 2)

        // Highlight if this is the hovered closeable node in current subpath (not the last node)
        const isInCurrentSubpath = index >= currentSubpathStart
        const isCloseable = isInCurrentSubpath && index < drawingPath.length - 1
        if (index === hoveredDrawingNodeIndex && isCloseable) {
          ctx.fillStyle = COLORS.closeableNode
          ctx.fill()
          ctx.strokeStyle = COLORS.closeableNodeBorder
          ctx.lineWidth = 2 / currentScale
          ctx.stroke()
        } else {
          ctx.fillStyle = COLORS.drawingPath
          ctx.fill()
          ctx.strokeStyle = COLORS.drawingPathBorder
          ctx.lineWidth = 2 / currentScale
          ctx.stroke()
        }
      })

      // Draw preview line/curve from last point to cursor (hide when starting new subpath)
      if (drawPreviewPos && drawingPath.length > 0 && !isStartingNewSubpath) {
        const lastCmd = drawingPath[drawingPath.length - 1]

        // Check if preview point is outside viewBox - show warning color
        const previewTarget = isDrawDragging && drawDragStart ? drawDragStart : drawPreviewPos
        const isOutOfBounds = isOutsideViewBox(previewTarget.x, previewTarget.y)

        ctx.strokeStyle = isOutOfBounds ? COLORS.outOfBoundsPreview : COLORS.drawingPreview
        ctx.lineWidth = (isOutOfBounds ? 2 : 1) / currentScale
        ctx.setLineDash([3 / currentScale, 3 / currentScale])
        ctx.beginPath()
        ctx.moveTo(lastCmd.x, lastCmd.y)

        // Show curve preview while dragging - respects drawingCurveType
        if (isDrawDragging && drawDragStart && drawDragCurrent) {
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y

          if (drawingCurveType === 'line') {
            // Line mode: always show straight line (ignore drag gesture)
            ctx.lineTo(drawDragStart.x, drawDragStart.y)
          } else if (drawingCurveType === 'quadratic') {
            // Quadratic mode: show quadratic bezier with single control point at midpoint
            const cpX = lastCmd.x + dx / 2
            const cpY = lastCmd.y + dy / 2
            ctx.quadraticCurveTo(cpX, cpY, drawDragStart.x, drawDragStart.y)
          } else {
            // Cubic mode (default): show cubic bezier with two control points
            ctx.bezierCurveTo(
              lastCmd.x + dx / 3,
              lastCmd.y + dy / 3, // cp1
              drawDragStart.x - dx / 3,
              drawDragStart.y - dy / 3, // cp2
              drawDragStart.x,
              drawDragStart.y // end point
            )
          }
        } else {
          ctx.lineTo(drawPreviewPos.x, drawPreviewPos.y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Draw control point handle while dragging (not shown for line mode)
        if (isDrawDragging && drawDragCurrent && drawingCurveType !== 'line') {
          // For quadratic, show single control point at midpoint
          // For cubic, show current drag position as reference
          const dx = drawDragCurrent.x - drawDragStart!.x
          const dy = drawDragCurrent.y - drawDragStart!.y
          const indicatorX = drawingCurveType === 'quadratic' ? lastCmd.x + dx / 2 : drawDragCurrent.x
          const indicatorY = drawingCurveType === 'quadratic' ? lastCmd.y + dy / 2 : drawDragCurrent.y

          // Draw control point indicator
          ctx.fillStyle = COLORS.selectedNode
          ctx.beginPath()
          ctx.arc(indicatorX, indicatorY, (NODE_RADIUS - 2) / currentScale, 0, Math.PI * 2)
          ctx.fill()

          // Draw line from last point to control point
          ctx.strokeStyle = COLORS.controlPointLine
          ctx.lineWidth = 1 / currentScale
          ctx.setLineDash([3 / currentScale, 3 / currentScale])
          ctx.beginPath()
          ctx.moveTo(lastCmd.x, lastCmd.y)
          ctx.lineTo(indicatorX, indicatorY)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }

    // Draw extend mode preview line from extend node to cursor
    if (isExtendMode && extendFromNode && extendPreviewPos && parsedSvg) {
      const path = parsedSvg.paths[extendFromNode.pathIndex]
      if (path) {
        const node = path.commands[extendFromNode.nodeIndex]
        if (node && node.x !== undefined && node.y !== undefined) {
          const commands = path.commands
          // Find the opposite endpoint for close path functionality
          const isExtendingFromEnd
            = extendFromNode.nodeIndex === commands.length - 1 || commands[extendFromNode.nodeIndex + 1]?.type === 'Z'
          const oppositeNodeIndex = isExtendingFromEnd ? 0 : commands.length - 1
          const oppositeNode = commands[oppositeNodeIndex]

          // Check if preview point is outside viewBox
          const isOutOfBounds = isOutsideViewBox(extendPreviewPos.x, extendPreviewPos.y)

          // Draw dashed preview line from extend node to cursor (or to opposite node if hovering)
          ctx.strokeStyle = isOutOfBounds ? COLORS.outOfBoundsPreview : COLORS.drawingPreview
          ctx.lineWidth = (isOutOfBounds ? 2 : 1) / currentScale
          ctx.setLineDash([3 / currentScale, 3 / currentScale])
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          if (isHoveringExtendCloseNode && oppositeNode) {
            // Draw line to opposite node when hovering to close
            ctx.lineTo(oppositeNode.x, oppositeNode.y)
          } else {
            ctx.lineTo(extendPreviewPos.x, extendPreviewPos.y)
          }
          ctx.stroke()
          ctx.setLineDash([])

          // Draw a highlight circle around the extend-from node
          ctx.strokeStyle = COLORS.selectedNode
          ctx.lineWidth = 2 / currentScale
          ctx.beginPath()
          ctx.arc(node.x, node.y, (NODE_RADIUS + 3) / currentScale, 0, Math.PI * 2)
          ctx.stroke()

          // Draw the closeable endpoint (opposite node) with special highlight
          if (oppositeNode && oppositeNode.x !== undefined && oppositeNode.y !== undefined) {
            if (isHoveringExtendCloseNode) {
              // Highlight when hovering - filled circle with pulsing effect
              ctx.fillStyle = COLORS.selectedNode
              ctx.beginPath()
              ctx.arc(oppositeNode.x, oppositeNode.y, (NODE_RADIUS + 2) / currentScale, 0, Math.PI * 2)
              ctx.fill()
              // Outer ring for emphasis
              ctx.strokeStyle = COLORS.selectedNode
              ctx.lineWidth = 2 / currentScale
              ctx.beginPath()
              ctx.arc(oppositeNode.x, oppositeNode.y, (NODE_RADIUS + 5) / currentScale, 0, Math.PI * 2)
              ctx.stroke()
            } else {
              // Show subtle indicator for closeable endpoint
              ctx.strokeStyle = COLORS.drawingPreview
              ctx.lineWidth = 1.5 / currentScale
              ctx.setLineDash([2 / currentScale, 2 / currentScale])
              ctx.beginPath()
              ctx.arc(oppositeNode.x, oppositeNode.y, (NODE_RADIUS + 3) / currentScale, 0, Math.PI * 2)
              ctx.stroke()
              ctx.setLineDash([])
            }
          }

          // Draw target position indicator at cursor (only if not hovering over close node)
          if (!isHoveringExtendCloseNode) {
            ctx.fillStyle = isOutOfBounds ? COLORS.outOfBoundsPreview : COLORS.selectedNode
            ctx.beginPath()
            ctx.arc(extendPreviewPos.x, extendPreviewPos.y, (NODE_RADIUS - 1) / currentScale, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // Draw predefined shape preview during drag
    if (selectedPredefinedShape && shapeDragStart && shapeDragCurrent) {
      const shape = getShapeById(selectedPredefinedShape)
      if (shape) {
        // Calculate bounding box from drag points
        const minX = Math.min(shapeDragStart.x, shapeDragCurrent.x)
        const maxX = Math.max(shapeDragStart.x, shapeDragCurrent.x)
        const minY = Math.min(shapeDragStart.y, shapeDragCurrent.y)
        const maxY = Math.max(shapeDragStart.y, shapeDragCurrent.y)

        const width = maxX - minX
        const height = maxY - minY
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2

        // Check if this is a composite shape
        if ('isComposite' in shape && shape.isComposite) {
          // Composite shape - renders multiple paths
          const compositeParts = shape.generator(cx, cy, width, height)
          // Sort by zIndex and render each part
          const sortedParts = [...compositeParts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

          sortedParts.forEach(part => {
            const partPathD = serializePathCommands(part.commands)
            const partPath = new Path2D(partPathD)

            // Use part's fill color with reduced opacity for preview
            ctx.fillStyle = part.fill ? `${part.fill}80` : 'rgba(0, 0, 0, 0.1)'
            ctx.fill(partPath)

            // Draw stroke
            ctx.strokeStyle = part.stroke ?? COLORS.drawingPath
            ctx.lineWidth = (part.strokeWidth ?? 1) / currentScale
            ctx.setLineDash([])
            ctx.stroke(partPath)
          })
        } else if ('isPattern' in shape && shape.isPattern) {
          // Pattern shape - generates multiple paths with scatter effect
          const patternParts = shape.generator(cx, cy, width, height, shape.defaultConfig)
          // Sort by zIndex and render each part
          const sortedParts = [...patternParts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

          sortedParts.forEach(part => {
            const partPathD = serializePathCommands(part.commands)
            const partPath = new Path2D(partPathD)

            // Use part's fill color with reduced opacity for preview
            ctx.fillStyle = part.fill ? `${part.fill}80` : 'rgba(0, 0, 0, 0.1)'
            ctx.fill(partPath)

            // Draw stroke
            ctx.strokeStyle = part.stroke ?? COLORS.drawingPath
            ctx.lineWidth = (part.strokeWidth ?? 1) / currentScale
            ctx.setLineDash([])
            ctx.stroke(partPath)
          })
        } else if (isUnifiedGridShape(shape)) {
          // Unified grid shape - single path with multiple subpaths (one per tile)
          const result = shape.generator(cx, cy, width, height)
          const shapePathD = serializePathCommands(result.commands)

          // Use the result's fill color with reduced opacity for preview
          ctx.fillStyle = result.fill ? `${result.fill}80` : 'rgba(0, 0, 0, 0.1)'
          ctx.strokeStyle = result.stroke ?? COLORS.drawingPath
          ctx.lineWidth = (result.strokeWidth ?? 2) / currentScale
          ctx.setLineDash([])

          const shapePath = new Path2D(shapePathD)
          ctx.fill(shapePath)
          ctx.stroke(shapePath)
        } else {
          // Simple shape - single path
          const shapeCommands = shape.generator(cx, cy, width, height) as PathCommand[]
          const shapePathD = serializePathCommands(shapeCommands)

          // Draw the shape preview
          ctx.strokeStyle = COLORS.drawingPath
          ctx.lineWidth = 2 / currentScale
          ctx.setLineDash([5 / currentScale, 5 / currentScale])
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'

          const shapePath = new Path2D(shapePathD)
          ctx.fill(shapePath)
          ctx.stroke(shapePath)
          ctx.setLineDash([])
        }

        // Draw bounding box corners
        ctx.strokeStyle = COLORS.drawingPreview
        ctx.lineWidth = 1 / currentScale
        const cornerSize = 8 / currentScale

        // Top-left corner
        ctx.beginPath()
        ctx.moveTo(minX, minY + cornerSize)
        ctx.lineTo(minX, minY)
        ctx.lineTo(minX + cornerSize, minY)
        ctx.stroke()

        // Top-right corner
        ctx.beginPath()
        ctx.moveTo(maxX - cornerSize, minY)
        ctx.lineTo(maxX, minY)
        ctx.lineTo(maxX, minY + cornerSize)
        ctx.stroke()

        // Bottom-right corner
        ctx.beginPath()
        ctx.moveTo(maxX, maxY - cornerSize)
        ctx.lineTo(maxX, maxY)
        ctx.lineTo(maxX - cornerSize, maxY)
        ctx.stroke()

        // Bottom-left corner
        ctx.beginPath()
        ctx.moveTo(minX + cornerSize, maxY)
        ctx.lineTo(minX, maxY)
        ctx.lineTo(minX, maxY - cornerSize)
        ctx.stroke()
      }
    }

    ctx.restore()

    // Draw guidelines overlay (in screen coordinates, after main restore)
    if (editModeSettings?.showRuler && guidelines && guidelines.length > 0) {
      ctx.save()
      ctx.scale(dpr, dpr)
      renderGuidelines({
        ctx,
        guidelines,
        scale: currentScale,
        offset: currentOffset,
        canvasSize,
        draggingGuidelineId,
        hoveredGuidelineId,
      })
      ctx.restore()
    }

    // Draw selection rectangle in screen coordinates (after restore)
    if (selectionRect) {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = COLORS.selectionRect
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.fillStyle = COLORS.selectionRectFill
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.setLineDash([])
      ctx.restore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedPathIndices,
    selectedNodeIndex,
    hoveredPathIndex,
    hoveredSegment,
    hoveredConnectedSegment,
    canvasSize,
    selectedNodeIndices,
    selectionRect,
    drawingPath,
    drawPreviewPos,
    hoveredDrawingNodeIndex,
    isStartingNewSubpath,
    scaleRef,
    offsetRef,
    isDrawDragging,
    drawDragStart,
    drawDragCurrent,
    isOutsideViewBox,
    selectedPredefinedShape,
    shapeDragStart,
    shapeDragCurrent,
    isShiftKeyPressed,
    isRotating,
    editorMode,
    extendPreviewPos,
    isExtendMode,
    extendFromNode,
    isHoveringExtendCloseNode,
    hidePathSelectionFeedback,
    // Edit mode overlay dependencies
    editModeSettings,
    guidelines,
    draggingGuidelineId,
    hoveredGuidelineId,
    svgToScreen,
  ])

  // Request a render (batched via RAF)
  const requestRender = useCallback(() => {
    // Cancel any pending render to ensure we use latest callbacks
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    needsRenderRef.current = true

    rafIdRef.current = requestAnimationFrame(() => {
      needsRenderRef.current = false
      rafIdRef.current = null
      renderBackgroundCanvas()
      renderInteractionCanvas()
    })
  }, [renderBackgroundCanvas, renderInteractionCanvas])

  // Trigger render when dependencies change
  useEffect(() => {
    requestRender()
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedPathIndices,
    selectedNodeIndex,
    hoveredPathIndex,
    hoveredSegment,
    hoveredConnectedSegment,
    canvasSize,
    selectedNodeIndices,
    selectionRect,
    drawingPath,
    drawPreviewPos,
    hoveredDrawingNodeIndex,
    isStartingNewSubpath,
    scale,
    offset,
    requestRender,
    isDrawDragging,
    drawDragStart,
    drawDragCurrent,
    selectedPredefinedShape,
    shapeDragStart,
    shapeDragCurrent,
    isShiftKeyPressed,
    extendPreviewPos,
    isExtendMode,
    extendFromNode,
    isHoveringExtendCloseNode,
    hidePathSelectionFeedback,
  ])

  // Find node or control point at position
  // Only considers nodes that are currently visible (in hovered segment or selected)
  const findElementAtPosition = useCallback(
    (screenX: number, screenY: number) => {
      if (selectedPathIndex === null || !parsedSvg) return null

      const path = parsedSvg.paths[selectedPathIndex]

      // All nodes on a selected path are always interactive (visible and clickable)
      for (let i = path.commands.length - 1; i >= 0; i--) {
        const command = path.commands[i]

        // Check control points first (only for selected node)
        if (i === selectedNodeIndex) {
          if (command.cp1) {
            const cp1Screen = svgToScreen(command.cp1.x, command.cp1.y)
            const dist = Math.sqrt(Math.pow(screenX - cp1Screen.x, 2) + Math.pow(screenY - cp1Screen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point' as const, nodeIndex: i, cpIndex: 0 }
            }
          }

          if (command.cp2) {
            const cp2Screen = svgToScreen(command.cp2.x, command.cp2.y)
            const dist = Math.sqrt(Math.pow(screenX - cp2Screen.x, 2) + Math.pow(screenY - cp2Screen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point' as const, nodeIndex: i, cpIndex: 1 }
            }
          }

          if (command.cp) {
            const cpScreen = svgToScreen(command.cp.x, command.cp.y)
            const dist = Math.sqrt(Math.pow(screenX - cpScreen.x, 2) + Math.pow(screenY - cpScreen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point' as const, nodeIndex: i, cpIndex: 0 }
            }
          }
        }

        // Check main node
        if (command.type.toUpperCase() !== 'Z') {
          const nodeScreen = svgToScreen(command.x, command.y)
          const dist = Math.sqrt(Math.pow(screenX - nodeScreen.x, 2) + Math.pow(screenY - nodeScreen.y, 2))
          if (dist <= HIT_TOLERANCE) {
            return { type: 'node' as const, nodeIndex: i }
          }
        }
      }

      return null
    },
    [selectedPathIndex, parsedSvg, svgToScreen, selectedNodeIndex]
  )

  // Calculate unified bounds and center for selected paths (for multi-path rotation)
  const getSelectedPathsUnifiedBoundsAndCenter = useCallback((): {
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    center: Point
  } | null => {
    if (!parsedSvg) return null

    // Get all selected path indices (either from multi-selection or single selection)
    const indices
      = selectedPathIndices.size > 0
        ? Array.from(selectedPathIndices)
        : selectedPathIndex !== null
          ? [selectedPathIndex]
          : []
    if (indices.length === 0) return null

    // Calculate unified bounding box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const idx of indices) {
      const path = parsedSvg.paths[idx]
      if (!path) continue
      const pathBounds = calculatePathBounds(path.commands)
      minX = Math.min(minX, pathBounds.minX)
      minY = Math.min(minY, pathBounds.minY)
      maxX = Math.max(maxX, pathBounds.maxX)
      maxY = Math.max(maxY, pathBounds.maxY)
    }

    if (!isFinite(minX)) return null

    return {
      bounds: { minX, minY, maxX, maxY },
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    }
  }, [parsedSvg, selectedPathIndex, selectedPathIndices])

  // Check if screen position is over the rotation handle
  const isOverRotationHandle = useCallback(
    (screenX: number, screenY: number): boolean => {
      // Need at least one path selected
      const hasSelection = selectedPathIndex !== null || selectedPathIndices.size > 0
      if (!hasSelection || !parsedSvg) return false
      // Rotation handle is only shown when no nodes are selected
      if (selectedNodeIndex !== null || selectedNodeIndices.size > 0) return false
      if (editorMode !== 'edit') return false

      const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
      if (!unifiedData) return false

      const { bounds, center } = unifiedData

      // Handle position in SVG coords (same calculation as in renderCanvas)
      const handleY = bounds.minY - ROTATION_HANDLE_OFFSET / scaleRef.current

      // Convert handle position to screen coords
      const handleScreen = svgToScreen(center.x, handleY)

      // Check distance
      const dist = Math.sqrt(Math.pow(screenX - handleScreen.x, 2) + Math.pow(screenY - handleScreen.y, 2))
      return dist <= ROTATION_HANDLE_RADIUS + HIT_TOLERANCE
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      selectedNodeIndex,
      selectedNodeIndices,
      editorMode,
      svgToScreen,
      scaleRef,
      getSelectedPathsUnifiedBoundsAndCenter,
    ]
  )

  // Check if screen position is inside the selection rectangle bounds
  // Used to allow dragging selected paths from anywhere inside the selection, not just on segments
  const isInsideSelectionBounds = useCallback(
    (screenX: number, screenY: number): boolean => {
      // Need at least one path selected
      const hasSelection = selectedPathIndex !== null || selectedPathIndices.size > 0
      if (!hasSelection || !parsedSvg) return false
      // Only check when no nodes are selected (when selection rectangle is visible)
      if (selectedNodeIndex !== null || selectedNodeIndices.size > 0) return false
      if (editorMode !== 'edit') return false

      const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
      if (!unifiedData) return false

      const { bounds } = unifiedData

      // Convert screen position to SVG coordinates
      const svgPos = screenToSvg(screenX, screenY)

      // Check if point is inside bounds
      return svgPos.x >= bounds.minX && svgPos.x <= bounds.maxX && svgPos.y >= bounds.minY && svgPos.y <= bounds.maxY
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      selectedNodeIndex,
      selectedNodeIndices,
      editorMode,
      screenToSvg,
      getSelectedPathsUnifiedBoundsAndCenter,
    ]
  )

  // Find which resize handle (if any) is at the given screen position
  // Calculate anchor point (opposite corner/edge) for resize operation
  // The anchor point stays fixed while the dragged handle moves
  const getResizeAnchorPoint = useCallback(
    (handle: ResizeHandleType, bounds: { minX: number; minY: number; maxX: number; maxY: number }): Point => {
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2

      switch (handle) {
        // Corner handles: anchor at opposite corner
        case 'tl':
          return { x: bounds.maxX, y: bounds.maxY } // anchor at bottom-right
        case 'tr':
          return { x: bounds.minX, y: bounds.maxY } // anchor at bottom-left
        case 'br':
          return { x: bounds.minX, y: bounds.minY } // anchor at top-left
        case 'bl':
          return { x: bounds.maxX, y: bounds.minY } // anchor at top-right
        // Edge handles: anchor at opposite edge center
        case 'n':
          return { x: centerX, y: bounds.maxY } // anchor at bottom center
        case 's':
          return { x: centerX, y: bounds.minY } // anchor at top center
        case 'e':
          return { x: bounds.minX, y: centerY } // anchor at left center
        case 'w':
          return { x: bounds.maxX, y: centerY } // anchor at right center
      }
    },
    []
  )

  const findResizeHandleAtPosition = useCallback(
    (screenX: number, screenY: number): ResizeHandleType | null => {
      // Need at least one path selected
      const hasSelection = selectedPathIndex !== null || selectedPathIndices.size > 0
      if (!hasSelection || !parsedSvg) return null
      // Resize handles are only shown when no nodes are selected
      if (selectedNodeIndex !== null || selectedNodeIndices.size > 0) return null
      if (editorMode !== 'edit') return null

      const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
      if (!unifiedData) return null

      const { bounds, center } = unifiedData
      const handleSize = RESIZE_HANDLE_SIZE / scaleRef.current
      const centerX = center.x
      const centerY = center.y

      const handles: Array<{ type: ResizeHandleType; x: number; y: number }> = [
        { type: 'tl', x: bounds.minX, y: bounds.minY },
        { type: 'tr', x: bounds.maxX, y: bounds.minY },
        { type: 'br', x: bounds.maxX, y: bounds.maxY },
        { type: 'bl', x: bounds.minX, y: bounds.maxY },
        { type: 'n', x: centerX, y: bounds.minY },
        { type: 's', x: centerX, y: bounds.maxY },
        { type: 'e', x: bounds.maxX, y: centerY },
        { type: 'w', x: bounds.minX, y: centerY },
      ]

      for (const handle of handles) {
        const handleScreen = svgToScreen(handle.x, handle.y)
        const dist = Math.sqrt(Math.pow(screenX - handleScreen.x, 2) + Math.pow(screenY - handleScreen.y, 2))
        if (dist <= handleSize + RESIZE_HANDLE_HIT_TOLERANCE) {
          return handle.type
        }
      }

      return null
    },
    [
      selectedPathIndex,
      selectedPathIndices,
      parsedSvg,
      selectedNodeIndex,
      selectedNodeIndices,
      editorMode,
      svgToScreen,
      scaleRef,
      getSelectedPathsUnifiedBoundsAndCenter,
    ]
  )

  // Find drawing path node at position (for closing path to any previous node)
  const findDrawingNodeAtPosition = useCallback(
    (screenX: number, screenY: number): number | null => {
      if (!drawingPath || drawingPath.length < 2) return null

      // Allow clicking on ANY previous node (not just current subpath)
      // This enables creating complex shapes like birthday hats where you close
      // to a node that's before a Z command
      // Exclude the last node (can't close to the node being drawn from)
      for (let i = 0; i < drawingPath.length - 1; i++) {
        const cmd = drawingPath[i]
        // Skip Z commands (they're not clickable nodes)
        if (cmd.type === 'Z') continue

        const nodeScreen = svgToScreen(cmd.x, cmd.y)
        const dist = Math.sqrt(Math.pow(screenX - nodeScreen.x, 2) + Math.pow(screenY - nodeScreen.y, 2))
        if (dist <= HIT_TOLERANCE) {
          return i
        }
      }
      return null
    },
    [drawingPath, svgToScreen]
  )

  // Handle guideline creation from ruler drag (called on mouseUp after drag completes)
  const handleGuidelineCreate = useCallback(
    (axis: 'x' | 'y', position: number): string => {
      if (!onGuidelineAdd) return ''
      const id = onGuidelineAdd(axis, position)
      // Guideline is created at final position, no need to set dragging state
      return id
    },
    [onGuidelineAdd]
  )

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Mark as interacted to hide mobile hints
      if (!hasInteracted) {
        setHasInteracted(true)
        onCanvasInteraction?.()
      }

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Middle mouse button for panning (always allowed)
      if (e.button === 1) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX, y: e.clientY }
        isInteractingRef.current = true
        return
      }

      // Skip if touch is active (mobile fires synthesized mouse events after touch)
      if (isTouchActiveRef.current) {
        return
      }

      // Skip if touch already blocked this interaction (mobile fires both touch + mouse events)
      if (touchBlockedByPopoverRef.current) {
        return
      }

      // Close sidebar and block click actions when popover or sidebar is open
      if (isPopoverOrSidebarOpen) {
        touchBlockedByPopoverRef.current = true
        onCloseSidebar?.()
        return
      }

      const svgPos = screenToSvg(screenX, screenY)

      // Handle draw mode clicks
      if (editorMode === 'draw') {
        // If a predefined shape is selected, start shape drag
        if (selectedPredefinedShape && onShapeDragStart) {
          onShapeDragStart(svgPos)
          return
        }

        // Check if clicking on a preceding node to close the path
        // Track the closing node index so we can handle drag-to-close with curve in mouseUp
        // Skip this check if we're starting a new subpath - in that case, clicking on an existing
        // node should create a new M command at that position, not close to it
        if (drawingPath && drawingPath.length >= 2 && !isStartingNewSubpath) {
          const closeNodeIndex = findDrawingNodeAtPosition(screenX, screenY)
          if (closeNodeIndex !== null) {
            // Track that we're potentially closing the path
            // Don't close immediately - allow drag for curve creation
            setClosingNodeIndex(closeNodeIndex)
            setDrawDragStart(svgPos)
            setDrawDragCurrent(null)
            setIsDrawDragging(false)
            setHoveredDrawingNodeIndex(null)
            return
          }
        }
        // Start draw drag tracking (don't add point yet - wait for mouseup to determine click vs drag)
        setDrawDragStart(svgPos)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
        setClosingNodeIndex(null) // Not closing, just adding new point
        return
      }

      // Check for guideline click (edit mode with ruler enabled)
      if (editorMode === 'edit' && editModeSettings?.showRuler && guidelines && guidelines.length > 0) {
        const guidelineAtPosition = findGuidelineAtPosition(
          { x: screenX, y: screenY },
          guidelines,
          scaleRef.current,
          offsetRef.current
        )
        if (guidelineAtPosition) {
          setDraggingGuidelineId(guidelineAtPosition.id)
          draggingGuidelineAxisRef.current = guidelineAtPosition.axis
          isInteractingRef.current = true
          return
        }
      }

      // Check rotation handle FIRST (before resize handles) because at low zoom levels,
      // the scaled resize hit areas can extend far enough to overlap with the rotation handle
      // Note: isOverRotationHandle internally checks for selection, editorMode, and node selection state
      if (isOverRotationHandle(screenX, screenY)) {
        const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
        if (!unifiedData) return

        const { center } = unifiedData

        // Determine which paths to rotate (prefer multi-selection if available)
        const pathIndicesToRotate
          = selectedPathIndices.size > 0
            ? new Set(selectedPathIndices)
            : selectedPathIndex !== null
              ? new Set([selectedPathIndex])
              : new Set<number>()

        // Safety check - shouldn't happen since isOverRotationHandle checks selection
        if (pathIndicesToRotate.size === 0) return

        // Store original rotations for all selected paths
        originalRotationsRef.current.clear()
        for (const idx of pathIndicesToRotate) {
          const path = parsedSvg!.paths[idx]
          if (path) {
            originalRotationsRef.current.set(idx, {
              rotation: path.pathRotation || 0,
              origin: path.pathRotationOrigin || calculatePathCenter(path.commands),
            })
          }
        }
        rotatingPathIndicesRef.current = pathIndicesToRotate

        // Calculate initial angle from unified center to mouse position
        const startAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)

        setIsRotating(true)
        setRotationStartAngle(startAngle)
        rotationCenterRef.current = center
        currentRotationDeltaRef.current = 0 // Reset delta at start
        isInteractingRef.current = true
        return
      }

      // Check for resize handle click (supports multi-path selection)
      // Note: findResizeHandleAtPosition internally checks for selection, editorMode, and node selection state
      const resizeHandle = findResizeHandleAtPosition(screenX, screenY)
      if (resizeHandle) {
        const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
        if (!unifiedData) return

        const { bounds } = unifiedData

        // Determine which paths to resize (prefer multi-selection if available)
        const pathIndicesToResize
          = selectedPathIndices.size > 0
            ? new Set(selectedPathIndices)
            : selectedPathIndex !== null
              ? new Set([selectedPathIndex])
              : new Set<number>()

        // Safety check - shouldn't happen since findResizeHandleAtPosition checks selection
        if (pathIndicesToResize.size === 0) return

        // Store original commands for all paths being resized
        originalCommandsRef.current.clear()
        for (const idx of pathIndicesToResize) {
          const path = parsedSvg!.paths[idx]
          if (path) {
            // Deep clone commands to avoid mutation
            originalCommandsRef.current.set(
              idx,
              path.commands.map(cmd => ({
                ...cmd,
                cp1: cmd.cp1 ? { ...cmd.cp1 } : undefined,
                cp2: cmd.cp2 ? { ...cmd.cp2 } : undefined,
                cp: cmd.cp ? { ...cmd.cp } : undefined,
              }))
            )
          }
        }
        resizingPathIndicesRef.current = pathIndicesToResize
        resizeStartBoundsRef.current = bounds
        resizeStartMouseRef.current = svgPos
        // Use anchor point (opposite corner/edge) instead of center for standard resize behavior
        resizeCenterRef.current = getResizeAnchorPoint(resizeHandle, bounds)

        setIsResizing(true)
        setResizingHandle(resizeHandle)
        isInteractingRef.current = true
        return
      }

      // Handle extend mode - clicking on canvas extends path from selected node (Feature 3)
      if (isExtendMode && extendFromNode && editorMode === 'edit') {
        const svgPos = screenToSvg(screenX, screenY)

        // Check if clicking on the opposite endpoint to close the path
        const path = parsedSvg.paths[extendFromNode.pathIndex]
        if (path && onCloseExtendPath) {
          const commands = path.commands
          // Find the opposite endpoint (if extending from last node, opposite is first node; vice versa)
          const isExtendingFromEnd
            = extendFromNode.nodeIndex === commands.length - 1 || commands[extendFromNode.nodeIndex + 1]?.type === 'Z'
          const oppositeNodeIndex = isExtendingFromEnd ? 0 : commands.length - 1
          const oppositeNode = commands[oppositeNodeIndex]

          if (oppositeNode && oppositeNode.x !== undefined && oppositeNode.y !== undefined) {
            const oppositeScreenPos = svgToScreen(oppositeNode.x, oppositeNode.y)
            const distToOpposite = Math.sqrt(
              Math.pow(screenX - oppositeScreenPos.x, 2) + Math.pow(screenY - oppositeScreenPos.y, 2)
            )

            // If close enough to opposite endpoint, close the path
            if (distToOpposite < HIT_TOLERANCE) {
              onCloseExtendPath()
              return
            }
          }
        }

        // Otherwise, extend the path
        if (onExtendPath) {
          onExtendPath(extendFromNode.pathIndex, extendFromNode.nodeIndex, svgPos.x, svgPos.y)
        }
        return
      }

      // Check for node/control point click first
      const element = findElementAtPosition(screenX, screenY)

      if (element) {
        if (element.type === 'node') {
          if (effectiveShiftPressed) {
            // Shift held: toggle selection (add if not selected, remove if selected)
            const newIndices = new Set(selectedNodeIndices)

            if (newIndices.has(element.nodeIndex)) {
              // Already selected - remove from selection (toggle off)
              newIndices.delete(element.nodeIndex)

              // Removed from selection - no need to update primary, it's derived from Set
            } else {
              // Not selected - add to selection
              newIndices.add(element.nodeIndex)
            }

            // Update the full selection Set (primary node is derived from first element)
            setSelectedNodeIndices(newIndices)
            // Shift+click is purely for selection - don't set up pending drag
            // (dragging multi-selected nodes is handled by non-shift click on selected node)
          } else if (selectedNodeIndices.size > 1 && selectedNodeIndices.has(element.nodeIndex)) {
            // No shift but clicking on already multi-selected node - prepare for multi-drag
            // Selection will be reduced to single node on mouseUp if no drag occurs
            setIsPendingDrag(true)
            setPendingDragInfo({
              type: 'multi-node',
              pathIndex: selectedPathIndex!,
              nodeIndex: element.nodeIndex,
              startX: screenX,
              startY: screenY,
              startSvgX: svgPos.x,
              startSvgY: svgPos.y,
            })
          } else {
            // No shift, clicking unselected node or single selection: replace selection
            setSelectedNodeIndices(new Set([element.nodeIndex]))
            setIsPendingDrag(true)
            setPendingDragInfo({
              type: 'node',
              pathIndex: selectedPathIndex!,
              nodeIndex: element.nodeIndex,
              startX: screenX,
              startY: screenY,
            })
          }
          return
        }

        if (element.type === 'control-point') {
          // Select the node that owns this control point
          setSelectedNodeIndices(new Set([element.nodeIndex]))
          setIsPendingDrag(true)
          setPendingDragInfo({
            type: 'control-point',
            pathIndex: selectedPathIndex!,
            nodeIndex: element.nodeIndex,
            cpIndex: element.cpIndex,
            startX: screenX,
            startY: screenY,
          })
        }
        return
      }

      // Check if clicking on a hovered segment to insert a node
      if (effectiveAltPressed && hoveredSegment && onNodeInsert) {
        onNodeInsert(hoveredSegment.pathIndex, hoveredSegment.segmentIndex, hoveredSegment.position, hoveredSegment.t)
        setHoveredSegment(null)
        return
      }

      // Check if clicking on a hovered connected segment (works for any selected path)
      // Instead of immediately selecting, set up pending drag for path move
      // If user releases without dragging, we'll select the segment in mouseUp
      if (hoveredConnectedSegment && selectedPathIndices.has(hoveredConnectedSegment.pathIndex)) {
        const clickedPathIndex = hoveredConnectedSegment.pathIndex

        // If Shift is pressed and multiple paths are selected, toggle path selection
        // instead of segment selection behavior
        if (effectiveShiftPressed && selectedPathIndices.size > 1) {
          const newIndices = new Set(selectedPathIndices)
          // Toggle off - remove from selection
          newIndices.delete(clickedPathIndex)
          onPathIndicesChange(newIndices)
          setSelectedNodeIndices(new Set())
          setHoveredConnectedSegment(null)
          return
        }

        const svgPos = screenToSvg(screenX, screenY)

        // Store pending segment selection (will be applied if no drag occurs)
        pendingSegmentSelectionRef.current = {
          segment: hoveredConnectedSegment.segment,
          isShiftHeld: effectiveShiftPressed,
          pathIndex: clickedPathIndex, // Store which path was clicked for multi-path handling
        }

        // Set up pending drag for path move
        setIsPendingDrag(true)
        setPendingDragInfo({
          type: 'path',
          pathIndex: clickedPathIndex,
          nodeIndex: 0,
          startX: screenX,
          startY: screenY,
          startSvgX: svgPos.x,
          startSvgY: svgPos.y,
        })

        // Clear the hovered segment visual
        setHoveredConnectedSegment(null)
        return
      }

      // No node/control point clicked - check if a path was clicked
      const clickedPathIndex = findPathAtPosition(screenX, screenY)

      if (clickedPathIndex !== null) {
        // Handle Shift+click for multi-path selection
        if (effectiveShiftPressed) {
          const newIndices = new Set(selectedPathIndices)
          if (newIndices.has(clickedPathIndex)) {
            // Toggle off - remove from selection
            newIndices.delete(clickedPathIndex)
          } else {
            // Toggle on - add to selection
            newIndices.add(clickedPathIndex)
          }
          // Update the full path selection Set (primary is derived)
          onPathIndicesChange(newIndices)
          // Clear node selection when doing multi-path selection
          setSelectedNodeIndices(new Set())
        } else if (!selectedPathIndices.has(clickedPathIndex)) {
          // Normal click on a different path - single selection
          onPathIndicesChange(new Set([clickedPathIndex]))
        } else {
          // Click on already-selected path - prepare for path drag
          // (similar to touch handler behavior)
          const svgPos = screenToSvg(screenX, screenY)
          setIsPendingDrag(true)
          setPendingDragInfo({
            type: 'path',
            pathIndex: clickedPathIndex,
            nodeIndex: 0,
            startX: screenX,
            startY: screenY,
            startSvgX: svgPos.x,
            startSvgY: svgPos.y,
          })
        }
      } else if (selectedPathIndices.size > 0) {
        // Click on empty canvas with path(s) selected
        // Check if clicking inside the selection bounds - if so, start path drag
        if (isInsideSelectionBounds(screenX, screenY)) {
          // Clicking inside selection rectangle - prepare for path drag
          const svgPos = screenToSvg(screenX, screenY)
          setIsPendingDrag(true)
          setPendingDragInfo({
            type: 'path',
            pathIndex: Array.from(selectedPathIndices)[0], // Use first selected path
            nodeIndex: 0,
            startX: screenX,
            startY: screenY,
            startSvgX: svgPos.x,
            startSvgY: svgPos.y,
          })
        } else {
          // Clicking outside selection bounds - start rectangle selection
          setIsPendingSelection(true)
          setSelectionStart({ x: screenX, y: screenY })
          // Only clear selection if Shift is not held (additive selection)
          if (!effectiveShiftPressed) {
            setSelectedNodeIndices(new Set())
          }
        }
      } else {
        // Click on empty canvas with nothing selected - start rectangle selection for paths
        setIsPendingSelection(true)
        setSelectionStart({ x: screenX, y: screenY })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      findElementAtPosition,
      findPathAtPosition,
      findDrawingNodeAtPosition,
      onPathIndicesChange,
      selectedPathIndex,
      selectedPathIndices,
      selectedNodeIndices,
      screenToSvg,
      setSelectedNodeIndices,
      hoveredSegment,
      hoveredConnectedSegment,
      onNodeInsert,
      editorMode,
      onDrawPathClick,
      onCloseDrawingPath,
      drawingPath,
      isAltKeyPressed,
      isShiftKeyPressed,
      hasInteracted,
      onCanvasInteraction,
      selectedPredefinedShape,
      onShapeDragStart,
      isOverRotationHandle,
      getSelectedPathsUnifiedBoundsAndCenter,
      parsedSvg,
      findResizeHandleAtPosition,
      isExtendMode,
      extendFromNode,
      onExtendPath,
      onCloseExtendPath,
      isPopoverOrSidebarOpen,
      onCloseSidebar,
      editModeSettings,
      svgToScreen,
      guidelines,
      isInsideSelectionBounds,
    ]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Skip if touch is active (mobile fires synthesized mouse events after touch)
      if (isTouchActiveRef.current) return

      // Skip processing if interaction was blocked due to popover/sidebar
      if (touchBlockedByPopoverRef.current) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Handle panning (use refs for smooth updates, no state changes during pan)
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y

        // Update refs directly (no React re-render)
        offsetRef.current = {
          x: offsetRef.current.x + dx,
          y: offsetRef.current.y + dy,
        }
        panStartRef.current = { x: e.clientX, y: e.clientY }

        // Request RAF render
        requestRender()
        return
      }

      // Handle guideline dragging
      if (draggingGuidelineId && draggingGuidelineAxisRef.current && onGuidelineUpdate) {
        const svgPos = screenToSvg(screenX, screenY)
        // Update guideline position based on axis
        const newPosition = draggingGuidelineAxisRef.current === 'x' ? svgPos.x : svgPos.y
        onGuidelineUpdate(draggingGuidelineId, newPosition)
        requestRender()
        return
      }

      // Handle resize dragging (supports multi-path selection)
      // Uses anchor-based scaling: the opposite corner/edge stays fixed while dragging
      if (
        isResizing
        && resizingHandle
        && resizeStartBoundsRef.current
        && resizeStartMouseRef.current
        && resizeCenterRef.current
      ) {
        // Apply snap to grid and guidelines for resize
        const rawSvgPos = screenToSvg(screenX, screenY)
        const currentScale = scaleRef.current
        const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)
        const svgPos = snapEnabled
          ? snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
          : rawSvgPos
        const startBounds = resizeStartBoundsRef.current
        const anchor = resizeCenterRef.current // This is now the anchor point (opposite corner/edge)

        let scaleX = 1
        let scaleY = 1

        const isCorner = ['tl', 'tr', 'br', 'bl'].includes(resizingHandle)

        // Calculate scale based on distance from anchor to current mouse position
        // vs distance from anchor to original handle position

        // For horizontal scaling
        if (resizingHandle === 'e' || resizingHandle === 'tr' || resizingHandle === 'br') {
          // Handle on right side, anchor on left
          const originalDistX = startBounds.maxX - anchor.x
          const newDistX = svgPos.x - anchor.x
          scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
        } else if (resizingHandle === 'w' || resizingHandle === 'tl' || resizingHandle === 'bl') {
          // Handle on left side, anchor on right
          const originalDistX = startBounds.minX - anchor.x
          const newDistX = svgPos.x - anchor.x
          scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
        }

        // For vertical scaling
        if (resizingHandle === 's' || resizingHandle === 'br' || resizingHandle === 'bl') {
          // Handle on bottom, anchor on top
          const originalDistY = startBounds.maxY - anchor.y
          const newDistY = svgPos.y - anchor.y
          scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
        } else if (resizingHandle === 'n' || resizingHandle === 'tl' || resizingHandle === 'tr') {
          // Handle on top, anchor on bottom
          const originalDistY = startBounds.minY - anchor.y
          const newDistY = svgPos.y - anchor.y
          scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
        }

        // Corner handles: lock aspect ratio (use uniform scale)
        // Use Math.min to ensure the selection never extends beyond the cursor position
        if (isCorner) {
          const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY))
          scaleX = scaleX >= 0 ? uniformScale : -uniformScale
          scaleY = scaleY >= 0 ? uniformScale : -uniformScale
        }

        // Edge handles: only scale in one direction
        if (resizingHandle === 'n' || resizingHandle === 's') scaleX = 1
        if (resizingHandle === 'e' || resizingHandle === 'w') scaleY = 1

        // Prevent negative or zero scale
        scaleX = Math.max(0.01, scaleX)
        scaleY = Math.max(0.01, scaleY)

        // Notify parent of resize change
        onResizeChange?.(resizingPathIndicesRef.current, scaleX, scaleY, anchor)
        requestRender()
        return
      }

      // Handle rotation dragging (supports multi-path selection)
      if (isRotating && rotationCenterRef.current && rotatingPathIndicesRef.current.size > 0) {
        const svgPos = screenToSvg(screenX, screenY)
        const center = rotationCenterRef.current

        // Calculate current angle from unified center to mouse
        const currentAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)

        // Calculate delta angle
        let deltaAngle = currentAngle - rotationStartAngle

        // Shift key: snap delta to 15-degree increments
        if (e.shiftKey) {
          deltaAngle = Math.round(deltaAngle / 15) * 15
        }

        // Store current delta for live feedback rendering
        currentRotationDeltaRef.current = deltaAngle

        // Notify parent of rotation change with delta angle (parent will apply to all paths)
        onRotationChange?.(rotatingPathIndicesRef.current, deltaAngle, center)
        requestRender()
        return
      }

      // Check if pending drag should start
      if (isPendingDrag && pendingDragInfo) {
        const dx = screenX - pendingDragInfo.startX
        const dy = screenY - pendingDragInfo.startY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance >= SELECTION_DRAG_THRESHOLD) {
          setIsPendingDrag(false)

          // For path drags, include the starting bounds for snap calculations
          if (pendingDragInfo.type === 'path') {
            const boundsData = getSelectedPathsUnifiedBoundsAndCenter()
            setDragState({
              ...pendingDragInfo,
              startBounds: boundsData?.bounds,
            })
          } else {
            setDragState(pendingDragInfo)
          }

          setPendingDragInfo(null)
          // Clear pending segment selection since user is dragging (moving path)
          pendingSegmentSelectionRef.current = null
        }
        return
      }

      // Check if pending selection should start
      if (isPendingSelection && selectionStart) {
        const dx = screenX - selectionStart.x
        const dy = screenY - selectionStart.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance >= SELECTION_DRAG_THRESHOLD) {
          setIsPendingSelection(false)
          setIsDrawingSelection(true)
        }
        return
      }

      // Handle selection rectangle drawing
      if (isDrawingSelection && selectionStart) {
        const x = Math.min(selectionStart.x, screenX)
        const y = Math.min(selectionStart.y, screenY)
        const width = Math.abs(screenX - selectionStart.x)
        const height = Math.abs(screenY - selectionStart.y)
        setSelectionRect({ x, y, width, height })
        return
      }

      // Handle dragging
      if (dragState) {
        const rawSvgPos = screenToSvg(screenX, screenY)
        const currentScale = scaleRef.current
        const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)

        if (dragState.type === 'node') {
          // Only snap single node if it's the only node selected (not in multi-node mode)
          const isSingleNodeSelected = selectedNodeIndices.size <= 1
          if (snapEnabled && isSingleNodeSelected) {
            const snappedPos = snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
            onNodeMove(dragState.pathIndex, dragState.nodeIndex, snappedPos.x, snappedPos.y)
          } else {
            onNodeMove(dragState.pathIndex, dragState.nodeIndex, rawSvgPos.x, rawSvgPos.y)
          }
        } else if (dragState.type === 'control-point' && dragState.cpIndex !== undefined) {
          // Don't snap control points - only snap main nodes
          onControlPointMove(dragState.pathIndex, dragState.nodeIndex, dragState.cpIndex, rawSvgPos.x, rawSvgPos.y)
        } else if (dragState.type === 'multi-node') {
          // Don't snap multi-node selection - too complex to determine which node to snap
          const deltaX = rawSvgPos.x - (dragState.startSvgX || 0)
          const deltaY = rawSvgPos.y - (dragState.startSvgY || 0)
          onMultiNodeMove?.(dragState.pathIndex, selectedNodeIndices, deltaX, deltaY)
        } else if (dragState.type === 'path') {
          // For path moves, snap based on selection bounds (not mouse position)
          const rawDeltaX = rawSvgPos.x - (dragState.startSvgX || 0)
          const rawDeltaY = rawSvgPos.y - (dragState.startSvgY || 0)

          if (snapEnabled && dragState.startBounds) {
            // Calculate current bounds after applying raw delta
            const currentBounds = {
              minX: dragState.startBounds.minX + rawDeltaX,
              minY: dragState.startBounds.minY + rawDeltaY,
              maxX: dragState.startBounds.maxX + rawDeltaX,
              maxY: dragState.startBounds.maxY + rawDeltaY,
            }

            // Get snap delta based on bounds edges
            const snapDelta = snapBounds(currentBounds, gridSettings ?? null, guidelines ?? [], currentScale)

            // Apply snap delta to the raw delta
            const deltaX = rawDeltaX + snapDelta.deltaX
            const deltaY = rawDeltaY + snapDelta.deltaY

            onPathMove?.(selectedPathIndices, deltaX, deltaY)
          } else {
            onPathMove?.(selectedPathIndices, rawDeltaX, rawDeltaY)
          }
        }
        // Early return during drag - skip hover detection and other expensive operations
        return
      }

      // Update hover state and cursor
      const element = findElementAtPosition(screenX, screenY)
      const canvas = interactionCanvasRef.current

      // Update draw mode preview position and check for closeable nodes
      if (editorMode === 'draw') {
        const svgPos = screenToSvg(screenX, screenY)
        setDrawPreviewPos(svgPos)

        // Handle predefined shape drag
        if (selectedPredefinedShape && shapeDragStart && onShapeDragMove) {
          onShapeDragMove(svgPos)
          return
        }

        // Track drag movement for curve creation
        if (drawDragStart) {
          const deltaX = svgPos.x - drawDragStart.x
          const deltaY = svgPos.y - drawDragStart.y
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

          if (distance > SELECTION_DRAG_THRESHOLD / scaleRef.current) {
            setIsDrawDragging(true)
            setDrawDragCurrent(svgPos)
          }
        }

        // Check for closeable drawing path nodes (only when not dragging)
        if (!drawDragStart && drawingPath && drawingPath.length >= 2) {
          const nodeIndex = findDrawingNodeAtPosition(screenX, screenY)
          setHoveredDrawingNodeIndex(nodeIndex)
        } else {
          setHoveredDrawingNodeIndex(null)
        }
      } else {
        setDrawPreviewPos(null)
        setHoveredDrawingNodeIndex(null)
        setDrawDragStart(null)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
      }

      // Update extend mode preview position and check for closeable endpoint hover
      if (isExtendMode && extendFromNode && editorMode === 'edit') {
        const svgPos = screenToSvg(screenX, screenY)
        setExtendPreviewPos(svgPos)

        // Check if hovering over the opposite endpoint (for closing the path)
        const path = parsedSvg.paths[extendFromNode.pathIndex]
        if (path) {
          const commands = path.commands
          const isExtendingFromEnd
            = extendFromNode.nodeIndex === commands.length - 1 || commands[extendFromNode.nodeIndex + 1]?.type === 'Z'
          const oppositeNodeIndex = isExtendingFromEnd ? 0 : commands.length - 1
          const oppositeNode = commands[oppositeNodeIndex]

          if (oppositeNode && oppositeNode.x !== undefined && oppositeNode.y !== undefined) {
            const oppositeScreenPos = svgToScreen(oppositeNode.x, oppositeNode.y)
            const distToOpposite = Math.sqrt(
              Math.pow(screenX - oppositeScreenPos.x, 2) + Math.pow(screenY - oppositeScreenPos.y, 2)
            )
            setIsHoveringExtendCloseNode(distToOpposite < HIT_TOLERANCE)
          } else {
            setIsHoveringExtendCloseNode(false)
          }
        } else {
          setIsHoveringExtendCloseNode(false)
        }
      } else {
        setExtendPreviewPos(null)
        setIsHoveringExtendCloseNode(false)
      }

      // Update hovered path - use local variables for immediate cursor updates
      let currentHoveredPath: number | null = null
      let currentHoveredSegment: HoveredSegment | null = null
      let currentHoveredConnectedSegment: HoveredConnectedSegment | null = null

      if (!dragState && !isDrawingSelection && !isPendingDrag && !isPendingSelection) {
        const pathAtPosition = findPathAtPosition(screenX, screenY)
        currentHoveredPath = pathAtPosition
        setHoveredPathIndex(pathAtPosition)

        // Check for segment hover (for node insertion with Alt key)
        // For multi-path selection, check if hovered path is one of the selected paths
        const hoveredSelectedPathIndex
          = pathAtPosition !== null && selectedPathIndices.has(pathAtPosition) ? pathAtPosition : null

        if (!isInteractingRef.current && effectiveAltPressed && hoveredSelectedPathIndex !== null && !element) {
          const svgPos = screenToSvg(screenX, screenY)
          const path = parsedSvg.paths[hoveredSelectedPathIndex]
          const segmentInfo = findSegmentAtPoint(svgPos, path, HIT_TOLERANCE / scaleRef.current)

          if (segmentInfo) {
            currentHoveredSegment = {
              pathIndex: hoveredSelectedPathIndex,
              segmentIndex: segmentInfo.segmentIndex,
              position: segmentInfo.position,
              t: segmentInfo.t,
            }
            setHoveredSegment(currentHoveredSegment)
          } else {
            setHoveredSegment(null)
          }
          // Clear connected segment when Alt is pressed (node insertion mode)
          setHoveredConnectedSegment(null)
        } else {
          setHoveredSegment(null)

          // Check for connected segment hover (for subpath highlighting)
          // Works when hovering over any of the selected paths
          // AND not when hovering directly over a node (nodes take priority)
          if (!isInteractingRef.current && hoveredSelectedPathIndex !== null && !element) {
            const svgPos = screenToSvg(screenX, screenY)
            const path = parsedSvg.paths[hoveredSelectedPathIndex]

            // Find the closest node to the cursor
            const closestNodeIndex = findClosestNodeInPath(svgPos, path)

            if (closestNodeIndex !== null) {
              // Find the connected segment containing this node
              const segment = findConnectedSegment(path.commands, closestNodeIndex)

              // Only highlight if segment has more than 1 node
              if (segment.nodeIndices.length > 1) {
                currentHoveredConnectedSegment = {
                  pathIndex: hoveredSelectedPathIndex,
                  segment,
                  closestNodeIndex,
                }
                setHoveredConnectedSegment(currentHoveredConnectedSegment)
              } else {
                setHoveredConnectedSegment(null)
              }
            } else {
              setHoveredConnectedSegment(null)
            }
          } else {
            setHoveredConnectedSegment(null)
          }
        }
      } else {
        setHoveredSegment(null)
        setHoveredConnectedSegment(null)
      }

      // Cursor logic - use LOCAL variables for immediate updates (state is async)
      // Resize handle cursor map
      const resizeHandleCursors: Record<ResizeHandleType, string> = {
        tl: 'nwse-resize',
        tr: 'nesw-resize',
        br: 'nwse-resize',
        bl: 'nesw-resize',
        n: 'ns-resize',
        s: 'ns-resize',
        e: 'ew-resize',
        w: 'ew-resize',
      }

      if (canvas) {
        if (editorMode === 'draw') {
          // Show pointer cursor when hovering over a closeable node
          if (hoveredDrawingNodeIndex !== null) {
            canvas.style.cursor = 'pointer'
          } else {
            canvas.style.cursor = 'crosshair'
          }
        } else if (isExtendMode && extendFromNode) {
          // Show pointer cursor when hovering over closeable endpoint, crosshair otherwise
          canvas.style.cursor = isHoveringExtendCloseNode ? 'pointer' : 'crosshair'
        } else if (isResizing && resizingHandle) {
          // Show appropriate resize cursor while resizing
          canvas.style.cursor = resizeHandleCursors[resizingHandle]
        } else if (isRotating) {
          canvas.style.cursor = 'grabbing'
        } else if (draggingGuidelineId) {
          // Show appropriate resize cursor while dragging guideline
          canvas.style.cursor = draggingGuidelineAxisRef.current === 'x' ? 'col-resize' : 'row-resize'
        } else if (dragState || isDrawingSelection) {
          canvas.style.cursor = isDrawingSelection ? 'crosshair' : 'move'
        } else {
          // Check rotation handle FIRST (before resize handles) because at low zoom levels,
          // the scaled resize hit areas can extend far enough to overlap with the rotation handle
          if (isOverRotationHandle(screenX, screenY)) {
            canvas.style.cursor = 'grab'
          } else {
            // Check for resize handle hover
            const hoveredResizeHandle = findResizeHandleAtPosition(screenX, screenY)
            if (hoveredResizeHandle) {
              canvas.style.cursor = resizeHandleCursors[hoveredResizeHandle]
            } else if (element) {
              // Show move cursor for any node in the selection (primary or multi-selected)
              const isSelectedNode
                = element.nodeIndex === selectedNodeIndex || selectedNodeIndices.has(element.nodeIndex)
              canvas.style.cursor = isSelectedNode ? 'move' : 'pointer'
            } else if (currentHoveredSegment && effectiveAltPressed) {
              canvas.style.cursor = 'crosshair'
            } else if (currentHoveredConnectedSegment) {
              // Show pointer cursor when hovering over a connected segment
              canvas.style.cursor = 'pointer'
            } else if (selectedPathIndex !== null || selectedPathIndices.size > 0) {
              // Show move cursor when inside selection bounds, default otherwise
              canvas.style.cursor = isInsideSelectionBounds(screenX, screenY) ? 'move' : 'default'
            } else if (currentHoveredPath !== null) {
              canvas.style.cursor = 'pointer'
            } else {
              // Check for guideline hover (edit mode with ruler enabled)
              if (editorMode === 'edit' && editModeSettings?.showRuler && guidelines && guidelines.length > 0) {
                const guidelineAtPosition = findGuidelineAtPosition(
                  { x: screenX, y: screenY },
                  guidelines,
                  scaleRef.current,
                  offsetRef.current
                )
                if (guidelineAtPosition) {
                  setHoveredGuidelineId(guidelineAtPosition.id)
                  canvas.style.cursor = guidelineAtPosition.axis === 'x' ? 'col-resize' : 'row-resize'
                } else {
                  setHoveredGuidelineId(null)
                  canvas.style.cursor = 'default'
                }
              } else {
                setHoveredGuidelineId(null)
                canvas.style.cursor = 'default'
              }
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isPendingDrag,
      pendingDragInfo,
      isPendingSelection,
      selectionStart,
      isDrawingSelection,
      dragState,
      findElementAtPosition,
      editorMode,
      screenToSvg,
      onNodeMove,
      onControlPointMove,
      onMultiNodeMove,
      selectedNodeIndices,
      onPathMove,
      drawingPath,
      findDrawingNodeAtPosition,
      findPathAtPosition,
      isAltKeyPressed,
      selectedPathIndex,
      parsedSvg.paths,
      hoveredSegment,
      hoveredConnectedSegment,
      hoveredPathIndex,
      hoveredDrawingNodeIndex,
      selectedNodeIndex,
      requestRender,
      scaleRef,
      drawDragStart,
      isRotating,
      rotationStartAngle,
      onRotationChange,
      isOverRotationHandle,
      isResizing,
      resizingHandle,
      onResizeChange,
      findResizeHandleAtPosition,
      isExtendMode,
      extendFromNode,
      editModeSettings,
      svgToScreen,
      gridSettings,
      guidelines,
      draggingGuidelineId,
      onGuidelineUpdate,
    ]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Skip if touch is active (mobile fires synthesized mouse events after touch)
      if (isTouchActiveRef.current) return

      // Skip processing if interaction was blocked due to popover/sidebar
      if (touchBlockedByPopoverRef.current) {
        touchBlockedByPopoverRef.current = false
        return
      }

      if (isPanningRef.current) {
        isPanningRef.current = false
        isInteractingRef.current = false
        commitViewport() // Sync refs to state
        return
      }

      // Handle guideline drag end
      if (draggingGuidelineId && draggingGuidelineAxisRef.current) {
        const rect = interactionCanvasRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top

          // Check if guideline should be removed (dragged into ruler area)
          const shouldRemove
            = draggingGuidelineAxisRef.current === 'x'
              ? screenX < RULER_SIZE // Vertical guideline dragged into left ruler
              : screenY < RULER_SIZE // Horizontal guideline dragged into top ruler

          if (shouldRemove && onGuidelineRemove) {
            onGuidelineRemove(draggingGuidelineId)
          }
        }

        setDraggingGuidelineId(null)
        draggingGuidelineAxisRef.current = null
        isInteractingRef.current = false
        return
      }

      // Handle resize end (supports multi-path selection)
      // Uses anchor-based scaling: same logic as mouseMove
      if (
        isResizing
        && resizingHandle
        && resizeStartBoundsRef.current
        && resizeStartMouseRef.current
        && resizeCenterRef.current
      ) {
        const rect = interactionCanvasRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          // Apply snap to grid and guidelines for final resize position
          const rawSvgPos = screenToSvg(screenX, screenY)
          const currentScale = scaleRef.current
          const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)
          const svgPos = snapEnabled
            ? snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
            : rawSvgPos
          const startBounds = resizeStartBoundsRef.current
          const anchor = resizeCenterRef.current // This is now the anchor point (opposite corner/edge)

          // Calculate final scale (same anchor-based logic as in mouseMove)
          let scaleX = 1
          let scaleY = 1

          const isCorner = ['tl', 'tr', 'br', 'bl'].includes(resizingHandle)

          // For horizontal scaling
          if (resizingHandle === 'e' || resizingHandle === 'tr' || resizingHandle === 'br') {
            const originalDistX = startBounds.maxX - anchor.x
            const newDistX = svgPos.x - anchor.x
            scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
          } else if (resizingHandle === 'w' || resizingHandle === 'tl' || resizingHandle === 'bl') {
            const originalDistX = startBounds.minX - anchor.x
            const newDistX = svgPos.x - anchor.x
            scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
          }

          // For vertical scaling
          if (resizingHandle === 's' || resizingHandle === 'br' || resizingHandle === 'bl') {
            const originalDistY = startBounds.maxY - anchor.y
            const newDistY = svgPos.y - anchor.y
            scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
          } else if (resizingHandle === 'n' || resizingHandle === 'tl' || resizingHandle === 'tr') {
            const originalDistY = startBounds.minY - anchor.y
            const newDistY = svgPos.y - anchor.y
            scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
          }

          // Corner handles: lock aspect ratio (use uniform scale)
          // Use Math.min to ensure the selection never extends beyond the cursor position
          if (isCorner) {
            const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY))
            scaleX = scaleX >= 0 ? uniformScale : -uniformScale
            scaleY = scaleY >= 0 ? uniformScale : -uniformScale
          }

          // Edge handles: only scale in one direction
          if (resizingHandle === 'n' || resizingHandle === 's') scaleX = 1
          if (resizingHandle === 'e' || resizingHandle === 'w') scaleY = 1

          // Prevent negative or zero scale
          scaleX = Math.max(0.01, scaleX)
          scaleY = Math.max(0.01, scaleY)

          // Notify parent of final resize (commit to history)
          onResizeChangeEnd?.(resizingPathIndicesRef.current, scaleX, scaleY, anchor)
        }

        setIsResizing(false)
        setResizingHandle(null)
        resizeStartBoundsRef.current = null
        resizeStartMouseRef.current = null
        resizeCenterRef.current = null
        resizingPathIndicesRef.current = new Set()
        originalCommandsRef.current.clear()
        isInteractingRef.current = false
        return
      }

      // Handle rotation end (supports multi-path selection)
      if (isRotating && rotationCenterRef.current && rotatingPathIndicesRef.current.size > 0) {
        const rect = interactionCanvasRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const svgPos = screenToSvg(screenX, screenY)
          const center = rotationCenterRef.current

          // Calculate final delta angle
          const currentAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)
          let deltaAngle = currentAngle - rotationStartAngle

          // Shift key: snap delta to 15-degree increments
          if (e.shiftKey) {
            deltaAngle = Math.round(deltaAngle / 15) * 15
          }

          // Notify parent of final rotation (commit to history)
          onRotationChangeEnd?.(rotatingPathIndicesRef.current, deltaAngle, center)
        }

        setIsRotating(false)
        rotationCenterRef.current = null
        currentRotationDeltaRef.current = 0 // Reset delta at end
        originalRotationsRef.current.clear()
        rotatingPathIndicesRef.current = new Set()
        isInteractingRef.current = false
        return
      }

      // Handle predefined shape drag end
      if (editorMode === 'draw' && selectedPredefinedShape && shapeDragStart && shapeDragCurrent && onShapeDragEnd) {
        onShapeDragEnd(shapeDragStart, shapeDragCurrent)
        return
      }

      // Handle draw mode close path with potential curve (click/drag on existing node)
      if (editorMode === 'draw' && closingNodeIndex !== null && drawDragStart) {
        if (isDrawDragging && drawDragCurrent) {
          // User dragged on a node - close with curve
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y
          const curveType = drawingCurveType === 'quadratic' ? 'quadratic' : 'cubic'
          onCloseDrawingPathWithCurve?.(closingNodeIndex, dx, dy, curveType)
        } else {
          // User clicked without dragging - close with straight line
          onCloseDrawingPath?.(closingNodeIndex)
        }

        // Reset close/drag state
        setClosingNodeIndex(null)
        setDrawDragStart(null)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
        setHoveredDrawingNodeIndex(null)
        return
      }

      // Handle draw mode drag end (determines click vs drag for line vs curve)
      if (editorMode === 'draw' && drawDragStart) {
        if (isDrawDragging && drawDragCurrent) {
          // User dragged - create a curve based on drawingCurveType
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y
          if (drawingCurveType === 'line') {
            // Line mode: always create straight lines regardless of drag
            onDrawPathClick?.(drawDragStart.x, drawDragStart.y)
          } else if (drawingCurveType === 'quadratic') {
            // Quadratic mode: create quadratic bezier
            onDrawPathQuadratic?.(drawDragStart.x, drawDragStart.y, dx, dy)
          } else {
            // Cubic mode (default): create cubic bezier
            onDrawPathCurve?.(drawDragStart.x, drawDragStart.y, dx, dy)
          }
        } else {
          // User clicked without dragging - create a line (existing behavior)
          onDrawPathClick?.(drawDragStart.x, drawDragStart.y)
        }

        // Reset draw drag state
        setDrawDragStart(null)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
        return
      }

      if (isPendingDrag) {
        // Check if this was a multi-node pending drag that didn't turn into actual drag
        // If so, reduce selection to single node (click behavior)
        if (pendingDragInfo?.type === 'multi-node') {
          setSelectedNodeIndices(new Set([pendingDragInfo.nodeIndex]))
        }

        // Check if there's a pending segment selection (click on segment without drag)
        if (pendingSegmentSelectionRef.current && pendingDragInfo?.type === 'path') {
          const { segment, isShiftHeld, pathIndex: segmentPathIndex } = pendingSegmentSelectionRef.current

          // If clicking on a segment in multi-path selection, reduce to single path first
          if (segmentPathIndex !== undefined && selectedPathIndices.size > 1) {
            onPathIndicesChange(new Set([segmentPathIndex]))
          }

          if (isShiftHeld) {
            // Shift held: toggle segment nodes (remove if already selected, add if not)
            const newIndices = new Set(selectedNodeIndices)
            segment.nodeIndices.forEach((idx: number) => {
              if (newIndices.has(idx)) {
                // Already selected - remove (toggle off)
                newIndices.delete(idx)
              } else {
                // Not selected - add (toggle on)
                newIndices.add(idx)
              }
            })
            setSelectedNodeIndices(newIndices)
          } else {
            // No shift: replace selection with segment nodes
            setSelectedNodeIndices(new Set(segment.nodeIndices))
          }
          pendingSegmentSelectionRef.current = null
        }

        setIsPendingDrag(false)
        setPendingDragInfo(null)
        return
      }

      if (isPendingSelection) {
        setIsPendingSelection(false)
        setSelectionStart(null)
        // User clicked but didn't drag - deselect if any path was selected
        if (selectedPathIndices.size > 0) {
          // Clear all selection state and hover feedback
          onPathIndicesChange(new Set())
          setSelectedNodeIndices(new Set())
          setHoveredPathIndex(null)
          setHoveredSegment(null)
          setHoveredConnectedSegment(null)
        }
        return
      }

      // Finalize selection rectangle
      if (isDrawingSelection && selectionRect && parsedSvg) {
        // Determine if we should select paths or nodes:
        // - If exactly one path is selected (single path selection): select nodes within that path
        // - If no path or multiple paths selected: select paths
        const shouldSelectNodes = selectedPathIndices.size === 1 && selectedPathIndex !== null

        if (shouldSelectNodes) {
          // Exactly one path is selected - select nodes within the path
          const path = parsedSvg.paths[selectedPathIndex]
          const newSelectedIndices = new Set<number>()

          path.commands.forEach((command, nodeIndex) => {
            if (command.type.toUpperCase() === 'Z') return

            const { x: screenX, y: screenY } = svgToScreen(command.x, command.y)

            if (
              screenX >= selectionRect.x
              && screenX <= selectionRect.x + selectionRect.width
              && screenY >= selectionRect.y
              && screenY <= selectionRect.y + selectionRect.height
            ) {
              newSelectedIndices.add(nodeIndex)
            }
          })

          // Shift held: toggle selection (remove if already selected, add if not); otherwise replace
          if (effectiveShiftPressed) {
            const combinedSelection = new Set(selectedNodeIndices)
            newSelectedIndices.forEach(index => {
              if (combinedSelection.has(index)) {
                // Already selected - remove (toggle off)
                combinedSelection.delete(index)
              } else {
                // Not selected - add (toggle on)
                combinedSelection.add(index)
              }
            })
            // Update the full selection Set (primary node is derived from first element)
            setSelectedNodeIndices(combinedSelection)
          } else {
            // Update the full selection Set (primary node is derived from first element)
            setSelectedNodeIndices(newSelectedIndices)
          }
        } else {
          // No path or multiple paths selected - select paths that intersect with rectangle
          const newSelectedPaths = new Set<number>()

          parsedSvg.paths.forEach((path, pathIndex) => {
            // Check if any node of the path is within the selection rectangle
            const hasNodeInRect = path.commands.some(cmd => {
              if (cmd.type.toUpperCase() === 'Z') return false
              const { x: nodeScreenX, y: nodeScreenY } = svgToScreen(cmd.x, cmd.y)
              return (
                nodeScreenX >= selectionRect.x
                && nodeScreenX <= selectionRect.x + selectionRect.width
                && nodeScreenY >= selectionRect.y
                && nodeScreenY <= selectionRect.y + selectionRect.height
              )
            })

            if (hasNodeInRect) {
              newSelectedPaths.add(pathIndex)
            }
          })

          if (newSelectedPaths.size > 0) {
            // Shift held: toggle selection (remove if already selected, add if not); otherwise replace
            if (effectiveShiftPressed) {
              const combinedSelection = new Set(selectedPathIndices)
              newSelectedPaths.forEach(index => {
                if (combinedSelection.has(index)) {
                  // Already selected - remove (toggle off)
                  combinedSelection.delete(index)
                } else {
                  // Not selected - add (toggle on)
                  combinedSelection.add(index)
                }
              })
              onPathIndicesChange(combinedSelection)
            } else {
              onPathIndicesChange(newSelectedPaths)
            }
            // Clear node selection when selecting paths
            setSelectedNodeIndices(new Set())
          }
        }

        setIsDrawingSelection(false)
        setSelectionStart(null)
        setSelectionRect(null)
        return
      }

      if (dragState) {
        const rect = interactionCanvasRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const svgPos = screenToSvg(screenX, screenY)

          if (dragState.type === 'node') {
            onNodeMoveEnd(dragState.pathIndex, dragState.nodeIndex, svgPos.x, svgPos.y)
          } else if (dragState.type === 'control-point' && dragState.cpIndex !== undefined) {
            onControlPointMoveEnd(dragState.pathIndex, dragState.nodeIndex, dragState.cpIndex, svgPos.x, svgPos.y)
          } else if (dragState.type === 'multi-node') {
            const deltaX = svgPos.x - (dragState.startSvgX || 0)
            const deltaY = svgPos.y - (dragState.startSvgY || 0)
            onMultiNodeMoveEnd?.(dragState.pathIndex, selectedNodeIndices, deltaX, deltaY)
          } else if (dragState.type === 'path') {
            // Apply snap to final position (same logic as mouse move)
            const rawDeltaX = svgPos.x - (dragState.startSvgX || 0)
            const rawDeltaY = svgPos.y - (dragState.startSvgY || 0)
            const currentScale = scaleRef.current
            const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)

            if (snapEnabled && dragState.startBounds) {
              const currentBounds = {
                minX: dragState.startBounds.minX + rawDeltaX,
                minY: dragState.startBounds.minY + rawDeltaY,
                maxX: dragState.startBounds.maxX + rawDeltaX,
                maxY: dragState.startBounds.maxY + rawDeltaY,
              }
              const snapDelta = snapBounds(currentBounds, gridSettings ?? null, guidelines ?? [], currentScale)
              const deltaX = rawDeltaX + snapDelta.deltaX
              const deltaY = rawDeltaY + snapDelta.deltaY
              onPathMoveEnd?.(selectedPathIndices, deltaX, deltaY)
            } else {
              onPathMoveEnd?.(selectedPathIndices, rawDeltaX, rawDeltaY)
            }
          }
        }
        setDragState(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isPendingDrag,
      isPendingSelection,
      dragState,
      screenToSvg,
      onNodeMoveEnd,
      onControlPointMoveEnd,
      onMultiNodeMoveEnd,
      onPathMoveEnd,
      selectedNodeIndices,
      isDrawingSelection,
      isShiftKeyPressed,
      selectionRect,
      selectedPathIndex,
      selectedPathIndices,
      gridSettings,
      guidelines,
      onPathIndicesChange,
      parsedSvg,
      svgToScreen,
      setSelectedNodeIndices,
      commitViewport,
      editorMode,
      drawDragStart,
      isDrawDragging,
      drawDragCurrent,
      onDrawPathClick,
      onDrawPathCurve,
      selectedPredefinedShape,
      shapeDragStart,
      shapeDragCurrent,
      onShapeDragEnd,
      isRotating,
      rotationStartAngle,
      onRotationChangeEnd,
      isResizing,
      resizingHandle,
      onResizeChangeEnd,
      draggingGuidelineId,
      onGuidelineRemove,
    ]
  )

  const handleMouseLeave = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false
      isInteractingRef.current = false
      commitViewport()
    }
    setDragState(null)
    setHoveredPathIndex(null)
    setHoveredSegment(null)
    setHoveredConnectedSegment(null)
    setHoveredGuidelineId(null)
    // Don't clear draggingGuidelineId - let mouseUp handle it for proper removal detection
    if (isPendingDrag) {
      setIsPendingDrag(false)
      setPendingDragInfo(null)
      pendingSegmentSelectionRef.current = null
    }
    if (isPendingSelection) {
      setIsPendingSelection(false)
      setSelectionStart(null)
    }
    if (isDrawingSelection) {
      setIsDrawingSelection(false)
      setSelectionStart(null)
      setSelectionRect(null)
    }
    // Reset draw drag state
    if (drawDragStart) {
      setDrawDragStart(null)
      setDrawDragCurrent(null)
      setIsDrawDragging(false)
    }
    // Reset rotation state
    if (isRotating) {
      setIsRotating(false)
      rotationCenterRef.current = null
      currentRotationDeltaRef.current = 0
      isInteractingRef.current = false
    }
  }, [isPendingDrag, isPendingSelection, isDrawingSelection, commitViewport, drawDragStart, isRotating])

  // Handle wheel events
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return
      viewportHandleWheel(e, rect)
    },
    [viewportHandleWheel]
  )

  // Add wheel event listener to prevent browser zoom
  useEffect(() => {
    const canvas = interactionCanvasRef.current
    if (!canvas) return

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    canvas.addEventListener('wheel', wheelHandler, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [])

  // Touch event handlers for mobile - map to mouse event logic
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Process gesture detection first
      const gestureResult = processTouchStart(e, rect)

      // If pinch or double-tap, don't process as regular touch (pan/zoom always allowed)
      if (gestureResult.gesture === 'pinch-start' || gestureResult.gesture === 'double-tap') {
        e.preventDefault()
        return
      }

      // For single touch, map to mouse down logic
      if (e.touches.length === 1) {
        const coords = getTouchCoordinates(e, rect)

        // Mark touch as active to block synthesized mouse events
        isTouchActiveRef.current = true

        // Close popover/sidebar and block all other canvas interactions when open
        if (isPopoverOrSidebarOpen) {
          touchBlockedByPopoverRef.current = true
          onCloseSidebar?.()
          return
        }

        // Reset block flag when touch is not blocked
        touchBlockedByPopoverRef.current = false

        // Mark as interacted to hide mobile hints (only after popover/sidebar check)
        if (!hasInteracted) {
          setHasInteracted(true)
          onCanvasInteraction?.()
        }

        const screenX = coords.screenX
        const screenY = coords.screenY
        const svgPos = screenToSvg(screenX, screenY)

        // Handle draw mode
        if (editorMode === 'draw') {
          // If a predefined shape is selected, start shape drag (same as mouse handler)
          if (selectedPredefinedShape && onShapeDragStart) {
            onShapeDragStart(svgPos)
            return
          }

          // Check for closing to existing node, but skip if starting new subpath
          if (drawingPath && drawingPath.length >= 2 && !isStartingNewSubpath) {
            const closeNodeIndex = findDrawingNodeAtPosition(screenX, screenY)
            if (closeNodeIndex !== null) {
              // Track that we're potentially closing the path
              // Don't close immediately - allow drag for curve creation
              setClosingNodeIndex(closeNodeIndex)
              setDrawDragStart(svgPos)
              setDrawDragCurrent(null)
              setIsDrawDragging(false)
              setHoveredDrawingNodeIndex(null)
              return
            }
          }
          // Start draw drag tracking (don't add point yet - wait for touchend to determine tap vs drag)
          setDrawDragStart(svgPos)
          setDrawDragCurrent(null)
          setIsDrawDragging(false)
          setClosingNodeIndex(null) // Not closing, just adding new point
          return
        }

        // Check for guideline touch (edit mode with ruler enabled)
        if (editorMode === 'edit' && editModeSettings?.showRuler && guidelines && guidelines.length > 0) {
          const guidelineAtPosition = findGuidelineAtPosition(
            { x: screenX, y: screenY },
            guidelines,
            scaleRef.current,
            offsetRef.current
          )
          if (guidelineAtPosition) {
            setDraggingGuidelineId(guidelineAtPosition.id)
            draggingGuidelineAxisRef.current = guidelineAtPosition.axis
            isInteractingRef.current = true
            return
          }
        }

        // Check for insert node mode (mobile Alt key equivalent) - insert node on segment tap
        if (effectiveAltPressed && selectedPathIndex !== null) {
          const path = parsedSvg.paths[selectedPathIndex]
          const segmentInfo = findSegmentAtPoint(svgPos, path, HIT_TOLERANCE / scaleRef.current)
          if (segmentInfo && onNodeInsert) {
            onNodeInsert(selectedPathIndex, segmentInfo.segmentIndex, segmentInfo.position, segmentInfo.t)
            return
          }
        }

        // Check rotation handle FIRST (before resize handles) - same order as mouse handler
        // This ensures proper handle detection at low zoom levels
        if (isOverRotationHandle(screenX, screenY)) {
          const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
          if (!unifiedData) return

          const { center } = unifiedData

          // Determine which paths to rotate (prefer multi-selection if available)
          const pathIndicesToRotate
            = selectedPathIndices.size > 0
              ? new Set(selectedPathIndices)
              : selectedPathIndex !== null
                ? new Set([selectedPathIndex])
                : new Set<number>()

          // Safety check - shouldn't happen since isOverRotationHandle checks selection
          if (pathIndicesToRotate.size === 0) return

          // Store original rotations for all selected paths
          originalRotationsRef.current.clear()
          for (const idx of pathIndicesToRotate) {
            const path = parsedSvg!.paths[idx]
            if (path) {
              originalRotationsRef.current.set(idx, {
                rotation: path.pathRotation || 0,
                origin: path.pathRotationOrigin || calculatePathCenter(path.commands),
              })
            }
          }
          rotatingPathIndicesRef.current = pathIndicesToRotate

          // Calculate initial angle from unified center to touch position
          const startAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)

          setIsRotating(true)
          setRotationStartAngle(startAngle)
          rotationCenterRef.current = center
          currentRotationDeltaRef.current = 0 // Reset delta at start
          isInteractingRef.current = true
          return
        }

        // Check for resize handle (supports multi-path selection)
        const resizeHandle = findResizeHandleAtPosition(screenX, screenY)
        if (resizeHandle) {
          const unifiedData = getSelectedPathsUnifiedBoundsAndCenter()
          if (!unifiedData) return

          const { bounds } = unifiedData

          // Determine which paths to resize (prefer multi-selection if available)
          const pathIndicesToResize
            = selectedPathIndices.size > 0
              ? new Set(selectedPathIndices)
              : selectedPathIndex !== null
                ? new Set([selectedPathIndex])
                : new Set<number>()

          // Safety check - shouldn't happen since findResizeHandleAtPosition checks selection
          if (pathIndicesToResize.size === 0) return

          // Store original commands for all paths being resized
          originalCommandsRef.current.clear()
          for (const idx of pathIndicesToResize) {
            const path = parsedSvg!.paths[idx]
            if (path) {
              // Deep clone commands to avoid mutation
              originalCommandsRef.current.set(
                idx,
                path.commands.map(cmd => ({
                  ...cmd,
                  cp1: cmd.cp1 ? { ...cmd.cp1 } : undefined,
                  cp2: cmd.cp2 ? { ...cmd.cp2 } : undefined,
                  cp: cmd.cp ? { ...cmd.cp } : undefined,
                }))
              )
            }
          }
          resizingPathIndicesRef.current = pathIndicesToResize
          resizeStartBoundsRef.current = bounds
          resizeStartMouseRef.current = svgPos
          // Use anchor point (opposite corner/edge) instead of center for standard resize behavior
          resizeCenterRef.current = getResizeAnchorPoint(resizeHandle, bounds)

          setIsResizing(true)
          setResizingHandle(resizeHandle)
          isInteractingRef.current = true
          return
        }

        // Selection rectangle mode: when enabled, tapping anywhere starts selection rectangle
        // - If path is selected: draw rectangle to select nodes on that path
        // - If no path is selected: draw rectangle to select paths
        if (mobileSelectionRectMode && editorMode === 'edit') {
          setIsTouchSelectionMode(true)
          setTouchSelectionStart({ x: screenX, y: screenY })
          setSelectionStart({ x: screenX, y: screenY })
          // Clear node selection before entering selection mode (keep path selection)
          if (!effectiveShiftPressed) {
            setSelectedNodeIndices(new Set())
          }
          isInteractingRef.current = true
          return
        }

        // Check for path selection FIRST on touch (before nodes)
        // On touch, there's no hover preview, so tapping a different path should select it
        // rather than accidentally selecting a node on the current path
        const pathIndex = findPathAtPosition(screenX, screenY)

        // If tapping on a DIFFERENT path, select that path (not nodes on current path)
        if (pathIndex !== null && !selectedPathIndices.has(pathIndex)) {
          // Handle multi-select mode for paths (mobile Shift key equivalent)
          if (effectiveShiftPressed) {
            const newIndices = new Set(selectedPathIndices)
            newIndices.add(pathIndex)
            onPathIndicesChange(newIndices)
          } else {
            // Select new path and clear node selection
            onPathIndicesChange(new Set([pathIndex]))
            setSelectedNodeIndices(new Set())
          }
          // Force re-render to show visual feedback for new path selection
          requestRender()
          return
        }

        // Check for node/control point (only on currently selected path)
        const element = findElementAtPosition(screenX, screenY)

        if (element) {
          if (element.type === 'node') {
            // Handle multi-select mode (mobile Shift key equivalent)
            if (effectiveShiftPressed) {
              const newIndices = new Set(selectedNodeIndices)
              if (newIndices.has(element.nodeIndex)) {
                // Already selected - toggle off (remove from selection)
                newIndices.delete(element.nodeIndex)
              } else {
                // Add to selection
                newIndices.add(element.nodeIndex)
              }
              setSelectedNodeIndices(newIndices)
              // Don't start drag when shift-selecting
              return
            }

            if (selectedNodeIndices.size > 1 && selectedNodeIndices.has(element.nodeIndex)) {
              // Multi-selected node - prepare for multi-drag
              setIsPendingDrag(true)
              setPendingDragInfo({
                type: 'multi-node',
                pathIndex: selectedPathIndex!,
                nodeIndex: element.nodeIndex,
                startX: screenX,
                startY: screenY,
                startSvgX: svgPos.x,
                startSvgY: svgPos.y,
              })
            } else {
              // Single node selection - select and prepare for drag
              setSelectedNodeIndices(new Set([element.nodeIndex]))
              setIsPendingDrag(true)
              setPendingDragInfo({
                type: 'node',
                pathIndex: selectedPathIndex!,
                nodeIndex: element.nodeIndex,
                startX: screenX,
                startY: screenY,
                startSvgX: svgPos.x,
                startSvgY: svgPos.y,
              })
            }
          } else if (element.type === 'control-point') {
            setDragState({
              type: 'control-point',
              pathIndex: selectedPathIndex!,
              nodeIndex: element.nodeIndex,
              cpIndex: element.cpIndex,
              startX: screenX,
              startY: screenY,
            })
          }
          return
        }

        // Check for connected segment tap (select all nodes in segment)
        if (hoveredConnectedSegment && selectedPathIndex !== null) {
          const segmentNodeIndices = new Set(hoveredConnectedSegment.segment.nodeIndices)
          if (effectiveShiftPressed) {
            // Add segment nodes to existing selection
            const newIndices = new Set(selectedNodeIndices)
            segmentNodeIndices.forEach(idx => newIndices.add(idx))
            setSelectedNodeIndices(newIndices)
          } else {
            setSelectedNodeIndices(segmentNodeIndices)
          }
          return
        }

        // Check if tapping on currently selected path
        if (pathIndex !== null && selectedPathIndices.has(pathIndex)) {
          // In multi-select mode, toggle off (remove from selection)
          if (effectiveShiftPressed) {
            const newIndices = new Set(selectedPathIndices)
            newIndices.delete(pathIndex)
            onPathIndicesChange(newIndices)
            // If we removed the last path, also clear node selection
            if (newIndices.size === 0) {
              setSelectedNodeIndices(new Set())
            }
            requestRender()
            return
          }
          // Not in multi-select mode - prepare for path drag
          setIsPendingDrag(true)
          setPendingDragInfo({
            type: 'path',
            pathIndex,
            nodeIndex: 0,
            startX: screenX,
            startY: screenY,
            startSvgX: svgPos.x,
            startSvgY: svgPos.y,
          })
          return
        }

        // Tapping on empty area with paths selected - check if tapping inside selection bounds
        if (pathIndex === null && !effectiveShiftPressed && selectedPathIndices.size > 0) {
          if (isInsideSelectionBounds(screenX, screenY)) {
            // Tapping inside selection rectangle - prepare for path drag
            setIsPendingDrag(true)
            setPendingDragInfo({
              type: 'path',
              pathIndex: Array.from(selectedPathIndices)[0], // Use first selected path
              nodeIndex: 0,
              startX: screenX,
              startY: screenY,
              startSvgX: svgPos.x,
              startSvgY: svgPos.y,
            })
            return
          }
          // Tapping outside selection bounds - clear selection
          onPathIndicesChange(new Set())
          setSelectedNodeIndices(new Set())
          requestRender()
          return
        }

        // Tapping on empty area with no paths selected - clear any node selection
        if (pathIndex === null && !effectiveShiftPressed && selectedNodeIndices.size > 0) {
          setSelectedNodeIndices(new Set())
          requestRender()
          return
        }

        // Otherwise start panning
        isPanningRef.current = true
        panStartRef.current = { x: coords.clientX, y: coords.clientY }
        gestureBaseOffsetRef.current = { ...offsetRef.current }
        gestureBaseScaleRef.current = scaleRef.current
        isInteractingRef.current = true
      }
    },
    [
      processTouchStart,
      hasInteracted,
      onCanvasInteraction,
      screenToSvg,
      editorMode,
      drawingPath,
      isStartingNewSubpath,
      findDrawingNodeAtPosition,
      findElementAtPosition,
      selectedNodeIndices,
      selectedPathIndex,
      selectedPathIndices,
      setSelectedNodeIndices,
      hoveredConnectedSegment,
      effectiveAltPressed,
      effectiveShiftPressed,
      parsedSvg,
      onNodeInsert,
      findPathAtPosition,
      onPathIndicesChange,
      selectedPredefinedShape,
      onShapeDragStart,
      isPopoverOrSidebarOpen,
      onCloseSidebar,
      scaleRef,
      mobileSelectionRectMode,
      isOverRotationHandle,
      findResizeHandleAtPosition,
      getSelectedPathsUnifiedBoundsAndCenter,
      getResizeAnchorPoint,
      requestRender,
      editModeSettings,
      guidelines,
      isInsideSelectionBounds,
      offsetRef,
    ]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Skip processing if touch was blocked due to popover/sidebar
      if (touchBlockedByPopoverRef.current) return

      // Process gesture detection first
      const gestureResult = processTouchMove(e, rect)

      // If pinching, let the gesture handler manage it
      if (gestureResult.gesture === 'pinch-move') {
        e.preventDefault()
        return
      }

      // Single touch handling
      if (e.touches.length === 1) {
        const coords = getTouchCoordinates(e, rect)
        const screenX = coords.screenX
        const screenY = coords.screenY

        // Handle panning
        if (isPanningRef.current) {
          const dx = coords.clientX - panStartRef.current.x
          const dy = coords.clientY - panStartRef.current.y

          offsetRef.current = {
            x: offsetRef.current.x + dx,
            y: offsetRef.current.y + dy,
          }
          panStartRef.current = { x: coords.clientX, y: coords.clientY }
          requestRender()
          applySvgLayerGestureTransform()
          return
        }

        // Handle guideline dragging
        if (draggingGuidelineId && draggingGuidelineAxisRef.current && onGuidelineUpdate) {
          const svgPos = screenToSvg(screenX, screenY)
          // Update guideline position based on axis
          const newPosition = draggingGuidelineAxisRef.current === 'x' ? svgPos.x : svgPos.y
          onGuidelineUpdate(draggingGuidelineId, newPosition)
          requestRender()
          return
        }

        // Handle resize dragging (supports multi-path selection)
        // Uses anchor-based scaling: the opposite corner/edge stays fixed while dragging
        if (
          isResizing
          && resizingHandle
          && resizeStartBoundsRef.current
          && resizeStartMouseRef.current
          && resizeCenterRef.current
        ) {
          // Apply snap to grid and guidelines for resize
          const rawSvgPos = screenToSvg(screenX, screenY)
          const currentScale = scaleRef.current
          const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)
          const svgPos = snapEnabled
            ? snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
            : rawSvgPos
          const startBounds = resizeStartBoundsRef.current
          const anchor = resizeCenterRef.current // This is now the anchor point (opposite corner/edge)

          let scaleX = 1
          let scaleY = 1

          const isCorner = ['tl', 'tr', 'br', 'bl'].includes(resizingHandle)

          // Calculate scale based on distance from anchor to current touch position
          // vs distance from anchor to original handle position

          // For horizontal scaling
          if (resizingHandle === 'e' || resizingHandle === 'tr' || resizingHandle === 'br') {
            // Handle on right side, anchor on left
            const originalDistX = startBounds.maxX - anchor.x
            const newDistX = svgPos.x - anchor.x
            scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
          } else if (resizingHandle === 'w' || resizingHandle === 'tl' || resizingHandle === 'bl') {
            // Handle on left side, anchor on right
            const originalDistX = startBounds.minX - anchor.x
            const newDistX = svgPos.x - anchor.x
            scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
          }

          // For vertical scaling
          if (resizingHandle === 's' || resizingHandle === 'br' || resizingHandle === 'bl') {
            // Handle on bottom, anchor on top
            const originalDistY = startBounds.maxY - anchor.y
            const newDistY = svgPos.y - anchor.y
            scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
          } else if (resizingHandle === 'n' || resizingHandle === 'tl' || resizingHandle === 'tr') {
            // Handle on top, anchor on bottom
            const originalDistY = startBounds.minY - anchor.y
            const newDistY = svgPos.y - anchor.y
            scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
          }

          // Corner handles: lock aspect ratio (use uniform scale)
          // Use Math.min to ensure the selection never extends beyond the cursor position
          if (isCorner) {
            const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY))
            scaleX = scaleX >= 0 ? uniformScale : -uniformScale
            scaleY = scaleY >= 0 ? uniformScale : -uniformScale
          }

          // Edge handles: only scale in one direction
          if (resizingHandle === 'n' || resizingHandle === 's') scaleX = 1
          if (resizingHandle === 'e' || resizingHandle === 'w') scaleY = 1

          // Prevent negative or zero scale
          scaleX = Math.max(0.01, scaleX)
          scaleY = Math.max(0.01, scaleY)

          // Notify parent of resize change
          onResizeChange?.(resizingPathIndicesRef.current, scaleX, scaleY, anchor)
          requestRender()
          return
        }

        // Handle rotation dragging (supports multi-path selection)
        if (isRotating && rotationCenterRef.current && rotatingPathIndicesRef.current.size > 0) {
          const svgPos = screenToSvg(screenX, screenY)
          const center = rotationCenterRef.current

          // Calculate current angle from unified center to touch position
          const currentAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)

          // Calculate delta angle
          const deltaAngle = currentAngle - rotationStartAngle

          // Store current delta for live feedback rendering
          currentRotationDeltaRef.current = deltaAngle

          // Notify parent of rotation change with delta angle (parent will apply to all paths)
          onRotationChange?.(rotatingPathIndicesRef.current, deltaAngle, center)
          requestRender()
          return
        }

        // Handle touch selection rectangle drawing (when selection mode is active via toggle button)
        if (isTouchSelectionMode && touchSelectionStart) {
          const x = Math.min(touchSelectionStart.x, screenX)
          const y = Math.min(touchSelectionStart.y, screenY)
          const width = Math.abs(screenX - touchSelectionStart.x)
          const height = Math.abs(screenY - touchSelectionStart.y)
          setSelectionRect({ x, y, width, height })
          return
        }

        // Check if pending drag should start
        if (isPendingDrag && pendingDragInfo) {
          const dx = screenX - pendingDragInfo.startX
          const dy = screenY - pendingDragInfo.startY
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance >= SELECTION_DRAG_THRESHOLD) {
            setIsPendingDrag(false)

            // For path drags, include the starting bounds for snap calculations
            if (pendingDragInfo.type === 'path') {
              const boundsData = getSelectedPathsUnifiedBoundsAndCenter()
              setDragState({
                ...pendingDragInfo,
                startBounds: boundsData?.bounds,
              })
            } else {
              setDragState(pendingDragInfo)
            }

            setPendingDragInfo(null)
          }
          return
        }

        // Handle dragging
        if (dragState) {
          const rawSvgPos = screenToSvg(screenX, screenY)
          const currentScale = scaleRef.current
          const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)

          if (dragState.type === 'node') {
            // Only snap single node if it's the only node selected
            const isSingleNodeSelected = selectedNodeIndices.size <= 1
            if (snapEnabled && isSingleNodeSelected) {
              const snappedPos = snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
              onNodeMove(dragState.pathIndex, dragState.nodeIndex, snappedPos.x, snappedPos.y)
            } else {
              onNodeMove(dragState.pathIndex, dragState.nodeIndex, rawSvgPos.x, rawSvgPos.y)
            }
          } else if (dragState.type === 'control-point' && dragState.cpIndex !== undefined) {
            // Don't snap control points - only snap main nodes
            onControlPointMove(dragState.pathIndex, dragState.nodeIndex, dragState.cpIndex, rawSvgPos.x, rawSvgPos.y)
          } else if (dragState.type === 'multi-node' && selectedNodeIndices.size > 0) {
            // Don't snap multi-node selection
            const deltaX = rawSvgPos.x - (dragState.startSvgX || 0)
            const deltaY = rawSvgPos.y - (dragState.startSvgY || 0)
            onMultiNodeMove?.(dragState.pathIndex, selectedNodeIndices, deltaX, deltaY)
          } else if (dragState.type === 'path') {
            // For path moves, snap based on selection bounds
            const rawDeltaX = rawSvgPos.x - (dragState.startSvgX || 0)
            const rawDeltaY = rawSvgPos.y - (dragState.startSvgY || 0)

            if (snapEnabled && dragState.startBounds) {
              const currentBounds = {
                minX: dragState.startBounds.minX + rawDeltaX,
                minY: dragState.startBounds.minY + rawDeltaY,
                maxX: dragState.startBounds.maxX + rawDeltaX,
                maxY: dragState.startBounds.maxY + rawDeltaY,
              }
              const snapDelta = snapBounds(currentBounds, gridSettings ?? null, guidelines ?? [], currentScale)
              const deltaX = rawDeltaX + snapDelta.deltaX
              const deltaY = rawDeltaY + snapDelta.deltaY
              onPathMove?.(selectedPathIndices, deltaX, deltaY)
            } else {
              onPathMove?.(selectedPathIndices, rawDeltaX, rawDeltaY)
            }
          }
          return
        }

        // Handle draw mode drag
        if (editorMode === 'draw') {
          const svgPos = screenToSvg(screenX, screenY)

          // Handle predefined shape drag (same as mouse handler)
          if (selectedPredefinedShape && shapeDragStart && onShapeDragMove) {
            onShapeDragMove(svgPos)
            return
          }

          // Handle freehand/curve drag
          if (drawDragStart) {
            setDrawDragCurrent(svgPos)
            setIsDrawDragging(true)
          }
        }

        // Update hovered segment for long-press node insertion
        if (editorMode === 'edit' && selectedPathIndex !== null && !dragState) {
          const svgPos = screenToSvg(screenX, screenY)
          const path = parsedSvg.paths[selectedPathIndex]
          if (path) {
            const segmentInfo = findSegmentAtPoint(svgPos, path, 10 / scaleRef.current)
            if (segmentInfo) {
              setHoveredSegment({
                pathIndex: selectedPathIndex,
                segmentIndex: segmentInfo.segmentIndex,
                position: segmentInfo.position,
                t: segmentInfo.t,
              })
            } else {
              setHoveredSegment(null)
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      processTouchMove,
      isPendingDrag,
      pendingDragInfo,
      dragState,
      screenToSvg,
      onNodeMove,
      onControlPointMove,
      selectedNodeIndices,
      onMultiNodeMove,
      onPathMove,
      selectedPathIndices,
      editorMode,
      drawDragStart,
      selectedPathIndex,
      parsedSvg,
      isTouchSelectionMode,
      touchSelectionStart,
      selectedPredefinedShape,
      shapeDragStart,
      onShapeDragMove,
      // Resize/rotation dependencies
      isResizing,
      resizingHandle,
      onResizeChange,
      isRotating,
      rotationStartAngle,
      onRotationChange,
      // Snap dependencies
      gridSettings,
      guidelines,
      scaleRef,
      // Guideline drag dependencies
      draggingGuidelineId,
      onGuidelineUpdate,
    ]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const rect = interactionCanvasRef.current?.getBoundingClientRect()
      if (!rect) return

      // Delay clearing touch active flag to block synthesized mouse events
      // Mobile browsers fire mousedown/mouseup ~300ms after touchend
      // Keep the flag set for 400ms to ensure synthesized events are blocked
      setTimeout(() => {
        isTouchActiveRef.current = false
      }, 400)

      // Skip all processing if touch was blocked due to popover/sidebar
      if (touchBlockedByPopoverRef.current) {
        setTimeout(() => {
          touchBlockedByPopoverRef.current = false
        }, 400)
        return
      }

      // End panning
      if (isPanningRef.current) {
        isPanningRef.current = false
        isInteractingRef.current = false
        clearSvgLayerGestureTransform()
        commitViewport()
      }

      // Handle guideline drag end
      if (draggingGuidelineId && draggingGuidelineAxisRef.current) {
        // Get last known touch position from changedTouches
        if (e.changedTouches.length > 0) {
          const touch = e.changedTouches[0]
          const screenX = touch.clientX - rect.left
          const screenY = touch.clientY - rect.top

          // Check if guideline should be removed (dragged into ruler area)
          const shouldRemove
            = draggingGuidelineAxisRef.current === 'x'
              ? screenX < RULER_SIZE // Vertical guideline dragged into left ruler
              : screenY < RULER_SIZE // Horizontal guideline dragged into top ruler

          if (shouldRemove && onGuidelineRemove) {
            onGuidelineRemove(draggingGuidelineId)
          }
        }

        setDraggingGuidelineId(null)
        draggingGuidelineAxisRef.current = null
        isInteractingRef.current = false
        return
      }

      // Finalize touch selection rectangle
      if (isTouchSelectionMode && selectionRect && parsedSvg) {
        // Determine if we should select paths or nodes:
        // - If exactly one path is selected: select nodes within that path
        // - If no path or multiple paths selected: select paths
        const shouldSelectNodes = selectedPathIndices.size === 1 && selectedPathIndex !== null

        if (shouldSelectNodes) {
          // Exactly one path is selected - select nodes within the path
          const path = parsedSvg.paths[selectedPathIndex]
          const newSelectedIndices = new Set<number>()

          path.commands.forEach((command, nodeIndex) => {
            if (command.type.toUpperCase() === 'Z') return
            const { x: nodeScreenX, y: nodeScreenY } = svgToScreen(command.x, command.y)

            if (
              nodeScreenX >= selectionRect.x
              && nodeScreenX <= selectionRect.x + selectionRect.width
              && nodeScreenY >= selectionRect.y
              && nodeScreenY <= selectionRect.y + selectionRect.height
            ) {
              newSelectedIndices.add(nodeIndex)
            }
          })

          // Shift held (multi-select mode): toggle selection; otherwise replace
          if (effectiveShiftPressed) {
            const combinedSelection = new Set(selectedNodeIndices)
            newSelectedIndices.forEach(index => {
              if (combinedSelection.has(index)) {
                combinedSelection.delete(index)
              } else {
                combinedSelection.add(index)
              }
            })
            setSelectedNodeIndices(combinedSelection)
          } else {
            setSelectedNodeIndices(newSelectedIndices)
          }
        } else {
          // No path or multiple paths selected - select paths that intersect with rectangle
          const newSelectedPaths = new Set<number>()

          parsedSvg.paths.forEach((path, pathIndex) => {
            // Check if any node of the path is within the selection rectangle
            const hasNodeInRect = path.commands.some(cmd => {
              if (cmd.type.toUpperCase() === 'Z') return false
              const { x: nodeScreenX, y: nodeScreenY } = svgToScreen(cmd.x, cmd.y)
              return (
                nodeScreenX >= selectionRect.x
                && nodeScreenX <= selectionRect.x + selectionRect.width
                && nodeScreenY >= selectionRect.y
                && nodeScreenY <= selectionRect.y + selectionRect.height
              )
            })

            if (hasNodeInRect) {
              newSelectedPaths.add(pathIndex)
            }
          })

          if (newSelectedPaths.size > 0) {
            // Shift held (multi-select mode): toggle selection; otherwise replace
            if (effectiveShiftPressed) {
              const combinedSelection = new Set(selectedPathIndices)
              newSelectedPaths.forEach(index => {
                if (combinedSelection.has(index)) {
                  combinedSelection.delete(index)
                } else {
                  combinedSelection.add(index)
                }
              })
              onPathIndicesChange(combinedSelection)
            } else {
              onPathIndicesChange(newSelectedPaths)
            }
            // Clear node selection when selecting paths
            setSelectedNodeIndices(new Set())
          }
        }

        // Clear selection state
        setIsTouchSelectionMode(false)
        setTouchSelectionStart(null)
        setSelectionRect(null)
        setSelectionStart(null)
        isInteractingRef.current = false
        return
      }

      // Handle resize end (supports multi-path selection)
      // Uses anchor-based scaling: same logic as touchMove
      if (
        isResizing
        && resizingHandle
        && resizeStartBoundsRef.current
        && resizeStartMouseRef.current
        && resizeCenterRef.current
      ) {
        const coords = getTouchCoordinates(e, rect)
        // Apply snap to grid and guidelines for final resize position
        const rawSvgPos = screenToSvg(coords.screenX, coords.screenY)
        const currentScale = scaleRef.current
        const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)
        const svgPos = snapEnabled
          ? snapPoint(rawSvgPos, gridSettings ?? null, guidelines ?? [], currentScale)
          : rawSvgPos
        const startBounds = resizeStartBoundsRef.current
        const anchor = resizeCenterRef.current // This is now the anchor point (opposite corner/edge)

        // Calculate final scale (same anchor-based logic as in touchMove)
        let scaleX = 1
        let scaleY = 1

        const isCorner = ['tl', 'tr', 'br', 'bl'].includes(resizingHandle)

        // For horizontal scaling
        if (resizingHandle === 'e' || resizingHandle === 'tr' || resizingHandle === 'br') {
          const originalDistX = startBounds.maxX - anchor.x
          const newDistX = svgPos.x - anchor.x
          scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
        } else if (resizingHandle === 'w' || resizingHandle === 'tl' || resizingHandle === 'bl') {
          const originalDistX = startBounds.minX - anchor.x
          const newDistX = svgPos.x - anchor.x
          scaleX = originalDistX !== 0 ? newDistX / originalDistX : 1
        }

        // For vertical scaling
        if (resizingHandle === 's' || resizingHandle === 'br' || resizingHandle === 'bl') {
          const originalDistY = startBounds.maxY - anchor.y
          const newDistY = svgPos.y - anchor.y
          scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
        } else if (resizingHandle === 'n' || resizingHandle === 'tl' || resizingHandle === 'tr') {
          const originalDistY = startBounds.minY - anchor.y
          const newDistY = svgPos.y - anchor.y
          scaleY = originalDistY !== 0 ? newDistY / originalDistY : 1
        }

        // Corner handles: lock aspect ratio (use uniform scale)
        // Use Math.min to ensure the selection never extends beyond the cursor position
        if (isCorner) {
          const uniformScale = Math.min(Math.abs(scaleX), Math.abs(scaleY))
          scaleX = scaleX >= 0 ? uniformScale : -uniformScale
          scaleY = scaleY >= 0 ? uniformScale : -uniformScale
        }

        // Edge handles: only scale in one direction
        if (resizingHandle === 'n' || resizingHandle === 's') scaleX = 1
        if (resizingHandle === 'e' || resizingHandle === 'w') scaleY = 1

        // Prevent negative or zero scale
        scaleX = Math.max(0.01, scaleX)
        scaleY = Math.max(0.01, scaleY)

        // Notify parent of final resize (commit to history)
        onResizeChangeEnd?.(resizingPathIndicesRef.current, scaleX, scaleY, anchor)

        setIsResizing(false)
        setResizingHandle(null)
        resizeStartBoundsRef.current = null
        resizeStartMouseRef.current = null
        resizeCenterRef.current = null
        resizingPathIndicesRef.current = new Set()
        originalCommandsRef.current.clear()
        isInteractingRef.current = false
        return
      }

      // Handle rotation end (supports multi-path selection)
      if (isRotating && rotationCenterRef.current && rotatingPathIndicesRef.current.size > 0) {
        const coords = getTouchCoordinates(e, rect)
        const svgPos = screenToSvg(coords.screenX, coords.screenY)
        const center = rotationCenterRef.current

        // Calculate final delta angle
        const currentAngle = Math.atan2(svgPos.y - center.y, svgPos.x - center.x) * (180 / Math.PI)
        const deltaAngle = currentAngle - rotationStartAngle

        // Notify parent of final rotation (commit to history)
        onRotationChangeEnd?.(rotatingPathIndicesRef.current, deltaAngle, center)

        setIsRotating(false)
        rotationCenterRef.current = null
        currentRotationDeltaRef.current = 0 // Reset delta at end
        originalRotationsRef.current.clear()
        rotatingPathIndicesRef.current = new Set()
        isInteractingRef.current = false
        return
      }

      // End drag state
      if (dragState) {
        const coords = getTouchCoordinates(e, rect)
        const svgPos = screenToSvg(coords.screenX, coords.screenY)

        if (dragState.type === 'node') {
          onNodeMoveEnd(dragState.pathIndex, dragState.nodeIndex, svgPos.x, svgPos.y)
        } else if (dragState.type === 'control-point' && dragState.cpIndex !== undefined) {
          onControlPointMoveEnd(dragState.pathIndex, dragState.nodeIndex, dragState.cpIndex, svgPos.x, svgPos.y)
        } else if (dragState.type === 'multi-node' && selectedNodeIndices.size > 0) {
          const deltaX = svgPos.x - (dragState.startSvgX || 0)
          const deltaY = svgPos.y - (dragState.startSvgY || 0)
          onMultiNodeMoveEnd?.(dragState.pathIndex, selectedNodeIndices, deltaX, deltaY)
        } else if (dragState.type === 'path') {
          // Apply snap to final position (same logic as touch move)
          const rawDeltaX = svgPos.x - (dragState.startSvgX || 0)
          const rawDeltaY = svgPos.y - (dragState.startSvgY || 0)
          const currentScale = scaleRef.current
          const snapEnabled = gridSettings?.snapEnabled || (guidelines && guidelines.length > 0)

          if (snapEnabled && dragState.startBounds) {
            const currentBounds = {
              minX: dragState.startBounds.minX + rawDeltaX,
              minY: dragState.startBounds.minY + rawDeltaY,
              maxX: dragState.startBounds.maxX + rawDeltaX,
              maxY: dragState.startBounds.maxY + rawDeltaY,
            }
            const snapDelta = snapBounds(currentBounds, gridSettings ?? null, guidelines ?? [], currentScale)
            const deltaX = rawDeltaX + snapDelta.deltaX
            const deltaY = rawDeltaY + snapDelta.deltaY
            onPathMoveEnd?.(selectedPathIndices, deltaX, deltaY)
          } else {
            onPathMoveEnd?.(selectedPathIndices, rawDeltaX, rawDeltaY)
          }
        }

        setDragState(null)
        return
      }

      // Handle pending drag that didn't start (tap behavior)
      if (isPendingDrag) {
        // Tap completed without drag - selection was already set in handleTouchStart
        // No need to change selection, just clear pending state
        setIsPendingDrag(false)
        setPendingDragInfo(null)
        return
      }

      // Handle predefined shape drag end (same as mouse handler)
      if (editorMode === 'draw' && selectedPredefinedShape && shapeDragStart && shapeDragCurrent && onShapeDragEnd) {
        onShapeDragEnd(shapeDragStart, shapeDragCurrent)
        return
      }

      // Handle draw mode - check for closing path with curve first
      if (editorMode === 'draw' && closingNodeIndex !== null && drawDragStart) {
        if (isDrawDragging && drawDragCurrent) {
          // User dragged on a node - close with curve
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y
          const curveType = drawingCurveType === 'quadratic' ? 'quadratic' : 'cubic'
          onCloseDrawingPathWithCurve?.(closingNodeIndex, dx, dy, curveType)
        } else {
          // User tapped without dragging - close with straight line
          onCloseDrawingPath?.(closingNodeIndex)
        }

        // Reset close/drag state
        setClosingNodeIndex(null)
        setDrawDragStart(null)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
        setHoveredDrawingNodeIndex(null)
        return
      }

      // Handle draw mode (freehand/curves) - adding new points
      if (editorMode === 'draw' && drawDragStart) {
        if (isDrawDragging && drawDragCurrent) {
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y
          if (drawingCurveType === 'line') {
            onDrawPathClick?.(drawDragStart.x, drawDragStart.y)
          } else if (drawingCurveType === 'quadratic') {
            onDrawPathQuadratic?.(drawDragStart.x, drawDragStart.y, dx, dy)
          } else {
            onDrawPathCurve?.(drawDragStart.x, drawDragStart.y, dx, dy)
          }
        } else {
          onDrawPathClick?.(drawDragStart.x, drawDragStart.y)
        }
        setDrawDragStart(null)
        setDrawDragCurrent(null)
        setIsDrawDragging(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      commitViewport,
      dragState,
      screenToSvg,
      svgToScreen,
      onNodeMoveEnd,
      onControlPointMoveEnd,
      selectedNodeIndices,
      onMultiNodeMoveEnd,
      onPathMoveEnd,
      selectedPathIndices,
      gridSettings,
      guidelines,
      isPendingDrag,
      pendingDragInfo,
      setSelectedNodeIndices,
      editorMode,
      drawDragStart,
      isDrawDragging,
      drawDragCurrent,
      drawingCurveType,
      onDrawPathCurve,
      onDrawPathClick,
      onDrawPathQuadratic,
      onCloseDrawingPath,
      onCloseDrawingPathWithCurve,
      closingNodeIndex,
      isTouchSelectionMode,
      selectionRect,
      selectedPathIndex,
      parsedSvg,
      touchSelectionStart,
      // Predefined shape dependencies
      selectedPredefinedShape,
      shapeDragStart,
      shapeDragCurrent,
      onShapeDragEnd,
      // Selection rectangle path selection dependencies
      effectiveShiftPressed,
      onPathIndicesChange,
      // Resize/rotation dependencies
      isResizing,
      resizingHandle,
      onResizeChangeEnd,
      isRotating,
      rotationStartAngle,
      onRotationChangeEnd,
      // Guideline drag dependencies
      draggingGuidelineId,
      onGuidelineRemove,
    ]
  )

  // Handle touch cancel - reset all touch-related state
  const handleTouchCancel = useCallback(() => {
    // Delay clearing touch active flag to block synthesized mouse events
    setTimeout(() => {
      isTouchActiveRef.current = false
    }, 400)
    clearSvgLayerGestureTransform()
    setIsTouchSelectionMode(false)
    setTouchSelectionStart(null)
    setSelectionRect(null)
    setSelectionStart(null)
    isPanningRef.current = false
    isInteractingRef.current = false
    setIsPendingDrag(false)
    setPendingDragInfo(null)
    setDragState(null)
  }, [clearSvgLayerGestureTransform])

  return (
    <div ref={containerRef} className={styles.canvasContainer}>
      {/* Preview Background Layer - renders preview image from TemplateEditor */}
      {/* Rendered first (lowest in stack) so grid/viewBox overlay appears on top */}
      {/* Not rendered in overlay mode (raster image editing) as the raster image fills the workspace */}
      {!isOverlayMode && previewImageConfig && workspaceDimensions && (
        <PreviewBackgroundLayer
          ref={previewBackgroundLayerRef}
          config={previewImageConfig}
          scale={scale}
          offset={offset}
          workspaceDimensions={workspaceDimensions}
        />
      )}
      {/* Raster Background Layer - renders image in overlay mode */}
      {/* Rendered after preview but before grid canvas */}
      {isOverlayMode && imageInfo && (
        <RasterBackgroundLayer
          ref={rasterBackgroundLayerRef}
          imageInfo={imageInfo}
          scale={scale}
          offset={offset}
          colorAdjustments={imageColorAdjustments}
          showLockedIndicator={false}
          paths={parsedSvg.paths}
          clipPathIndices={clipPathIndices}
          holePathIndices={holePathIndices}
          adjustmentMasks={adjustmentMasks}
          workspaceDimensions={workspaceDimensions}
        />
      )}
      {/* Background canvas - draws viewBox overlay, border, and grid */}
      {/* Canvas dimensions are set programmatically in resize observer for HiDPI support */}
      <canvas ref={canvasRef} className={styles.canvas} />
      {/* SVG Preview Layer - renders paths with effects (z-index: 1, non-interactive) */}
      <SVGPreviewLayer
        ref={svgPreviewLayerRef}
        parsedSvg={parsedSvgExtended}
        scale={scale}
        offset={offset}
        width={canvasSize.width}
        height={canvasSize.height}
        effectGroups={effectGroups}
        holePathIndices={holePathIndices}
      />
      {/* Interaction canvas - draws nodes, handles, selection; captures events (z-index: 2) */}
      <canvas
        ref={interactionCanvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className={styles.interactionCanvas}
      />
      {/* Ruler overlay - displays rulers at top and left edges (z-index: 10) */}
      {editModeSettings?.showRuler && parsedSvg.viewBox && (
        <RulerOverlay
          canvasSize={canvasSize}
          scale={scale}
          offset={offset}
          viewBox={parsedSvg.viewBox}
          mousePosition={mousePositionSvg}
          onGuidelineCreate={handleGuidelineCreate}
          guidelines={guidelines ?? []}
          selectionBounds={getSelectedPathsUnifiedBoundsAndCenter()?.bounds}
        />
      )}
      {/* Zoom controls - bottom right of canvas */}
      <div className={styles.zoomControls}>
        <ButtonGroup variant="segmented">
          <Button icon={MinusIcon} variant="secondary" onClick={viewportZoomOut} accessibilityLabel={t('zoom-out')} />
          <Button
            icon={SearchIcon}
            variant="secondary"
            onClick={viewportResetZoom}
            accessibilityLabel={t('fit-to-view')}
          />
          <Button pressed={true} variant="secondary">{`${Math.round(scale * 100)}%`}</Button>
          <Button icon={PlusIcon} variant="secondary" onClick={viewportZoomIn} accessibilityLabel={t('zoom-in')} />
        </ButtonGroup>
      </div>
    </div>
  )
})

export default EditorCanvas
