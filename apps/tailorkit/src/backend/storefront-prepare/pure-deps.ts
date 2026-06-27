// Pure functions extracted verbatim from TailorKit upstream so the publish transform can run
// server-side without dragging the editor's browser stores, Mongoose models, and client-fetch
// modules. Each function is copied exactly from the noted upstream source; only the surrounding
// file-level imports (stores/Transmitter/models) are dropped because these bodies never touch them.
import type { LayerDocument } from './_external-types'
import type { Layer } from './types/psd'
import { EOptionSet } from './types/psd'

// Source: app/constants/errors.ts
const UncommonError = 'Something unexpected happened'

// Source: app/utils/shopify.ts → formatShopifyObjectIdToNumberId (verbatim)
export function formatShopifyObjectIdToNumberId(id: string | number, prefix: string): string {
  if (typeof id === 'number') {
    return id.toString()
  }
  if (!isNaN(Number(id))) {
    return id.toString()
  }
  return id.replace(prefix, '')
}

// Source: app/modules/TemplateEditor/fns.ts:728 → isLayerOfTemplateVisible (verbatim)
export const isLayerOfTemplateVisible = (layer: LayerDocument, allLayers: LayerDocument[]): boolean => {
  // Input validation
  if (!layer) {
    return false
  }

  const layerMap = new Map(allLayers.map(l => [l._id, l]))
  const visited = new Set<string>()
  let currentLayer = layer

  while (true) {
    // Check current layer visibility
    if (!currentLayer.visible) {
      return false
    }

    // Reached root layer (no parent) and it's visible
    if (!currentLayer.parent) {
      return true
    }

    // Detect circular reference
    if (visited.has(currentLayer._id)) {
      console.warn(`Circular reference detected in layer hierarchy: ${currentLayer._id}`)
      return false
    }

    visited.add(currentLayer._id)

    // Get and validate parent
    const parentLayer = layerMap.get(currentLayer.parent)
    if (!parentLayer) {
      console.warn(`Parent layer ${currentLayer.parent} not found for layer ${currentLayer._id}`)

      // Initially we return false, but layer can be visible without parent root.
      // It's side effect of the previous implementation.
      // return false
      return true
    }

    currentLayer = parentLayer
  }
}

// Source: app/modules/TemplateEditor/elements/fns.ts:134 → checkLayerInsideMultiLayout (verbatim)
export function checkLayerInsideMultiLayout(targetLayer: Layer | null, allLayers: Layer[]) {
  if (!targetLayer) {
    console.warn(UncommonError)
    return {
      isLayerInsideMultiLayout: false,
      multiLayoutLayerId: undefined,
    }
  }

  // Find all multilayout layers
  const multiLayoutLayers = allLayers.filter(layer => layer.type === 'multi-layout')

  // Find which multilayout contains our target layer
  const containingMultiLayout = multiLayoutLayers.find(multiLayoutLayer => {
    const multiLayoutOptionSet = multiLayoutLayer.optionSet?.find(opt => opt.type === EOptionSet.MULTI_LAYOUT_OPTION)

    if (!multiLayoutOptionSet?.data?.['multi_layout']?.layouts) {
      return false
    }

    return multiLayoutOptionSet?.data?.['multi_layout']?.layouts?.some(layout =>
      layout.layerIds.includes(targetLayer._id)
    )
  })

  const multiLayoutLayerId = containingMultiLayout?._id

  return {
    isLayerInsideMultiLayout: !!multiLayoutLayerId,
    multiLayoutLayerId,
  }
}
