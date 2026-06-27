import type { LoaderFunctionArgs } from '@remix-run/node'
import { getCombinedClipartsList } from './cliparts.server'
import { getClipartsCategoriesFromIndex, getClipartsDetailsBySelection } from '~/services/cliparts.server'
import PSD from '~/models/PSD.server'
import Image from '~/models/Image.server'
import Layer from '~/models/Layer.server'
import Template, { deleteTemplatesOrCliparts } from '~/models/Template.server'
import PrintArea from '~/models/PrintArea.server'
import { catchAsync } from '~/utils/catchAsync'
import type { TClipartsSelected } from './constants'
import { TEMPLATE_TYPE, TEMPLATES_ACTIONS } from './constants'
import { authenticate } from '~/shopify/app.server'
import type { FetchListResponse } from '~/bootstrap/fns/fetch.server'
import { fetchList, json } from '~/bootstrap/fns/fetch.server'
import AdmZip from 'adm-zip'
import { sanitizeFileName } from '~/utils/file-types'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import OptionSet from '~/models/OptionSet.server'
import { duplicateTemplates, getListTemplates, cloneClipartToTemplate } from './fns.server'
import { evaluateRequestForMutatingAssets } from '~/models/Asset.server'
import { updateShopUsages } from '~/models/Shop.server'
import type { PipelineStage } from 'mongoose'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const templates = await getListTemplates(request)

  return json(templates)
}

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case TEMPLATES_ACTIONS.UPLOAD_FILES: {
      // Evaluate request number for uploading media.
      // Set incNumber equal to 0.5 for each request because one template can include many media
      await evaluateRequestForMutatingAssets(shopDomain, 0.5)

      const formData: any = await request.formData()
      const files = formData.getAll('files') as (File | string)[]
      const fileUploadType = formData.get('fileUploadType') as string
      const filesToUpload = files.map(file => {
        if (typeof file === 'string') {
          return JSON.parse(file)
        }

        return file
      })

      const api = new ShopifyApiClient(admin)
      const data = await uploadFiles({ api, files: filesToUpload, shopDomain, fileUploadType })

      return json({ success: true, data })
    }

    case TEMPLATES_ACTIONS.EXPORT_TEMPLATES: {
      const formData: any = await request.formData()
      const templateIds = JSON.parse(formData.get('templateIds') as string)

      const templates = await Template.find({ shopDomain, _id: { $in: templateIds } })
        .populate([
          { path: 'psds', model: PSD },
          {
            path: 'layers',
            model: Layer,
            populate: [
              { path: 'image', model: Image },
              { path: 'optionSet', model: OptionSet },
            ],
          },
        ])
        .lean()

      if (!templates?.length) {
        return json({ success: false, message: 'no-templates-to-export' })
      }

      // If single template, return minified JSON payload directly
      if (templates.length === 1) {
        const tpl = templates[0]
        const filename = `${sanitizeFileName(tpl?.name || String(tpl?._id)) || 'template'}.json`
        return new Response(JSON.stringify(tpl), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename=${filename}`,
          },
        }) as any
      }

      // Multiple templates: build zip
      const zip = new AdmZip()
      templates.forEach(tpl => {
        const filename = `${sanitizeFileName(tpl?.name || String(tpl?._id)) || 'template'}.json`
        zip.addFile(filename, Buffer.from(JSON.stringify(tpl)))
      })
      const zipBuffer = zip.toBuffer()

      return new Response(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename=templates-export.zip',
        },
      }) as any
    }

    case TEMPLATES_ACTIONS.DUPLICATE:
    case TEMPLATES_ACTIONS.DELETE_TEMPLATES: {
      const formData: any = await request.json()
      const { selectedResources } = formData

      // Get template data
      const templates = await Template.find(
        { shopDomain, _id: { $in: selectedResources } },
        {
          _id: 1,
          name: 1,
          layers: 1,
          psds: 1,
          shopDomain: 1,
          activeVariantIntegration: 1,
          dimension: 1,
          previewUrl: 1,
        }
      ).populate([
        {
          path: 'psds',
          model: PSD,
        },
        {
          path: 'layers',
          model: Layer,
          populate: [{ path: 'optionSet', model: OptionSet }],
        },
      ])

      if (action === TEMPLATES_ACTIONS.DUPLICATE) {
        await duplicateTemplates(templates, shopDomain)
      } else {
        // Do not delete in-use templates - use simple aggregation
        // const templatesInUse = await Mockup.aggregate([
        //   {
        //     $lookup: {
        //       from: 'layerintegrations',
        //       localField: 'layers',
        //       foreignField: '_id',
        //       as: 'denormalizedData.integration',
        //     },
        //   },
        //   {
        //     $addFields: {
        //       'denormalizedData.integration._id': { $arrayElemAt: ['$denormalizedData.integration._id', 0] },
        //     },
        //   },
        //   {
        //     $match: {
        //       'denormalizedData.integration.data.templateId': { $in: templates.map((template: any) => template._id) },
        //       'denormalizedData.integration.publishedAt': { $ne: null },
        //     },
        //   },
        //   {
        //     $group: {
        //       _id: '$denormalizedData.integration.data.templateId',
        //     },
        //   },
        // ])

        // console.log('templatesInUse = ', templatesInUse)

        // const inUseTemplateIds = new Set(templatesInUse.map(item => item._id.toString()))

        // console.log('inUseTemplateIds = ', inUseTemplateIds.size)
        // Filter out templates that are in use
        for (let i = templates.length - 1; i >= 0; i--) {
          // if (inUseTemplateIds.has(templates[i]._id.toString())) {
          //   templates.splice(i, 1)
          // }
          if (templates[i].activeVariantIntegration.length) {
            templates.splice(i, 1)
          }
        }

        if (templates.length) {
          // Delete all assets belong to the selected templates
          // const assets = templates.reduce(
          //   (
          //     assets: { psdIds: string[]; layerIds: string[]; imageIds: string[]; optionSetIds: string[] },
          //     template: any
          //   ) => {
          //     template.psds.reduce((assets: any, psd: any) => {
          //       assets.psdIds.push(psd._id)

          //       return assets
          //     }, assets)

          //     template.layers.reduce((assets: any, layer: any) => {
          //       assets.layerIds.push(layer._id)
          //       assets.imageIds.push(layer.image)

          //       return assets
          //     }, assets)

          //     return assets
          //   },
          //   { psdIds: [], layerIds: [], imageIds: [] }
          // )

          // if (assets.imageIds.length) {
          //   await Image.deleteMany({ _id: { $in: assets.imageIds } })
          // }

          // // Delete all layers belong to the selected templates
          // if (assets.layerIds.length) {
          //   await Layer.deleteMany({ _id: { $in: assets.layerIds } })
          // }

          // // Delete all PSDs belong to the selected templates
          // if (assets.psdIds.length) {
          //   await PSD.deleteMany({ _id: { $in: assets.psdIds } })
          // }

          // // Delete all selected templates that are not in-use
          // await Template.deleteMany({ shopDomain, _id: { $in: templates.map((template: any) => template._id) } })

          const templateIds = templates.map((template: any) => template._id)
          const layerIds = templates.flatMap((template: any) => template.layers.map((layer: any) => layer._id))
          const psdIds = templates.flatMap((template: any) => template.psds.map((psd: any) => psd._id))

          await deleteTemplatesOrCliparts({
            shopDomain,
            templateIds,
            layerIds,
            psdIds,
          })
        }
      }

      // Update shop uages
      updateShopUsages(shopDomain).catch(console.error)

      break
    }

    case TEMPLATES_ACTIONS.GET_TEMPLATES_BY_IDS: {
      const formData: any = await request.formData()
      const templateIds = JSON.parse(formData.get('templateIds') as string)

      // Get template data
      const templates = await Template.find({ shopDomain, _id: { $in: templateIds } }).populate([
        {
          path: 'psds',
          model: PSD,
        },
        {
          path: 'layers',
          model: Layer,
          populate: [
            {
              path: 'image',
              model: Image,
            },
            {
              path: 'optionSet',
              model: OptionSet,
            },
          ],
        },
      ])

      return json({ success: true, templates })
    }

    case TEMPLATES_ACTIONS.GET_CLIPARTS_LIST: {
      const { filter__type } = Object.fromEntries(searchParams.entries())
      const filterCategoriesRaw = searchParams.get('filter__categories') || ''
      const hasCategoryFilter = !!filterCategoriesRaw
      // removed debug log

      const filters = [{ deletedAt: { $eq: null } }]

      const typeFilters = [
        {
          type: TEMPLATE_TYPE.CLIPART,
          shopDomain,
        },
      ]

      const initialPipeline: PipelineStage[] = [
        {
          $match: {
            $and: [...filters, ...typeFilters],
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            thumbnailUrl: 1,
            previewUrl: 1,
            createdAt: 1,
            type: 1,
            metadata: 1,
            dimension: 1,
          },
        },
      ]

      let res1: FetchListResponse = { page: 0, total: 0, items: [] }

      if (filter__type?.includes(TEMPLATE_TYPE.CLIPART) && !hasCategoryFilter) {
        // Fetch own cliparts
        res1 = await fetchList(request, Template, initialPipeline, [], true)
        // removed debug log
      }

      // Fetch cliparts from store asset domain
      const res2 = await getCombinedClipartsList(request, shopDomain)
      // removed debug log

      const res = {
        ...res1,
        ...res2,
        items: [...(res1.items || []), ...(res2.items || [])],
        total: (res1.items?.length || 0) + res2.total,
      }

      // removed debug log
      return json({ success: true, ...res })
    }

    case TEMPLATES_ACTIONS.GET_CLIPARTS_CATEGORIES: {
      const categories = await getClipartsCategoriesFromIndex()
      return json({ success: true, items: categories })
    }

    case TEMPLATES_ACTIONS.GET_CLIPARTS_DETAILS: {
      const payload = await request.json()
      const { clipartsSelected = [] } = payload

      if (!Array.isArray(clipartsSelected)) {
        throw new Error('Invalid input: clipartsSelected should be an array')
      }

      const templates = await getClipartsDetailsBySelection(clipartsSelected as TClipartsSelected[], shopDomain)

      return json({ success: true, templates })
    }

    case TEMPLATES_ACTIONS.CLONE_CLIPART_TO_TEMPLATE: {
      const formData: any = await request.json()
      const { clipartId } = formData

      if (!clipartId) {
        throw new Error('Clipart ID is required')
      }

      try {
        const result = await cloneClipartToTemplate(clipartId, shopDomain)

        return json({
          success: true,
          data: {
            templateId: result.templateId,
            templateName: result.templateName,
            isFirstTemplate: result.isFirstTemplate,
          },
        })
      } catch (error) {
        console.error('cloneClipartToTemplate - error = ', error)
        return json({
          success: false,
          message: error instanceof Error ? error.message : error || 'Unknown error',
        })
      }
    }

    case TEMPLATES_ACTIONS.CHECK_TEMPLATE_USAGE: {
      const formData: any = await request.json()
      const { templateId } = formData

      if (!templateId) {
        return json({ success: false, error: 'Template ID is required' }, { status: 400 })
      }

      // Count how many print areas use this template in the entire database for this shop
      const printAreas = await PrintArea.find(
        {
          template: templateId,
          shopDomain,
        },
        {
          _id: 1,
        }
      ).lean()

      const usageCount = printAreas?.length || 0

      // Check if template is used in other print areas (excluding current one)
      const isUsedElsewhere = usageCount > 1

      return json({
        success: true,
        templateId,
        printAreaIds: printAreas?.map((printArea: any) => printArea?._id) || [],
        usageCount,
        isUsedElsewhere,
      })
    }
  }

  return json({ success: true })
})
