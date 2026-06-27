/**
 * Immutable update utilities for VectorEditor
 * Efficient shallow copy operations to avoid expensive JSON.parse/stringify deep cloning
 */

import type { ParsedPath, Point } from './svg'

/**
 * Update a single command's position immutably
 */
export function updateCommandPosition(
  paths: ParsedPath[],
  pathIndex: number,
  nodeIndex: number,
  x: number,
  y: number
): ParsedPath[] {
  const newPaths = [...paths]
  const newPath = { ...newPaths[pathIndex] }
  const newCommands = [...newPath.commands]
  newCommands[nodeIndex] = { ...newCommands[nodeIndex], x, y }
  newPath.commands = newCommands
  newPaths[pathIndex] = newPath
  return newPaths
}

/**
 * Update a control point position immutably
 */
export function updateControlPointPosition(
  paths: ParsedPath[],
  pathIndex: number,
  nodeIndex: number,
  cpIndex: number,
  x: number,
  y: number
): ParsedPath[] {
  const newPaths = [...paths]
  const newPath = { ...newPaths[pathIndex] }
  const newCommands = [...newPath.commands]
  const cmd = { ...newCommands[nodeIndex] }

  if (cpIndex === 0 && cmd.cp1) {
    cmd.cp1 = { x, y }
  } else if (cpIndex === 1 && cmd.cp2) {
    cmd.cp2 = { x, y }
  } else if (cmd.cp) {
    cmd.cp = { x, y }
  }

  newCommands[nodeIndex] = cmd
  newPath.commands = newCommands
  newPaths[pathIndex] = newPath
  return newPaths
}

/**
 * Update multiple nodes' positions immutably (for multi-node drag)
 * Also handles control points for bezier curves to preserve shape
 */
export function updateMultipleNodePositions(
  paths: ParsedPath[],
  pathIndex: number,
  originalPositions: Map<number | string, Point>,
  deltaX: number,
  deltaY: number
): ParsedPath[] {
  const newPaths = [...paths]
  const newPath = { ...newPaths[pathIndex] }
  const newCommands = [...newPath.commands]

  originalPositions.forEach((original, key) => {
    // Handle main node positions (numeric keys)
    if (typeof key === 'number') {
      const nodeIndex = key
      const newCmd = { ...newCommands[nodeIndex] }
      newCmd.x = original.x + deltaX
      newCmd.y = original.y + deltaY

      // Handle control points for this node
      const cp1Orig = originalPositions.get(`cp1_${nodeIndex}`)
      if (newCmd.cp1 && cp1Orig) {
        newCmd.cp1 = { x: cp1Orig.x + deltaX, y: cp1Orig.y + deltaY }
      }

      const cp2Orig = originalPositions.get(`cp2_${nodeIndex}`)
      if (newCmd.cp2 && cp2Orig) {
        newCmd.cp2 = { x: cp2Orig.x + deltaX, y: cp2Orig.y + deltaY }
      }

      const cpOrig = originalPositions.get(`cp_${nodeIndex}`)
      if (newCmd.cp && cpOrig) {
        newCmd.cp = { x: cpOrig.x + deltaX, y: cpOrig.y + deltaY }
      }

      newCommands[nodeIndex] = newCmd
    }
  })

  newPath.commands = newCommands
  newPaths[pathIndex] = newPath
  return newPaths
}

/**
 * Update an entire path's position immutably (for path drag)
 * Handles main coordinates and all control points
 */
export function updatePathPosition(
  paths: ParsedPath[],
  pathIndex: number,
  originalPositions: Map<number | string, Point>,
  deltaX: number,
  deltaY: number
): ParsedPath[] {
  const newPaths = [...paths]
  const newPath = { ...newPaths[pathIndex] }
  const newCommands = [...newPath.commands]

  newCommands.forEach((cmd, idx) => {
    const original = originalPositions.get(idx)
    if (original) {
      const newCmd = { ...cmd }
      newCmd.x = original.x + deltaX
      newCmd.y = original.y + deltaY

      const cp1Orig = originalPositions.get(`cp1_${idx}`)
      if (newCmd.cp1 && cp1Orig) {
        newCmd.cp1 = { x: cp1Orig.x + deltaX, y: cp1Orig.y + deltaY }
      }

      const cp2Orig = originalPositions.get(`cp2_${idx}`)
      if (newCmd.cp2 && cp2Orig) {
        newCmd.cp2 = { x: cp2Orig.x + deltaX, y: cp2Orig.y + deltaY }
      }

      const cpOrig = originalPositions.get(`cp_${idx}`)
      if (newCmd.cp && cpOrig) {
        newCmd.cp = { x: cpOrig.x + deltaX, y: cpOrig.y + deltaY }
      }

      newCommands[idx] = newCmd
    }
  })

  newPath.commands = newCommands
  newPaths[pathIndex] = newPath
  return newPaths
}
