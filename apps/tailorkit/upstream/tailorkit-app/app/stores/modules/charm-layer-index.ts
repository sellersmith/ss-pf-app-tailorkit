/**
 * Charm Layer Index - O(1) lookup for CHARM layers by instanceId
 *
 * This module maintains a Map<instanceId, TLayerStore> for fast lookups
 * instead of O(n) scans through all extracted layers.
 *
 * Usage:
 * - Call `registerCharmLayer(instanceId, store)` when creating a CHARM layer
 * - Call `unregisterCharmLayer(instanceId)` when removing a CHARM layer
 * - Call `getCharmLayerByInstanceId(instanceId)` for O(1) lookup
 * - Call `clearCharmLayerIndex()` when resetting the editor state
 */

import type { TLayerStore } from '~/stores/modules/layer'

/** Map from instanceId to CHARM layer store */
const charmLayerIndex = new Map<string, TLayerStore>()

/**
 * Register a CHARM layer in the index for O(1) lookup
 * @param instanceId - The charm instance ID
 * @param layerStore - The CHARM layer store
 */
export function registerCharmLayer(instanceId: string, layerStore: TLayerStore): void {
  if (!instanceId) return
  charmLayerIndex.set(instanceId, layerStore)
}

/**
 * Unregister a CHARM layer from the index
 * @param instanceId - The charm instance ID to remove
 */
export function unregisterCharmLayer(instanceId: string): void {
  if (!instanceId) return
  charmLayerIndex.delete(instanceId)
}

/**
 * Get a CHARM layer store by instanceId - O(1) lookup
 * @param instanceId - The charm instance ID
 * @returns The CHARM layer store, or undefined if not found
 */
export function getCharmLayerByInstanceId(instanceId: string): TLayerStore | undefined {
  if (!instanceId) return undefined
  return charmLayerIndex.get(instanceId)
}

/**
 * Check if an instanceId is registered
 * @param instanceId - The charm instance ID
 * @returns true if the instanceId is in the index
 */
export function hasCharmLayer(instanceId: string): boolean {
  return charmLayerIndex.has(instanceId)
}

/**
 * Clear all entries from the index
 * Call this when resetting editor state or loading a new template
 */
export function clearCharmLayerIndex(): void {
  charmLayerIndex.clear()
}

/**
 * Get the current size of the index (for debugging)
 */
export function getCharmLayerIndexSize(): number {
  return charmLayerIndex.size
}

/**
 * Get all registered instanceIds (for debugging)
 */
export function getAllCharmInstanceIds(): string[] {
  return Array.from(charmLayerIndex.keys())
}
