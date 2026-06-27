/**
 * Generate a stable hash representing the selected variant set used for caching.
 *
 * Even if the editor renders with `variants[0]` only, changing the selected variants set
 * should invalidate/refresh the single cached suggestion entry.
 *
 * @param variantIds - List of selected variant ids (Shopify variant id preferred)
 * @returns Stable hash string (sorted join) or "_default_" when empty
 */
export function generateVariantHash(variantIds: string[]): string {
  const normalized = (variantIds || [])
    .map(String)
    .map(s => s.trim())
    .filter(Boolean)
  if (normalized.length === 0) return '_default_'
  normalized.sort()
  return normalized.join('|')
}
