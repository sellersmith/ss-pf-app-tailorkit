/**
 * Konva Cache Constants and Types
 *
 * Local copy for extension builds - must be kept in sync with app/utils/konva-cache.ts
 */

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
