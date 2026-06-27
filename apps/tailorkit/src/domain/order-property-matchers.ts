// TailorKit line-item property matchers — used by order capture (phase-03 graft shim) and the GAP-1
// webhook fork (phase-06) to decide which line items are TailorKit-personalized.
//
// `getValidPropertyNamePrefix` + `isOneTickProperty` are copied BYTE-IDENTICAL from upstream
// `apps/tailorkit/upstream/.../routes/orders._index/fns.ts:240,255` (covered by the phase-03b
// diff-guard). The ONLY non-verbatim part is the PROPERTY_PREFIX constant binding below — a
// channel-mismatch fix, not a logic reword.

import type { TailorKitOrderLineItem } from './order-record'

// OneTick marks add-on items with this fixed property key (mirror of
// `apps/onetick/src/storefront/runtime/constants/index.ts:18` EOneTickOrderPropertyKeys.ONETICK_PROPERTIES).
const ONETICK_PROPERTY_KEY = '__onetick_properties'

// SOURCE OF TRUTH: the storefront writes line-item properties under this exact prefix (the app-embed
// Liquid `"propertyPrefix": "__pf_tailorkit"` runtime config, fallback in
// `apps/tailorkit/src/storefront-copied/assets/constants/index.ts:27`). ATC writes
// `properties[__pf_tailorkit]` and `properties[__pf_tailorkit_Layer_<id>]`. The TWO leading
// underscores keep the property hidden at checkout AND make it match Shopify's `orders/create`
// webhook filter `line_items.properties.name:__pf_*` (shopify.app.toml) so pure-TailorKit orders
// reach the server — aligned to PageFly's `__pf_*` namespace without editing the operator-owned toml.
// Mirrored literally here (NOT imported — storefront constants pull browser/proxy-config deps).
const STOREFRONT_WRITE_PREFIX = '__pf_tailorkit'

// The matcher below internally prepends a single leading `_` (`` `_${propertyPrefix}` ``), so the
// value passed in is the storefront prefix with exactly one leading underscore stripped:
// `__pf_tailorkit` → `_pf_tailorkit` → matcher rebuilds `__pf_tailorkit`. PageFly core matches EXACT
// keys (`p.name === '__pf_orderitem_id'`), never a `__pf_` prefix, so this never collides with core.
export const TAILORKIT_PROPERTY_PREFIX = STOREFRONT_WRITE_PREFIX.replace(/^_/, '')

/**
 * VERBATIM copy of upstream `getValidPropertyNamePrefix`. A property name can start with the prefix
 * (with a trailing space) or be the bare prefix itself. Diff-guarded against upstream.
 */
export function getValidPropertyNamePrefix(propertyName: string, propertyPrefix: string) {
  /** @important: Must have a space after the property prefix */
  const prefix = `_${propertyPrefix}`
  const suffix = ' '
  const startWithString = `${prefix}${suffix}`

  // A Property name can start with the property prefix or be the property prefix itself
  // Ex: _PF Hat #1 or _PF only
  return propertyName.startsWith(startWithString) || propertyName === prefix
}

/**
 * VERBATIM copy of upstream `isOneTickProperty`. OneTick uses a fixed key, not the `_PREFIX ` pattern.
 */
export const isOneTickProperty = (propertyName: string) => propertyName === ONETICK_PROPERTY_KEY

/**
 * Standalone TailorKit line-item filter (mirrors upstream importOrderAndCustomer L117–128). Returns
 * the line items carrying a TailorKit property (by prefix) OR a OneTick property. Kept independent of
 * the grafted capture body so the phase-06 webhook fork can gate dispatch without importing the graft.
 */
export function detectTailorKitLineItems(lineItems: TailorKitOrderLineItem[]): TailorKitOrderLineItem[] {
  if (!Array.isArray(lineItems)) return []
  return lineItems.filter(lineItem => {
    const properties = Array.isArray(lineItem.properties) ? lineItem.properties : []
    const hasTailorKitPrefix = properties.some(prop =>
      getValidPropertyNamePrefix(prop.name, TAILORKIT_PROPERTY_PREFIX)
    )
    const hasOneTickProperties = properties.some(prop => isOneTickProperty(prop.name))
    return hasTailorKitPrefix || hasOneTickProperties
  })
}
