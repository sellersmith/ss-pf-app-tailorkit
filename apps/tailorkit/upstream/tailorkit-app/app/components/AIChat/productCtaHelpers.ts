import type { ProductRecommendationData } from './fns'
import { extractProductVariantData } from '~/utils/shopify/variantUtils'
import { duplicateClipartTemplate } from '~/utils/integration/templateDuplication'
import { buildTemporaryIntegration } from '~/utils/integration/integrationBuilder'

/**
 * Clone a clipart template to the user's own account and prepare integration
 * @param templateId - The ID of the clipart template to clone
 * @param clipartData - Clipart positioning and dimension data
 * @param productData - Product recommendation data with variant IDs
 * @returns Promise that resolves with the integration URL to navigate to
 */
export async function duplicateTemplateAndOpenIntegration(
  templateId: string,
  clipartData: ProductRecommendationData['clipart'],
  productData?: Partial<ProductRecommendationData>
): Promise<string> {
  try {
    // Step 1: Duplicate the clipart template
    const cloneResult = await duplicateClipartTemplate(templateId)

    if (!cloneResult.success || !cloneResult.data) {
      throw new Error(cloneResult.message || 'Failed to clone template')
    }

    const { templateId: newTemplateId } = cloneResult.data

    // Step 2: Extract and validate product variant data then clone the existing product to a new product
    const { variantIds, productId } = extractProductVariantData(
      productData,
      (window as any)?.tailorkit?.currentProductRecommendation
    )

    // Step 3: Build temporary integration with template pre-filled
    const integrationUrl = await buildTemporaryIntegration({
      templateId: newTemplateId,
      variantIds,
      productId,
      clipartData,
      title: 'AI Generated Design',
    })

    return integrationUrl
  } catch (error) {
    console.error('Error cloning clipart template:', error)

    throw error
  }
}

/**
 * Check if a template is a clipart that can be cloned
 * @param template - The template object to check
 * @returns Boolean indicating if the template can be cloned
 */
export function canCloneTemplate(template: any): boolean {
  if (!template) return false

  // Check if it's a clipart or premade template with a category
  return (
    template.type === 'clipart'
    || (template.type === 'premade-template' && template.category)
    || (template.category && template.isFromTailorkit)
  )
}

/**
 * Get details of clipart templates by their IDs
 * @param clipartIds - Array of clipart template IDs
 * @returns Promise that resolves to the clipart details
 */
export async function getClipartDetails(clipartIds: string[]): Promise<any> {
  try {
    const { TemplatesService } = await import('~/api/services/templates')
    return TemplatesService.getClipartsDetails(clipartIds.map(id => ({ _id: id, type: 'clipart' })))
  } catch (error) {
    console.error('Error fetching clipart details:', error)
    throw error
  }
}
