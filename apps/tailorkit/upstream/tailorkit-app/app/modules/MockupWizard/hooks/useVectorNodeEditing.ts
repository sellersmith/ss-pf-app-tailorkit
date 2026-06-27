/**
 * Hook for editing nodes and control points of completed vector shapes.
 *
 * When a vector shape is selected, this hook automatically activates and:
 * - Renders anchor nodes on the path and diamond-shaped control point handles
 * - Detects hover/click on nodes and control points
 * - Handles dragging to reposition nodes or refine curves
 * - Updates pathCommands, pathD, and bounding box in real-time
 *
 * Nodes show automatically when a vector shape is selected — no separate
 * "edit mode" is needed. Node/CP hit testing takes priority over resize handles
 * so the user can drag nodes even when handles overlap.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PathCommand, Point } from '~/modules/VectorEditor/utils/svg'
import type { VectorShape, ShapeSelection } from '../types'
import { computePathBoundingBox, serializePathCommandsToD } from '../utils/vectorPathUtils'

// Visual sizes (screen pixels, identity transform)
const NODE_RADIUS = 5
const CP_RADIUS = 4
// Hit area is larger than visual for easier clicking
const HIT_RADIUS = 8

/** Identifies a specific control point on a specific command */
interface ControlPointRef {
  commandIndex: number
  type: 'cp' | 'cp1' | 'cp2'
}

interface UseVectorNodeEditingOptions {
  shapeSelections: ShapeSelection[]
  selectedShapeIndex: number | null
  onShapeSelectionsChange: (shapes: ShapeSelection[]) => void
  transformImageToCanvas: (x: number, y: number) => Point
  viewportScale: number
}

