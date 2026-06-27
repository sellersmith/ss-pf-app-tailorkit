// Shopify internal IDs are typically 13+ digits
const SHOPIFY_INTERNAL_ID_MIN_LENGTH = 13

export type OrderInputType = 'shopify_id' | 'order_name'

export interface ParsedOrderInput {
  type: OrderInputType
  value: string
}

/**
 * Parse user input to determine if it's a Shopify internal ID or an order name/number.
 *
 * - Pure digits with 13+ characters → Shopify internal ID (e.g. "5551234567890")
 * - Starts with '#' → order name (e.g. "#1719")
 * - Pure digits with fewer than 13 characters → order name/number (e.g. "1719")
 */
export function parseOrderInput(input: string): ParsedOrderInput | null {
  const trimmed = input?.trim()

  if (!trimmed) return null

  // Input starts with '#' → order name
  if (trimmed.startsWith('#')) {
    const numberPart = trimmed.slice(1)

    if (!/^\d+$/.test(numberPart) || !numberPart) return null

    return { type: 'order_name', value: trimmed }
  }

  // Must be all digits
  if (!/^\d+$/.test(trimmed)) return null

  // Long numeric string → Shopify internal ID
  if (trimmed.length >= SHOPIFY_INTERNAL_ID_MIN_LENGTH) {
    return { type: 'shopify_id', value: trimmed }
  }

  // Short numeric string → order name/number (e.g. "1719" → "#1719")
  return { type: 'order_name', value: `#${trimmed}` }
}
