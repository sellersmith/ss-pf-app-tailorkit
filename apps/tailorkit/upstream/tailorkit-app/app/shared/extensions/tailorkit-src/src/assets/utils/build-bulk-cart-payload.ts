/**
 * Build a Shopify `/cart/add.js` `items[]` payload from N collected per-unit
 * personalization snapshots. Each unit becomes a separate `quantity: 1` line item
 * with its own properties + bulk grouping metadata.
 *
 * The split-line-items strategy lets a customer add 12 trophies (each with
 * different text) in a single ATC click. Shopify processes the items[]
 * atomically; either all N succeed or none do.
 */

const BULK_GROUP_KEY = '_TLK_bulk_group'
const BULK_INDEX_KEY = '_TLK_bulk_index'
const BULK_TOTAL_KEY = '_TLK_bulk_total'

export interface BulkUnitInput {
  /** Per-unit cart properties (already PUA-sanitized + serialized). */
  properties: Record<string, string>
  /** Optional preview asset URL injected as `_Preview` property. */
  previewUrl?: string
}

export interface BulkCartItem {
  id: number | string
  quantity: 1
  properties: Record<string, string>
}

export interface BulkCartPayload {
  items: BulkCartItem[]
}

/**
 * Render a per-unit label by interpolating {index} (1-based) and {total} into the template.
 * Fallback to "Unit N of M" if template is empty/invalid.
 */
function renderLabel(template: string, index: number, total: number): string {
  const safe = typeof template === 'string' && template.trim().length > 0 ? template : 'Unit {index} of {total}'
  return safe.replace(/\{index\}/g, String(index)).replace(/\{total\}/g, String(total))
}

/**
 * Build the `items[]` payload from N units.
 *
 * @param variantId Shopify variant id (same for all units).
 * @param units Per-unit data collected from the bulk customizer.
 * @param bulkGroupId Shared UUID linking all N items as one bulk submission.
 * @param labelTemplate Per-unit visible label template, e.g. "Trophy {index} of {total}".
 */
export function buildBulkCartPayload(
  variantId: number | string,
  units: BulkUnitInput[],
  bulkGroupId: string,
  labelTemplate: string
): BulkCartPayload {
  const total = units.length
  const items: BulkCartItem[] = units.map((unit, idx) => {
    const oneBased = idx + 1
    const properties: Record<string, string> = {
      ...unit.properties,
      [BULK_GROUP_KEY]: bulkGroupId,
      [BULK_INDEX_KEY]: String(oneBased),
      [BULK_TOTAL_KEY]: String(total),
      Item: renderLabel(labelTemplate, oneBased, total),
    }
    if (unit.previewUrl) {
      properties._Preview = unit.previewUrl
    }
    return { id: variantId, quantity: 1, properties }
  })

  return { items }
}
