/* eslint-disable max-lines */
import type { ShapeSelection } from '../../types'
import type { ViewPort, Dimension } from '~/types/template'
import styles from '../../styles.module.css'
import React, { useEffect, useCallback, useState, useRef } from 'react'
import { Spinner, Text, ButtonGroup, Button } from '@shopify/polaris'
import { CursorIcon, CornerSquareIcon, CornerRoundIcon, MaximizeIcon } from '@shopify/polaris-icons'
import { calculateOnZooming, calculateOnInitTemplate } from '~/utils/canvas/zoom'
import { MIN_SCALE } from '~/constants/canvas'
import { useCanvasState } from '../../hooks/useCanvasState'
import { useShapeDetection } from '../../hooks/useShapeDetection'
import { useTouchGestures } from '../../hooks/useTouchGestures'
import { redrawCanvas, drawCurrentSelection } from '../../utils/canvasDrawing'
import useDevices from '~/utils/hooks/useDevice'
import {
  isPointNearShapeEdge,
  constrainShape,
  getHandleAtPoint,
  getCursorForHandle,
  updateShapeWithHandle,
  isPointInShape,
  type HandleType,
} from '../../utils/shapeUtils'

interface InteractiveCanvasProps {
  imageUrl: string
  shapeSelections: ShapeSelection[]
  onShapeSelectionsChange: (selections: ShapeSelection[]) => void
  onError?: (error: string) => void
  onZoomChange?: (zoomState: { scale: number; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void }) => void
}

