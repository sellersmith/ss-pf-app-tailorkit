export interface VariantDataSignals {
  variantTitles: string[]
  productId: string
  productTitle: string
}

/**
 * Check if variant title is a Shopify placeholder (should be ignored)
 */
function isPlaceholderVariantTitle(title: string): boolean {
  const t = title.trim().toLowerCase()
  if (!t) return true
  return t === 'default title' || t === 'default' || t === 'untitled'
}

/**
 * Build structured query text for RAG search with labeled fields.
 *
 * Strategy: Use same structure as RAG documents for better semantic alignment.
 * Labels help the embedding model understand field roles and improve matching accuracy.
 *
 * Example output:
 * ```
 * Product: Gold Infinity Bracelet
 * Variants: Rose Gold, White Gold
 * ```
 *
 * This matches the structure in RAG documents:
 * ```
 * Name: Golden grace (gold)
 * Target Audience: Romantic buyers...
 * Context: Ideal for gold bands, bracelets...
 * ```
 */
export function buildSuggestionQueryText(variantData: VariantDataSignals): string {
  const parts: string[] = []

  // Product title is the most important signal
  if (variantData.productTitle) {
    parts.push(`Product: ${variantData.productTitle.trim()}`)
  }

  // Include all variant titles with label
  const validVariantTitles = (variantData.variantTitles || [])
    .map(t => t.trim())
    .filter(t => t && !isPlaceholderVariantTitle(t))

  if (validVariantTitles.length) {
    parts.push(`Variants: ${validVariantTitles.join(', ')}`)
  }

  return parts.filter(Boolean).join('\n').trim()
}
