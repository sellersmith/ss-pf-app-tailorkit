import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import Template from '~/models/Template.server'
import Layer from '~/models/Layer.server'
import OptionSet from '~/models/OptionSet.server'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { catchAsync } from '~/utils/catchAsync'

export const loader = catchAsync(async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticateAppProxy(request)
    const shopDomain = session.shop
    console.log('✅ App Proxy Authentication Success - Shop:', shopDomain)

    const templateId = params.id

    if (!templateId) {
      return json(
        { error: 'Template ID is required' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    console.log('🔍 Searching for template:', templateId, 'in shop:', shopDomain)

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
      console.log('❌ Template not found:', templateId)
      return json(
        { error: 'Template not found' },
        {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    console.log('✅ Template found:', (template as any)._id)

    // Extract all option sets from all layers and prepare layers data
    const optionSets: any[] = []
    const optionSetIds = new Set<string>()
    const layers: any[] = []

    const templateData = template as any
    console.log('🔍 Template layers found:', templateData.layers ? templateData.layers.length : 0)

    if (templateData.layers && Array.isArray(templateData.layers)) {
      templateData.layers.forEach((layer: any, index: number) => {
        console.log(`🔍 Processing layer ${index + 1}:`, {
          id: layer._id,
          type: layer.type,
          label: layer.label,
          hasSettings: !!layer.settings,
          settingsKeys: layer.settings ? Object.keys(layer.settings) : [],
          hasOptionSet: !!layer.optionSet,
          optionSetCount: Array.isArray(layer.optionSet) ? layer.optionSet.length : 0,
        })

        // Prepare layer data with all necessary information
        const layerData: any = {
          _id: layer._id,
          type: layer.type,
          label: layer.label,
          visible: layer.visible,
          locked: layer.locked,
          parent: layer.parent,
          settings: layer.settings || {},
          optionSetIds: Array.isArray(layer.optionSet) ? layer.optionSet.map((os: any) => os._id) : [],
          templateId: layer.templateId,
          top: layer.top,
          left: layer.left,
          width: layer.width,
          height: layer.height,
          rotate: layer.rotate,
          // For text layers, include the content
          ...(layer.type === 'text' && layer.settings ? { textContent: layer.settings.content || '' } : {}),
        }

        // Log text content for debugging
        if (layer.type === 'text' && layer.settings) {
          console.log(`📝 Text layer content:`, layer.settings.content)
        }

        layers.push(layerData)

        // Extract option sets from layer
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
                layerName: layer.label || `Layer ${layer._id}`,
              })
            }
          })
        }
      })
    }

    console.log(`✅ Found ${optionSets.length} option sets and ${layers.length} layers for template ${templateId}`)
    console.log(
      '📋 Layers summary:',
      layers.map(l => ({ id: l._id, type: l.type, label: l.label, hasContent: !!l.textContent }))
    )
    console.log(
      '📋 Option sets summary:',
      optionSets.map(os => ({ id: os._id, type: os.type, label: os.label, layerId: os.layerId }))
    )

    return json(
      {
        success: true,
        templateId,
        templateName: templateData.name,
        templateDimension: templateData.dimension,
        layers,
        optionSets,
        totalLayers: layers.length,
        totalOptionSets: optionSets.length,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  } catch (authError: any) {
    console.error('❌ App Proxy Authentication Failed:', authError)
    return json(
      { error: 'Authentication failed', details: authError.message },
      {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    )
  }
})
