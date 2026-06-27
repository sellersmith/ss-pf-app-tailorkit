import { useState, useRef, useEffect, useCallback } from 'react'
import type { ShapeSelection } from '../types'
import { createRectangularShape, createEllipseShape } from '../utils/shapeUtils'

/**
 * Hook for managing canvas state and image loading
 */
export function useCanvasState(imageUrl: string, onError?: (error: string) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [imageLoaded, setImageLoaded] = useState(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<ShapeSelection | null>(null)
  const [currentShapeType, setCurrentShapeType] = useState<'rectangle' | 'ellipse'>('rectangle')

  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null)
  const [hasMouseMoved, setHasMouseMoved] = useState(false)

  /**
   * Get canvas context
   */
  const getCanvasContext = useCallback(() => {
    return canvasRef.current?.getContext('2d') || null
  }, [])

  /**
   * Get canvas coordinates from mouse event
   */
  const getCanvasCoordinates = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return null

    const rect = canvas.getBoundingClientRect()

    // In container-based system, canvas pixel coordinates should map directly
    // to canvas element coordinates since the canvas now fills the container
    const x = Math.round(event.clientX - rect.left)
    const y = Math.round(event.clientY - rect.top)

    return { x, y }
  }, [])

  /**
   * Start drawing a new shape
   */
  const startDrawing = useCallback(
    (x: number, y: number, shapeType?: 'rectangle' | 'ellipse') => {
      setMouseDownPos({ x, y })
      setHasMouseMoved(false)
      setIsDrawing(true)

      // Use provided shape type or fall back to current state
      const typeToUse = shapeType || currentShapeType

      // Create initial shape based on shape type
      if (typeToUse === 'ellipse') {
        setCurrentSelection(createEllipseShape(x, y, 0, 0))
      } else {
        setCurrentSelection(createRectangularShape(x, y, 0, 0))
      }

      // Also update the current shape type if provided
      if (shapeType && shapeType !== currentShapeType) {
        setCurrentShapeType(shapeType)
      }
    },
    [currentShapeType]
  )

  /**
   * Update current selection while drawing
   */
  const updateDrawing = useCallback(
    (x: number, y: number) => {
      if (!isDrawing || !mouseDownPos || !currentSelection) return null

      setHasMouseMoved(true)

      const newSelection = {
        ...currentSelection,
        x: Math.min(mouseDownPos.x, x),
        y: Math.min(mouseDownPos.y, y),
        width: Math.abs(x - mouseDownPos.x),
        height: Math.abs(y - mouseDownPos.y),
      }

      setCurrentSelection(newSelection)
      return newSelection
    },
    [isDrawing, mouseDownPos, currentSelection]
  )

  /**
   * Finish drawing and return the final selection
   */
  const finishDrawing = useCallback(
    (minSize = 5) => {
      if (!isDrawing || !currentSelection || !hasMouseMoved) {
        setIsDrawing(false)
        setCurrentSelection(null)
        setMouseDownPos(null)
        setHasMouseMoved(false)
        return null
      }

      // Only return selection if it's large enough
      const finalSelection
        = currentSelection.width > minSize || currentSelection.height > minSize
          ? { ...currentSelection, source: 'manual' as const }
          : null

      setIsDrawing(false)
      setCurrentSelection(null)
      setMouseDownPos(null)
      setHasMouseMoved(false)

      return finalSelection
    },
    [isDrawing, currentSelection, hasMouseMoved]
  )

  /**
   * Cancel current drawing
   */
  const cancelDrawing = useCallback(() => {
    setIsDrawing(false)
    setCurrentSelection(null)
    setMouseDownPos(null)
    setHasMouseMoved(false)
  }, [])

  /**
   * Get click coordinates (only if mouse didn't move much)
   */
  const getClickCoordinates = useCallback(() => {
    if (hasMouseMoved || !mouseDownPos) return null
    return mouseDownPos
  }, [hasMouseMoved, mouseDownPos])

  /**
   * Load and render image to canvas
   */
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw image
      ctx.drawImage(img, 0, 0)

      setImage(img)
      setImageLoaded(true)
    }
    img.onerror = () => {
      onError?.('Failed to load image')
    }
    img.src = imageUrl
  }, [imageUrl, onError])

  /**
   * Set the current shape type for new drawings
   */
  const setShapeType = useCallback((type: 'rectangle' | 'ellipse') => {
    setCurrentShapeType(type)
  }, [])

  /**
   * Switch shape type while drawing (for shift key functionality)
   */
  const switchShapeType = useCallback(
    (type: 'rectangle' | 'ellipse') => {
      if (!isDrawing || !currentSelection || !mouseDownPos) return

      // Convert current selection to new shape type
      const newSelection
        = type === 'ellipse'
          ? createEllipseShape(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height)
          : createRectangularShape(
              currentSelection.x,
              currentSelection.y,
              currentSelection.width,
              currentSelection.height
            )

      setCurrentShapeType(type)
      setCurrentSelection(newSelection)
    },
    [isDrawing, currentSelection, mouseDownPos]
  )

  /**
   * Get image dimensions
   */
  const imageDimensions = image ? { width: image.width, height: image.height } : null

  return {
    // Refs
    canvasRef,
    containerRef,

    // State
    imageLoaded,
    image,
    imageDimensions,
    isDrawing,
    currentSelection,
    currentShapeType,
    hasMouseMoved,

    // Utilities
    getCanvasContext,
    getCanvasCoordinates,

    // Drawing operations
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    getClickCoordinates,

    // Shape type management
    setShapeType,
    switchShapeType,
  }
}
