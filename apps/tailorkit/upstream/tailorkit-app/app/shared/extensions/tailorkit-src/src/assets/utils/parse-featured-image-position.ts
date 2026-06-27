/**
 * Shared parser for the block-level `featured_image_position` setting.
 *
 * Accepts whatever shape Liquid/Shopify pushes through JSON (number, numeric string,
 * null, undefined) and normalises to a positive integer ≥ DEFAULT_FEATURED_IMAGE_POSITION,
 * or `undefined` when the value is missing / invalid.
 *
 * Callers MUST treat `DEFAULT_FEATURED_IMAGE_POSITION` as "no-op" — position-based
 * code paths should only activate when the returned value is strictly greater
 * than this default.
 */

/**
 * Default 1-based position of the product image used for the preview canvas.
 * Merchants opt into non-default behavior by setting a higher value (e.g. 2).
 */
export const DEFAULT_FEATURED_IMAGE_POSITION = 1

/** Parse merchant-provided `featured_image_position` to a positive integer or undefined. */
export function parseFeaturedImagePosition(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < DEFAULT_FEATURED_IMAGE_POSITION) return undefined
  return Math.floor(n)
}
