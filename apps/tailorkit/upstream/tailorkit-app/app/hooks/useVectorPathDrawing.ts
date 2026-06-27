/**
 * Shared hook for vector path drawing state machine.
 *
 * Extracted from VectorEditor (VectorEditor.tsx lines 1015-1258 and
 * EditorCanvas/index.tsx lines 1834-3046) to be reusable across modules.
 *
 * Manages:
 * - Path command accumulation (M, L, Q, C, Z)
 * - Click vs drag detection for line vs curve creation
 * - Path closing by clicking on preceding nodes
 * - Drawing preview state (drag position, hovered node)
 */

import { useState, useCallback, useRef } from 'react'
import type { PathCommand, Point } from '~/modules/VectorEditor/utils/svg'

export type DrawingCurveType = 'line' | 'cubic' | 'quadratic'

/** Minimum pixel distance to distinguish a drag from a click */
const DRAG_THRESHOLD = 5
/** Pixel radius for detecting close-to-node proximity */
const NODE_HIT_TOLERANCE = 10

/** Find the start index of the current open subpath (last M without a following Z) */
function findOpenSubpathStart(path: PathCommand[]): number {
  let lastMIndex = -1
  for (let j = 0; j < path.length; j++) {
    if (path[j].type === 'M') lastMIndex = j
    if (path[j].type === 'Z') lastMIndex = -1
  }
  return lastMIndex
}

export interface VectorPathDrawingOptions {
  /** Default curve type for drag gestures */
  curveType?: DrawingCurveType
  /** When true, auto-appends Z command on finish if path is not closed */
  autoClose?: boolean
}

export interface VectorPathDrawingState {
  /** Accumulated path commands being drawn */
  drawingPath: PathCommand[] | null
  /** Current drag start position (set on mouseDown) */
  drawDragStart: Point | null
  /** Current drag position (updated on mouseMove when dragging) */
  drawDragCurrent: Point | null
  /** Whether user is actively dragging (distance > threshold) */
  isDrawDragging: boolean
  /** Index of the drawing node being hovered for close-path indication */
  hoveredDrawingNodeIndex: number | null
  /** Index of the node being closed to (set on mouseDown near existing node) */
  closingNodeIndex: number | null
  /** Preview cursor position for drawing feedback line */
  drawPreviewPos: Point | null
}

/** Options for path point addition — supports subpath creation via moveTo */
export interface DrawPathPointOptions {
  /** When true, appends an M (moveTo) command instead of L/curve to start a new subpath */
  moveTo?: boolean
}

export interface VectorPathDrawingActions {
  /** Add a line segment (M or L command) at the given position. Pass { moveTo: true } to force M command for new subpath. */
  handleDrawPathClick: (x: number, y: number, options?: DrawPathPointOptions) => void
  /** Add a cubic bezier curve command. Pass { moveTo: true } to force M command for new subpath. */
  handleDrawPathCurve: (
    x: number,
    y: number,
    controlDx: number,
    controlDy: number,
    options?: DrawPathPointOptions
  ) => void
  /** Add a quadratic bezier curve command. Pass { moveTo: true } to force M command for new subpath. */
  handleDrawPathQuadratic: (
    x: number,
    y: number,
    controlDx: number,
    controlDy: number,
    options?: DrawPathPointOptions
  ) => void
  /** Close the current subpath by connecting to a preceding node with a line */
  handleCloseDrawingPath: (closeToNodeIndex: number) => void
  /** Close the current subpath by connecting to a preceding node with a curve */
  handleCloseDrawingPathWithCurve: (
    closeToNodeIndex: number,
    controlDx: number,
    controlDy: number,
    curveType: 'cubic' | 'quadratic'
  ) => void
  /** Finish drawing and return the completed path commands (or null if invalid) */
  handleFinishDrawing: () => PathCommand[] | null
  /** Cancel drawing and clear all state */
  handleCancelDrawing: () => void
  /** Undo the last path command */
  handleUndo: () => void
  /** Redo the last undone path command */
  handleRedo: () => void
  /** Set the curve type for drag gestures */
  setCurveType: (type: DrawingCurveType) => void

