import type { LineItem } from '~/models/Order.server'

/**
 * LEGACY SUPPORT ONLY (kept after bulk-personalize-v2 revert on 2026-05-21).
 *
 * The bulk-personalize-v2 feature was live on master between 2026-05-19 08:57
 * UTC (PR #1307) and 2026-05-21 ~07:00 UTC (PR #1317 revert). Any customer
 * order placed during that window may carry `_TLK_bulk_group` line-item
 * properties. This utility lets the admin Order Detail UI render a small
 * grouping banner so those legacy orders are still readable.
 *
 * Do NOT use this for new functionality — the v2 feature ships separately
 * when production-ready. Delete this file once the legacy 46h window orders
 * are all fulfilled.
 *
 * Bulk personalize line items carry these properties (set by the storefront
 * bulk-drawer Web Component when it built the multi-item ATC payload).
 */
const BULK_GROUP_KEY = '_TLK_bulk_group'
const BULK_TOTAL_KEY = '_TLK_bulk_total'

export interface BulkGroupSummary {
  /** Shared UUID across the N items in one bulk submission. */
  groupId: string
  /** Number of items in the group (read from _TLK_bulk_total; falls back to count). */
  total: number
  /** All line items belonging to this group, in original order. */
  items: LineItem[]
}

function readProp(item: LineItem | null | undefined, key: string): string | undefined {
  const props: Array<{ name?: string; value?: string }>
    = (item?.properties as Array<{ name?: string; value?: string }>) || []
  return props.find(p => p?.name === key)?.value
}

/** True when the line item is part of a bulk per-unit personalization submission. */
export function isBulkLineItem(item: LineItem | null | undefined): boolean {
  return Boolean(readProp(item, BULK_GROUP_KEY))
}

/**
 * Group bulk-personalize line items by their shared _TLK_bulk_group UUID.
 * Items not part of a bulk submission are returned in `singletons`. Order is
 * preserved within each group and across the singletons list.
 */
export function groupBulkLineItems(lineItems: LineItem[]): {
  groups: BulkGroupSummary[]
  singletons: LineItem[]
} {
  if (!lineItems?.length) return { groups: [], singletons: [] }

  const groupMap = new Map<string, BulkGroupSummary>()
  const singletons: LineItem[] = []

  for (const item of lineItems) {
    const groupId = readProp(item, BULK_GROUP_KEY)
    if (!groupId) {
      singletons.push(item)
      continue
    }
    const totalRaw = readProp(item, BULK_TOTAL_KEY)
    const totalParsed = totalRaw ? Number.parseInt(totalRaw, 10) : NaN
    const existing = groupMap.get(groupId)
    if (existing) {
      existing.items.push(item)
      // Prefer the most reliable total: a finite parsed value wins over current placeholder.
      if (Number.isFinite(totalParsed) && totalParsed > existing.total) existing.total = totalParsed
    } else {
      groupMap.set(groupId, {
        groupId,
        total: Number.isFinite(totalParsed) ? totalParsed : 1,
        items: [item],
      })
    }
  }

  // Materialize totals: if total was never set above, fall back to the actual item count.
  for (const group of groupMap.values()) {
    if (group.total < group.items.length) group.total = group.items.length
  }

  return { groups: Array.from(groupMap.values()), singletons }
}
