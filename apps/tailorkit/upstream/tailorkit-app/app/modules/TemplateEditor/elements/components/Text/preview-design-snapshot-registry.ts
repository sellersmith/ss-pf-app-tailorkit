/**
 * Module-level registry that stores design-time snapshots for layers currently
 * in preview mode. When the save flow runs while a layer is being previewed,
 * it reads from this registry to overlay the original design values onto the
 * serialized state — preventing preview-dragged positions from bleeding into
 * the persisted data and the storefront.
 *
 * Populated by TextWithZoneGroupRenderer on preview enter; cleared on exit.
 * Read by useSaveTemplate before sending layer data to the server.
 */

import type { ShapeSetting } from '~/types/psd'

export interface DesignSnapshot {
  left: number
  top: number
  width: number
  height: number
  rotate: number
  shapeSettings: ShapeSetting | undefined
}

const registry = new Map<string, DesignSnapshot>()

export function registerDesignSnapshot(layerId: string, snapshot: DesignSnapshot): void {
  registry.set(layerId, snapshot)
}

export function unregisterDesignSnapshot(layerId: string): void {
  registry.delete(layerId)
}

export function getDesignSnapshot(layerId: string): DesignSnapshot | undefined {
  return registry.get(layerId)
}