  // Mouse event state machine
  /** Call on mouseDown with the position in drawing coordinates */
  onMouseDown: (pos: Point, scale?: number) => void
  /** Call on mouseMove with the position in drawing coordinates */
  onMouseMove: (pos: Point, scale?: number) => void
  /**
   * Call on mouseUp. Returns the action that was performed, or null.
   * The caller should NOT call handleDrawPathClick/Curve directly — onMouseUp handles it.
   */
  onMouseUp: () => void

  /** Find a drawing node index near the given screen position, or null */
  findNodeAtPosition: (x: number, y: number, posToDrawing: (x: number, y: number) => Point) => number | null
}

export type UseVectorPathDrawingReturn = VectorPathDrawingState &
  VectorPathDrawingActions & {
    /** Whether a drawing is currently in progress */
    isDrawing: boolean
    /** Current curve type setting */
    curveType: DrawingCurveType
    /** Whether undo is available */
    canUndo: boolean
    /** Whether redo is available */
    canRedo: boolean
  }

/**
 * Hook for managing vector path drawing state and interactions.
 *
 * Usage:
 * 1. Wire onMouseDown/onMouseMove/onMouseUp to canvas mouse events
 * 2. Use drawingPath + drawPreviewPos for rendering feedback
 * 3. Call handleFinishDrawing() when user presses Enter
 * 4. Call handleCancelDrawing() when user presses Escape
 */
