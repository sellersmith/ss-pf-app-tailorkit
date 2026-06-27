import type { ShapeSelection } from '../../types'
import type { HandleType } from '../../utils/shapeUtils'

export interface InteractiveCanvasProps {
  imageUrl: string
  shapeSelections: ShapeSelection[]
  onShapeSelectionsChange: (selections: ShapeSelection[]) => void
  onError?: (error: string) => void
  onZoomChange?: (zoomState: { scale: number; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void }) => void
  /** Callback when vector drawing mode is entered for the first time */
  onVectorModeEnter?: () => void
  /** When true, auto-detect runs immediately on image load (no shapes) and results are
   *  auto-confirmed. A center-rectangle fallback fires if detection times out or errors.
   *  Only set this in guided onboarding flows — leave false (default) in the full editor
   *  where merchants choose their own tools intentionally. */
  autoTriggerDetection?: boolean
}

export type DrawingMode = 'pan' | 'rectangle' | 'ellipse' | 'vector' | 'magicwand' | 'manipulate' | 'paint'

export interface ManipulationIntent {
  type: 'move' | 'resize' | 'rotate'
  startPos: { x: number; y: number }
  handle?: HandleType
  shapeIndex: number
  shape: ShapeSelection
  rotationStartAngle?: number
}

export interface InteractionState {
  // Shape movement
  isMoving: boolean
  movingShapeIndex: number | null
  initialMousePos: { x: number; y: number } | null
  dragOffset: { x: number; y: number } | null

  // Shape resize
  isResizing: boolean
  resizingShapeIndex: number | null
  resizeHandle: HandleType | null
  resizeStartPos: { x: number; y: number } | null
  originalShape: ShapeSelection | null

  // Shape rotation
  isRotating: boolean
  rotatingShapeIndex: number | null
  rotationStartAngle: number | null
  originalRotation: number

  // Touch-specific
  isTouchDrawing: boolean
  isTouchMoving: boolean
  isTouchResizing: boolean
  isTouchRotating: boolean
  touchResizeHandle: HandleType | null
  touchRotationStartAngle: number | null
  touchOriginalRotation: number

  // Selection
  selectedShapeIndex: number | null
}

export interface InteractionSetters {
  setIsMoving: (v: boolean) => void
  setMovingShapeIndex: (v: number | null) => void
  setInitialMousePos: (v: { x: number; y: number } | null) => void
  setDragOffset: (v: { x: number; y: number } | null) => void

  setIsResizing: (v: boolean) => void
  setResizingShapeIndex: (v: number | null) => void
  setResizeHandle: (v: HandleType | null) => void
  setResizeStartPos: (v: { x: number; y: number } | null) => void
  setOriginalShape: (v: ShapeSelection | null) => void

  setIsRotating: (v: boolean) => void
  setRotatingShapeIndex: (v: number | null) => void
  setRotationStartAngle: (v: number | null) => void
  setOriginalRotation: (v: number) => void

  setIsTouchDrawing: (v: boolean) => void
  setIsTouchMoving: (v: boolean) => void
  setIsTouchResizing: (v: boolean) => void
  setIsTouchRotating: (v: boolean) => void
  setTouchResizeHandle: (v: HandleType | null) => void
  setTouchRotationStartAngle: (v: number | null) => void
  setTouchOriginalRotation: (v: number) => void

  setSelectedShapeIndex: (v: number | null) => void
}
