import type { ProductTemplate } from '@sellersmith/shineon-sdk'
import type { ShineOnNormalizedProduct } from '../types'

/**
 * Normalizes a ShineOn product template to the common product format
 * used by the import wizard (TemporaryProduct shape)
 */
export function normalizeProductTemplate(template: ProductTemplate): ShineOnNormalizedProduct {
  const baseCost = Number(template.base_cost) || 0
  const metalType = template.metafields?.metal || ''
  const productType = template.metafields?.type || ''
  const hasEngravings = !!template.engraving_sibling_id
  const buyerUploads = !!template.buyer_uploads

  const title = buildTemplateTitle(template)
  const images = extractProductImages(template)

  return {
    productId: String(template.id),
    title,
    description: buildTemplateDescription(template),
    images,
    baseProfitMargin: 0,
    baseCost,
    metalType,
    productType,
    hasEngravings,
    buyerUploads,
  }
}

function buildTemplateTitle(template: ProductTemplate): string {
  // parent_label is the product name (e.g., "Graduation Cap Name Necklace API")
  // title is the variant name (e.g., "Polished Stainless Steel")
  if (template.parent_label) return template.parent_label
  if (template.title) return template.title

  // Fallback: build from metafields if both are missing
  const meta = template.metafields || {}
  const parts: string[] = []
  if (meta.type && meta.type !== 'other') parts.push(capitalizeFirst(meta.type))
  if (meta.metal && meta.metal !== 'other') parts.push(`- ${capitalizeFirst(meta.metal)}`)

  return parts.length > 0 ? parts.join(' ') : `ShineOn Product ${template.product_template}`
}

/**
 * Extract the best available product image.
 * Priority: default transformation layer image > artwork_mask_src
 */
function extractProductImages(template: ProductTemplate): string[] {
  // Try to get the main layer image from the default transformation (actual product render)
  const defaultTransform = template.transformations?.find(t => t.default === true)

  const layers = defaultTransform?.layers
  if (layers?.main) return [layers.main]

  // Fallback to artwork mask
  if (template.artwork_mask_src) return [template.artwork_mask_src]

  return []
}

function buildTemplateDescription(template: ProductTemplate): string {
  const meta = template.metafields || {}
  const parts: string[] = []

  if (meta.type) parts.push(`Product type: ${meta.type}`)
  if (meta.metal) parts.push(`Metal: ${meta.metal}`)
  if (template.buyer_uploads) parts.push('Supports custom artwork upload')
  if (template.engraving_sibling_id) parts.push('Supports engraving')

  return parts.join('. ')
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Normalizes an array of ShineOn product templates
 */
export function normalizeProductTemplates(templates: ProductTemplate[]): ShineOnNormalizedProduct[] {
  return templates.map(normalizeProductTemplate)
}
