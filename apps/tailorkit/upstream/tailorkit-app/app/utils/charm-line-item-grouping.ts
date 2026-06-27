import type { LineItem } from '~/models/Order.server'

export interface CharmGroupedLineItem {
  item: LineItem
  charms: LineItem[]
}

export interface CharmGroupResult {
  /** Parent items (or standalone) with their charm children */
  groupedItems: CharmGroupedLineItem[]
  /** Total charm count across all parents */
  totalCharmCount: number
}

/** Check if a line item is a charm add-on. Property format: _${PREFIX}_charm */
export function isCharmItem(item: any, propertyPrefix: string): boolean {
  const props: Array<{ name?: string; value?: string }> = item?.properties || []
  return props.some(p => p?.name === `_${propertyPrefix}_charm` && p?.value === 'true')
}

/** Extract _ref_id value from a line item's properties. Property format: _${PREFIX}_ref_id */
export function getRefId(item: any, propertyPrefix: string): string | undefined {
  const props: Array<{ name?: string; value?: string }> = item?.properties || []
  return props.find(p => p?.name === `_${propertyPrefix}_ref_id`)?.value
}

/**
 * Groups charm line items under their parent product by matching _ref_id.
 * Items without charms pass through with empty charms array.
 * Orphaned charms (no parent match) appear as standalone items.
 */
export function groupCharmLineItems(lineItems: LineItem[], propertyPrefix: string): CharmGroupResult {
  if (!lineItems?.length) {
    return { groupedItems: [], totalCharmCount: 0 }
  }

  // Partition into charms and non-charms
  const charms: LineItem[] = []
  const nonCharms: LineItem[] = []

  for (const item of lineItems) {
    if (isCharmItem(item, propertyPrefix)) {
      charms.push(item)
    } else {
      nonCharms.push(item)
    }
  }

  // No charms → early return
  if (charms.length === 0) {
    return {
      groupedItems: nonCharms.map(item => ({ item, charms: [] })),
      totalCharmCount: 0,
    }
  }

  // Build map: refId → charm items
  const charmsByRefId = new Map<string, LineItem[]>()
  const orphanedCharms: LineItem[] = []

  for (const charm of charms) {
    const refId = getRefId(charm, propertyPrefix)
    if (refId) {
      const existing = charmsByRefId.get(refId) || []
      existing.push(charm)
      charmsByRefId.set(refId, existing)
    } else {
      orphanedCharms.push(charm)
    }
  }

  // Assign charms to parents
  const groupedItems: CharmGroupedLineItem[] = []
  let totalCharmCount = 0

  for (const item of nonCharms) {
    const refId = getRefId(item, propertyPrefix)
    const itemCharms = refId ? charmsByRefId.get(refId) || [] : []

    if (refId && charmsByRefId.has(refId)) {
      charmsByRefId.delete(refId) // Mark as matched
    }

    totalCharmCount += itemCharms.length
    groupedItems.push({ item, charms: itemCharms })
  }

  // Append orphaned charms (no parent match) as standalone
  for (const [, unmatchedCharms] of charmsByRefId) {
    for (const charm of unmatchedCharms) {
      groupedItems.push({ item: charm, charms: [] })
    }
  }
  for (const charm of orphanedCharms) {
    groupedItems.push({ item: charm, charms: [] })
  }

  return { groupedItems, totalCharmCount }
}
