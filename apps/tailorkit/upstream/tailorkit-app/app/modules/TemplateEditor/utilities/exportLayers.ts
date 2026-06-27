import Konva from 'konva'
import type { Node } from 'konva/lib/Node'
import type { Stage } from 'konva/lib/Stage'
import { prepareStageForExport } from './canvas'

export interface ExportLayerOptions {
  format: 'png' | 'jpg'
  scale: 1 | 2 | 3
}

interface LayerState {
  _id: string
  left?: number
  top?: number
  width?: number
  height?: number
  rotate?: number
  [key: string]: unknown
}

/** Konva Node with internal _id property for deduplication */
interface KonvaNodeWithInternalId extends Node {
  _id: number
}

/**
 * Calculate the rotated bounding box for a single layer
 * Rotates around the center (matching Konva's default behavior)
 */
function getRotatedBounds(state: LayerState): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const left = state.left || 0
  const top = state.top || 0
  const width = state.width || 0
  const height = state.height || 0
  const rotate = state.rotate || 0

  // No rotation - return simple bounds
  if (rotate === 0) {
    return {
      minX: left,
      minY: top,
      maxX: left + width,
      maxY: top + height,
    }
  }

  // Rotate around center (matching Konva's default behavior)
  const centerX = left + width / 2
  const centerY = top + height / 2
  const rad = (rotate * Math.PI) / 180

  const corners = [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ]

  const rotated = corners.map(c => ({
    x: centerX + (c.x - centerX) * Math.cos(rad) - (c.y - centerY) * Math.sin(rad),
    y: centerY + (c.x - centerX) * Math.sin(rad) + (c.y - centerY) * Math.cos(rad),
  }))

  const xs = rotated.map(p => p.x)
  const ys = rotated.map(p => p.y)

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

/**
 * Get the combined bounding box from layer states
 * Uses layer dimensions (not Konva getClientRect) to exclude effects from bounds
 * This ensures text effects (drop shadows, etc.) don't expand the export area
 */
