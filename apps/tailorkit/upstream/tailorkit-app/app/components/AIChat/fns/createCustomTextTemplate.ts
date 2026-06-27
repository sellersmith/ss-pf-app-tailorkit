import { uuid } from '~/utils/uuid'
import { compressData } from '~/utils/file-types/zip'
import { TemplatesService } from '~/api/services/templates'
import { TEMPLATE_ACTIONS } from '~/routes/api.templates.$id/constants'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { remapTemplateIdsAndReferences } from '~/utils/templates/remapTemplateIds'

/**
 * Creates and saves a custom text template using premade template data
 * Replaces all _id fields with new UUIDs and updates shopDomain
 *
 * Returns the saved template data that can be used with prepareVariantsSelected
 */
export async function createCustomTextTemplate(): Promise<any> {
  const templateId = uuid()

  const shopDomain = window.shopify?.config?.shop

  if (!shopDomain) {
    throw new Error('Shop domain not found')
  }

  // Import premade template
  const premadeTemplate = await import('./premade-template.json')

  // Deep clone the template to avoid modifying the original
  const templateData = JSON.parse(JSON.stringify(premadeTemplate.default || premadeTemplate))

  // Remap IDs and cross-references for layers and option sets, and set shopDomain/templateId
  const { template: updatedTemplate } = remapTemplateIdsAndReferences(templateData, uuid, shopDomain, templateId)

  // Save the template to database
  const formData = new FormData()

  // Compress template data
  const compressedUint8 = compressData(updatedTemplate)
  // Create a new ArrayBuffer and copy bytes to satisfy BlobPart typing
  const ab = new ArrayBuffer(compressedUint8.byteLength)
  new Uint8Array(ab).set(compressedUint8)
  const compressedData = new Blob([ab], { type: 'application/octet-stream' })

  formData.append('type', TEMPLATE_ACTIONS.SAVE_TEMPLATE)
  formData.append('templateData', compressedData)
  formData.append('use_ai_feature', `${localStorage?.getItem('TLK_USE_AI_FEATURE_AT') ? 1 : 0}`)

  // Save the template
  const response = await TemplatesService.create(templateId, formData)

  if (!response?.success) {
    throw new Error(response?.message || 'Failed to save template')
  }

  // Return the template data with the saved ID for integration use
  return updatedTemplate
}
