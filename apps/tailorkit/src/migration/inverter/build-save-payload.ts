// Inverse of populateTailorKitEditorPayload: NORMALIZE a populated native Integration graph back into
// the TailorKitProductEditorSavePayload the editor would have POSTed. This is the ONLY genuinely-new
// logic in the migration — everything downstream (repo.update → derive 7 collections) is shipped code.
//
// Output contract (mirrors product-editor-populate.ts comments):
//   variant.mockup = mockupId (bare), variant.printAreas = [printAreaId]; full objects in sibling
//   arrays mockups[]/layers[]/printAreas[]/mockupViews[]. Template stays nested in printAreas[].template
//   AND is reachable from layers via layer.data.templateId (indirect join the populate inverse expects).
import type {
  NativeIntegrationGraph,
  NativeLayerIntegration,
  NativeMockup,
  NativeMockupView,
  NativePrintArea,
  NativeTemplate,
  NativeVariantIntegration,
} from '../native/native-graph'
import type { TailorKitProductEditorSavePayload } from '../../domain/product-editor-save-payload'
import { idOf, shopifyVariantIdOf, text, type JsonRecord } from '../../domain/product-editor-save-payload-utils'

export interface BuildSavePayloadResult {
  payload: TailorKitProductEditorSavePayload
  skipped: { variants: string[]; mockups: string[] }
}

function isDisintegrated(mockup: NativeMockup | null | undefined): boolean {
  return Boolean(mockup && mockup.disintegratedAt)
}

/** Returns the full Template object from a populated ref (printArea.template or layer.data.templateId). */
function templateObject(ref: NativeTemplate | string | null | undefined): NativeTemplate | undefined {
  return ref && typeof ref === 'object' ? ref : undefined
}

function layerDisplayName(layer: NativeLayerIntegration, template: NativeTemplate | undefined): string {
  return (
    text(layer.name) ||
    text(layer.label) ||
    text(layer.legacyName) ||
    text(template?.name) ||
    text(template?.title) ||
    text(layer.layerId) ||
    String(layer._id)
  )
}

export function buildSavePayloadFromNativeGraph(graph: NativeIntegrationGraph): BuildSavePayloadResult {
  const skippedVariants: string[] = []
  const skippedMockups = new Set<string>()

  const mockupsById = new Map<string, JsonRecord>()
  const layersById = new Map<string, JsonRecord>()
  const printAreasById = new Map<string, JsonRecord>()
  const mockupViewsById = new Map<string, JsonRecord>()
  const variantsOut: JsonRecord[] = []
  // Full Template objects keyed by id, harvested anywhere they appear (printArea.template OR
  // layer.data.templateId). Used after the walk to emit indirect-join template carriers.
  const templatesById = new Map<string, NativeTemplate>()

  // Normalizes a layer to bare-id form (data.templateId → id) and harvests its full template object.
  const collectLayer = (layer: NativeLayerIntegration): string => {
    const layerId = String(layer._id)
    if (!layersById.has(layerId)) {
      const data = (layer.data || {}) as JsonRecord
      const template = templateObject(layer.data?.templateId)
      if (template) templatesById.set(String(template._id), template)
      const normalizedData: JsonRecord = template ? { ...data, templateId: String(template._id) } : { ...data }
      const fallbackName = layerDisplayName(layer, template)
      layersById.set(layerId, {
        ...layer,
        _id: layerId,
        type: text(layer.type) || text(data.type) || (template ? 'template' : 'image'),
        name: text(layer.name) || fallbackName,
        label: text(layer.label) || fallbackName,
        legacyName: text(layer.legacyName) || fallbackName,
        data: normalizedData,
      })
    }
    return layerId
  }

  const resolvedVariants = Array.isArray(graph.variants) ? graph.variants : []
  const resolvedRefs = new Set(resolvedVariants.map(variant => String(variant.id)))

  // ORPHAN-SKIP: a raw GID with no resolvable VariantIntegration → record + skip, keep migrating.
  ;(graph.variantRefs || []).forEach(ref => {
    if (!resolvedRefs.has(String(ref))) skippedVariants.push(String(ref))
  })

  resolvedVariants.forEach((variant: NativeVariantIntegration) => {
    const variantId = idOf(variant._id) || idOf(variant.id)
    if (!variantId) {
      skippedVariants.push(String(variant.id || variant._id || 'unknown'))
      return
    }

    const mockup = variant.mockup || null
    // DISINTEGRATED-MOCKUP SKIP: if the variant's only mockup is soft-deleted, treat as orphan.
    if (mockup && isDisintegrated(mockup)) {
      skippedMockups.add(String(mockup._id))
      skippedVariants.push(variantId)
      return
    }

    const mockupId = mockup ? String(mockup._id) : undefined

    // Collect the mockup (dedup) with normalized layers as bare ids; views go to the sibling array.
    if (mockup && mockupId && !mockupsById.has(mockupId)) {
      const layerIds = (mockup.layers || []).map(collectLayer)
      ;(mockup.views || []).forEach((view: NativeMockupView) => {
        const viewId = String(view._id)
        const viewLayerIds = (view.layers || []).map(collectLayer)
        if (!mockupViewsById.has(viewId)) {
          mockupViewsById.set(viewId, { ...view, mockup: mockupId, layers: viewLayerIds })
        }
      })
      mockupsById.set(mockupId, { ...mockup, layers: layerIds, views: undefined })
    }

    // Collect printAreas (dedup) with the full nested template; harvest the template object too.
    const printAreaIds: string[] = []
    ;(variant.printAreas || []).forEach((printArea: NativePrintArea) => {
      const printAreaId = String(printArea._id)
      printAreaIds.push(printAreaId)
      if (!printAreasById.has(printAreaId)) {
        const template = templateObject(printArea.template)
        if (template) templatesById.set(String(template._id), template)
        printAreasById.set(printAreaId, template ? { ...printArea, template } : { ...printArea })
      }
    })

    // Mirror createTailorKitCreateInputFromSavePayload variant identity exactly: canonical id + GID.
    variantsOut.push({
      _id: variantId,
      id: variant.id,
      shopifyVariantId: shopifyVariantIdOf(variant),
      productId: text(variant.productId),
      title: text(variant.title),
      price: text(variant.price),
      compareAtPrice: text(variant.compareAtPrice),
      mockup: mockupId,
      printAreas: printAreaIds,
    })
  })

  // INDIRECT-JOIN: the populate inverse indexes templates ONLY from printAreas[].template. A template
  // reachable only via layer.data.templateId would be lost on round-trip, so emit a synthetic
  // print-area carrier ({ _id, template }) for any harvested template not already nested in a printArea.
  const nestedTemplateIds = new Set(
    [...printAreasById.values()].map(printArea => idOf((printArea as JsonRecord).template)).filter(Boolean)
  )
  const templateCarriers: JsonRecord[] = []
  templatesById.forEach((template, templateId) => {
    if (nestedTemplateIds.has(templateId)) return
    templateCarriers.push({ _id: `template-carrier-${templateId}`, template })
  })

  const payload: TailorKitProductEditorSavePayload = {
    integration: {
      _id: String(graph._id),
      id: String(graph._id),
      title: text(graph.title),
      notes: text(graph.notes),
      selectedTab: typeof graph.selectedTab === 'number' ? graph.selectedTab : undefined,
    },
    variants: variantsOut,
    mockups: [...mockupsById.values()],
    layers: [...layersById.values()],
    printAreas: [...printAreasById.values(), ...templateCarriers],
    mockupViews: [...mockupViewsById.values()],
  }

  return { payload, skipped: { variants: skippedVariants, mockups: [...skippedMockups] } }
}