function getCombinedBoundingBoxFromStates(layerStates: LayerState[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (layerStates.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  // Calculate rotated bounds for each layer
  const boundingBoxes = layerStates.map(getRotatedBounds)

  // Find overall min/max across all layers
  const minX = boundingBoxes.reduce((min, b) => Math.min(min, b.minX), Infinity)
  const minY = boundingBoxes.reduce((min, b) => Math.min(min, b.minY), Infinity)
  const maxX = boundingBoxes.reduce((max, b) => Math.max(max, b.maxX), -Infinity)
  const maxY = boundingBoxes.reduce((max, b) => Math.max(max, b.maxY), -Infinity)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Find the top-level element group for each layer ID
 *
 * Layer structure examples:
 * - Text: Group (no id) > [Rect (id=layerId), KonvaTextWithEffects]
 * - Image: Group (id=layerId-wrapper) > [KonvaImageWithMask (id=layerId), ...]
 *
 * In both cases, we want to export the top-level Group that's directly under the canvas layer.
 */
function findTopLevelNodes(canvasLayer: Konva.Layer, layerIds: string[]): Node[] {
  const layerIdSet = new Set(layerIds)
  const selectedNodes: Node[] = []
  const processedNodeIds = new Set<number>() // Track by Konva internal _id to avoid duplicates

  canvasLayer.find((node: Node) => {
    const nodeId = node.id()
    if (layerIdSet.has(nodeId)) {
      // Walk up to find the top-level group directly under canvas layer
      let targetNode: Node = node
      let current: Node | null = node

      while (current && current.parent !== canvasLayer) {
        if (current.parent && current.parent.getClassName() === 'Group') {
          targetNode = current.parent as Node
        }
        current = current.parent as Node | null
      }

      // If we found a parent that's directly under canvas layer, use that
      if (current && current.parent === canvasLayer) {
        targetNode = current
      }

      // Avoid adding the same node twice (e.g., if multiple children have IDs)
      const internalId = (targetNode as KonvaNodeWithInternalId)._id
      if (!processedNodeIds.has(internalId)) {
        processedNodeIds.add(internalId)
        selectedNodes.push(targetNode)
      }
    }
    return false
  })

  return selectedNodes
}

/**
 * Export selected layers as a single merged image blob
 *
 * Uses layer state dimensions for bounds calculation to exclude effects (drop shadows, etc.)
 * from expanding the export area. The visual content including effects is still rendered.
 *
 * @param stage - The Konva stage
 * @param layerIds - Array of layer IDs to export
 * @param layerStates - Layer state objects with dimensions (used for bounds calculation)
 * @param options - Export options (format, scale)
 */
export function exportLayersAsBlob(
  stage: Stage,
  layerIds: string[],
  layerStates: LayerState[],
  options: ExportLayerOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Track clonedStage for cleanup in case of errors
    let clonedStage: ReturnType<typeof prepareStageForExport>['clonedStage'] | null = null

    try {
      // Calculate bounds from layer states (excludes effects like drop shadows)
      const bounds = getCombinedBoundingBoxFromStates(layerStates)

      if (bounds.width <= 0 || bounds.height <= 0) {
        reject(new Error('Selected layers have no visible content'))
        return
      }

      // Use shared utility to clone and prepare stage for export
      // This handles: cloning with normalized transforms, removing editor helpers, restoring cache
      const prepared = prepareStageForExport(stage, stage.width(), stage.height())
      clonedStage = prepared.clonedStage
      const canvasLayer = prepared.canvasLayer

      // Find the top-level nodes for the selected layers
      const clonedSelectedNodes = findTopLevelNodes(canvasLayer, layerIds)

      if (clonedSelectedNodes.length === 0) {
        clonedStage.destroy()
        reject(new Error('No nodes found for the selected layers'))
        return
      }

      // Create a temporary layer for export
      const tempLayer = new Konva.Layer()

      // For JPG, add white background first
      if (options.format === 'jpg') {
        const bgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: bounds.width,
          height: bounds.height,
          fill: 'white',
        })
        tempLayer.add(bgRect)
      }

      // Create a group to hold the nodes, offset by the bounding box position
      const exportGroup = new Konva.Group({
        x: -bounds.x,
        y: -bounds.y,
      })

      // Move cloned nodes to the export group
      clonedSelectedNodes.forEach(node => {
        node.remove()
        exportGroup.add(node)
      })

      tempLayer.add(exportGroup)
      clonedStage.add(tempLayer)

      // Hide the original canvas layer in the cloned stage
      canvasLayer.hide()

      const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg'
      const quality = options.format === 'png' ? 1 : 0.92

      const timeoutId = setTimeout(() => {
        clonedStage.destroy()
        reject(new Error('Export operation timed out'))
      }, 10000)

      tempLayer.toBlob({
        width: bounds.width,
        height: bounds.height,
        pixelRatio: options.scale,
        mimeType,
        quality,
        callback: (blob: Blob | null) => {
          clearTimeout(timeoutId)
          clonedStage.destroy()

          if (!blob) {
            reject(new Error('Failed to generate image blob'))
            return
          }

          resolve(blob)
        },
      })
    } catch (error) {
      // Ensure cleanup even if an error occurs after cloning
      if (clonedStage) {
        clonedStage.destroy()
      }
      console.error('Error exporting layers:', error)
      reject(error as Error)
    }
  })
}

/**
 * Trigger browser download for a blob
 * @param blob - The blob to download
 * @param filename - The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Generate a filename for the exported layer(s)
 * @param layerNames - Array of layer names
 * @param format - Export format (png/jpg)
 * @param scale - Export scale (1/2/3)
 */
export function generateExportFilename(layerNames: string[], format: 'png' | 'jpg', scale: number): string {
  const baseName
    = layerNames.length === 1
      ? layerNames[0]
          .replace(/[^a-zA-Z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'layer'
      : 'merged-layers'

  return `${baseName}-${scale}x.${format}`
}
