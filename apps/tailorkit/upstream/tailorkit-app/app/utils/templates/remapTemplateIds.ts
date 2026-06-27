import { duplicateLayers } from '~/modules/TemplateEditor/fns'

export type IdMap = {
  layerIdMap: Record<string, string>
  optionSetIdMap: Record<string, string>
}

export type RemapTemplateResult<TTemplate = any> = {
  template: TTemplate
  idMap: IdMap
}

/**
 * Remap all layer and option set IDs in a template and fix cross-references.
 * - Generates new UUIDs for layers and option sets
 * - Updates layer.parent, layer.children, layer.optionSet references
 * - Updates conditionalLogic (controls.conditions.thenShowOrHideLayers, isControlledBy)
 * - Updates multi-layout option set data: data.multi_layout.layouts[].layerIds
 */
export function remapTemplateIdsAndReferences(
  templateData: any,
  uuid: () => string,
  shopDomain: string,
  newTemplateId?: string
): RemapTemplateResult<any> {
  if (!templateData || typeof templateData !== 'object') {
    return { template: templateData, idMap: { layerIdMap: {}, optionSetIdMap: {} } }
  }

  const template = JSON.parse(JSON.stringify(templateData))

  // Try to reuse duplicateLayers logic to ensure consistent behavior with editor
  try {
    const originalLayers: any[] = Array.isArray(template.layers) ? template.layers : []
    const processedLayers: any[] = duplicateLayers({
      layers: originalLayers,
      shopDomain,
      topShift: 0,
      leftShift: 0,
      shouldUploadImageToShopify: false,
      newId: undefined,
      validationErrorsContext: undefined,
    })

    // Build layerIdMap by zipping original to processed in order
    const layerIdMap: Record<string, string> = {}
    for (let i = 0; i < originalLayers.length; i++) {
      const oldId: string | undefined = originalLayers[i]?._id
      const newId: string | undefined = processedLayers[i]?._id
      if (typeof oldId === 'string' && typeof newId === 'string') {
        layerIdMap[oldId] = newId
      }
    }

    // Derive optionSetIdMap by pairing original layer optionSet IDs with processed layer optionSet objects
    const optionSetIdMap: Record<string, string> = {}
    for (let i = 0; i < originalLayers.length; i++) {
      const origOpts: any[] = Array.isArray(originalLayers[i]?.optionSet) ? (originalLayers[i].optionSet as any[]) : []
      const newOpts: any[] = Array.isArray(processedLayers[i]?.optionSet) ? (processedLayers[i].optionSet as any[]) : []
      const n = Math.min(origOpts.length, newOpts.length)
      for (let j = 0; j < n; j++) {
        const oldOsId = typeof origOpts[j] === 'string' ? (origOpts[j] as string) : origOpts[j]?._id
        const newOsId = typeof newOpts[j] === 'string' ? (newOpts[j] as string) : newOpts[j]?._id
        if (typeof oldOsId === 'string' && typeof newOsId === 'string') {
          optionSetIdMap[oldOsId] = newOsId
        }
      }
    }

    // Update top-level optionSets with mapping and shopDomain; also fix multi-layout layerIds
    const optionSetGroups: any[][] = Array.isArray(template.optionSets) ? template.optionSets : []
    optionSetGroups.forEach(group => {
      if (!Array.isArray(group)) return
      group.forEach(os => {
        if (!os || typeof os !== 'object') return
        if (typeof os._id === 'string' && optionSetIdMap[os._id]) {
          os._id = optionSetIdMap[os._id]
        }
        os.shopDomain = shopDomain
        const layouts = os?.data?.multi_layout?.layouts
        if (Array.isArray(layouts)) {
          layouts.forEach((layout: any) => {
            if (Array.isArray(layout?.layerIds)) {
              layout.layerIds = layout.layerIds.map((lid: string) => layerIdMap[lid] || lid)
            }
          })
        }
      })
    })

    // Assign processed layers and identifiers
    template.layers = processedLayers.map(l => ({ ...l, shopDomain, templateId: newTemplateId || l.templateId }))
    if (newTemplateId) template._id = newTemplateId
    template.shopDomain = shopDomain

    return { template, idMap: { layerIdMap, optionSetIdMap } }
  } catch (_err) {
    // Fallback to pure remapping if duplicateLayers is not available in this environment
    const layerIdMap: Record<string, string> = {}
    const optionSetIdMap: Record<string, string> = {}

    const layers: any[] = Array.isArray(template.layers) ? template.layers : []
    layers.forEach(layer => {
      if (layer && typeof layer._id === 'string') {
        layerIdMap[layer._id] = uuid()
      }
    })

    const optionSetGroups: any[][] = Array.isArray(template.optionSets) ? template.optionSets : []
    optionSetGroups.forEach(group => {
      if (Array.isArray(group)) {
        group.forEach(os => {
          if (os && typeof os._id === 'string') {
            optionSetIdMap[os._id] = uuid()
          }
        })
      }
    })

    optionSetGroups.forEach(group => {
      if (!Array.isArray(group)) return
      group.forEach(os => {
        if (!os || typeof os !== 'object') return
        const oldId = os._id
        if (typeof oldId === 'string' && optionSetIdMap[oldId]) {
          os._id = optionSetIdMap[oldId]
        }
        os.shopDomain = shopDomain
        const layouts = os?.data?.multi_layout?.layouts
        if (Array.isArray(layouts)) {
          layouts.forEach((layout: any) => {
            if (Array.isArray(layout?.layerIds)) {
              layout.layerIds = layout.layerIds.map((lid: string) => layerIdMap[lid] || lid)
            }
          })
        }
      })
    })

    const remappedLayers = layers.map(origLayer => {
      const layer = { ...origLayer }
      const oldId = layer._id
      const newId = typeof oldId === 'string' ? layerIdMap[oldId] : undefined
      if (newId) layer._id = newId
      if (typeof layer.parent === 'string') {
        layer.parent = layerIdMap[layer.parent] || layer.parent
      }
      if (Array.isArray(layer.children)) {
        layer.children = layer.children.map((cid: string) => layerIdMap[cid] || cid)
      }
      if (Array.isArray(layer.optionSet)) {
        layer.optionSet = layer.optionSet.map((osId: string | any) => {
          if (typeof osId === 'string') return optionSetIdMap[osId] || osId
          if (osId && typeof osId === 'object' && typeof osId._id === 'string') {
            const newOsId = optionSetIdMap[osId._id] || osId._id
            return { ...osId, _id: newOsId }
          }
          return osId
        })
      }
      const cl = layer.conditionalLogic
      if (cl && typeof cl === 'object') {
        const controls = cl.controls || {}
        const conditions = Array.isArray(controls.conditions) ? controls.conditions : []
        const isControlledBy = Array.isArray(cl.isControlledBy) ? cl.isControlledBy : []
        const remappedConditions = conditions.map((condition: any) => {
          const thenShowOrHideLayers = Array.isArray(condition?.thenShowOrHideLayers)
            ? condition.thenShowOrHideLayers.map((lid: string) => layerIdMap[lid] || lid)
            : []
          const ifOptionSelected
            = typeof condition?.ifOptionSelected === 'string'
              ? layerIdMap[condition.ifOptionSelected] || condition.ifOptionSelected
              : condition?.ifOptionSelected
          return { ...condition, thenShowOrHideLayers, ifOptionSelected }
        })
        layer.conditionalLogic = {
          ...cl,
          controls: { ...controls, conditions: remappedConditions },
          isControlledBy: isControlledBy.map((lid: string) => layerIdMap[lid] || lid),
        }
      }
      layer.shopDomain = shopDomain
      if (newTemplateId) layer.templateId = newTemplateId
      return layer
    })

    template.layers = remappedLayers
    if (newTemplateId) template._id = newTemplateId
    template.shopDomain = shopDomain

    return { template, idMap: { layerIdMap, optionSetIdMap } }
  }
}
