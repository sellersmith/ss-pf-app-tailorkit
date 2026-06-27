import { type LoaderFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { authenticate } from '~/shopify/app.server'
import { INTEGRATION_ACTION } from './constants'
import { convertIdsToQuery, ShopifyApiClient } from '~/shopify/graphql/api.server'
import { type IPageInfo } from '~/types/shopify-product'
import { fetchList, json, type FetchListResponse } from '~/bootstrap/fns/fetch.server'
import Integration, {
  getPublishedIntegrationsByVariantIds,
  getPublishedIntegrationsOfTemplate,
} from '~/models/Integration.server'
import VariantIntegration from '~/models/VariantIntegration.server'
import Mockup, { recomputeTemplatesActiveVariants } from '~/models/Mockup.server'
import LayerIntegration from '~/models/LayerIntegration.server'
import { IntegrationStatus, type IntegrationListResult } from '~/types/integration'
import { publishIntegrationProcess, unpublishIntegrationProcess } from '../api.integration/fns.server'
import { parseFiltersFromRequest } from '~/bootstrap/fns/filter/filter.server'
import { SHOPIFY_ITEMS_LIMITATION } from '~/constants'
import { sanitizeShopifySearch } from '~/utils/shopify'
import type { PipelineStage } from 'mongoose'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'
import { compressData } from '~/utils/file-types/zip'
import { updateShopUsages } from '~/models/Shop.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get filters to fetch list of integrations
  const filters = await parseFiltersFromRequest(request)

  // Prepare query to lookup integration by title
  let searchFilter: { $match: any } | null = null
  const titleFilter = filters?.find((q: any) => Boolean(q?.['$match']?.title))

  if (titleFilter) {
    // Cast titleFilter to a specific type to access $match property
    const searchValue = (titleFilter as { $match: { title: string } }).$match.title
    searchFilter = {
      $match: {
        $or: [
          { 'denormalizedData.integration.name': searchValue },
          { label: searchValue },
          { 'denormalizedData.templates.name': searchValue },
        ],
      },
    }
  }

  // Optimized direct Mockup query using denormalizedData
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort')
  const [sortBy, sortDir] = sort?.split('__') || []
  const sortDirection = sortDir?.toLowerCase() === 'desc' ? -1 : 1

  // Create stages array for direct Mockup query
  const mockupStages: PipelineStage[] = [
    { $match: { shopDomain } },

    // Ensure denormalizedData.integration exists
    { $match: { 'denormalizedData.integration': { $ne: null } } },

    // Apply title search if provided
    ...(searchFilter ? [searchFilter] : []),

    // Group by integration ID to form integrated templates
    {
      $group: {
        _id: '$denormalizedData.integration._id',
        title: { $first: '$denormalizedData.integration.name' },
        mockupIntegration: {
          $addToSet: {
            _id: '$_id',
            label: '$label',
            variantLabel: '$variantLabel',
            baseImage: '$baseImage',
            createdAtMockup: '$createdAt',
            updatedAtMockup: '$updatedAt',
            templatesIntegration: '$denormalizedData.templates',
          },
        },
        variantIntegration: {
          $addToSet: {
            $map: {
              input: '$denormalizedData.variants',
              as: 'variant',
              in: {
                $mergeObjects: ['$$variant', { mockup: '$_id' }],
              },
            },
          },
        },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
        shopDomain: { $first: '$shopDomain' },
      },
    },

    // Flatten and transform variants
    {
      $addFields: {
        variantIntegration: {
          $reduce: {
            input: '$variantIntegration',
            initialValue: [],
            in: { $concatArrays: ['$$value', '$$this'] },
          },
        },
        status: IntegrationStatus.PUBLISHED, // All found integrations are published
      },
    },

    // Sort based on user preference or default to updatedAt
    { $sort: sortBy ? { [sortBy]: sortDirection } : { updatedAt: -1 } },
  ]

  const t1 = performance.now()

  const res: Omit<FetchListResponse, 'items'> & { items: IntegrationListResult[] | null } = await fetchList(
    request,
    Mockup,
    mockupStages,
    [],
    true,
    ['title']
  )

  const t2 = performance.now()

  return json({ ...res, totalExecutionTimeInMs: t2 - t1 })
}

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  try {
    const {
      admin,
      session: { shop: shopDomain },
    } = await authenticate.admin(request)
    const api = new ShopifyApiClient(admin)

    // Get action from search params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case INTEGRATION_ACTION.FETCH_ALL_PRODUCT_VARIANTS: {
        const formData = await request.formData()
        const pageInfo: IPageInfo = JSON.parse((formData.get('pageInfo') as string) || '{}')
        const isFetchNextPage = Boolean(formData.get('isFetchNextPage'))
        const queryString: string = (formData.get('queryString') as string) || ''
        const productName: string = (formData.get('productName') as string) || ''
        const variantName: string = (formData.get('variantName') as string) || ''
        const productId: string = (formData.get('productId') as string) || ''
        const withArchived: boolean = (formData.get('withArchived') as string) === 'true'

        const _productName = productName ? `*${sanitizeShopifySearch(productName)}*` : ''
        const _variantName = variantName ? `*${sanitizeShopifySearch(variantName)}*` : ''
        const archivedQuery = !withArchived ? `(NOT status:${PRODUCT_STATUS_TYPE_FORMATTED.ARCHIVED})` : ''
        const productIdQuery = productId ? `(id:${productId.split('/').pop() || ''})` : ''

        const queryComponents = [productIdQuery, _productName, queryString, archivedQuery].filter(Boolean)
        const _queryString = queryComponents.length > 0 ? queryComponents.join(' AND ') : ''

        const { hasNextPage = false, endCursor = null } = pageInfo || {}
        const shouldFetchNextPage = Boolean(isFetchNextPage && hasNextPage && endCursor)
        const PRODUCTS_PER_PAGE = 15

        const commonQuery = {
          query: `${_queryString}${_variantName ? ` OR ${_variantName}` : ''}`,
          sortKey: 'CREATED_AT' as const,
          first: PRODUCTS_PER_PAGE,
        }

        const queryParams = shouldFetchNextPage && endCursor ? { ...commonQuery, after: endCursor } : commonQuery

        const t1 = performance.now()
        const { productsList, pageInfo: _pageInfo } = await api.getProducts(queryParams)
        const t2 = performance.now()

        // Compress the productsList data and convert to Base64 for safe JSON transmission
        const compressedData = compressData(productsList)
        const base64Data = Buffer.from(compressedData).toString('base64')

        return json({
          success: true,
          compressedProductsList: base64Data,
          pageInfo: _pageInfo,
          totalExecutionTimeInMs: t2 - t1,
          isCompressed: true,
        })
      }

      case INTEGRATION_ACTION.FETCH_PRODUCT_VARIANTS_BY_VARIANT_IDS: {
        // Parse request body
        const payload = await request.json()
        const { variantIds = [] } = payload || {}

        const productVariants = await api.getProductVariantsByVariantIds(variantIds)
        return json({ success: true, productVariants })
      }

      case INTEGRATION_ACTION.FETCH_PRODUCT_VARIANT_METAFIELDS: {
        // Parse request body
        const payload = await request.json()
        const { variantIds = [] } = payload || {}

        const productVariants = await api.getProductVariantMetafields({
          query: convertIdsToQuery(variantIds),
          first: variantIds.length > SHOPIFY_ITEMS_LIMITATION ? SHOPIFY_ITEMS_LIMITATION : variantIds.length,
        })
        const groupVariantMetafields: any = productVariants.reduce((groupVariantMetafields: any, variant: any) => {
          if (!groupVariantMetafields[variant.id]) {
            groupVariantMetafields[variant.id] = variant.metafields?.nodes?.[0]
          }

          return groupVariantMetafields
        }, {})

        return json({ success: true, groupVariantMetafields })
      }

      // case INTEGRATION_ACTION.DIS_RESET_INTEGRATE_TEMPLATE: {
      //   const payload = await request.json()
      //   const { variantIds, mockupId, integrationPublished, requestType } = payload
      //   const templatePopulatePipeline = {
      //     populate: [
      //       {
      //         path: 'psds',
      //         model: PSD,
      //       },
      //       {
      //         path: 'layers',
      //         model: Layer,
      //         populate: [
      //           {
      //             path: 'image',
      //             model: Image,
      //           },
      //           {
      //             path: 'optionSet',
      //             model: OptionSet,
      //           },
      //         ],
      //       },
      //     ],
      //   }
      //   // Fetch variant integrations using the variantIds
      //   const variantIntegrations = await VariantIntegration.find({
      //     shopDomain,
      //     id: { $in: variantIds },
      //   }).populate({
      //     path: 'printAreas',
      //     model: PrintArea,
      //     populate: {
      //       path: 'template', // populating templateId in print area
      //       model: Template,
      //       ...templatePopulatePipeline,
      //     },
      //   })

      //   let variants = []

      //   if (requestType === INTEGRATION_ACTION.DIS_INTEGRATE_TEMPLATE) {
      //     // Update mockup
      //     const mockup = await Mockup.findOneAndUpdate(
      //       { shopDomain, _id: mockupId },
      //       { disintegratedAt: new Date().toISOString() },
      //       { new: true }
      //     )
      //     variants = variantIntegrations.map(v => ({ ...v.toObject(), mockup }))
      //   } else if (requestType === INTEGRATION_ACTION.RESET_INTEGRATE_TEMPLATE) {
      //     // Update mockup and get the updated data by option { new: true }
      //     const mockupData = await Mockup.findOneAndUpdate(
      //       { shopDomain, _id: mockupId },
      //       { disintegratedAt: null },
      //       { new: true }
      //     ).populate([
      //       {
      //         path: 'layers',
      //         model: LayerIntegration,
      //         populate: [
      //           {
      //             path: 'data.templateId', // populating templateId in LayerIntegration
      //             model: Template,
      //             ...templatePopulatePipeline,
      //           },
      //         ],
      //       },
      //     ])

      //     variants = variantIntegrations.map(v => ({ ...v.toObject(), mockup: mockupData }))
      //   }

      //   // Check status of integration and re-publish if need
      //   if (integrationPublished) {
      //     await updateMetafields({ admin, variants })
      //   }

      //   return json({ success: true })
      // }

      case INTEGRATION_ACTION.FETCH_PRODUCT_BY_PRODUCT_ID: {
        const payload = await request.json()
        const { productIds } = payload || {}
        const products = await api.getProductsByIds(productIds)

        if (products) {
          return json({ success: true, products })
        }
        return json({ success: false, message: 'Products not found' })
      }

      case INTEGRATION_ACTION.UNPUBLISH_PERSONALIZED_PRODUCTS: {
        const payload = await request.json()
        const { integrationId } = payload

        // Update mockup
        const integration = await Integration.findOne({ shopDomain, _id: integrationId })
        if (!integration) return json({ success: false, message: 'Integration not found' })

        await unpublishIntegrationProcess({ admin, integrationId, shopDomain })

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      case INTEGRATION_ACTION.PUBLISH_PERSONALIZED_PRODUCTS: {
        const payload = await request.json()
        const { integrationId } = payload || {}

        await publishIntegrationProcess(admin, integrationId, shopDomain)

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      case INTEGRATION_ACTION.DELETE_PERSONALIZED_PRODUCTS: {
        const payload = await request.json()
        const { mockups } = payload || {}

        if (mockups.length === 0) {
          return json({
            success: false,
            message: 'No disintegrated mockups found with the provided IDs',
          })
        }

        const mockupIds = mockups.map((mockup: any) => mockup._id)

        // Find variants using these mockups
        const variantIntegrations = await VariantIntegration.find({
          shopDomain,
          mockup: { $in: mockupIds },
        })

        // Get layers from these mockups to delete
        const layerIds = mockups.reduce((acc: any, mockup: any) => {
          return [...acc, ...(mockup.layers || [])]
        }, [])

        // Collect affected template ids BEFORE deleting layers
        const templateIds: string[] = await LayerIntegration.distinct('data.templateId', {
          _id: { $in: layerIds },
          shopDomain,
        })

        // Process deletions
        await LayerIntegration.deleteMany({ _id: { $in: layerIds } })

        // Delete mockups
        await Mockup.deleteMany({ _id: { $in: mockupIds } })

        // Get variant IDs
        const variantIds = variantIntegrations.map(variant => variant.id)

        // Find all integrations that have these variants
        const integrations = await Integration.find({
          shopDomain,
          variants: { $in: variantIds },
        })

        // Use bulk operations instead of sequential processing
        const bulkOps = integrations.map(integration => {
          const remainingVariants = integration.variants.filter((variantId: any) => !variantIds.includes(variantId))

          if (remainingVariants.length === 0) {
            // If no variants remain, delete the integration
            return {
              deleteOne: {
                filter: { _id: integration._id },
              },
            }
          }
          // Otherwise, update with remaining variants
          return {
            updateOne: {
              filter: { _id: integration._id },
              update: { $set: { variants: remainingVariants } },
            },
          }
        })

        // Execute bulk operations if there are any
        if (bulkOps.length > 0) {
          await Integration.bulkWrite(bulkOps)
        }

        // Delete variants
        await VariantIntegration.deleteMany({ id: { $in: variantIds } })

        // Recompute templates' activeVariantIntegration after deletions
        if (templateIds && templateIds.length > 0) {
          await recomputeTemplatesActiveVariants(templateIds.filter(Boolean))
        }

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json({
          success: true,
          deletedMockups: mockupIds,
          deletedVariants: variantIds,
          affectedIntegrations: integrations.map(i => i._id),
        })
      }

      case INTEGRATION_ACTION.FETCH_INTEGRATIONS_BY_VARIANT_IDS: {
        const payload = await request.json()
        const { variantIds } = payload || {}

        const integrations = await getPublishedIntegrationsByVariantIds(variantIds, shopDomain)
        return json({ success: true, integrations })
      }

      case INTEGRATION_ACTION.FETCH_INTEGRATIONS_BY_TEMPLATE: {
        const payload = await request.json()
        const { templateId } = payload || {}
        const integrations = await getPublishedIntegrationsOfTemplate(templateId, shopDomain)
        return json({ success: true, integrations })
      }

      case INTEGRATION_ACTION.CHECK_SHARED_TEMPLATES_WITH_PUBLISHED: {
        const payload = await request.json()
        const { integrationId, templateIds } = payload || {}

        if (!templateIds || templateIds.length === 0) {
          return json({ success: true, sharedIntegrationIds: [] })
        }

        // Collect all published integration IDs that share any of these templates
        const sharedIntegrationIdsSet = new Set<string>()

        for (const templateId of templateIds) {
          const integrations = await getPublishedIntegrationsOfTemplate(templateId, shopDomain)
          integrations.forEach((integration: any) => {
            // Exclude current integration from results
            if (integration._id !== integrationId) {
              sharedIntegrationIdsSet.add(integration._id)
            }
          })
        }

        return json({
          success: true,
          sharedIntegrationIds: Array.from(sharedIntegrationIdsSet),
        })
      }

      // case INTEGRATION_ACTION.DELETE_INTEGRATE_TEMPLATE: {
      //   const payload = await request.json()
      //   const { integrationId, variantIds } = payload || {}

      //   const integration = await Integration.findOne({ shopDomain, _id: integrationId })
      //   const newVariants = (integration.variants || []).filter((id: string) => !variantIds.includes(id))

      //   const variantList = await VariantIntegration.find({ shopDomain, id: { $in: variantIds } }).populate([
      //     {
      //       path: 'mockup',
      //       model: Mockup,
      //       populate: {
      //         path: 'layers',
      //         model: LayerIntegration,
      //       },
      //     },
      //   ])

      //   // Delete all assets belong to the selected integration
      //   const assets = variantList.reduce(
      //     (assets: { mockupIds: string[]; layerIds: string[]; variantIds: string[] }, variant: any) => {
      //       const variantId = variant._id
      //       const mockupId = variant.mockup._id
      //       const layers = variant.mockup.layers || []

      //       if (!assets.variantIds.includes(variantId)) {
      //         assets.variantIds.push(variantId)
      //       }

      //       if (!assets.mockupIds.includes(mockupId)) {
      //         assets.mockupIds.push(mockupId)
      //       }

      //       layers.reduce((assets: any, layer: any) => {
      //         if (!assets.layerIds.includes(layer._id)) {
      //           assets.layerIds.push(layer._id)
      //         }

      //         return assets
      //       }, assets)

      //       return assets
      //     },
      //     { mockupIds: [], layerIds: [], variantIds: [] }
      //   )

      //   // Delete mockups
      //   if (assets.mockupIds.length > 0) {
      //     await Mockup.deleteMany({ _id: { $in: assets.mockupIds } })
      //   }

      //   // Delete layers
      //   if (assets.layerIds.length > 0) {
      //     await LayerIntegration.deleteMany({ _id: { $in: assets.layerIds } })
      //   }

      //   // Delete variants
      //   if (assets.variantIds.length > 0) {
      //     await VariantIntegration.deleteMany({ _id: { $in: assets.variantIds } })
      //   }

      //   const newIntegration = await Integration.findOneAndUpdate({ shopDomain,_id: integrationId }, { variants: newVariants })

      //   return { success: true, newIntegration }
      // }

      case INTEGRATION_ACTION.FETCH_COLLECTIONS: {
        const formData = await request.formData()
        const pageInfo: IPageInfo = JSON.parse((formData.get('pageInfo') as string) || '{}')
        const isFetchNextPage = Boolean(formData.get('isFetchNextPage'))
        const query: string = (formData.get('query') as string) || ''

        const { hasNextPage = false, endCursor = null } = pageInfo || {}
        const shouldFetchNextPage = Boolean(isFetchNextPage && hasNextPage && endCursor)

        const commonQuery = {
          first: 50,
          sortKey: 'TITLE' as const,
          reverse: false,
          ...(query ? { query: `*${sanitizeShopifySearch(query)}*` } : {}),
        }
        const queryParams = shouldFetchNextPage && endCursor ? { ...commonQuery, after: endCursor } : commonQuery

        const { collectionsList, pageInfo: _pageInfo } = await api.getCollections(queryParams)
        return json({ success: true, collections: collectionsList, pageInfo: _pageInfo })
      }

      case INTEGRATION_ACTION.FETCH_COLLECTION_PRODUCTS: {
        const formData = await request.formData()
        const collectionId: string = (formData.get('collectionId') as string) || ''
        const pageInfo: IPageInfo = JSON.parse((formData.get('pageInfo') as string) || '{}')
        const isFetchNextPage = Boolean(formData.get('isFetchNextPage'))

        if (!collectionId || !/^gid:\/\/shopify\/Collection\/\d+$/.test(collectionId)) {
          return json({ success: false, message: 'Invalid or missing collectionId' }, { status: 400 })
        }

        const { hasNextPage = false, endCursor = null } = pageInfo || {}
        const shouldFetchNextPage = Boolean(isFetchNextPage && hasNextPage && endCursor)

        const commonQuery = { first: 50, sortKey: 'TITLE' as const, reverse: false }
        const queryParams = shouldFetchNextPage && endCursor ? { ...commonQuery, after: endCursor } : commonQuery

        const { productsList, pageInfo: _pageInfo } = await api.getCollectionProducts(collectionId, queryParams)

        const compressedData = compressData(productsList)
        const base64Data = Buffer.from(compressedData).toString('base64')

        return json({ success: true, compressedProductsList: base64Data, pageInfo: _pageInfo, isCompressed: true })
      }

      default: {
        return json({ success: false, message: 'Invalid action' })
      }
    }
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
})
