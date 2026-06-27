/**
 * Hit Detection Hook
 * Handles finding paths, nodes, control points, and rotation handles at screen positions
 */

import { useCallback } from 'react'
import { serializePathCommands, calculatePathBounds, calculatePathCenter } from '../../../utils/svg'
import type { Point, ParsedSvg, PathCommand } from '../../../utils/svg'
import type { HoveredConnectedSegment } from '../../../types'
import { HIT_TOLERANCE, ROTATION_HANDLE_OFFSET, ROTATION_HANDLE_RADIUS } from '../../../constants'

export interface HitDetectionResult {
  type: 'node' | 'control-point'
  nodeIndex: number
  cpIndex?: number
}

export interface UseHitDetectionProps {
  parsedSvg: ParsedSvg
  selectedPathIndex: number | null
  selectedNodeIndex: number | null
  selectedNodeIndices: Set<number>
  hoveredConnectedSegment: HoveredConnectedSegment | null
  editorMode: 'select' | 'edit' | 'draw'
  scaleRef: React.RefObject<number>
  screenToSvg: (screenX: number, screenY: number) => Point
  svgToScreen: (svgX: number, svgY: number) => Point
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function useHitDetection({
  parsedSvg,
  selectedPathIndex,
  selectedNodeIndex,
  selectedNodeIndices,
  hoveredConnectedSegment,
  editorMode,
  scaleRef,
  screenToSvg,
  svgToScreen,
  canvasRef,
}: UseHitDetectionProps) {
  // Find which path contains the given screen position
  // NOTE: Rotation is now baked into path coordinates, so no special rotation handling needed
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
    [parsedSvg, screenToSvg, canvasRef]
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

  // Find node or control point at position
  // Only considers nodes that are currently visible (in hovered segment or selected)
  // NOTE: Rotation is now baked into path coordinates, so no special rotation handling needed
  const findElementAtPosition = useCallback(
    (screenX: number, screenY: number): HitDetectionResult | null => {
      if (selectedPathIndex === null || !parsedSvg) return null

      const path = parsedSvg.paths[selectedPathIndex]

      // Determine which nodes are currently visible/interactable
      const visibleNodes: Set<number> | null
        = hoveredConnectedSegment?.pathIndex === selectedPathIndex
          ? new Set(hoveredConnectedSegment.segment.nodeIndices)
          : null

      // Also always allow interaction with selected nodes
      const isNodeVisible = (nodeIndex: number) => {
        if (nodeIndex === selectedNodeIndex) return true
        if (selectedNodeIndices.has(nodeIndex)) return true
        if (visibleNodes === null) return false // No hovered segment means no visible nodes
        return visibleNodes.has(nodeIndex)
      }

      for (let i = path.commands.length - 1; i >= 0; i--) {
        // Skip nodes that aren't visible
        if (!isNodeVisible(i)) continue

        const command = path.commands[i]

        // Check control points first (only for selected node)
        if (i === selectedNodeIndex) {
          if (command.cp1) {
            const cp1Screen = svgToScreen(command.cp1.x, command.cp1.y)
            const dist = Math.sqrt(Math.pow(screenX - cp1Screen.x, 2) + Math.pow(screenY - cp1Screen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point', nodeIndex: i, cpIndex: 0 }
            }
          }

          if (command.cp2) {
            const cp2Screen = svgToScreen(command.cp2.x, command.cp2.y)
            const dist = Math.sqrt(Math.pow(screenX - cp2Screen.x, 2) + Math.pow(screenY - cp2Screen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point', nodeIndex: i, cpIndex: 1 }
            }
          }

          if (command.cp) {
            const cpScreen = svgToScreen(command.cp.x, command.cp.y)
            const dist = Math.sqrt(Math.pow(screenX - cpScreen.x, 2) + Math.pow(screenY - cpScreen.y, 2))
            if (dist <= HIT_TOLERANCE) {
              return { type: 'control-point', nodeIndex: i, cpIndex: 0 }
            }
          }
        }

        // Check main node
        if (command.type.toUpperCase() !== 'Z') {
          const nodeScreen = svgToScreen(command.x, command.y)
          const dist = Math.sqrt(Math.pow(screenX - nodeScreen.x, 2) + Math.pow(screenY - nodeScreen.y, 2))
          if (dist <= HIT_TOLERANCE) {
            return { type: 'node', nodeIndex: i }
          }
        }
      }

      return null
    },
    [selectedPathIndex, parsedSvg, svgToScreen, hoveredConnectedSegment, selectedNodeIndex, selectedNodeIndices]
  )

  // Check if screen position is over the rotation handle
  const isOverRotationHandle = useCallback(
    (screenX: number, screenY: number): boolean => {
      if (selectedPathIndex === null || !parsedSvg) return false
      // Rotation handle is only shown when no nodes are selected
      if (selectedNodeIndex !== null || selectedNodeIndices.size > 0) return false
      if (editorMode !== 'edit') return false

      const path = parsedSvg.paths[selectedPathIndex]
      const bounds = calculatePathBounds(path.commands)
      const center = calculatePathCenter(path.commands)

      // Handle position in SVG coords (same calculation as in renderCanvas)
      const handleY = bounds.minY - ROTATION_HANDLE_OFFSET / (scaleRef.current ?? 1)

      // Convert handle position to screen coords
      const handleScreen = svgToScreen(center.x, handleY)

      // Check distance
      const dist = Math.sqrt(Math.pow(screenX - handleScreen.x, 2) + Math.pow(screenY - handleScreen.y, 2))
      return dist <= ROTATION_HANDLE_RADIUS + HIT_TOLERANCE
    },
    [selectedPathIndex, parsedSvg, selectedNodeIndex, selectedNodeIndices, editorMode, svgToScreen, scaleRef]
  )

  // Find the start index of the current (unclosed) subpath
  const getCurrentSubpathStartIndex = useCallback((path: PathCommand[]): number => {
    // Search backwards for the last M or Z command
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].type === 'M') {
        return i // Start from this M command
      }
      if (path[i].type === 'Z') {
        return i + 1 // Start from after this Z command (next subpath)
      }
    }
    return 0
  }, [])

  // Find drawing path node at position (for closing current subpath)
  const findDrawingNodeAtPosition = useCallback(
    (screenX: number, screenY: number, drawingPath: PathCommand[] | null): number | null => {
      if (!drawingPath || drawingPath.length < 2) return null

      // Find the start of the current subpath
      const currentSubpathStart = getCurrentSubpathStartIndex(drawingPath)

      // Need at least 2 nodes in current subpath to close it
      if (drawingPath.length - currentSubpathStart < 2) return null

      // Only check nodes in the CURRENT subpath (not already-closed subpaths)
      // Exclude the last node (can't close to the node being drawn from)
      for (let i = currentSubpathStart; i < drawingPath.length - 1; i++) {
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
    [svgToScreen, getCurrentSubpathStartIndex]
  )

  return {
    findPathAtPosition,
    findElementAtPosition,
    isOverRotationHandle,
    isOutsideViewBox,
    getCurrentSubpathStartIndex,
    findDrawingNodeAtPosition,
  }
}
