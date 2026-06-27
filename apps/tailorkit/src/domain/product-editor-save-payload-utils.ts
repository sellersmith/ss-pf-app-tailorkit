export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

export function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function number(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  const record = asRecord(value)
  return text(record._id) || text(record.id)
}

/**
 * Extracts the Shopify variant identifier from a save-payload variant.
 *
 * The ProductEditor keeps the Shopify variant GID on `variant.id` while `variant._id` may be a
 * TailorKit internal UUID. Storefront Liquid reads `app.metafields.em_tailorkit[<numeric-variant-id>]`,
 * so we must capture the Shopify id — never the UUID. Returns the numeric id when the value is a
 * `gid://shopify/ProductVariant/<n>` GID or a bare numeric string; otherwise undefined.
 */
export function shopifyVariantIdOf(variant: unknown): string | undefined {
  const record = asRecord(variant)
  const candidates = [record.shopifyVariantId, record.id, record.variantId, record.admin_graphql_api_id]
  for (const candidate of candidates) {
    const value = text(candidate) ?? (typeof candidate === 'number' ? String(candidate) : undefined)
    if (!value) continue
    const gidMatch = value.match(/^gid:\/\/shopify\/ProductVariant\/(\d+)$/)
    if (gidMatch) return gidMatch[1]
    if (/^\d+$/.test(value)) return value
  }
  return undefined
}

export function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.reduce<string[]>((ids, item) => {
    const id = idOf(item)
    return id ? [...ids, id] : ids
  }, [])
}

export function templateIdOf(value: unknown): string | undefined {
  const record = asRecord(value)
  return text(value) || text(record._id) || text(record.id)
}
