import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import Template from '~/models/Template.server'
import Layer from '~/models/Layer.server'
import OptionSet from '~/models/OptionSet.server'
import { authenticate } from '~/shopify/app.server'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const templateId = params.id

  if (!templateId) {
    return json({ error: 'Template ID is required' }, { status: 400 })
  }

  try {
    // Get template with populated layers and option sets
    const template = await Template.findOne({
      _id: templateId,
      shopDomain,
      deletedAt: null,
    })
      .populate({
        path: 'layers',
        model: Layer,
        match: { deletedAt: null },
        populate: {
          path: 'optionSet',
          model: OptionSet,
        },
      })
      .lean()

    if (!template) {
      return json({ error: 'Template not found' }, { status: 404 })
    }

    // Extract all option sets from all layers
    const optionSets: any[] = []
    const optionSetIds = new Set<string>()

    const templateData = template as any
    if (templateData.layers && Array.isArray(templateData.layers)) {
      templateData.layers.forEach((layer: any) => {
        if (layer.optionSet && Array.isArray(layer.optionSet)) {
          layer.optionSet.forEach((optionSet: any) => {
            if (optionSet && !optionSetIds.has(optionSet._id)) {
              optionSetIds.add(optionSet._id)
              optionSets.push({
                _id: optionSet._id,
                label: optionSet.label,
                labelOnStoreFront: optionSet.labelOnStoreFront,
                type: optionSet.type,
                data: optionSet.data,
                values: optionSet.values,
                layerId: layer._id,
                layerType: layer.type,
                layerName: layer.name || `Layer ${layer._id}`,
              })
            }
          })
        }
      })
    }

    return json({
      success: true,
      templateId,
      templateName: templateData.name,
      optionSets,
      totalOptionSets: optionSets.length,
    })
  } catch (error) {
    console.error('Error fetching template option sets:', error)
    return json({ error: 'Failed to fetch template option sets' }, { status: 500 })
  }
}