export default function InteractiveCanvas({
  imageUrl,
  shapeSelections,
  onShapeSelectionsChange,
  onError,
  onZoomChange,
}: InteractiveCanvasProps) {
  const { isMobileView } = useDevices()
  const {
    canvasRef,
    containerRef,
    imageLoaded,
    image,
    isDrawing,
    currentSelection,
    getCanvasContext,
    getCanvasCoordinates,
    startDrawing,
    updateDrawing,
    finishDrawing,
    getClickCoordinates,
    switchShapeType,
    setShapeType,
  } = useCanvasState(imageUrl, onError)

  const { detectAndCreateAllShapes } = useShapeDetection()

  // Zoom state management
  const [viewport, setViewport] = useState<ViewPort>({ scale: 1, left: 0, top: 0 })
  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [containerDimension, setContainerDimension] = useState<Dimension | null>(null)
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isWheeling, setIsWheeling] = useState(false)

  // Track if viewport has been initialized to prevent unwanted resets
  const viewportInitializedRef = useRef(false)

  // Ref for throttling redraws
  const redrawRequestRef = useRef<number | null>(null)

  // Refs to always have the latest state for performRedraw to avoid closure issues
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const shapeSelectionsRef = useRef(shapeSelections)
  shapeSelectionsRef.current = shapeSelections

  // Auto-detection state for managing the process
  const [autoDetectionCompleted, setAutoDetectionCompleted] = useState(false)

  const isDrawingRef = useRef(isDrawing)
  isDrawingRef.current = isDrawing

  const currentSelectionRef = useRef(currentSelection)
  currentSelectionRef.current = currentSelection

  // Function to resize canvas to match container dimensions
  const resizeCanvasToContainer = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return null

    // Use offsetWidth/offsetHeight instead of getBoundingClientRect to avoid reflows
    const newWidth = container.offsetWidth
    const newHeight = container.offsetHeight

    // Only resize if dimensions have actually changed
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      // Set canvas size to match container (this will clear the canvas)
      canvas.width = newWidth
      canvas.height = newHeight

      // Only update state when dimensions actually changed
      const newContainerDimension = { width: newWidth, height: newHeight }
      setContainerDimension(newContainerDimension)
      return newContainerDimension
    }

    // Return current dimensions if no change
    return { width: canvas.width, height: canvas.height }
  }, [canvasRef, containerRef])

  // Coordinate transformation functions - defined early to avoid initialization errors
  // Transform canvas pixel coordinates to image coordinates accounting for viewport
  const transformCanvasToImage = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } => {
      const { scale, left, top } = viewport

      // Apply the inverse of the viewport transformation to get image coordinates
      // This reverses what the canvas context does: ctx.translate(left, top) and ctx.scale(scale, scale)
      // Round to prevent floating-point precision issues that cause flickering when zoomed
      return {
        x: Math.round((canvasX - left) / scale),
        y: Math.round((canvasY - top) / scale),
      }
    },
    [viewport]
  )

  // Transform image coordinates to canvas pixel coordinates accounting for viewport
  const transformImageToCanvas = useCallback(
    (imageX: number, imageY: number): { x: number; y: number } => {
      const { scale, left, top } = viewport
      return {
        x: imageX * scale + left,
        y: imageY * scale + top,
      }
    },
    [viewport]
  )

  // Check if image coordinates are within valid image bounds
  const isWithinImageBounds = useCallback(
    (x: number, y: number): boolean => {
      if (!image) return false
      return x >= 0 && x <= image.width && y >= 0 && y <= image.height
    },
    [image]
  )

  // Shape movement state
  const [isMoving, setIsMoving] = useState(false)
  const [movingShapeIndex, setMovingShapeIndex] = useState<number | null>(null)
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  // Remove shift key state - we'll use toggle approach instead

  // Selected shape state for single selection
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null)

  // State to track if this is a legitimate drawing operation vs a simple click
  const [isIntentionalDrawing, setIsIntentionalDrawing] = useState(false)

  // Refs to avoid closure issues
  const selectedShapeIndexRef = useRef(selectedShapeIndex)
  selectedShapeIndexRef.current = selectedShapeIndex

  const isMovingRef = useRef(isMoving)
  isMovingRef.current = isMoving

  const movingShapeIndexRef = useRef(movingShapeIndex)
  movingShapeIndexRef.current = movingShapeIndex

  // Helper function to check if point is within shape boundaries (local implementation)
  const isPointInShapeLocal = useCallback((x: number, y: number, shape: ShapeSelection): boolean => {
    // Safety check: ensure shape exists and has required properties
    if (
      !shape
      || typeof shape.x !== 'number'
      || typeof shape.y !== 'number'
      || typeof shape.width !== 'number'
      || typeof shape.height !== 'number'
    ) {
      return false
    }

    // For hover detection, always use rectangular bounding box for both ellipses and rectangles
    // This eliminates flickering for ellipses and provides consistent behavior
    const inShape = x >= shape.x && x < shape.x + shape.width && y >= shape.y && y < shape.y + shape.height

    return inShape
  }, [])

  // Helper function to find shape at a specific point
  const findShapeAtPoint = useCallback(
    (x: number, y: number, shapes: ShapeSelection[]): number | null => {
      // Iterate through shapes in reverse order (top to bottom) to prioritize recently drawn shapes
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (isPointInShapeLocal(x, y, shapes[i])) {
          return i
        }
      }
      return null
    },
    [isPointInShapeLocal]
  )

  // Rectangle resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizingShapeIndex, setResizingShapeIndex] = useState<number | null>(null)
  const [resizeHandle, setResizeHandle] = useState<HandleType | null>(null)
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null)
  const [originalShape, setOriginalShape] = useState<ShapeSelection | null>(null)

  // Refs for resize state (must be after state declarations)
  const isResizingRef = useRef(isResizing)
  isResizingRef.current = isResizing

  const resizingShapeIndexRef = useRef(resizingShapeIndex)
  resizingShapeIndexRef.current = resizingShapeIndex

  // Helper function to trigger auto-detection and create all distinct image detail shapes
  const runAutoDetectionAndCreateShape = useCallback(() => {
    if (!image || autoDetectionCompleted || shapeSelections.length > 0) {
      return
    }

    const allDetectedShapes = detectAndCreateAllShapes(image)

    if (allDetectedShapes.length > 0) {
      // Create shape selections from all detected distinct image details
      const autoCreatedShapes: ShapeSelection[] = allDetectedShapes.map(detectedShape => ({
        ...detectedShape.boundingBox,
        type: 'rectangle' as const,
        source: 'auto-detected' as const,
        shapeId: detectedShape.id,
      }))

      onShapeSelectionsChange(autoCreatedShapes)

      // Auto-select the first shape if any were created
      if (autoCreatedShapes.length > 0) {
        setSelectedShapeIndex(0)
      }
    }

    setAutoDetectionCompleted(true)
  }, [image, autoDetectionCompleted, detectAndCreateAllShapes, onShapeSelectionsChange, shapeSelections])

  // Function to delete a shape by index
  const deleteShape = useCallback(
    (index: number) => {
      const shapeToDelete = shapeSelections[index]
      const updatedSelections = shapeSelections.filter((_, i) => i !== index)

      // If the deleted shape was originally auto-detected,
      // add a deletion marker to prevent it from reappearing
      if (shapeToDelete && shapeToDelete.source === 'auto-detected' && shapeToDelete.shapeId) {
        const deletedMarker: ShapeSelection = {
          ...shapeToDelete,
          source: 'deleted-auto-detected' as const,
          width: 0, // Make it invisible
          height: 0,
        }
        updatedSelections.push(deletedMarker)
      }

      // Clear selected shape state if the deleted shape was selected
      if (selectedShapeIndex === index) {
        setSelectedShapeIndex(null)
      }
      // Update selected shape index for remaining shapes if needed
      else if (selectedShapeIndex !== null && selectedShapeIndex > index) {
        setSelectedShapeIndex(selectedShapeIndex - 1)
      }

      onShapeSelectionsChange(updatedSelections)
    },
    [shapeSelections, onShapeSelectionsChange, selectedShapeIndex]
  )

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Alt/Option + d for deleting shapes and seed points
      if ((event.altKey || event.metaKey) && event.code === 'KeyD') {
        event.preventDefault()

        // Delete selected shape
        if (selectedShapeIndex !== null) {
          deleteShape(selectedShapeIndex)
          setSelectedShapeIndex(null)
        }
      }
    }

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedShapeIndex, deleteShape])

  // Handle click for shape selection and seed points
  const handleClick = useCallback(
    (x: number, y: number) => {
      if (!image) return

      // Check if click is within image boundaries
      if (!isWithinImageBounds(x, y)) {
        return // Don't create seed points or interact with shapes outside image
      }

      // Priority 1: Check if clicking on an existing user-drawn shape
      const clickedShapeIndex = findShapeAtPoint(x, y, shapeSelections)

      if (clickedShapeIndex !== null) {
        // Select this shape
        setSelectedShapeIndex(clickedShapeIndex)
        return
      }

      // Priority 2: Click outside all shapes - add seed point and deselect
      setSelectedShapeIndex(null)
    },
    // ESLint suppression: Intentionally omitting viewport, getCanvasCoordinates, transformCanvasToImage
    // to avoid recreating this callback on every viewport change. These are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, shapeSelections, selectedShapeIndex, onShapeSelectionsChange, findShapeAtPoint]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return

      const coords = getCanvasCoordinates(event)
      if (!coords) return

      // Transform canvas pixel coordinates to image coordinates considering viewport
      const { x, y } = transformCanvasToImage(coords.x, coords.y)

      // Check if mouse down is within image boundaries
      if (!isWithinImageBounds(x, y)) {
        return // Don't start any interactions outside image bounds
      }

      // Priority 1: Check if clicking on a resize handle of selected shape
      if (selectedShapeIndex !== null) {
        const selectedShape = shapeSelections[selectedShapeIndex]
        if (selectedShape) {
          const handleType = getHandleAtPoint(x, y, selectedShape, viewport.scale)
          if (handleType) {
            // Start resize operation for selected shape
            setIsResizing(true)
            setResizingShapeIndex(selectedShapeIndex)
            setResizeHandle(handleType)
            setResizeStartPos({ x, y })
            setOriginalShape(selectedShape)
            return
          }
        }
      }

      // Priority 2: Check if clicking on an edge of selected shape for movement
      if (selectedShapeIndex !== null) {
        const selectedShape = shapeSelections[selectedShapeIndex]
        if (selectedShape && isPointNearShapeEdge(x, y, selectedShape, 5, viewport.scale)) {
          // Start moving the selected shape
          setIsMoving(true)
          setMovingShapeIndex(selectedShapeIndex)
          setInitialMousePos({ x, y })
          setDragOffset({ x: x - selectedShape.x, y: y - selectedShape.y })
          return
        }
      }

      // Priority 3: Check if clicking on any existing shape
      // Note: x, y are already in image coordinates (transformed at line 400)
      const clickedShapeIndex = findShapeAtPoint(x, y, shapeSelections)
      if (clickedShapeIndex !== null) {
        // Clicking on a shape - this is a simple click, not drawing
        setIsIntentionalDrawing(false)
        return
      }

      // Priority 4: Start drawing a new shape - this is intentional drawing
      setIsIntentionalDrawing(true)
      setShapeType('rectangle')

      // Constrain starting coordinates to image bounds
      const constrainedImageCoords = {
        x: Math.max(0, Math.min(x, image.width)),
        y: Math.max(0, Math.min(y, image.height)),
      }

      // Convert constrained image coordinates back to canvas coordinates for drawing
      const constrainedCanvasCoords = transformImageToCanvas(constrainedImageCoords.x, constrainedImageCoords.y)

      // Use constrained canvas coordinates for drawing feedback to avoid double transformation
      startDrawing(constrainedCanvasCoords.x, constrainedCanvasCoords.y)
    },
    // ESLint suppression: Intentionally omitting viewport and transformation refs
    // to avoid recreating on viewport changes. These are stable transformation functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      image,
      getCanvasCoordinates,
      startDrawing,
      shapeSelections,
      selectedShapeIndex,
      findShapeAtPoint,
      transformCanvasToImage,
      onShapeSelectionsChange,
      setShapeType,
    ]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image || !canvasRef.current) return

      const coords = getCanvasCoordinates(event)
      if (!coords) return

      // Transform canvas pixel coordinates to image coordinates considering viewport
      const { x, y } = transformCanvasToImage(coords.x, coords.y)
      const canvas = canvasRef.current

      // If we're resizing a shape, handle that first
      if (isResizing && resizingShapeIndex !== null && resizeHandle && resizeStartPos && originalShape) {
        // Calculate mouse delta from resize start position
        const deltaX = x - resizeStartPos.x
        const deltaY = y - resizeStartPos.y

        // Use existing updateShapeWithHandle function to get updated shape
        const updatedShape = updateShapeWithHandle(originalShape, resizeHandle, deltaX, deltaY)

        // Apply boundary constraints if we have image dimensions
        const constrainedShape = image
          ? constrainShape(updatedShape, { width: image.width, height: image.height })
          : updatedShape

        // Update rectangle in real-time
        const updatedSelections = [...shapeSelections]
        updatedSelections[resizingShapeIndex] = constrainedShape
        onShapeSelectionsChange(updatedSelections)

        canvas.style.cursor = getCursorForHandle(resizeHandle)
      } else if (isMoving && movingShapeIndex !== null && initialMousePos && dragOffset) {
        // Calculate new position based on mouse movement
        const deltaX = x - initialMousePos.x
        const deltaY = y - initialMousePos.y

        const originalShape = shapeSelections[movingShapeIndex]
        const newShape = {
          ...originalShape,
          x: initialMousePos.x + deltaX - dragOffset.x,
          y: initialMousePos.y + deltaY - dragOffset.y,
        }

        // Constrain to canvas bounds if we have image dimensions
        const constrainedShape = image
          ? constrainShape(newShape, { width: image.width, height: image.height })
          : newShape

        // Update the shape in real-time
        const updatedSelections = [...shapeSelections]
        updatedSelections[movingShapeIndex] = constrainedShape
        onShapeSelectionsChange(updatedSelections)

        canvas.style.cursor = 'move'
      } else if (isDrawing) {
        // If we're drawing a selection, handle that
        // Constrain drawing coordinates to image bounds
        const constrainedImageCoords = {
          x: Math.max(0, Math.min(x, image.width)),
          y: Math.max(0, Math.min(y, image.height)),
        }

        // Convert constrained image coordinates back to canvas coordinates for drawing feedback
        const constrainedCanvasCoords = transformImageToCanvas(constrainedImageCoords.x, constrainedImageCoords.y)

        // Use constrained canvas coordinates for drawing feedback
        updateDrawing(constrainedCanvasCoords.x, constrainedCanvasCoords.y)
        // Let the normal redraw cycle handle the drawing feedback with proper viewport transformation
        canvas.style.cursor = 'crosshair'
      } else {
        // Check if mouse is within image bounds before processing hover detection
        if (!isWithinImageBounds(x, y)) {
          canvas.style.cursor = 'default'
          return
        }

        // No longer handle auto-detected shape hover in simplified approach

        // Determine cursor based on hover state
        let cursorStyle = 'crosshair' // Default for empty areas

        // Check if hovering anywhere within any shape (for handle display)
        // Use bounding box detection for consistent behavior and no flickering
        let anyShapeIndex: number | null = null
        for (let i = 0; i < shapeSelections.length; i++) {
          if (isPointInShapeLocal(x, y, shapeSelections[i])) {
            anyShapeIndex = i
            break
          }
        }

        if (anyShapeIndex !== null) {
          const hoveredShapeObj = shapeSelections[anyShapeIndex]
          const isSelectedShape = selectedShapeIndex === anyShapeIndex

          // Check if mouse is over a specific handle (only when not currently moving)
          if (!isMoving) {
            const handleType = getHandleAtPoint(x, y, hoveredShapeObj, viewport.scale)
            if (handleType) {
              // Handle has highest priority - override any other cursor
              cursorStyle = getCursorForHandle(handleType)
            } else {
              // Only check edge/interior if we're NOT over a handle
              // For selected shapes, only check edges to avoid conflict with handles
              const edgeThreshold = isSelectedShape ? 3 : 5 // Smaller threshold for selected shapes
              const isOverEdge = isPointNearShapeEdge(x, y, hoveredShapeObj, edgeThreshold, viewport.scale)
              if (isOverEdge && isSelectedShape) {
                // For selected shapes, only show move cursor on edges
                cursorStyle = 'move'
              } else if (isOverEdge && !isSelectedShape) {
                // For unselected shapes, edges are not interactive
                cursorStyle = 'pointer'
              } else {
                // Interior cursor behavior
                if (isSelectedShape) {
                  // Selected shape: crosshair for seed points
                  cursorStyle = 'crosshair'
                } else {
                  // Unselected shape: pointer for selection
                  cursorStyle = 'pointer'
                }
              }
            }
          } else {
            cursorStyle = 'move'
          }
        }

        canvas.style.cursor = cursorStyle
      }
    },
    // ESLint suppression: Intentionally omitting viewport and transformation functions
    // to avoid recreating on every viewport/state change. Using refs for stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      image,
      canvasRef,
      getCanvasCoordinates,
      getCanvasContext,
      isResizing,
      resizingShapeIndex,
      resizeHandle,
      resizeStartPos,
      originalShape,
      isMoving,
      movingShapeIndex,
      initialMousePos,
      dragOffset,
      shapeSelections,
      onShapeSelectionsChange,
      isDrawing,
      currentSelection,
      updateDrawing,
      transformCanvasToImage,
      viewport,
      selectedShapeIndex,
    ]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return

      // If we were resizing a shape, complete the resize
      if (isResizing) {
        setIsResizing(false)
        setResizingShapeIndex(null)
        setResizeHandle(null)
        setResizeStartPos(null)
        setOriginalShape(null)
        return
      }

      // If we were moving a rectangle, complete the movement
      if (isMoving) {
        setIsMoving(false)
        setMovingShapeIndex(null)
        setInitialMousePos(null)
        setDragOffset(null)
        return
      }

      // Handle drawing completion
      const finalSelection = finishDrawing()
      if (finalSelection && isIntentionalDrawing) {
        // Only create new shapes for intentional drawing operations
        // Convert canvas coordinates back to image coordinates for final shape
        const imageTopLeft = transformCanvasToImage(finalSelection.x, finalSelection.y)
        const imageBottomRight = transformCanvasToImage(
          finalSelection.x + finalSelection.width,
          finalSelection.y + finalSelection.height
        )

        // Create new shape selection preserving the original type with image coordinates
        const newManualShape = {
          x: imageTopLeft.x,
          y: imageTopLeft.y,
          width: imageBottomRight.x - imageTopLeft.x,
          height: imageBottomRight.y - imageTopLeft.y,
          type: finalSelection.type,
          source: 'manual' as const,
          shapeId: finalSelection.type === 'ellipse' ? `ellipse-${Date.now()}` : `rectangle-${Date.now()}`,
        }
        onShapeSelectionsChange([...shapeSelections, newManualShape])
      } else {
        // Handle clicks that result in seed points or shape selection
        // For non-drawing interactions, always try to handle as a click
        const clickCoords = getClickCoordinates()
        if (clickCoords || !isIntentionalDrawing) {
          // Get the actual coordinates from the current mouse position
          const canvasCoords = getCanvasCoordinates(event)
          if (canvasCoords) {
            const imageCoords = transformCanvasToImage(canvasCoords.x, canvasCoords.y)
            handleClick(imageCoords.x, imageCoords.y)
          }
        }
      }

      // Reset the drawing intention flag
      setIsIntentionalDrawing(false)
    },
    [
      image,
      isResizing,
      isMoving,
      finishDrawing,
      shapeSelections,
      onShapeSelectionsChange,
      getClickCoordinates,
      handleClick,
      transformCanvasToImage,
      isIntentionalDrawing,
      getCanvasCoordinates,
    ]
  )

  // Initialize canvas size and zoom when image loads
  useEffect(() => {
    if (image && imageLoaded && canvasRef.current && containerRef.current) {
      // Set image dimension for zoom calculations
      setDimension({ width: image.width, height: image.height })

      // Resize canvas to match container
      const containerDims = resizeCanvasToContainer()
      if (!containerDims) {
        return
      }

      // Only initialize viewport if it hasn't been set yet
      // This prevents zoom reset during component updates/remounts
      if (!viewportInitializedRef.current) {
        // Calculate initial viewport to fit image in container
        const initialViewport = calculateOnInitTemplate(
          containerDims.width,
          containerDims.height,
          { width: image.width, height: image.height },
          false // Don't scale up smaller images
        )

        setViewport(initialViewport)
        viewportInitializedRef.current = true
      }

      // Run auto-detection and create first shape
      runAutoDetectionAndCreateShape()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, imageLoaded, runAutoDetectionAndCreateShape])

  // Reset auto-detection when shapes are cleared (for reset functionality)
  useEffect(() => {
    if (shapeSelections.length === 0 && autoDetectionCompleted && image) {
      setAutoDetectionCompleted(false)
      // Trigger auto-detection again after reset
      setTimeout(() => {
        runAutoDetectionAndCreateShape()
      }, 100)
    }
  }, [shapeSelections.length, autoDetectionCompleted, image, runAutoDetectionAndCreateShape])

  // Shift key toggle for shape type switching during drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only toggle shape type if we're currently drawing
      if (e.key === 'Shift' && isDrawing && currentSelection) {
        // Prevent browser default behavior
        e.preventDefault()
        // Toggle between rectangle and ellipse based on current type
        const newType = currentSelection.type === 'rectangle' ? 'ellipse' : 'rectangle'
        switchShapeType(newType)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawing, currentSelection, switchShapeType])

  // Zoom bounds checking using container dimensions
  const isWithinBounds = useCallback(
    (newViewport: ViewPort): boolean => {
      if (!dimension || !containerDimension) return true

      const { left, top, scale } = newViewport

      const scaledWidth = dimension.width * scale
      const scaledHeight = dimension.height * scale

      // Calculate visible area percentages using container dimensions
      const visibleWidth = Math.min(containerDimension.width, scaledWidth + left) - Math.max(0, left)
      const visibleHeight = Math.min(containerDimension.height, scaledHeight + top) - Math.max(0, top)

      const visiblePercentageWidth = (visibleWidth / scaledWidth) * 100
      const visiblePercentageHeight = (visibleHeight / scaledHeight) * 100

      // At least 5% must be visible in both dimensions
      return visiblePercentageWidth >= 5 && visiblePercentageHeight >= 5
    },
    [dimension, containerDimension]
  )

  // Wheel event handler for zoom and panning
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is handled by native event listener to avoid passive warnings

      const isZooming = event.ctrlKey || event.metaKey
      const { scale, left, top } = viewport

      if (!dimension) return

      // Clear any existing timeout
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
      }

      // Set wheeling state
      if (!isWheeling) {
        setIsWheeling(true)
      }

      if (isZooming) {
        // Handle zoom
        const newViewport = calculateOnZooming({
          e: event.nativeEvent,
          oldScale: scale,
          oldLeft: left,
          oldTop: top,
          speedFactor: 0.8,
        })

        // Enforce minimum scale
        if (newViewport.scale < MIN_SCALE) {
          newViewport.scale = MIN_SCALE
        }

        // Only update if within bounds
        if (isWithinBounds(newViewport)) {
          setViewport(newViewport)
        }
      } else {
        // Handle panning
        const panSpeed = 1.0
        const newLeft = left - event.deltaX * panSpeed
        const newTop = top - event.deltaY * panSpeed

        const newViewport = { scale, left: newLeft, top: newTop }

        // Only update if within bounds
        if (isWithinBounds(newViewport)) {
          setViewport(newViewport)
        }
      }

      // Reset wheeling state after timeout
      wheelTimeoutRef.current = setTimeout(() => {
        setIsWheeling(false)
      }, 100)
    },
    [viewport, dimension, isWheeling, isWithinBounds]
  )

  // Touch gesture handlers for mobile
  const handleTouchPinchZoom = useCallback(
    (scaleDelta: number, centerX: number, centerY: number) => {
      if (!dimension || !containerDimension) return

      const { scale, left, top } = viewport
      const newScale = Math.max(MIN_SCALE, Math.min(5.0, scale * scaleDelta))

      // Calculate new viewport position to zoom towards the touch center
      const scaleChange = newScale / scale
      const newLeft = centerX - (centerX - left) * scaleChange
      const newTop = centerY - (centerY - top) * scaleChange

      const newViewport = { scale: newScale, left: newLeft, top: newTop }

      if (isWithinBounds(newViewport)) {
        setViewport(newViewport)
      }
    },
    [viewport, dimension, containerDimension, isWithinBounds]
  )

  const handleTouchPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const { scale, left, top } = viewport
      const newLeft = left + deltaX
      const newTop = top + deltaY

      const newViewport = { scale, left: newLeft, top: newTop }

      if (isWithinBounds(newViewport)) {
        setViewport(newViewport)
      }
    },
    [viewport, isWithinBounds]
  )

  const handleTouchTap = useCallback(
    (x: number, y: number) => {
      // Convert touch coordinates to image coordinates
      const imageCoords = transformCanvasToImage(x, y)
      if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return

      // Check if tapping on a shape
      const shapeIndex = findShapeAtPoint(imageCoords.x, imageCoords.y, shapeSelections)

      if (shapeIndex !== null) {
        // Select the shape
        setSelectedShapeIndex(shapeIndex)
      }
    },
    [transformCanvasToImage, isWithinImageBounds, findShapeAtPoint, shapeSelections]
  )

  const handleTouchTapAndHold = useCallback(
    (x: number, y: number) => {
      // Convert touch coordinates to image coordinates
      const imageCoords = transformCanvasToImage(x, y)
      if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return

      // Check if we're over a shape for deletion
      const shapeIndex = findShapeAtPoint(imageCoords.x, imageCoords.y, shapeSelections)
      if (shapeIndex !== null) {
        deleteShape(shapeIndex)
        return
      }

      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    },
    [transformCanvasToImage, isWithinImageBounds, findShapeAtPoint, shapeSelections, deleteShape]
  )

  // Mobile touch drawing state to prevent conflicts with gestures
  const [isTouchDrawing, setIsTouchDrawing] = useState(false)
  // Mobile interaction mode: 'pan', 'rectangle', 'ellipse', or 'manipulate'
  // In manipulate mode, move/resize is automatically detected based on touch location
  const [mobileMode, setMobileMode] = useState<'pan' | 'rectangle' | 'ellipse' | 'manipulate'>('pan')
  // Track if user has interacted with canvas (to hide hint)
  const [hasInteracted, setHasInteracted] = useState(false)
  // Mobile touch manipulation state
  const [isTouchMoving, setIsTouchMoving] = useState(false)
  const [isTouchResizing, setIsTouchResizing] = useState(false)
  const [touchResizeHandle, setTouchResizeHandle] = useState<HandleType | null>(null)

  // Helper function to check if touch point is over interactive elements (shapes or seed points)
  const isOverInteractiveElement = useCallback(
    (x: number, y: number): boolean => {
      if (!image) return false

      // Transform canvas coordinates to image coordinates
      const imageCoords = transformCanvasToImage(x, y)

      // Check if over any shapes
      const shapeIndex = findShapeAtPoint(imageCoords.x, imageCoords.y, shapeSelections)
      if (shapeIndex !== null) return true

      return false
    },
    [image, transformCanvasToImage, findShapeAtPoint, shapeSelections]
  )

  // Handle touch start for drawing on mobile
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!isMobileView || !image) return

      // Prevent default to avoid scrolling
      event.preventDefault()

      // Mark that user has interacted
      setHasInteracted(true)

      if (event.touches.length === 1) {
        const touch = event.touches[0]
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const canvasX = touch.clientX - rect.left
        const canvasY = touch.clientY - rect.top

        // Transform to image coordinates
        const imageCoords = transformCanvasToImage(canvasX, canvasY)

        // Check if within image bounds
        if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return

        // Handle different modes
        if (mobileMode === 'rectangle' || mobileMode === 'ellipse') {
          // Drawing mode
          setIsTouchDrawing(true)

          // Determine the shape type based on mobile mode
          const shapeToUse = mobileMode === 'ellipse' ? 'ellipse' : 'rectangle'

          // Constrain starting coordinates to image bounds
          const constrainedImageCoords = {
            x: Math.max(0, Math.min(imageCoords.x, image.width)),
            y: Math.max(0, Math.min(imageCoords.y, image.height)),
          }

          // Convert back to canvas coordinates for drawing
          const constrainedCanvasCoords = transformImageToCanvas(constrainedImageCoords.x, constrainedImageCoords.y)

          // Pass shape type directly to startDrawing
          startDrawing(constrainedCanvasCoords.x, constrainedCanvasCoords.y, shapeToUse)
        } else if (mobileMode === 'manipulate' && selectedShapeIndex !== null) {
          // Manipulate mode - automatically detect move vs resize based on touch location
          const selectedShape = shapeSelections[selectedShapeIndex]
          if (selectedShape) {
            // First check if touching a resize handle (priority)
            const mobileScale = viewport.scale
            const handleType = getHandleAtPoint(
              imageCoords.x,
              imageCoords.y,
              selectedShape,
              mobileScale,
              true // Use mobile handle sizes
            )

            if (handleType) {
              // Start resize operation
              setIsTouchResizing(true)
              setResizingShapeIndex(selectedShapeIndex)
              setTouchResizeHandle(handleType)
              setResizeStartPos(imageCoords)
              setOriginalShape(selectedShape)
            } else if (isPointInShape(imageCoords.x, imageCoords.y, selectedShape)) {
              // Start move operation
              setIsTouchMoving(true)
              setMovingShapeIndex(selectedShapeIndex)
              setInitialMousePos(imageCoords)
              setDragOffset({ x: imageCoords.x - selectedShape.x, y: imageCoords.y - selectedShape.y })
            }
          }
        }
      }
    },
    [
      isMobileView,
      image,
      canvasRef,
      transformCanvasToImage,
      isWithinImageBounds,
      mobileMode,
      transformImageToCanvas,
      startDrawing,
      selectedShapeIndex,
      shapeSelections,
      viewport.scale,
    ]
  )

  // Handle touch move for drawing on mobile
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isMobileView || !image) return
      if (!isTouchDrawing && !isTouchMoving && !isTouchResizing) return

      // Prevent default to avoid scrolling
      event.preventDefault()

      if (event.touches.length === 1) {
        const touch = event.touches[0]
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const canvasX = touch.clientX - rect.left
        const canvasY = touch.clientY - rect.top

        // Transform to image coordinates
        const imageCoords = transformCanvasToImage(canvasX, canvasY)

        if (isTouchDrawing) {
          // Handle drawing
          const constrainedImageCoords = {
            x: Math.max(0, Math.min(imageCoords.x, image.width)),
            y: Math.max(0, Math.min(imageCoords.y, image.height)),
          }

          // Convert back to canvas coordinates for drawing
          const constrainedCanvasCoords = transformImageToCanvas(constrainedImageCoords.x, constrainedImageCoords.y)
          updateDrawing(constrainedCanvasCoords.x, constrainedCanvasCoords.y)
        } else if (isTouchMoving && movingShapeIndex !== null && initialMousePos && dragOffset) {
          // Handle moving
          const deltaX = imageCoords.x - initialMousePos.x
          const deltaY = imageCoords.y - initialMousePos.y

          const originalShape = shapeSelections[movingShapeIndex]
          const newShape = {
            ...originalShape,
            x: initialMousePos.x + deltaX - dragOffset.x,
            y: initialMousePos.y + deltaY - dragOffset.y,
          }

          // Constrain to canvas bounds
          const constrainedShape = constrainShape(newShape, { width: image.width, height: image.height })

          // Update the shape in real-time
          const updatedSelections = [...shapeSelections]
          updatedSelections[movingShapeIndex] = constrainedShape
          onShapeSelectionsChange(updatedSelections)
        } else if (
          isTouchResizing
          && resizingShapeIndex !== null
          && touchResizeHandle
          && resizeStartPos
          && originalShape
        ) {
          // Handle resizing
          const deltaX = imageCoords.x - resizeStartPos.x
          const deltaY = imageCoords.y - resizeStartPos.y

          // Use existing updateShapeWithHandle function to get updated shape
          const updatedShape = updateShapeWithHandle(originalShape, touchResizeHandle, deltaX, deltaY)

          // Apply boundary constraints
          const constrainedShape = constrainShape(updatedShape, { width: image.width, height: image.height })

          // Update shape in real-time
          const updatedSelections = [...shapeSelections]
          updatedSelections[resizingShapeIndex] = constrainedShape
          onShapeSelectionsChange(updatedSelections)
        }
      }
    },
    [
      isMobileView,
      image,
      isTouchDrawing,
      isTouchMoving,
      isTouchResizing,
      canvasRef,
      transformCanvasToImage,
      transformImageToCanvas,
      updateDrawing,
      movingShapeIndex,
      initialMousePos,
      dragOffset,
      shapeSelections,
      resizingShapeIndex,
      touchResizeHandle,
      resizeStartPos,
      originalShape,
      onShapeSelectionsChange,
    ]
  )

  // Handle touch end for drawing on mobile
  const handleTouchEnd = useCallback(() => {
    if (!isMobileView) return

    if (isTouchDrawing) {
      setIsTouchDrawing(false)

      // Complete the drawing
      const finalSelection = finishDrawing()
      if (finalSelection) {
        // Convert canvas coordinates back to image coordinates for final shape
        const imageTopLeft = transformCanvasToImage(finalSelection.x, finalSelection.y)
        const imageBottomRight = transformCanvasToImage(
          finalSelection.x + finalSelection.width,
          finalSelection.y + finalSelection.height
        )

        // Create new shape selection with image coordinates
        const newManualShape = {
          x: imageTopLeft.x,
          y: imageTopLeft.y,
          width: imageBottomRight.x - imageTopLeft.x,
          height: imageBottomRight.y - imageTopLeft.y,
          type: finalSelection.type,
          source: 'manual' as const,
          shapeId: finalSelection.type === 'ellipse' ? `ellipse-${Date.now()}` : `rectangle-${Date.now()}`,
        }
        onShapeSelectionsChange([...shapeSelections, newManualShape])
      }
    }

    // Reset move state
    if (isTouchMoving) {
      setIsTouchMoving(false)
      setMovingShapeIndex(null)
      setInitialMousePos(null)
      setDragOffset(null)
    }

    // Reset resize state
    if (isTouchResizing) {
      setIsTouchResizing(false)
      setResizingShapeIndex(null)
      setTouchResizeHandle(null)
      setResizeStartPos(null)
      setOriginalShape(null)
    }
  }, [
    isMobileView,
    isTouchDrawing,
    isTouchMoving,
    isTouchResizing,
    finishDrawing,
    transformCanvasToImage,
    shapeSelections,
    onShapeSelectionsChange,
  ])

  // Setup touch event listeners for mobile drawing
  useEffect(() => {
    if (!isMobileView) return

    const canvas = canvasRef.current
    if (!canvas) return

    const touchStartHandler = (e: TouchEvent) => handleTouchStart(e)
    const touchMoveHandler = (e: TouchEvent) => handleTouchMove(e)
    const touchEndHandler = () => handleTouchEnd()

    canvas.addEventListener('touchstart', touchStartHandler, { passive: false })
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false })
    canvas.addEventListener('touchend', touchEndHandler, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', touchStartHandler)
      canvas.removeEventListener('touchmove', touchMoveHandler)
      canvas.removeEventListener('touchend', touchEndHandler)
    }
  }, [isMobileView, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef])

  // Initialize touch gestures for mobile (only when not drawing and not over interactive elements)
  useTouchGestures(
    canvasRef,
    {
      onPinchZoom: handleTouchPinchZoom,
      onPan: mobileMode === 'pan' ? handleTouchPan : undefined, // Only pan in pan mode
      onTap: (x, y) => {
        // Mark interaction and handle tap
        setHasInteracted(true)
        handleTouchTap(x, y)
      },
      onTapAndHold: (x, y) => {
        // Mark interaction
        setHasInteracted(true)

        // For tap and hold in drawing modes, start drawing in empty areas
        if (!isOverInteractiveElement(x, y) && (mobileMode === 'rectangle' || mobileMode === 'ellipse')) {
          // Start drawing mode for tap and hold in empty areas
          const imageCoords = transformCanvasToImage(x, y)
          if (isWithinImageBounds(imageCoords.x, imageCoords.y)) {
            setIsTouchDrawing(true)

            // Determine the shape type based on mobile mode
            const shapeToUse = mobileMode === 'ellipse' ? 'ellipse' : 'rectangle'

            // Constrain starting coordinates to image bounds
            const constrainedImageCoords = {
              x: Math.max(0, Math.min(imageCoords.x, image?.width || 0)),
              y: Math.max(0, Math.min(imageCoords.y, image?.height || 0)),
            }

            // Convert back to canvas coordinates for drawing
            const constrainedCanvasCoords = transformImageToCanvas(constrainedImageCoords.x, constrainedImageCoords.y)

            // Pass shape type directly to startDrawing
            startDrawing(constrainedCanvasCoords.x, constrainedCanvasCoords.y, shapeToUse)
          }
        } else {
          // Use original tap and hold behavior for interactive elements or pan mode
          handleTouchTapAndHold(x, y)
        }
      },
    },
    {
      enabled: isMobileView && !isTouchDrawing,
      tapHoldDelay: 600,
      minPinchDistance: 20,
      panThreshold: 8,
    }
  )

  // Zoom utility functions using container dimensions
  const zoomIn = useCallback(() => {
    const newScale = Math.min(viewport.scale * 1.25, 5.0)
    if (!containerDimension || !dimension) return

    const centerX = containerDimension.width / 2
    const centerY = containerDimension.height / 2

    const speed = newScale / viewport.scale - 1
    const newLeft = centerX - (centerX - viewport.left) * (1 + speed)
    const newTop = centerY - (centerY - viewport.top) * (1 + speed)

    const newViewport = { scale: newScale, left: newLeft, top: newTop }
    if (isWithinBounds(newViewport)) {
      setViewport(newViewport)
    }
  }, [viewport, containerDimension, dimension, isWithinBounds])

  const zoomOut = useCallback(() => {
    const newScale = Math.max(viewport.scale / 1.25, MIN_SCALE)
    if (!containerDimension || !dimension) return

    const centerX = containerDimension.width / 2
    const centerY = containerDimension.height / 2

    const speed = newScale / viewport.scale - 1
    const newLeft = centerX - (centerX - viewport.left) * (1 + speed)
    const newTop = centerY - (centerY - viewport.top) * (1 + speed)

    const newViewport = { scale: newScale, left: newLeft, top: newTop }
    if (isWithinBounds(newViewport)) {
      setViewport(newViewport)
    }
  }, [viewport, containerDimension, dimension, isWithinBounds])

  const resetZoom = useCallback(() => {
    if (!containerDimension || !dimension) return

    const initialViewport = calculateOnInitTemplate(
      containerDimension.width,
      containerDimension.height,
      { width: dimension.width, height: dimension.height },
      false
    )
    setViewport(initialViewport)
  }, [containerDimension, dimension])

  // Notify parent of zoom state changes
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange({
        scale: viewport.scale,
        zoomIn,
        zoomOut,
        resetZoom,
      })
    }
  }, [viewport.scale, zoomIn, zoomOut, resetZoom, onZoomChange])

  // Add wheel event listener to prevent browser zoom
  useEffect(() => {
    const canvas = canvasRef.current
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
  }, [canvasRef])

  // TODO(EMTKIT-XXXX): Re-enable ResizeObserver after fixing coordinate transformation issues
  // Container resize handling was disabled due to viewport calculation bugs

  // Redraw function that always uses current state via refs - avoids all closure issues
  const performRedraw = () => {
    if (!canvasRef.current || !image) return

    const ctx = getCanvasContext()
    if (ctx) {
      // Single function call handles all drawing in correct order
      // Show handles only when a shape is selected, but hide them when moving or resizing
      const showHandlesShape
        = isMovingRef.current || isResizingRef.current
          ? null
          : selectedShapeIndexRef.current !== null
            ? { type: 'shape' as const, index: selectedShapeIndexRef.current }
            : null

      // Use all refs to ensure we always have the latest state
      redrawCanvas(ctx, image, shapeSelectionsRef.current, showHandlesShape, viewportRef.current, isMobileView)

      // Draw current selection being drawn (ellipse or rectangle preview)
      if (isDrawingRef.current && currentSelectionRef.current) {
        // Draw drawing feedback in canvas coordinates (no viewport transformation needed)
        ctx.save()
        // Reset transformations to draw in canvas coordinates
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        drawCurrentSelection(ctx, currentSelectionRef.current)
        ctx.restore()
      }

      // Add special visual feedback for rectangle being moved
      if (isMovingRef.current && movingShapeIndexRef.current !== null) {
        const movingRect = shapeSelectionsRef.current[movingShapeIndexRef.current]
        if (movingRect && movingRect.type === 'rectangle') {
          // Draw a highlighted border for the moving rectangle using viewport-aware coordinates
          ctx.save()

          // Apply viewport transformation before drawing the feedback
          ctx.translate(viewportRef.current.left, viewportRef.current.top)
          ctx.scale(viewportRef.current.scale, viewportRef.current.scale)

          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2 / viewportRef.current.scale // Scale line width for zoom consistency
          ctx.setLineDash([5 / viewportRef.current.scale, 5 / viewportRef.current.scale])
          ctx.strokeRect(movingRect.x, movingRect.y, movingRect.width, movingRect.height)
          ctx.restore()
        } else if (movingRect && movingRect.type === 'ellipse') {
          // Draw a highlighted border for the moving ellipse
          ctx.save()

          // Apply viewport transformation before drawing the feedback
          ctx.translate(viewportRef.current.left, viewportRef.current.top)
          ctx.scale(viewportRef.current.scale, viewportRef.current.scale)

          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2 / viewportRef.current.scale
          ctx.setLineDash([5 / viewportRef.current.scale, 5 / viewportRef.current.scale])

          // Draw ellipse
          ctx.beginPath()
          ctx.ellipse(
            movingRect.x + movingRect.width / 2,
            movingRect.y + movingRect.height / 2,
            movingRect.width / 2,
            movingRect.height / 2,
            0,
            0,
            2 * Math.PI
          )
          ctx.stroke()
          ctx.restore()
        }
      }

      // Add special visual feedback for shape being resized
      if (isResizingRef.current && resizingShapeIndexRef.current !== null) {
        const resizingShape = shapeSelectionsRef.current[resizingShapeIndexRef.current]
        if (resizingShape && resizingShape.type === 'rectangle') {
          // Draw a highlighted border for the resizing rectangle using viewport-aware coordinates
          ctx.save()

          // Apply viewport transformation before drawing the feedback
          ctx.translate(viewportRef.current.left, viewportRef.current.top)
          ctx.scale(viewportRef.current.scale, viewportRef.current.scale)

          ctx.strokeStyle = '#ff6600'
          ctx.lineWidth = 2 / viewportRef.current.scale // Scale line width for zoom consistency
          ctx.setLineDash([3 / viewportRef.current.scale, 3 / viewportRef.current.scale])
          ctx.strokeRect(resizingShape.x, resizingShape.y, resizingShape.width, resizingShape.height)
          ctx.restore()
        } else if (resizingShape && resizingShape.type === 'ellipse') {
          // Draw a highlighted border for the resizing ellipse
          ctx.save()

          // Apply viewport transformation before drawing the feedback
          ctx.translate(viewportRef.current.left, viewportRef.current.top)
          ctx.scale(viewportRef.current.scale, viewportRef.current.scale)

          ctx.strokeStyle = '#ff6600'
          ctx.lineWidth = 2 / viewportRef.current.scale
          ctx.setLineDash([3 / viewportRef.current.scale, 3 / viewportRef.current.scale])

          // Draw ellipse
          ctx.beginPath()
          ctx.ellipse(
            resizingShape.x + resizingShape.width / 2,
            resizingShape.y + resizingShape.height / 2,
            resizingShape.width / 2,
            resizingShape.height / 2,
            0,
            0,
            2 * Math.PI
          )
          ctx.stroke()
          ctx.restore()
        }
      }
    }
  }

  // Redraw canvas when relevant state changes
  useEffect(() => {
    // Cancel any pending redraw
    if (redrawRequestRef.current) {
      cancelAnimationFrame(redrawRequestRef.current)
    }

    // Schedule a new redraw
    redrawRequestRef.current = requestAnimationFrame(performRedraw)

    // Cleanup on unmount
    return () => {
      if (redrawRequestRef.current) {
        cancelAnimationFrame(redrawRequestRef.current)
      }
    }
    // ESLint suppression: performRedraw uses refs to access current state, avoiding closure issues.
    // Including performRedraw in deps would cause infinite loop. This pattern is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shapeSelections,
    image,
    canvasRef,
    getCanvasContext,
    isDrawing,
    currentSelection,
    isMoving,
    movingShapeIndex,
    isResizing,
    resizingShapeIndex,
    selectedShapeIndex,
    viewport,
  ])

  return (
    <div className={styles.canvasContainer} ref={containerRef}>
      {!imageLoaded && (
        <div className={styles.loading}>
          <Spinner size="large" />
          <Text variant="bodyMd" as="p">
            Loading image...
          </Text>
        </div>
      )}

      {/* Mobile Mode Selector */}
      {isMobileView && imageLoaded && (
        <div className={styles.mobileDrawingModeToggle}>
          <ButtonGroup variant="segmented">
            <Button
              pressed={mobileMode === 'pan'}
              onClick={() => {
                setMobileMode('pan')
                setHasInteracted(false)
              }}
              size="slim"
              icon={CursorIcon}
              accessibilityLabel="Select and pan mode"
            />
            <Button
              pressed={mobileMode === 'rectangle'}
              onClick={() => {
                setMobileMode('rectangle')
                setHasInteracted(false)
              }}
              size="slim"
              icon={CornerSquareIcon}
              accessibilityLabel="Draw rectangles"
            />
            <Button
              pressed={mobileMode === 'ellipse'}
              onClick={() => {
                setMobileMode('ellipse')
                setHasInteracted(false)
              }}
              size="slim"
              icon={CornerRoundIcon}
              accessibilityLabel="Draw ellipses"
            />
            <Button
              pressed={mobileMode === 'manipulate'}
              onClick={() => {
                setMobileMode('manipulate')
                setHasInteracted(false)
              }}
              size="slim"
              icon={MaximizeIcon}
              accessibilityLabel="Move and resize shapes"
              disabled={selectedShapeIndex === null}
            />
          </ButtonGroup>

          {/* Mode-specific hint that hides after interaction */}
          {!hasInteracted && !isTouchDrawing && !isTouchMoving && !isTouchResizing && (
            <div className={styles.drawingModeHint}>
              {mobileMode === 'pan'
                ? 'Tap to select shapes or add seed points.'
                : mobileMode === 'rectangle'
                  ? 'Drag to draw rectangles.'
                  : mobileMode === 'ellipse'
                    ? 'Drag to draw ellipses.'
                    : 'Drag shape to move, handles to resize.'}
            </div>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          display: imageLoaded ? 'block' : 'none',
          touchAction: isMobileView ? 'manipulation' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      />
    </div>
  )
}
