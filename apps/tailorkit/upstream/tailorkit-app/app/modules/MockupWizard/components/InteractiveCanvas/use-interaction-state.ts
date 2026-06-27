import { useState, useRef } from 'react'
import type { HandleType } from '../../utils/shapeUtils'
import type { ShapeSelection } from '../../types'
import type { InteractionState, InteractionSetters, ManipulationIntent } from './types'

export interface UseInteractionStateReturn extends InteractionState, InteractionSetters {
  manipulationIntentRef: React.MutableRefObject<ManipulationIntent | null>
  isMovingRef: React.MutableRefObject<boolean>
  isResizingRef: React.MutableRefObject<boolean>
  isRotatingRef: React.MutableRefObject<boolean>
  movingShapeIndexRef: React.MutableRefObject<number | null>
  resizingShapeIndexRef: React.MutableRefObject<number | null>
  rotatingShapeIndexRef: React.MutableRefObject<number | null>
  selectedShapeIndexRef: React.MutableRefObject<number | null>
}

export function useInteractionState(): UseInteractionStateReturn {
  // Shape movement
  const [isMoving, setIsMoving] = useState(false)
  const [movingShapeIndex, setMovingShapeIndex] = useState<number | null>(null)
  const [initialMousePos, setInitialMousePos] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  // Shape selection
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null)

  // Shape resize
  const [isResizing, setIsResizing] = useState(false)
  const [resizingShapeIndex, setResizingShapeIndex] = useState<number | null>(null)
  const [resizeHandle, setResizeHandle] = useState<HandleType | null>(null)
  const [resizeStartPos, setResizeStartPos] = useState<{ x: number; y: number } | null>(null)
  const [originalShape, setOriginalShape] = useState<ShapeSelection | null>(null)

  // Shape rotation
  const [isRotating, setIsRotating] = useState(false)
  const [rotatingShapeIndex, setRotatingShapeIndex] = useState<number | null>(null)
  const [rotationStartAngle, setRotationStartAngle] = useState<number | null>(null)
  const [originalRotation, setOriginalRotation] = useState<number>(0)

  // Touch-specific state
  const [isTouchDrawing, setIsTouchDrawing] = useState(false)
  const [isTouchMoving, setIsTouchMoving] = useState(false)
  const [isTouchResizing, setIsTouchResizing] = useState(false)
  const [isTouchRotating, setIsTouchRotating] = useState(false)
  const [touchResizeHandle, setTouchResizeHandle] = useState<HandleType | null>(null)
  const [touchRotationStartAngle, setTouchRotationStartAngle] = useState<number | null>(null)
  const [touchOriginalRotation, setTouchOriginalRotation] = useState<number>(0)

  // Refs for avoiding stale closures in event handlers
  const manipulationIntentRef = useRef<ManipulationIntent | null>(null)
  const isMovingRef = useRef(isMoving)
  isMovingRef.current = isMoving
  const isResizingRef = useRef(isResizing)
  isResizingRef.current = isResizing
  const isRotatingRef = useRef(isRotating)
  isRotatingRef.current = isRotating
  const movingShapeIndexRef = useRef(movingShapeIndex)
  movingShapeIndexRef.current = movingShapeIndex
  const resizingShapeIndexRef = useRef(resizingShapeIndex)
  resizingShapeIndexRef.current = resizingShapeIndex
  const rotatingShapeIndexRef = useRef(rotatingShapeIndex)
  rotatingShapeIndexRef.current = rotatingShapeIndex
  const selectedShapeIndexRef = useRef(selectedShapeIndex)
  selectedShapeIndexRef.current = selectedShapeIndex

  return {
    // State
    isMoving,
    movingShapeIndex,
    initialMousePos,
    dragOffset,
    selectedShapeIndex,
    isResizing,
    resizingShapeIndex,
    resizeHandle,
    resizeStartPos,
    originalShape,
    isRotating,
    rotatingShapeIndex,
    rotationStartAngle,
    originalRotation,
    isTouchDrawing,
    isTouchMoving,
    isTouchResizing,
    isTouchRotating,
    touchResizeHandle,
    touchRotationStartAngle,
    touchOriginalRotation,
    // Setters
    setIsMoving,
    setMovingShapeIndex,
    setInitialMousePos,
    setDragOffset,
    setSelectedShapeIndex,
    setIsResizing,
    setResizingShapeIndex,
    setResizeHandle,
    setResizeStartPos,
    setOriginalShape,
    setIsRotating,
    setRotatingShapeIndex,
    setRotationStartAngle,
    setOriginalRotation,
    setIsTouchDrawing,
    setIsTouchMoving,
    setIsTouchResizing,
    setIsTouchRotating,
    setTouchResizeHandle,
    setTouchRotationStartAngle,
    setTouchOriginalRotation,
    // Refs
    manipulationIntentRef,
    isMovingRef,
    isResizingRef,
    isRotatingRef,
    movingShapeIndexRef,
    resizingShapeIndexRef,
    rotatingShapeIndexRef,
    selectedShapeIndexRef,
  }
}
