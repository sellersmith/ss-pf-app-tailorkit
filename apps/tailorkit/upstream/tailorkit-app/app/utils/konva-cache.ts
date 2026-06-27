/**
 * Konva Cache Management Utilities
 *
 * Handles cache restoration after stage cloning operations.
 * When Konva clones a stage, cached canvas data is not transferred,
 * causing composite operations and other cache-dependent features to fail.
 *
 * @module utils/konva-cache
 */

import type Konva from 'konva'

export const INNER_SHADOW_CACHE_GROUP_NAME = 'inner-shadow-cache-group'
export const MASK_COMPOSITE_CACHE_GROUP_NAME = 'mask-composite-cache-group'

/**
 * Cached group data attributes interface
 * These attributes are stored on groups to preserve cache parameters across cloning
 */
export interface CachedGroupAttrs {
  'data-cache-width'?: number
  'data-cache-height'?: number
  'data-font-size'?: number
}

/**
 * Konva cache configuration interface
 */
interface CacheConfig {
  imageSmoothingEnabled: boolean
  x?: number
  y?: number
  width?: number
  height?: number
  pixelRatio?: number
}

/**
 * Cache group configurations
 * Add new cache groups here as features are developed
 */
const CACHE_GROUP_SELECTORS = {
  INNER_SHADOW: `.${INNER_SHADOW_CACHE_GROUP_NAME}`,
  MASK_COMPOSITE: `.${MASK_COMPOSITE_CACHE_GROUP_NAME}`,
  // Future cache groups can be added here:
  // OUTER_GLOW: '.outer-glow-cache-group',
  // BLEND_MODE: '.blend-mode-cache-group',
} as const

/**
 * Checks if a group is a mask composite cache group
 * @param group - The Konva group to check
 * @returns True if the group is marked for mask composite caching
 */
function isMaskCompositeGroup(group: Konva.Group): boolean {
  // Use hasName to check for the cache group name in space-separated names
  // e.g., "layer mask-composite-cache-group" will match
  return group.hasName(MASK_COMPOSITE_CACHE_GROUP_NAME)
}

/**
 * Restores cache for all cached groups in a cloned layer
 *
 * This function should be called immediately after cloning a stage
 * and before rendering/exporting it. It ensures all cache-dependent
 * features (like inner shadows with globalCompositeOperation) work correctly.
 *
 * IMPORTANT: The cache pixelRatio should match your export pixelRatio to prevent
 * edge artifacts. If you're exporting with toBlob({ pixelRatio: 1 }), don't pass
 * a custom pixelRatio here (or explicitly pass pixelRatio: 1).
 *
 * @param layer - The layer from the cloned stage (typically canvasLayer)
 * @param options - Optional configuration
 * @param options.pixelRatio - Custom pixel ratio (must match toBlob pixelRatio to avoid white lines)
 * @param options.selectors - Custom selectors to restore (defaults to all known cache groups)
 *
 * @example
 * ```typescript
 * const clonedStage = stage.clone({ ... })
 * const canvasLayer = clonedStage.findOne(`#${CANVAS_EDITOR_LAYER}`)
 *
 * // Restore with default pixelRatio (safest for composite operations)
 * restoreClonedCache(canvasLayer)
 *
 * // If exporting with custom pixelRatio, match it here
 * canvasLayer.toBlob({ pixelRatio: 2, ... })
 * restoreClonedCache(canvasLayer, { pixelRatio: 2 })
 * ```
 */
export function restoreClonedCache(
  layer: Konva.Layer | Konva.Group,
  options?: {
    pixelRatio?: number
    selectors?: string[]
  }
): void {
  if (!layer) {
    console.warn('[restoreClonedCache] No layer provided, skipping cache restoration')
    return
  }

  const selectors = options?.selectors || Object.values(CACHE_GROUP_SELECTORS)
  const customPixelRatio = options?.pixelRatio

  // Process each cache group type
  selectors.forEach(selector => {
    try {
      const cacheGroups = layer.find(selector) as Konva.Group[]

      if (!cacheGroups || cacheGroups.length === 0) {
        return // No groups found for this selector, skip silently
      }

      cacheGroups.forEach((group: Konva.Group) => {
        try {
          // Clear any stale cache reference from cloning
          group.clearCache()

          // Try to get cached parameters from data attributes
          const groupAttrs = group.attrs as CachedGroupAttrs
          const cacheWidth = groupAttrs['data-cache-width']
          const cacheHeight = groupAttrs['data-cache-height']
          const fontSize = groupAttrs['data-font-size'] || 16

          // Calculate padding
          // For INNER_SHADOW: use fontSize * 2 (buffer for shadow blur)
          // For MASK_COMPOSITE: no padding needed (exact dimensions)
          const padding = isMaskCompositeGroup(group) ? 0 : fontSize * 2

          // Re-cache with proper bounds and optional custom pixel ratio
          // CRITICAL: Must include cache bounds to prevent white line artifacts at high pixelRatio
          const cacheConfig: CacheConfig = {
            imageSmoothingEnabled: false, // Disable to prevent antialiasing artifacts with globalCompositeOperation
          }

          // If we have stored cache dimensions, use them with padding offset
          if (cacheWidth && cacheHeight) {
            cacheConfig.x = -padding
            cacheConfig.y = -padding
            cacheConfig.width = cacheWidth + padding * 2
            cacheConfig.height = cacheHeight + padding * 2
          }

          if (customPixelRatio !== undefined) {
            cacheConfig.pixelRatio = customPixelRatio
          }

          group.cache(cacheConfig)
        } catch (error) {
          console.error(`[restoreClonedCache] Failed to restore cache for group:`, error)
        }
      })
    } catch (error) {
      console.error(`[restoreClonedCache] Failed to process selector "${selector}":`, error)
    }
  })
}

/**
 * Restores cache for a specific cache group type only
 *
 * @param layer - The layer from the cloned stage
 * @param groupType - The cache group type to restore
 * @param pixelRatio - Optional custom pixel ratio
 *
 * @example
 * ```typescript
 * // Only restore inner shadow caches
 * restoreSpecificCache(canvasLayer, 'INNER_SHADOW', 2)
 * ```
 */
export function restoreSpecificCache(
  layer: any,
  groupType: keyof typeof CACHE_GROUP_SELECTORS,
  pixelRatio?: number
): void {
  const selector = CACHE_GROUP_SELECTORS[groupType]

  if (!selector) {
    console.warn(`[restoreSpecificCache] Unknown cache group type: ${groupType}`)
    return
  }

  restoreClonedCache(layer, {
    selectors: [selector],
    pixelRatio,
  })
}

/**
 * Export cache group selectors for external use
 */
export { CACHE_GROUP_SELECTORS }
