/**
 * Charm-builder utility functions
 *
 * Pure functions for extracting charm data from print areas,
 * building default state, and resolving slot references.
 */

import type { CharmNodeLayer, CharmSlotNode } from './types'

/**
 * Extract the first charm-node layer from prepared print areas.
 * Returns null if no charm-node layer exists.
 */
export function extractCharmNodeFromPrintAreas(printAreas: any[]): CharmNodeLayer | null {
  for (const pa of printAreas) {
    const layers = pa.ls || pa.layers || []
    for (const layer of layers) {
      if (layer.t === 'charm-node') return layer as CharmNodeLayer
    }
  }
  return null
}

/**
 * Build default slot→charm assignments from charm node data.
 * Pre-assigns charms to slots based on linked product transform data.
 */
export function buildDefaultAssignments(charmNode: CharmNodeLayer): Record<string, string> {
  const assignments: Record<string, string> = {}

  for (const product of charmNode.lp) {
    for (const transform of product.tr || []) {
      // Match transform position to slot — find nearest slot
      const slot = charmNode.nd.find(nd => Math.abs(nd.x - transform.x) < 1 && Math.abs(nd.y - transform.y) < 1)
      if (slot) {
        assignments[slot.i] = product.i
      }
    }
  }

  return assignments
}

/**
 * Build default positions map from slot nodes.
 * Uses the server-prepared (x, y) coordinates as initial positions.
 */
export function buildDefaultPositions(nodes: CharmSlotNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    positions[node.i] = { x: node.x, y: node.y }
  }
  return positions
}

/**
 * Count the number of slots that have a charm assigned.
 */
export function countAssignedSlots(assignments: Record<string, string>): number {
  return Object.keys(assignments).filter(key => assignments[key]).length
}

/**
 * Resolve a slot node by its ID.
 * Returns undefined if not found.
 */
export function resolveSlotById(nodes: CharmSlotNode[], slotId: string): CharmSlotNode | undefined {
  return nodes.find(node => node.i === slotId)
}
