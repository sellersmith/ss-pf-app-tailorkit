import Integration from '~/models/Integration.server'
import LayerIntegration from '~/models/LayerIntegration.server'
import type { DenormalizedData } from '~/models/Mockup.server'
import Mockup from '~/models/Mockup.server'
import Template from '~/models/Template.server'
import VariantIntegration from '~/models/VariantIntegration.server'

/**
 * Updates the denormalizedData field of a mockup with variant and template information
 * This function is optimized for performance by using efficient queries and parallelization
 *
 * The denormalizedData contains:
 * - variants: Array of variant data (id, productId) that use this mockup
 * - templates: Array of template data (id, name) used in the mockup's layers
 *
 * Performance considerations:
 * - Uses parallel queries for variants and layers to reduce latency
 * - Minimizes data fetched from database by selecting only required fields
 * - Avoids updating timestamps to prevent unnecessary updates
 *
 * @param mockupId The ID of the mockup to update
 * @param shopDomain The shop domain
 * @param options Additional options for updating
 * @returns Promise resolving to the updated mockup or null if error/not found
 */
export async function updateMockupDenormalizedData(
  mockupId: string,
  shopDomain: string,
  options: {
    skipVariants?: boolean
    skipTemplates?: boolean
    skipIntegration?: boolean
    additionalData?: {
      integration?: {
        _id: string
        name: string
      }
    }
  } = {}
): Promise<any> {
  try {
    const { skipVariants, skipTemplates, skipIntegration = false, additionalData } = options
    const updateVariants = !skipVariants
    const updateTemplates = !skipTemplates
    const updateIntegration = !skipIntegration

    // Get the mockup
    const mockup = (await Mockup.findOne({ _id: mockupId, shopDomain }).lean()) as any
    if (!mockup) {
      console.warn(`Mockup ${mockupId} not found for shop ${shopDomain}`)
      return null
    }

    // Create denormalizedData object or use existing
    const denormalizedData: DenormalizedData = mockup.denormalizedData || {}

    // Get variants related to this mockup - in parallel with templates query
    const variantsPromise = updateVariants
      ? (async () => {
          const result = await VariantIntegration.find(
            { mockup: mockupId, shopDomain },
            { _id: 1, productId: 1, id: 1 }
          ).lean()
          return result
        })()
      : Promise.resolve([])

    // Get templates related to this mockup via LayerIntegration - in parallel with variants query
    const mockupLayers = mockup.layers || []

    const layerTemplatesPromise
      = updateTemplates && mockupLayers.length
        ? (async () => {
            const result = await LayerIntegration.find(
              { _id: { $in: mockupLayers }, shopDomain, visible: true },
              { 'data.templateId': 1, printAreaId: 1, visible: 1 }
            ).lean()
            return result as Array<{ data?: { templateId?: string }; printAreaId?: string; visible?: boolean }>
          })()
        : Promise.resolve([])

    // Get integration related to this mockup - only if additionalData doesn't provide it and we're not skipping integration
    const integrationPromise
      = !additionalData?.integration && updateIntegration
        ? (async () => {
            // First, find variant integrations that reference this mockup
            const variantIntegrations = await VariantIntegration.find(
              { mockup: mockupId, shopDomain },
              { id: 1 }
            ).lean()

            if (!variantIntegrations.length) return null

            // Then find the integration that references these variant integrations
            const variantIds = variantIntegrations.map(v => v.id)

            const integration = (await Integration.findOne(
              { variants: { $in: variantIds }, shopDomain },
              { _id: 1, title: 1 }
            ).lean()) as any

            return integration
          })()
        : Promise.resolve(null)

    // Wait for all parallel queries to complete
    const [variants, layerTemplates, queriedIntegration] = await Promise.all([
      variantsPromise,
      layerTemplatesPromise,
      integrationPromise,
    ])

    // Process variants data
    if (updateVariants) {
      denormalizedData.variants = (variants as any[]).map(variant => ({
        _id: variant._id,
        productId: variant.productId,
        id: variant.id,
      }))
    }

    // Process templates data
    if (updateTemplates) {
      if (layerTemplates.length) {
        // Extract template IDs from layer integrations
        const templateIds = layerTemplates
          .filter(l => l.data?.templateId)
          .map(l => l.data!.templateId!)
          .filter(Boolean)
          .filter((id, index, self) => self.indexOf(id) === index) // Deduplicate

        if (templateIds.length) {
          // Fetch template details
          const templates = (await Template.find(
            { _id: { $in: templateIds }, shopDomain },
            { _id: 1, name: 1, alias: 1, isHiddenTemplate: 1 }
          ).lean()) as any[]

          denormalizedData.templates = templates.map(template => ({
            _id: template._id,
            name: template.name,
            alias: template.alias,
            isHidden: template.isHiddenTemplate,
          }))
        } else {
          denormalizedData.templates = []
        }
      } else {
        // No layers → no templates
        denormalizedData.templates = []
      }
    }

    // Process integration data
    if (additionalData?.integration) {
      // Use the provided integration data instead of querying
      denormalizedData.integration = {
        _id: additionalData.integration._id,
        name: additionalData.integration.name,
      }
    } else if (queriedIntegration) {
      // Use the integration data from the database query
      denormalizedData.integration = {
        _id: queriedIntegration._id,
        name: queriedIntegration.title,
      }
    } else if (updateIntegration) {
      // If we tried to get integration data but found none, set to null
      denormalizedData.integration = null
    }
    // If skipIntegration is true and no additionalData, leave integration field unchanged

    // Update the mockup with the new denormalizedData
    const updateResult = await Mockup.updateOne(
      { _id: mockupId, shopDomain },
      { $set: { denormalizedData } },
      { timestamps: false }
    )
    return { _id: mockupId, success: updateResult.modifiedCount > 0 }
  } catch (error) {
    console.error(`Error updating denormalizedData for mockup ${mockupId}:`, error)
    return { _id: mockupId, success: false, error: (error as Error).message }
  }
}