export function useVectorPathDrawing(options: VectorPathDrawingOptions = {}): UseVectorPathDrawingReturn {
  const { curveType: initialCurveType = 'quadratic', autoClose = false } = options

  // Drawing state
  const [drawingPath, setDrawingPathRaw] = useState<PathCommand[] | null>(null)
  const [curveType, setCurveType] = useState<DrawingCurveType>(initialCurveType)

  // Undo/redo stacks (use refs to avoid dependency cascades in callbacks)
  const undoStackRef = useRef<(PathCommand[] | null)[]>([])
  const redoStackRef = useRef<(PathCommand[] | null)[]>([])
  const drawingPathRef = useRef<PathCommand[] | null>(null)

  // Wrap setDrawingPath to track undo/redo history
  const setDrawingPath = useCallback(
    (updater: PathCommand[] | null | ((prev: PathCommand[] | null) => PathCommand[] | null)) => {
      setDrawingPathRaw(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        // Only push to undo stack if the path actually changed
        if (prev !== next) {
          undoStackRef.current.push(prev)
          redoStackRef.current = [] // Clear redo on new action
          drawingPathRef.current = next
        }
        return next
      })
    },
    []
  )

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const prev = undoStackRef.current.pop()!
    redoStackRef.current.push(drawingPathRef.current)
    drawingPathRef.current = prev
    setDrawingPathRaw(prev)
  }, [])

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const next = redoStackRef.current.pop()!
    undoStackRef.current.push(drawingPathRef.current)
    drawingPathRef.current = next
    setDrawingPathRaw(next)
  }, [])

  // Track whether undo/redo are available (derived from path changes)
  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

  // Mouse interaction state
  const [drawDragStart, setDrawDragStart] = useState<Point | null>(null)
  const [drawDragCurrent, setDrawDragCurrent] = useState<Point | null>(null)
  const [isDrawDragging, setIsDrawDragging] = useState(false)
  const [hoveredDrawingNodeIndex, setHoveredDrawingNodeIndex] = useState<number | null>(null)
  const [closingNodeIndex, setClosingNodeIndex] = useState<number | null>(null)
  const [drawPreviewPos, setDrawPreviewPos] = useState<Point | null>(null)

  // Ref to avoid stale closure in onMouseUp
  const stateRef = useRef({
    drawingPath,
    drawDragStart,
    drawDragCurrent,
    isDrawDragging,
    closingNodeIndex,
    curveType,
  })
  stateRef.current = {
    drawingPath,
    drawDragStart,
    drawDragCurrent,
    isDrawDragging,
    closingNodeIndex,
    curveType,
  }

  // ── Path command handlers (extracted from VectorEditor.tsx lines 1015-1252) ──

  const handleDrawPathClick = useCallback(
    (x: number, y: number, options?: DrawPathPointOptions) => {
      setDrawingPath(prev => {
        if (!prev) {
          return [{ type: 'M' as const, x, y }]
        }
        // Auto-start new subpath after a closed path or explicit moveTo
        const lastCmd = prev[prev.length - 1]
        if (options?.moveTo || lastCmd.type === 'Z') {
          return [...prev, { type: 'M' as const, x, y }]
        }
        return [...prev, { type: 'L' as const, x, y }]
      })
    },
    [setDrawingPath]
  )

  const handleDrawPathCurve = useCallback(
    (x: number, y: number, controlDx: number, controlDy: number, options?: DrawPathPointOptions) => {
      setDrawingPath(prev => {
        if (!prev || prev.length === 0 || options?.moveTo) {
          if (prev && options?.moveTo) {
            return [...prev, { type: 'M' as const, x, y }]
          }
          return [{ type: 'M' as const, x, y }]
        }
        const lastCmd = prev[prev.length - 1]
        // Auto-start new subpath after a closed path
        if (lastCmd.type === 'Z') {
          return [...prev, { type: 'M' as const, x, y }]
        }
        const curveCmd: PathCommand = {
          type: 'C',
          x,
          y,
          cp1: { x: lastCmd.x + controlDx / 3, y: lastCmd.y + controlDy / 3 },
          cp2: { x: x - controlDx / 3, y: y - controlDy / 3 },
        }
        return [...prev, curveCmd]
      })
    },
    [setDrawingPath]
  )

  const handleDrawPathQuadratic = useCallback(
    (x: number, y: number, controlDx: number, controlDy: number, options?: DrawPathPointOptions) => {
      setDrawingPath(prev => {
        if (!prev || prev.length === 0 || options?.moveTo) {
          if (prev && options?.moveTo) {
            return [...prev, { type: 'M' as const, x, y }]
          }
          return [{ type: 'M' as const, x, y }]
        }
        const lastCmd = prev[prev.length - 1]
        // Auto-start new subpath after a closed path
        if (lastCmd.type === 'Z') {
          return [...prev, { type: 'M' as const, x, y }]
        }
        const curveCmd: PathCommand = {
          type: 'Q',
          x,
          y,
          cp: { x: lastCmd.x + controlDx / 2, y: lastCmd.y + controlDy / 2 },
        }
        return [...prev, curveCmd]
      })
    },
    [setDrawingPath]
  )

  const handleCloseDrawingPath = useCallback(
    (closeToNodeIndex: number) => {
      setDrawingPath(prev => {
        if (!prev || prev.length < 2) return prev

        // Find the M command that starts the subpath containing the target node
        let targetSubpathStart = 0
        for (let i = closeToNodeIndex; i >= 0; i--) {
          if (prev[i].type === 'M') {
            targetSubpathStart = i
            break
          }
        }

        const firstNode = prev[targetSubpathStart]
        const targetNode = prev[closeToNodeIndex]
        let closingCommands: PathCommand[]

        if (closeToNodeIndex === targetSubpathStart) {
          closingCommands = [{ type: 'Z' as const, x: firstNode.x, y: firstNode.y }]
        } else {
          closingCommands = [
            { type: 'L' as const, x: targetNode.x, y: targetNode.y },
            { type: 'Z' as const, x: firstNode.x, y: firstNode.y },
          ]
        }

        return [...prev, ...closingCommands]
      })
    },
    [setDrawingPath]
  )

  const handleCloseDrawingPathWithCurve = useCallback(
    (closeToNodeIndex: number, controlDx: number, controlDy: number, curveTypeParam: 'cubic' | 'quadratic') => {
      setDrawingPath(prev => {
        if (!prev || prev.length < 2) return prev

        let targetSubpathStart = 0
        for (let i = closeToNodeIndex; i >= 0; i--) {
          if (prev[i].type === 'M') {
            targetSubpathStart = i
            break
          }
        }

        const firstNode = prev[targetSubpathStart]
        const targetNode = prev[closeToNodeIndex]
        const lastCmd = prev[prev.length - 1]

        const endPoint = closeToNodeIndex === targetSubpathStart ? firstNode : targetNode
        let closingCommands: PathCommand[]

        if (curveTypeParam === 'quadratic') {
          closingCommands = [
            {
              type: 'Q' as const,
              x: endPoint.x,
              y: endPoint.y,
              cp: { x: lastCmd.x + controlDx / 2, y: lastCmd.y + controlDy / 2 },
            },
            { type: 'Z' as const, x: firstNode.x, y: firstNode.y },
          ]
        } else {
          closingCommands = [
            {
              type: 'C' as const,
              x: endPoint.x,
              y: endPoint.y,
              cp1: { x: lastCmd.x + controlDx / 3, y: lastCmd.y + controlDy / 3 },
              cp2: { x: endPoint.x - controlDx / 3, y: endPoint.y - controlDy / 3 },
            },
            { type: 'Z' as const, x: firstNode.x, y: firstNode.y },
          ]
        }

        return [...prev, ...closingCommands]
      })
    },
    [setDrawingPath]
  )

  const handleFinishDrawing = useCallback((): PathCommand[] | null => {
    const path = stateRef.current.drawingPath
    if (!path || path.length < 2) {
      setDrawingPath(null)
      return null
    }

    const finalPath = [...path]

    // Auto-close if requested and path is not already closed
    if (autoClose && !finalPath.some(cmd => cmd.type === 'Z')) {
      const firstM = finalPath.find(cmd => cmd.type === 'M')
      if (firstM) {
        finalPath.push({ type: 'L', x: firstM.x, y: firstM.y })
        finalPath.push({ type: 'Z', x: firstM.x, y: firstM.y })
      }
    }

    // Reset all state (bypass tracked setDrawingPath to avoid polluting undo stack)
    setDrawingPathRaw(null)
    drawingPathRef.current = null
    undoStackRef.current = []
    redoStackRef.current = []
    setDrawDragStart(null)
    setDrawDragCurrent(null)
    setIsDrawDragging(false)
    setHoveredDrawingNodeIndex(null)
    setClosingNodeIndex(null)
    setDrawPreviewPos(null)

    return finalPath
  }, [autoClose, setDrawingPath])

  const handleCancelDrawing = useCallback(() => {
    // Bypass tracked setDrawingPath to avoid polluting undo stack
    setDrawingPathRaw(null)
    drawingPathRef.current = null
    undoStackRef.current = []
    redoStackRef.current = []
    setDrawDragStart(null)
    setDrawDragCurrent(null)
    setIsDrawDragging(false)
    setHoveredDrawingNodeIndex(null)
    setClosingNodeIndex(null)
    setDrawPreviewPos(null)
  }, [])

  // ── Mouse event state machine (extracted from EditorCanvas/index.tsx) ──

  const findNodeAtPosition = useCallback(
    (screenX: number, screenY: number, posToDrawing: (x: number, y: number) => Point): number | null => {
      const path = stateRef.current.drawingPath
      if (!path || path.length < 2) return null

      for (let i = 0; i < path.length - 1; i++) {
        const cmd = path[i]
        if (cmd.type === 'Z') continue

        // Calculate distance in screen/pixel space
        const nodePos = posToDrawing(cmd.x, cmd.y)
        const dx = screenX - nodePos.x
        const dy = screenY - nodePos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= NODE_HIT_TOLERANCE) {
          return i
        }
      }
      return null
    },
    []
  )

  const onMouseDown = useCallback((pos: Point, scale = 1) => {
    const path = stateRef.current.drawingPath
    // Scale tolerance to drawing coordinate space so it stays consistent on screen
    const tolerance = NODE_HIT_TOLERANCE / scale

    // Check if clicking on a preceding node to close the current open subpath
    if (path && path.length >= 2) {
      // Find start of current open subpath (only allow closing within current subpath)
      const openSubpathStart = findOpenSubpathStart(path)
      if (openSubpathStart >= 0) {
        for (let i = openSubpathStart; i < path.length - 1; i++) {
          const cmd = path[i]
          if (cmd.type === 'Z') continue
          const dx = pos.x - cmd.x
          const dy = pos.y - cmd.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= tolerance) {
            setClosingNodeIndex(i)
            setDrawDragStart(pos)
            setDrawDragCurrent(null)
            setIsDrawDragging(false)
            setHoveredDrawingNodeIndex(null)
            return
          }
        }
      }
    }

    // Regular point: record drag start, wait for mouseUp to determine click vs drag
    setDrawDragStart(pos)
    setDrawDragCurrent(null)
    setIsDrawDragging(false)
    setClosingNodeIndex(null)
    // Sync ref immediately for onMouseUp
    stateRef.current.drawDragStart = pos
    stateRef.current.drawDragCurrent = null
    stateRef.current.isDrawDragging = false
    stateRef.current.closingNodeIndex = null
  }, [])

  const onMouseMove = useCallback((pos: Point, scale = 1) => {
    setDrawPreviewPos(pos)

    // Track drag movement for curve creation
    const dragStart = stateRef.current.drawDragStart
    if (dragStart) {
      const deltaX = pos.x - dragStart.x
      const deltaY = pos.y - dragStart.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (distance > DRAG_THRESHOLD / scale) {
        setIsDrawDragging(true)
        setDrawDragCurrent(pos)
        // Update stateRef immediately so onMouseUp reads current values
        // (React batches state updates; stateRef is only updated on next render)
        stateRef.current.isDrawDragging = true
        stateRef.current.drawDragCurrent = pos
      }
    }

    // Check for close-path node hover when not dragging (only in current open subpath)
    if (!stateRef.current.drawDragStart) {
      const path = stateRef.current.drawingPath
      if (path && path.length >= 2) {
        let found: number | null = null
        const openSubpathStart = findOpenSubpathStart(path)
        if (openSubpathStart >= 0) {
          for (let i = openSubpathStart; i < path.length - 1; i++) {
            const cmd = path[i]
            if (cmd.type === 'Z') continue
            const dx = pos.x - cmd.x
            const dy = pos.y - cmd.y
            if (Math.sqrt(dx * dx + dy * dy) <= NODE_HIT_TOLERANCE / scale) {
              found = i
              break
            }
          }
        }
        setHoveredDrawingNodeIndex(found)
      }
    } else {
      setHoveredDrawingNodeIndex(null)
    }
  }, [])

  const onMouseUp = useCallback(() => {
    const {
      closingNodeIndex: closeIdx,
      drawDragStart: dragStart,
      drawDragCurrent: dragCurrent,
      isDrawDragging: dragging,
      curveType: ct,
    } = stateRef.current

    if (!dragStart) return

    // Path closing
    if (closeIdx !== null) {
      if (dragging && dragCurrent) {
        const dx = dragCurrent.x - dragStart.x
        const dy = dragCurrent.y - dragStart.y
        const closeCurveType = ct === 'quadratic' ? 'quadratic' : 'cubic'
        handleCloseDrawingPathWithCurve(closeIdx, dx, dy, closeCurveType as 'cubic' | 'quadratic')
      } else {
        handleCloseDrawingPath(closeIdx)
      }

      setClosingNodeIndex(null)
      setDrawDragStart(null)
      setDrawDragCurrent(null)
      setIsDrawDragging(false)
      setHoveredDrawingNodeIndex(null)
      return
    }

    // Regular point addition
    if (dragging && dragCurrent) {
      const dx = dragCurrent.x - dragStart.x
      const dy = dragCurrent.y - dragStart.y
      if (ct === 'line') {
        handleDrawPathClick(dragStart.x, dragStart.y)
      } else if (ct === 'quadratic') {
        handleDrawPathQuadratic(dragStart.x, dragStart.y, dx, dy)
      } else {
        handleDrawPathCurve(dragStart.x, dragStart.y, dx, dy)
      }
    } else {
      handleDrawPathClick(dragStart.x, dragStart.y)
    }

    setDrawDragStart(null)
    setDrawDragCurrent(null)
    setIsDrawDragging(false)
  }, [
    handleDrawPathClick,
    handleDrawPathCurve,
    handleDrawPathQuadratic,
    handleCloseDrawingPath,
    handleCloseDrawingPathWithCurve,
  ])

  return {
    // State
    drawingPath,
    drawDragStart,
    drawDragCurrent,
    isDrawDragging,
    hoveredDrawingNodeIndex,
    closingNodeIndex,
    drawPreviewPos,
    isDrawing: drawingPath !== null,
    curveType,

    // Actions
    handleDrawPathClick,
    handleDrawPathCurve,
    handleDrawPathQuadratic,
    handleCloseDrawingPath,
    handleCloseDrawingPathWithCurve,
    handleFinishDrawing,
    handleCancelDrawing,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    setCurveType,

    // Mouse event state machine
    onMouseDown,
    onMouseMove,
    onMouseUp,
    findNodeAtPosition,
  }
}
