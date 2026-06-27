import type { PipelineStage } from 'mongoose'
import type { LoaderFunctionArgs } from '@remix-run/node'
import Mockup from '~/models/Mockup.server'
import Integration from '~/models/Integration.server'
import VariantIntegration from '~/models/VariantIntegration.server'
import { authenticate } from '~/shopify/app.server'
import { fetchList, json } from '~/bootstrap/fns/fetch.server'
import { parseFiltersFromRequest } from '~/bootstrap/fns/filter/filter.server'
import { ShopifyApiClient, verifyResponse } from '~/shopify/graphql/api.server'
import Template from '~/models/Template.server'
import { IntegrationStatus } from '~/types/integration'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    admin,
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
          { label: searchValue },
          { 'denormalizedData.templates.name': searchValue },
          { 'denormalizedData.integration.name': searchValue },
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

    // Get integration status
    {
      $lookup: {
        from: Integration.collection?.collectionName ?? '', // Handle potential null collectionName
        localField: 'denormalizedData.integration._id',
        foreignField: '_id',
        as: 'integration',
      },
    },
    {
      $set: {
        status: {
          $cond: [
            { $eq: [{ $size: '$integration' }, 0] },
            IntegrationStatus.UNPUBLISHED,
            {
              $cond: [
                { $eq: [{ $arrayElemAt: ['$integration.publishedAt', 0] }, null] },
                IntegrationStatus.UNPUBLISHED,
                IntegrationStatus.PUBLISHED,
              ],
            },
          ],
        },
      },
    },

    // Sort based on user preference or default to updatedAt
    { $sort: sortBy ? { [sortBy]: sortDirection } : { updatedAt: -1 } },
  ]

  const res = await fetchList(request, Mockup, mockupStages, [], true, ['title'])

  // Enrich response: variant titles + template updatedAt times
  try {
    if (res.items) {
      // 1. Fetch variant titles from Shopify
      const apiClient = new ShopifyApiClient(admin)

      const variantIds = res.items.reduce((acc: string[], item: any) => {
        return acc.concat(item.denormalizedData.variants.map((v: any) => v?.id))
      }, [])

      if (variantIds.length > 0) {
        const variants = Object.values(
          (await verifyResponse(
            await apiClient.graphql(`
              query {
                ${variantIds
                  .map((id: string, idx: number) => `productVariant${idx}: productVariant(id: "${id}") { id title }`)
                  .join('\n')}
              }
            `)
          )) || {}
        ) as any[]

        // Fetch VariantIntegration data to get printAreas
        const variantMongoIds = res.items.reduce((acc: string[], item: any) => {
          return acc.concat(item.denormalizedData.variants.map((v: any) => v._id))
        }, [])

        const variantIntegrations = await VariantIntegration.find({
          _id: { $in: variantMongoIds },
          shopDomain,
        })
          .select('_id printAreas')
          .populate('printAreas', '_id name template')
          .lean()

        res.items = res.items.map((item: any) => {
          item.denormalizedData.variants = item.denormalizedData.variants.map((v: any) => {
            const variantInteg = variantIntegrations.find((vi: any) => vi._id.toString() === v._id.toString())
            return {
              ...v,
              title: variants.find((variant: any) => {
                return variant?.id === v?.id
              })?.title,
              printAreas: variantInteg?.printAreas || [],
            }
          })

          return item
        })
      }

      // 2. Attach templates' updatedAt to enable republish detection on the client
      const templateIds = res.items.reduce((acc: string[], item: any) => {
        return acc.concat(item.denormalizedData.templates?.map((t: any) => t._id) || [])
      }, [])

      if (templateIds.length > 0) {
        const templatesMeta = await Template.find({ _id: { $in: templateIds }, shopDomain })
          .select('_id updatedAt')
          .lean()

        res.items = res.items.map((item: any) => {
          if (item.denormalizedData.templates) {
            item.denormalizedData.templates = item.denormalizedData.templates.map((t: any) => {
              const meta = templatesMeta.find((m: any) => m._id.toString() === t._id.toString())
              return { ...t, updatedAt: meta?.updatedAt || null }
            })
          }
          return item
        })
      }

      // 3. Flatten integration info and keep publishedAt
      res.items = res.items.map((item: any) => {
        const integrationArr = item.integration || []
        if (integrationArr.length > 0) {
          const integ = integrationArr[0]
          item.denormalizedData.integration = {
            _id: integ._id,
            name: integ.name || integ.title || '',
            publishedAt: integ.publishedAt || null,
          }
        }

        // Remove raw integration array to avoid sending full document
        delete item.integration
        return item
      })
    }
  } catch (e: any) {
    console.error(e)
  }

  return json(res)
}