/**
 * Updates the denormalizedData field for multiple mockups in bulk
 *
 * This function provides significant performance benefits over updating mockups individually:
 * - Processes mockups in batches to avoid memory issues and optimize performance
 * - Uses the same efficient query patterns as updateMockupDenormalizedData
 * - Can be run asynchronously (non-blocking) when called with setTimeout
 *
 * @param mockupIds Array of mockup IDs to update
 * @param shopDomain The shop domain
 * @param options Additional options for updating
 * @returns Promise resolving to array of updated mockups
 */
export async function bulkUpdateMockupDenormalizedData(
  mockupIds: string[],
  shopDomain: string,
  options: {
    skipVariants?: boolean
    skipTemplates?: boolean
    skipIntegration?: boolean
    batchSize?: number
    additionalData?: {
      integration?: {
        _id: string
        name: string
      }
    }
  } = {}
): Promise<any[]> {
  const startTime = performance.now()

  if (!mockupIds.length) return []

  const {
    skipVariants,
    skipTemplates,
    skipIntegration = true, // Skip integration query by default for bulk operations
    batchSize = 10,
    additionalData,
  } = options
  const results: any[] = []

  console.log(`[PERF] bulkUpdateMockupDenormalizedData starting for ${mockupIds.length} mockups`)

  // Process in batches to avoid memory issues and optimize performance
  for (let i = 0; i < mockupIds.length; i += batchSize) {
    const batchIds = mockupIds.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batchIds.map(id =>
        updateMockupDenormalizedData(id, shopDomain, {
          skipVariants,
          skipTemplates,
          skipIntegration,
          additionalData,
        })
      )
    )

    const validResults = batchResults.filter(Boolean)
    results.push(...validResults)
  }

  const totalTime = performance.now() - startTime
  const successRate = Math.round((results.length / mockupIds.length) * 100)
  const avgTimePerMockup = Math.round(totalTime / mockupIds.length)

  console.log(
    `[PERF] bulkUpdateMockupDenormalizedData completed: `
      + `${results.length}/${mockupIds.length} mockups (${successRate}%) updated in ${Math.round(totalTime)}ms `
      + `(avg: ${avgTimePerMockup}ms per mockup)`
  )

  return results
}

/**
 * Updates denormalizedData for all mockups that reference a specific template
 * This is useful when a template is updated (e.g. name changed) to ensure denormalizedData stays in sync
 *
 * @param templateId The ID of the template that was updated
 * @param shopDomain The shop domain
 * @returns Promise that resolves when all mockups are updated
 */
export async function updateDenormalizedDataForTemplate(templateId: string, shopDomain: string): Promise<any> {
  const startTime = performance.now()
  let lookupTime = 0
  let updateTime = 0

  try {
    // Find all layer integrations that reference this template
    const layersStart = performance.now()
    const layerIntegrations = await LayerIntegration.find(
      { 'data.templateId': templateId, shopDomain },
      { _id: 1 }
    ).lean()
    lookupTime += performance.now() - layersStart

    if (!layerIntegrations.length) {
      return null
    }

    // Find all mockups that contain these layers
    const mockupsStart = performance.now()
    const mockups = await Mockup.find(
      {
        layers: { $in: layerIntegrations.map(l => l._id) },
        shopDomain,
      },
      { _id: 1 }
    ).lean()
    lookupTime += performance.now() - mockupsStart

    if (!mockups.length) {
      console.log(`[PERF] No mockups found for template ${templateId} (${Math.round(lookupTime)}ms)`)
      return null
    }

    // Extract mockup IDs as strings
    const mockupIds = mockups.map(m => String(m._id))

    // Update denormalizedData for all affected mockups
    // Only update the templates part as variants shouldn't be affected by template changes
    const updateStart = performance.now()
    const results = await bulkUpdateMockupDenormalizedData(mockupIds, shopDomain, { skipVariants: true })
    updateTime = performance.now() - updateStart

    return results
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      `[PERF] updateDenormalizedDataForTemplate ERROR for template ${templateId}: `
        + `${Math.round(totalTime)}ms total (lookup: ${Math.round(lookupTime)}ms, update: ${Math.round(updateTime)}ms)`,
      error
    )
    return null
  }
}
