import { ShineOn } from '@sellersmith/shineon-sdk'
import type { ProductTemplate } from '@sellersmith/shineon-sdk'

/**
 * Fetches ShineOn product template details including sibling resolution.
 * Returns the template data with resolved siblings as variant options.
 */
export async function getShineOnProductDetails(
  templateId: string,
  apiToken: string
): Promise<{
  title: string
  description: string
  images: string[]
  variants: Array<{
    id: string
    title: string
    cost: number
    options: Record<string, string>
  }>
}> {
  const shineOn = new ShineOn({ token: apiToken })
  const template = await shineOn.productTemplates.get(templateId)

  // Build variants from template + siblings
  const variants = await resolveTemplateVariants(shineOn, template)

  return {
    title: template.parent_label || template.title || `ShineOn Product ${template.product_template}`,
    description: buildDescription(template),
    images: extractImages(template),
    variants,
  }
}

async function resolveTemplateVariants(
  shineOn: ShineOn,
  template: ProductTemplate
): Promise<Array<{ id: string; title: string; cost: number; options: Record<string, string> }>> {
  const baseCost = Number(template.base_cost) || 0
  const meta = template.metafields || {}

  // Start with the main template as a variant
  const variants = [
    {
      id: String(template.id),
      title: buildVariantTitle(template),
      cost: baseCost,
      options: buildVariantOptions(meta),
    },
  ]

  // Resolve siblings (other metal/color variants)
  if (template.siblings && template.siblings.length > 0) {
    const siblingTemplates = await Promise.all(
      template.siblings
        .filter(siblingId => siblingId !== template.id)
        .map(siblingId => shineOn.productTemplates.get(siblingId).catch(() => null))
    )

    for (const sibling of siblingTemplates) {
      if (!sibling) continue
      const siblingMeta = sibling.metafields || {}
      const siblingCost = Number(sibling.base_cost) || baseCost

      variants.push({
        id: String(sibling.id),
        title: buildVariantTitle(sibling),
        cost: siblingCost,
        options: buildVariantOptions(siblingMeta),
      })
    }
  }

  return variants
}

/** Extract best available product image from transformations or artwork mask */
function extractImages(template: ProductTemplate): string[] {
  const defaultTransform = template.transformations?.find(t => t.default === true)

  const layers = defaultTransform?.layers
  if (layers?.main) return [layers.main]

  if (template.artwork_mask_src) return [template.artwork_mask_src]
  return []
}

type ProductMetafields = ProductTemplate['metafields']

function buildVariantTitle(template: ProductTemplate): string {
  // Use API title (e.g., "Polished Stainless Steel") which is the variant name
  if (template.title) return template.title

  const meta = template.metafields || {}
  const parts: string[] = []
  if (meta.metal && meta.metal !== 'other') parts.push(capitalizeFirst(meta.metal))
  if (meta.size_option && meta.size_option !== '0') parts.push(meta.size_option)
  return parts.length > 0 ? parts.join(' / ') : 'Default'
}

function buildVariantOptions(meta: ProductMetafields): Record<string, string> {
  const options: Record<string, string> = {}
  if (meta.metal) options['Metal'] = capitalizeFirst(meta.metal)
  if (meta.size_option) options['Size'] = meta.size_option
  if (meta.shape && meta.shape !== 'other') options['Shape'] = capitalizeFirst(meta.shape)
  // Ensure at least one option
  if (Object.keys(options).length === 0) options['Style'] = 'Default'
  return options
}

function buildDescription(template: ProductTemplate): string {
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
