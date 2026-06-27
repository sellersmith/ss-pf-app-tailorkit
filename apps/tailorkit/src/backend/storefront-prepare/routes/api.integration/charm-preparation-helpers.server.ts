import { CHARM_THUMB_SIZE } from '../../modules/TemplateEditor/elements/components/CharmNode/charm-node-utils'
import type { CharmNodeSettings, CharmProductRef, CharmSlotNode, CharmTransformInstance } from '../../types/psd'

/**
 * Prepare a single charm product for storefront metafield.
 *
 * P1-11/P1-12: Only exports IDs + transforms. Storefront fetches live product
 * data (title, price, image) from Storefront API using productId.
 *
 * This keeps metafield payload small (~80 bytes per charm vs ~250 with snapshots)
 * and ensures storefront always shows current product data.
 *
 * @param uniformScale - print-area scale factor for sizing charms proportionally
 * @param globalCharmScale - shared scale from any placed charm (admin syncs scale across all instances)
 */
function prepareCharmProduct(product: CharmProductRef, uniformScale: number, globalCharmScale: number) {
  // Compute per-product charm size from its transform scale.
  // Admin renders each charm at CHARM_THUMB_SIZE * transform.scale (e.g. 180 * 1.75 = 315px).
  // Use the first transform's scale; fall back to globalCharmScale for products never placed on canvas.
  const firstScale
    = (product.transforms || []).find(t => typeof t.scale === 'number' && t.scale > 0)?.scale || globalCharmScale
  const productCharmSize = Math.round(CHARM_THUMB_SIZE * firstScale * uniformScale)

  return {
    /** Internal reference ID */
    i: product._id,
    /** Shopify Product ID - PRIMARY identifier for storefront lookup */
    pid: product.shopifyProductId,
    /** Selected variant ID (optional) - for pre-selected add-to-cart */
    ...(product.selectedVariantId ? { vid: product.selectedVariantId } : {}),
    /** Per-product charm render size (admin base * transform scale * print-area scale) */
    cs: productCharmSize,
    /** Transform instances (positions on canvas) */
    tr: (product.transforms || []).map((t: CharmTransformInstance) => ({
      id: t.instanceId,
      x: t.x,
      y: t.y,
      r: t.rotation,
      s: t.scale,
    })),
  }
}

/**
 * Prepare a single slot node for storefront metafield.
 * Positions are scaled by scaleX/scaleY to match the print-area coordinate system.
 */
function prepareCharmSlotNode(node: CharmSlotNode, scaleX: number, scaleY: number) {
  return {
    /** Node ID */
    i: node._id,
    /** X position (scaled to print area) */
    x: node.x * scaleX,
    /** Y position (scaled to print area) */
    y: node.y * scaleY,
    /** Slot limit */
    sl: node.slotLimit,
    /** Label */
    l: node.label,
    /** Default charm (if assigned) */
    ...(node.defaultCharm ? { dc: node.defaultCharm._id } : {}),
    /** Slot rotation in degrees, only emitted when non-zero (storefront treats absent as 0) */
    ...(node.rotation ? { r: node.rotation } : {}),
  }
}

/**
 * Prepare CHARM_NODE layer data for storefront metafield.
 *
 * @param layer - CHARM_NODE layer (uses 'any' settings to accept LayerDocument union type)
 * @param scaleX - Horizontal scale factor (container.width / origin.width). Default 1.
 * @param scaleY - Vertical scale factor (container.height / origin.height). Default 1.
 * @returns Prepared charm node data for storefront rendering, or null if layer is invalid
 */
export function prepareCharmNodeData(layer: { _id: string; settings?: unknown }, scaleX = 1, scaleY = 1) {
  if (!layer?._id) {
    console.warn('prepareCharmNodeData: layer._id is missing, skipping charm node preparation')
    return null
  }

  // Cast settings to CharmNodeSettings - caller ensures layer.type === 'charm-node'
  const settings = (layer.settings || {}) as CharmNodeSettings

  // Print-area scale factor (for templates where PSD ≠ container dimensions)
  const uniformScale = Math.sqrt(scaleX * scaleY)

  // Global charm scale priority: placed transform scale > merchant UI setting > 1
  // This ensures unplaced products inherit the correct size from either:
  // 1. Any placed charm's scale (admin syncs all instances to same scale)
  // 2. Merchant's defaultCharmSize setting (px, converted to scale via / CHARM_THUMB_SIZE)
  // 3. Fallback to 1 (base CHARM_THUMB_SIZE)
  const allProducts = (settings.linkedProducts || []) as CharmProductRef[]
  const placedScale = allProducts
    .flatMap(p => p.transforms || [])
    .find(t => typeof t.scale === 'number' && t.scale > 0)?.scale
  const defaultScale = settings.defaultCharmSize ? settings.defaultCharmSize / CHARM_THUMB_SIZE : undefined
  const globalCharmScale = placedScale || defaultScale || 1

  // Prepare linked products with per-product charm size
  const linkedProducts = allProducts.map(p => prepareCharmProduct(p, uniformScale, globalCharmScale))

  // Prepare slot nodes with scaled positions
  const nodes = (settings.nodes || []).map(node => prepareCharmSlotNode(node, scaleX, scaleY))

  // Layer-level fallback charm size: use the first product's size (all should be consistent in FIXED mode).
  // Per-product cs is the authoritative source — this fallback is for charms without a matching product.
  const fallbackCs = linkedProducts.length > 0 ? linkedProducts[0].cs : Math.round(CHARM_THUMB_SIZE * uniformScale)

  return {
    /** Layer type */
    t: 'charm-node',
    /** Layer ID */
    i: layer._id,
    /** Charm node settings */
    s: {
      /** Display style: FIXED or FREE */
      ds: settings.displayStyle || 'FIXED',
      /** Storefront label */
      sfl: settings.storefrontLabel || '',
      /** Maximum charms allowed */
      mc: settings.maxCharms ?? (settings.nodes?.length || 0),
      /** Allow multiple assignments */
      ama: settings.allowMultipleAssignments ?? false,
      /** Fallback charm render size (from first linked product; per-product cs is authoritative) */
      cs: fallbackCs,
      /** Anchor position for charm display; omitted when default ('top') to save payload bytes */
      ...(settings.anchorPosition && settings.anchorPosition !== 'top' ? { ap: settings.anchorPosition } : {}),
    },
    /** Linked products catalog */
    lp: linkedProducts,
    /** Slot nodes (FIXED mode) */
    nd: nodes,
    /** Empty option set list (charm-node doesn't use traditional option sets) */
    osl: [],
  }
}
