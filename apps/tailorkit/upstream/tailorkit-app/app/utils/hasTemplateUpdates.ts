import type { Template } from '~/types/psd'
import type { VariantIntegration, LayerIntegration } from '~/types/integration'

type TemplateWithTimestamp = Pick<Template, 'updatedAt'>

// Extended layer type that accounts for server data structure
type LayerWithTemplateId = LayerIntegration & {
  data?: LayerIntegration['data'] & {
    templateId?: string | Template
  }
}

/**
 * Checks if any template associated with this product has been updated
 * after its last publish time. We must inspect:
 *  1. Top-level templates array (legacy)
 *  2. Each variant's mockup layers (template or templateId)
 *  3. Each variant's printAreas template
 */
export function hasTemplateUpdatesSince(options: {
  templates?: TemplateWithTimestamp[]
  variants?: VariantIntegration[]
  publishedAt?: Date | string | null
}): boolean {
  const { templates = [], variants = [], publishedAt } = options

  if (!publishedAt) return false

  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt)

  const templateUpdatedTimes: Date[] = []

  // 1. Top-level templates
  templates.forEach(t => {
    if (t?.updatedAt) {
      templateUpdatedTimes.push(t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt))
    }
  })

  // 2 & 3. Inspect variants
  variants.forEach(variant => {
    // Layers - check both template and templateId (server can populate either)
    variant.mockup?.layers?.forEach(layer => {
      // Layer stores expose getState() - extract if needed
      const layerData: LayerWithTemplateId = typeof layer === 'object' && 'getState' in layer ? layer.getState() : layer

      const templateData = layerData?.data?.template || layerData?.data?.templateId
      if (templateData && typeof templateData === 'object' && templateData.updatedAt) {
        const updatedAt = templateData.updatedAt
        templateUpdatedTimes.push(updatedAt instanceof Date ? updatedAt : new Date(updatedAt))
      }
    })

    // Print areas - template can be string | Template | null
    variant.printAreas?.forEach(pa => {
      const template = pa.template
      if (template && typeof template === 'object' && template.updatedAt) {
        const updatedAt = template.updatedAt
        templateUpdatedTimes.push(updatedAt instanceof Date ? updatedAt : new Date(updatedAt))
      }
    })
  })

  return templateUpdatedTimes.some(d => d > published)
}
