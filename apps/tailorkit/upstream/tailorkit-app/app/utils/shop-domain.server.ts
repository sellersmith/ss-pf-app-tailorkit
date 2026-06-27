/**
 * Shopify shop domain validator/normalizer.
 *
 * Accepts only canonical *.myshopify.com domains (case-insensitive). Used by
 * public partner endpoints to reject arbitrary input before it reaches DB
 * queries, rate-limit keys, or attribution upserts. Without this, callers
 * could create high-cardinality docs / pollute query cache / inject odd
 * casing into Shop.shopDomain lookups (which use unique-indexed strings).
 */
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

export function normalizeShopDomain(input: string | null | undefined): string | null {
  if (!input) return null
  const shop = input.trim().toLowerCase()
  return SHOP_DOMAIN_PATTERN.test(shop) ? shop : null
}
