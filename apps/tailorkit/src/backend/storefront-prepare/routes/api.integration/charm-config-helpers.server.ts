import type { CharmNodeSettings, CharmProductRef, CharmSlotNode } from '../../types/psd'

/**
 * Minimal layer shape needed for charm config extraction. `settings` is the full Layer settings
 * union (charm config is narrowed internally) so the populated `Template.layers: LayerDocument[]`
 * — whose `settings` is a wider union — assigns without a cast at the call site.
 */
type LayerInput = {
  _id: string
  type: string
  settings?: CharmNodeSettings | { [key: string]: unknown }
}

/** Storefront charm config shape */
type StorefrontCharmConfig = {
  layerId: string
  displayStyle: string
  label?: string
  maxCharms?: number
  allowMultiple: boolean
  nodes?: Array<{
    _id: string
    x: number
    y: number
    slotLimit: number
    label: string
    defaultCharmId?: string
  }>
  products: Array<{
    _id: string
    productId: string
    variantId: string
    defaultQuantity?: number
  }>
}

/**
 * Extract all charm-node layer settings into compact storefront configs.
 * Returns an empty array if no charm-node layers exist or none have linked products.
 *
 * Strips admin-only fields (transforms, isAddingNodeMode) and keeps only
 * essential storefront data to minimize metafield payload size.
 *
 * Note: Intentionally skips template-level visibility filtering —
 * charm-node config should always be included if linked products exist,
 * since charm rendering is handled separately from regular layer rendering.
 */
export const prepareCharmConfigs = (layers: LayerInput[]): StorefrontCharmConfig[] => {
  return layers
    .filter(l => l.type === 'charm-node' && l.settings)
    .map((charmNodeLayer): StorefrontCharmConfig | null => {
      const settings = charmNodeLayer.settings as CharmNodeSettings
      if (!settings.linkedProducts?.length) return null

      return {
        layerId: charmNodeLayer._id,
        displayStyle: settings.displayStyle || 'FIXED',
        ...(settings.storefrontLabel ? { label: settings.storefrontLabel } : {}),
        ...(settings.maxCharms ? { maxCharms: getEffectiveMaxCharms(settings) } : {}),
        allowMultiple: settings.allowMultipleAssignments || false,
        ...(settings.nodes?.length
          ? {
              nodes: settings.nodes.filter(Boolean).map((n: CharmSlotNode) => ({
                _id: n._id,
                x: n.x,
                y: n.y,
                slotLimit: n.slotLimit,
                label: n.label,
                ...(n.defaultCharm?._id ? { defaultCharmId: n.defaultCharm._id } : {}),
              })),
            }
          : {}),
        // Only store stable IDs in metafield — all other product data (title, price,
        // thumbnail, availability) is fetched at runtime from the Storefront API.
        // This prevents stale data and eliminates re-publish when product info changes.
        products: settings.linkedProducts.filter(Boolean).map((p: CharmProductRef) => ({
          _id: p._id,
          productId: p.shopifyProductId,
          // Extract numeric ID from GID (e.g. "gid://shopify/ProductVariant/123" → "123")
          // /cart/add.js requires numeric variant IDs, not GID format
          variantId:
            String(p.selectedVariantId || '')
              .split('/')
              .pop() || '',
          // Default placement count — declarative intent from merchant, resolved by storefront at render time
          ...(p.isDefault && p.defaultQuantity ? { defaultQuantity: p.defaultQuantity } : {}),
        })),
      }
    })
    .filter((config): config is StorefrontCharmConfig => config !== null)
}

/**
 * @deprecated Use `prepareCharmConfigs` (plural). Backward compat shim for Phase 2→3 rollout.
 * Remove after storefront reads charmConfigs[] (target: v1.37.0, ~2026-05-01).
 * TODO(multi-charm-cleanup): Remove this function and dual-emit in preparation-fns.server.ts
 */
export const prepareCharmConfig = (layers: LayerInput[]): StorefrontCharmConfig | null => {
  const configs = prepareCharmConfigs(layers)
  return configs[0] ?? null
}

/** In FIXED mode, cap maxCharms at total slot capacity to prevent overflow */
function getEffectiveMaxCharms(settings: CharmNodeSettings): number {
  const nodeCount = (settings.nodes || []).length
  const maxCharms = settings.maxCharms || nodeCount
  const displayStyle = settings.displayStyle || 'FIXED'
  if (displayStyle === 'FREE') return maxCharms
  const nodes = settings.nodes?.filter(Boolean) || []
  const totalSlotCapacity = nodes.reduce((sum, n) => sum + (n.slotLimit || 1), 0)
  return totalSlotCapacity > 0 ? Math.min(maxCharms, totalSlotCapacity) : maxCharms
}