export function useVectorNodeEditing({
  shapeSelections,
  selectedShapeIndex,
  onShapeSelectionsChange,
  transformImageToCanvas,
  viewportScale,
}: UseVectorNodeEditingOptions) {
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null)
  const [hoveredCp, setHoveredCp] = useState<ControlPointRef | null>(null)
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null)
  const [draggingCp, setDraggingCp] = useState<ControlPointRef | null>(null)
  const [selectedNodeIndices, setSelectedNodeIndices] = useState<Set<number>>(new Set())

  // Marquee (rectangle) selection — refs for perf (avoid re-renders during drag)
  const marqueeStartRef = useRef<Point | null>(null)
  const marqueeEndRef = useRef<Point | null>(null)
  // Counter bumped on marquee start/end to trigger redraws only when needed
  const [marqueeVersion, setMarqueeVersion] = useState(0)
  // Track selection state at marquee start for toggle behavior
  const marqueeBaseSelectionRef = useRef<Set<number>>(new Set())

  // Backward-compatible single selection (first selected node or null)
  const selectedNodeIndex = selectedNodeIndices.size > 0 ? [...selectedNodeIndices][0] : null

  // Derive whether a vector shape is selected
  const selectedShape = selectedShapeIndex !== null ? shapeSelections[selectedShapeIndex] : null
  const isActive = selectedShape?.type === 'vector'
  const vectorShape = isActive ? (selectedShape as VectorShape) : null

  // Refs for keyboard handler to access latest state without re-registering
  const selectedNodeIndexRef = useRef(selectedNodeIndex)
  selectedNodeIndexRef.current = selectedNodeIndex
  const selectedNodeIndicesRef = useRef(selectedNodeIndices)
  selectedNodeIndicesRef.current = selectedNodeIndices
  const vectorShapeRef = useRef(vectorShape)
  vectorShapeRef.current = vectorShape
  const selectedShapeIndexRef = useRef(selectedShapeIndex)
  selectedShapeIndexRef.current = selectedShapeIndex
  const shapeSelectionsRef = useRef(shapeSelections)
  shapeSelectionsRef.current = shapeSelections

  // Clear drag/hover/selection/marquee state when selection changes or deactivates
  useEffect(() => {
    setHoveredNodeIndex(null)
    setHoveredCp(null)
    setDraggingNodeIndex(null)
    setDraggingCp(null)
    setSelectedNodeIndices(new Set())
    marqueeStartRef.current = null
    marqueeEndRef.current = null
  }, [selectedShapeIndex])

  // ── Hit testing (image coordinates) ──

  const findNodeAt = useCallback(
    (ix: number, iy: number, cmds: PathCommand[]): number | null => {
      const hitR = HIT_RADIUS / viewportScale
      // Reverse order so topmost (latest) nodes get priority
      for (let i = cmds.length - 1; i >= 0; i--) {
        const cmd = cmds[i]
        if (cmd.type === 'Z') continue
        if (Math.hypot(ix - cmd.x, iy - cmd.y) <= hitR) return i
      }
      return null
    },
    [viewportScale]
  )

  const findCpAt = useCallback(
    (ix: number, iy: number, cmds: PathCommand[]): ControlPointRef | null => {
      const hitR = HIT_RADIUS / viewportScale
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i]
        if (cmd.cp && Math.hypot(ix - cmd.cp.x, iy - cmd.cp.y) <= hitR) {
          return { commandIndex: i, type: 'cp' }
        }
        if (cmd.cp1 && Math.hypot(ix - cmd.cp1.x, iy - cmd.cp1.y) <= hitR) {
          return { commandIndex: i, type: 'cp1' }
        }
        if (cmd.cp2 && Math.hypot(ix - cmd.cp2.x, iy - cmd.cp2.y) <= hitR) {
          return { commandIndex: i, type: 'cp2' }
        }
      }
      return null
    },
    [viewportScale]
  )

  // ── Shape mutation helpers ──

  /** Move an anchor node and its attached control points */
  const applyNodeMove = useCallback((shape: VectorShape, idx: number, nx: number, ny: number): VectorShape => {
    const cmds: PathCommand[] = shape.pathCommands.map(c => ({ ...c }))
    const cmd = cmds[idx]
    const dx = nx - cmd.x
    const dy = ny - cmd.y

    // Move anchor + its own control points together
    cmds[idx] = {
      ...cmd,
      x: nx,
      y: ny,
      ...(cmd.cp ? { cp: { x: cmd.cp.x + dx, y: cmd.cp.y + dy } } : {}),
      ...(cmd.cp1 ? { cp1: { x: cmd.cp1.x + dx, y: cmd.cp1.y + dy } } : {}),
      ...(cmd.cp2 ? { cp2: { x: cmd.cp2.x + dx, y: cmd.cp2.y + dy } } : {}),
    }

    // If M moved, update corresponding Z endpoint
    if (cmd.type === 'M') {
      for (let j = idx + 1; j < cmds.length; j++) {
        if (cmds[j].type === 'Z') {
          cmds[j] = { ...cmds[j], x: nx, y: ny }
          break
        }
        if (cmds[j].type === 'M') break // Next subpath
      }
    }

    const bbox = computePathBoundingBox(cmds)
    const pathD = serializePathCommandsToD(cmds)
    return { ...shape, pathCommands: cmds, pathD, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
  }, [])

  /** Move a single control point (curve refinement) */
  const applyCpMove = useCallback((shape: VectorShape, ref: ControlPointRef, nx: number, ny: number): VectorShape => {
    const cmds: PathCommand[] = shape.pathCommands.map(c => ({ ...c }))
    cmds[ref.commandIndex] = { ...cmds[ref.commandIndex], [ref.type]: { x: nx, y: ny } }

    const bbox = computePathBoundingBox(cmds)
    const pathD = serializePathCommandsToD(cmds)
    return { ...shape, pathCommands: cmds, pathD, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
  }, [])

  // ── Node deletion ──

  /** Delete a node from the vector path. Returns true if deletion was performed. */
  const deleteNodeAtIndex = useCallback(
    (nodeIdx: number): boolean => {
      const shape = vectorShapeRef.current
      const shapeIdx = selectedShapeIndexRef.current
      if (!shape || shapeIdx === null) return false

      const cmds = shape.pathCommands

      // Count non-Z, non-M anchor points in the same subpath
      let anchorCount = 0
      for (const cmd of cmds) {
        if (cmd.type !== 'Z') anchorCount++
      }

      // Need at least 3 anchors (M + 2 curve/line) to form a valid closed path after deletion
      if (anchorCount <= 3) return false

      const targetCmd = cmds[nodeIdx]
      if (targetCmd.type === 'Z') return false

      let newCmds: PathCommand[]

      if (targetCmd.type === 'M') {
        // Deleting M: promote the next non-Z command to M, remove old M
        const nextIdx = nodeIdx + 1
        if (nextIdx >= cmds.length || cmds[nextIdx].type === 'Z') return false
        newCmds = cmds.filter((_, i) => i !== nodeIdx)
        // The command that was at nextIdx is now at nodeIdx — make it M
        newCmds[nodeIdx] = { ...newCmds[nodeIdx], type: 'M', cp: undefined, cp1: undefined, cp2: undefined }
        // Update corresponding Z endpoint to new M's coordinates
        for (let j = newCmds.length - 1; j >= 0; j--) {
          if (newCmds[j].type === 'Z') {
            newCmds[j] = { ...newCmds[j], x: newCmds[nodeIdx].x, y: newCmds[nodeIdx].y }
            break
          }
        }
      } else {
        // Deleting L/C/Q: just remove the command
        newCmds = cmds.filter((_, i) => i !== nodeIdx)
      }

      const bbox = computePathBoundingBox(newCmds)
      const pathD = serializePathCommandsToD(newCmds)
      const updated: VectorShape = {
        ...shape,
        pathCommands: newCmds,
        pathD,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      }

      const newSelections = [...shapeSelectionsRef.current]
      newSelections[shapeIdx] = updated
      onShapeSelectionsChange(newSelections)

      setSelectedNodeIndices(new Set())
      setHoveredNodeIndex(null)
      return true
    },
    [onShapeSelectionsChange]
  )

  /** Delete all currently selected nodes. Returns true if any were deleted. */
  const deleteSelectedNodes = useCallback((): boolean => {
    const shape = vectorShapeRef.current
    const shapeIdx = selectedShapeIndexRef.current
    const indices = selectedNodeIndicesRef.current
    if (!shape || shapeIdx === null || indices.size === 0) return false

    const cmds = shape.pathCommands

    // Count non-Z anchors — need at least 3 remaining after deletion
    let anchorCount = 0
    for (const cmd of cmds) {
      if (cmd.type !== 'Z') anchorCount++
    }

    // Filter out Z and indices that can't be deleted
    const toDelete = new Set<number>()
    for (const idx of indices) {
      if (idx >= 0 && idx < cmds.length && cmds[idx].type !== 'Z') {
        toDelete.add(idx)
      }
    }
    if (toDelete.size === 0) return false
    if (anchorCount - toDelete.size < 3) return false // would leave < 3 anchors

    // Delete in reverse order to preserve indices
    let newCmds = [...cmds.map(c => ({ ...c }))]
    const sortedDesc = [...toDelete].sort((a, b) => b - a)
    for (const idx of sortedDesc) {
      if (newCmds[idx].type === 'M') {
        // Promote next non-Z command to M
        const nextIdx = idx + 1
        if (nextIdx < newCmds.length && newCmds[nextIdx].type !== 'Z') {
          newCmds = newCmds.filter((_, i) => i !== idx)
          newCmds[idx] = { ...newCmds[idx], type: 'M', cp: undefined, cp1: undefined, cp2: undefined }
          for (let j = newCmds.length - 1; j >= 0; j--) {
            if (newCmds[j].type === 'Z') {
              newCmds[j] = { ...newCmds[j], x: newCmds[idx].x, y: newCmds[idx].y }
              break
            }
          }
        }
      } else {
        newCmds = newCmds.filter((_, i) => i !== idx)
      }
    }

    const bbox = computePathBoundingBox(newCmds)
    const pathD = serializePathCommandsToD(newCmds)
    const updated: VectorShape = {
      ...shape,
      pathCommands: newCmds,
      pathD,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    }

    const newSelections = [...shapeSelectionsRef.current]
    newSelections[shapeIdx] = updated
    onShapeSelectionsChange(newSelections)

    setSelectedNodeIndices(new Set())
    setHoveredNodeIndex(null)
    return true
  }, [onShapeSelectionsChange])

  // ── Event handlers (accept image coordinates) ──

  /**
   * Returns true if the event was consumed (node/CP was clicked).
   * @param isMobile — on mobile, node tap always toggles selection (like shift+click)
   */
  const handleMouseDown = useCallback(
    (ix: number, iy: number, shiftKey?: boolean, isMobile?: boolean): boolean => {
      if (!vectorShape) return false

      const cmds = vectorShape.pathCommands
      // CPs are smaller targets → check first for priority
      const cpRef = findCpAt(ix, iy, cmds)
      if (cpRef) {
        setDraggingCp(cpRef)
        setSelectedNodeIndices(new Set())
        return true
      }

      const nodeIdx = findNodeAt(ix, iy, cmds)
      if (nodeIdx !== null) {
        setDraggingNodeIndex(nodeIdx)
        if (shiftKey || isMobile) {
          // Shift+click (desktop) or any tap (mobile): toggle node in multi-selection
          setSelectedNodeIndices(prev => {
            const next = new Set(prev)
            if (next.has(nodeIdx)) {
              next.delete(nodeIdx)
            } else {
              next.add(nodeIdx)
            }
            return next
          })
        } else {
          setSelectedNodeIndices(new Set([nodeIdx]))
        }
        return true
      }

      // Empty area — start marquee selection drag (desktop and mobile)
      marqueeStartRef.current = { x: ix, y: iy }
      marqueeEndRef.current = { x: ix, y: iy }
      setMarqueeVersion(v => v + 1) // trigger redraw for marquee start
      // Snapshot current selection: shift preserves base for additive, normal for toggle
      marqueeBaseSelectionRef.current = new Set(selectedNodeIndices)
      return false
    },
    [vectorShape, findCpAt, findNodeAt, selectedNodeIndices]
  )

  /**
   * Returns true if dragging a node/CP/marquee (event consumed — skip other move handlers).
   * @param shiftKey — when true, marquee adds to existing selection instead of toggling
   */
  const handleMouseMove = useCallback(
    (ix: number, iy: number, shiftKey?: boolean): boolean => {
      if (!vectorShape || selectedShapeIndex === null) return false

      // Active node drag
      if (draggingNodeIndex !== null) {
        const updated = applyNodeMove(vectorShape, draggingNodeIndex, ix, iy)
        const newSelections = [...shapeSelections]
        newSelections[selectedShapeIndex] = updated
        onShapeSelectionsChange(newSelections)
        return true
      }

      // Active CP drag
      if (draggingCp !== null) {
        const updated = applyCpMove(vectorShape, draggingCp, ix, iy)
        const newSelections = [...shapeSelections]
        newSelections[selectedShapeIndex] = updated
        onShapeSelectionsChange(newSelections)
        return true
      }

      // Active marquee drag — update rectangle + live-preview node selection
      if (marqueeStartRef.current) {
        marqueeEndRef.current = { x: ix, y: iy }

        // Compute enclosed nodes for live visual feedback
        const mStart = marqueeStartRef.current
        const minX = Math.min(mStart.x, ix)
        const maxX = Math.max(mStart.x, ix)
        const minY = Math.min(mStart.y, iy)
        const maxY = Math.max(mStart.y, iy)

        const cmds = vectorShape.pathCommands
        const enclosed = new Set<number>()
        for (let i = 0; i < cmds.length; i++) {
          if (cmds[i].type === 'Z') continue
          if (cmds[i].x >= minX && cmds[i].x <= maxX && cmds[i].y >= minY && cmds[i].y <= maxY) {
            enclosed.add(i)
          }
        }

        const base = marqueeBaseSelectionRef.current
        if (shiftKey) {
          const next = new Set(base)
          for (const idx of enclosed) next.add(idx)
          setSelectedNodeIndices(next)
        } else {
          const next = new Set(base)
          for (const idx of enclosed) {
            if (base.has(idx)) next.delete(idx)
            else next.add(idx)
          }
          setSelectedNodeIndices(next)
        }

        setMarqueeVersion(v => v + 1)
        return true
      }

      // Hover detection (don't consume — let InteractiveCanvas handle cursor)
      const cmds = vectorShape.pathCommands
      const cpRef = findCpAt(ix, iy, cmds)
      if (cpRef) {
        setHoveredCp(cpRef)
        setHoveredNodeIndex(null)
        return false
      }

      const nodeIdx = findNodeAt(ix, iy, cmds)
      setHoveredNodeIndex(nodeIdx)
      if (nodeIdx !== null) setHoveredCp(null)
      else setHoveredCp(null)

      return false
    },
    [
      vectorShape,
      selectedShapeIndex,
      draggingNodeIndex,
      draggingCp,
      shapeSelections,
      onShapeSelectionsChange,
      applyNodeMove,
      applyCpMove,
      findCpAt,
      findNodeAt,
    ]
  )

  /** Returns true if a drag was completed */
  const handleMouseUp = useCallback((): boolean => {
    if (draggingNodeIndex !== null || draggingCp !== null) {
      setDraggingNodeIndex(null)
      setDraggingCp(null)
      return true
    }

    // Marquee drag completed — selection was already applied live in handleMouseMove
    const mStart = marqueeStartRef.current
    const mEnd = marqueeEndRef.current
    if (mStart) {
      const wasRealDrag = mEnd && (Math.abs(mEnd.x - mStart.x) > 3 || Math.abs(mEnd.y - mStart.y) > 3)

      if (!wasRealDrag) {
        // Click on empty area (no real drag) — clear selection
        setSelectedNodeIndices(new Set())
      }

      marqueeStartRef.current = null
      marqueeEndRef.current = null
      setMarqueeVersion(v => v + 1) // trigger redraw to clear marquee rect
      return wasRealDrag ?? false
    }

    return false
  }, [draggingNodeIndex, draggingCp])

  // ── Rendering (identity transform — all coords via transformImageToCanvas) ──

  const renderNodes = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!vectorShape) return

      const cmds = vectorShape.pathCommands

      // 1. Draw highlighted path outline
      ctx.beginPath()
      ctx.strokeStyle = '#0066ff'
      ctx.lineWidth = 2.5
      ctx.setLineDash([])

      for (const cmd of cmds) {
        const p = transformImageToCanvas(cmd.x, cmd.y)
        switch (cmd.type) {
          case 'M':
            ctx.moveTo(p.x, p.y)
            break
          case 'L':
            ctx.lineTo(p.x, p.y)
            break
          case 'Q': {
            const cp = cmd.cp ? transformImageToCanvas(cmd.cp.x, cmd.cp.y) : p
            ctx.quadraticCurveTo(cp.x, cp.y, p.x, p.y)
            break
          }
          case 'C': {
            const c1 = cmd.cp1 ? transformImageToCanvas(cmd.cp1.x, cmd.cp1.y) : p
            const c2 = cmd.cp2 ? transformImageToCanvas(cmd.cp2.x, cmd.cp2.y) : p
            ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)
            break
          }
          case 'Z':
            ctx.closePath()
            break
        }
      }
      ctx.stroke()

      // 2. Draw control point lines and diamond handles
      let prevX = 0
      let prevY = 0

      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i]

        if (cmd.type === 'Q' && cmd.cp) {
          const prev = transformImageToCanvas(prevX, prevY)
          const cp = transformImageToCanvas(cmd.cp.x, cmd.cp.y)
          const anchor = transformImageToCanvas(cmd.x, cmd.y)

          // Dashed lines: prev → cp → anchor
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(cp.x, cp.y)
          ctx.lineTo(anchor.x, anchor.y)
          ctx.stroke()
          ctx.setLineDash([])

          drawDiamondHandle(ctx, cp, i, 'cp', hoveredCp, draggingCp)
        }

        if (cmd.type === 'C') {
          const prev = transformImageToCanvas(prevX, prevY)
          const anchor = transformImageToCanvas(cmd.x, cmd.y)

          if (cmd.cp1) {
            const c1 = transformImageToCanvas(cmd.cp1.x, cmd.cp1.y)
            ctx.beginPath()
            ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.moveTo(prev.x, prev.y)
            ctx.lineTo(c1.x, c1.y)
            ctx.stroke()
            ctx.setLineDash([])
            drawDiamondHandle(ctx, c1, i, 'cp1', hoveredCp, draggingCp)
          }

          if (cmd.cp2) {
            const c2 = transformImageToCanvas(cmd.cp2.x, cmd.cp2.y)
            ctx.beginPath()
            ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.moveTo(anchor.x, anchor.y)
            ctx.lineTo(c2.x, c2.y)
            ctx.stroke()
            ctx.setLineDash([])
            drawDiamondHandle(ctx, c2, i, 'cp2', hoveredCp, draggingCp)
          }
        }

        if (cmd.type !== 'Z') {
          prevX = cmd.x
          prevY = cmd.y
        }
      }

      // 3. Draw anchor nodes on top of everything
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i]
        if (cmd.type === 'Z') continue

        const p = transformImageToCanvas(cmd.x, cmd.y)
        const isH = hoveredNodeIndex === i
        const isD = draggingNodeIndex === i
        const isSel = selectedNodeIndices.has(i)

        ctx.beginPath()
        ctx.arc(p.x, p.y, isH || isD || isSel ? NODE_RADIUS * 1.5 : NODE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = isD ? '#ff6600' : isSel ? '#0066ff' : isH ? '#0066ff' : '#ffffff'
        ctx.strokeStyle = isSel ? '#ff4444' : '#0066ff'
        ctx.lineWidth = isSel ? 2.5 : 2
        ctx.fill()
        ctx.stroke()
      }

      // 4. Draw marquee selection rectangle (read from refs — updated every mousemove)
      if (marqueeStartRef.current && marqueeEndRef.current) {
        const p1 = transformImageToCanvas(marqueeStartRef.current.x, marqueeStartRef.current.y)
        const p2 = transformImageToCanvas(marqueeEndRef.current.x, marqueeEndRef.current.y)
        const rx = Math.min(p1.x, p2.x)
        const ry = Math.min(p1.y, p2.y)
        const rw = Math.abs(p2.x - p1.x)
        const rh = Math.abs(p2.y - p1.y)

        ctx.fillStyle = 'rgba(0, 102, 255, 0.08)'
        ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeStyle = '#0066ff'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.setLineDash([])
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- marqueeVersion triggers redraw for ref-based marquee rect
    [
      vectorShape,
      transformImageToCanvas,
      hoveredNodeIndex,
      hoveredCp,
      draggingNodeIndex,
      draggingCp,
      selectedNodeIndices,
      marqueeVersion,
    ]
  )

  return {
    /** Whether a vector shape is selected and nodes should be shown */
    isActive,
    /** Whether user is actively dragging a node, control point, or marquee */
    isDragging: draggingNodeIndex !== null || draggingCp !== null || marqueeStartRef.current !== null,
    /** Hovered node index (for redraw dependency) */
    hoveredNodeIndex,
    /** Hovered control point (for redraw dependency) */
    hoveredCp,
    /** Currently selected node index (first in set, for backward compat) */
    selectedNodeIndex,
    /** All selected node indices (for multi-select) */
    selectedNodeIndices,
    /** Whether a marquee selection is in progress */
    isMarqueeSelecting: marqueeStartRef.current !== null,
    /** Increments each marquee move — use as redraw dependency */
    marqueeVersion,
    /** Delete a node by index. Returns true if deleted. */
    deleteNodeAtIndex,
    /** Delete all selected nodes. Returns true if any deleted. */
    deleteSelectedNodes,

    // Event handlers (accept image coordinates, return true if consumed)
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,

    // Rendering (identity transform — call with ctx.setTransform(1,0,0,1,0,0))
    renderNodes,
  }
}

// ── Standalone rendering helper ──

/** Draw a diamond-shaped control point handle */
function drawDiamondHandle(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  cmdIdx: number,
  cpType: 'cp' | 'cp1' | 'cp2',
  hoveredCp: ControlPointRef | null,
  draggingCp: ControlPointRef | null
) {
  const isH = hoveredCp?.commandIndex === cmdIdx && hoveredCp?.type === cpType
  const isD = draggingCp?.commandIndex === cmdIdx && draggingCp?.type === cpType
  const r = isH || isD ? CP_RADIUS * 1.5 : CP_RADIUS

  ctx.beginPath()
  ctx.moveTo(pos.x, pos.y - r)
  ctx.lineTo(pos.x + r, pos.y)
  ctx.lineTo(pos.x, pos.y + r)
  ctx.lineTo(pos.x - r, pos.y)
  ctx.closePath()

  ctx.fillStyle = isD ? '#ff6600' : isH ? '#0066ff' : '#ffffff'
  ctx.strokeStyle = '#0066ff'
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
}
