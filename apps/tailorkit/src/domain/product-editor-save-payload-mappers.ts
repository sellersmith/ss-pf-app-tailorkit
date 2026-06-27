import type {
  TailorKitIntegrationRecord,
  TailorKitMockupSnapshot,
  TailorKitTemplateSnapshot,
  TailorKitVariantSnapshot,
} from './product-personalizer'
import type {
  TailorKitLayerIntegrationSnapshot,
  TailorKitMockupViewSnapshot,
  TailorKitPrintAreaSnapshot,
} from './product-editor-state'
import type { TailorKitProductEditorSavePayload } from './product-editor-save-payload'
import { asArray, asRecord, idOf, idsOf, number, shopifyVariantIdOf, templateIdOf, text, type JsonRecord } from './product-editor-save-payload-utils'

export interface TailorKitSavePayloadSlices {
  variants: TailorKitVariantSnapshot[]
  mockups: TailorKitMockupSnapshot[]
  templates: TailorKitTemplateSnapshot[]
  printAreas: TailorKitPrintAreaSnapshot[]
  layerIntegrations: TailorKitLayerIntegrationSnapshot[]
  mockupViews: TailorKitMockupViewSnapshot[]
}

function variantIdsByMockup(variants: JsonRecord[]) {
  const result = new Map<string, string[]>()
  variants.forEach(variant => {
    const variantId = idOf(variant._id) || idOf(variant.id)
    const mockupId = idOf(variant.mockup)
    if (!variantId || !mockupId) return
    result.set(mockupId, [...(result.get(mockupId) || []), variantId])
  })
  return result
}

function printAreaMockupLookup(variants: JsonRecord[]) {
  const result = new Map<string, string>()
  variants.forEach(variant => {
    const mockupId = idOf(variant.mockup)
    if (mockupId) idsOf(variant.printAreas).forEach(printAreaId => result.set(printAreaId, mockupId))
  })
  return result
}

function toVariants(payload: TailorKitProductEditorSavePayload, current: TailorKitIntegrationRecord) {
  const currentById = new Map(current.variants.map(variant => [variant.id, variant]))
  return asArray(payload.variants)
    .map<TailorKitVariantSnapshot | null>(variant => {
      const id = idOf(variant._id) || idOf(variant.id)
      const existing = id ? currentById.get(id) : undefined
      const productId = text(variant.productId) || existing?.productId
      if (!id || !productId) return null
      const image = asRecord(variant.image)
      return {
        id,
        shopifyVariantId: shopifyVariantIdOf(variant) || existing?.shopifyVariantId,
        productId,
        title: text(variant.title) || text(variant.displayName) || existing?.title || 'Default Title',
        productTitle: existing?.productTitle || text(variant.productTitle) || current.title,
        productHandle: text(variant.productHandle) || existing?.productHandle,
        imageUrl: text(variant.imageUrl) || text(image.src) || existing?.imageUrl,
        price: text(variant.price) || existing?.price,
        compareAtPrice: text(variant.compareAtPrice) || existing?.compareAtPrice,
      }
    })
    .filter((variant): variant is TailorKitVariantSnapshot => Boolean(variant))
}

function toPrintAreas(payload: TailorKitProductEditorSavePayload, current: TailorKitIntegrationRecord) {
  const mockupByPrintArea = printAreaMockupLookup(asArray(payload.variants))
  const fallbackMockupId = current.mockups[0]?.id
  return asArray(payload.printAreas)
    .map<TailorKitPrintAreaSnapshot | null>(printArea => {
      const id = idOf(printArea._id) || idOf(printArea.id)
      const mockupId = id ? mockupByPrintArea.get(id) || fallbackMockupId : fallbackMockupId
      if (!id || !mockupId) return null
      return {
        id,
        label: text(printArea.name) || text(printArea.label) || 'Print area',
        mockupId,
        templateId: templateIdOf(printArea.template),
        widthPx: number(printArea.width),
        heightPx: number(printArea.height),
      }
    })
    .filter((printArea): printArea is TailorKitPrintAreaSnapshot => Boolean(printArea))
}

function toTemplates(printAreas: JsonRecord[], layers: JsonRecord[]) {
  const templates = new Map<string, TailorKitTemplateSnapshot>()
  printAreas.forEach(printArea => {
    const template = asRecord(printArea.template)
    const id = templateIdOf(printArea.template)
    if (!id) return
    templates.set(id, {
      id,
      name: text(template.name) || text(template.title) || 'Template',
      printAreaId: idOf(printArea._id) || idOf(printArea.id),
      previewUrl: text(template.previewUrl),
    })
  })
  layers.forEach(layer => {
    const data = asRecord(layer.data)
    const id = text(data.templateId) || templateIdOf(data.template)
    if (id && !templates.has(id)) templates.set(id, { id, name: 'Template', printAreaId: idOf(layer.printAreaId) })
  })
  return Array.from(templates.values())
}

function toMockups(payload: TailorKitProductEditorSavePayload, current: TailorKitIntegrationRecord) {
  const variants = asArray(payload.variants)
  const variantLookup = variantIdsByMockup(variants)
  return asArray(payload.mockups)
    .map<TailorKitMockupSnapshot | null>(mockup => {
      const id = idOf(mockup._id) || idOf(mockup.id)
      if (!id) return null
      const existing = current.mockups.find(item => item.id === id)
      return {
        id,
        label: text(mockup.label) || text(mockup.storefrontLabel) || existing?.label || current.title,
        variantIds: variantLookup.get(id) || existing?.variantIds || current.variants.map(variant => variant.id),
        printAreaIds: variants.filter(variant => idOf(variant.mockup) === id).flatMap(variant => idsOf(variant.printAreas)),
      }
    })
    .filter((mockup): mockup is TailorKitMockupSnapshot => Boolean(mockup))
}

function toLayers(payload: TailorKitProductEditorSavePayload) {
  return asArray(payload.layers)
    .map<TailorKitLayerIntegrationSnapshot | null>(layer => {
      const id = idOf(layer._id) || idOf(layer.id)
      const data = asRecord(layer.data)
      if (!id) return null
      return {
        id,
        type: text(layer.type) || 'template',
        printAreaId: idOf(layer.printAreaId),
        templateId: text(data.templateId) || templateIdOf(data.template),
        x: number(layer.x),
        y: number(layer.y),
        width: number(layer.width),
        height: number(layer.height),
        rotation: number(layer.rotation),
        visible: typeof layer.visible === 'boolean' ? layer.visible : undefined,
        data: Object.keys(data).length ? data : undefined,
      }
    })
    .filter((layer): layer is TailorKitLayerIntegrationSnapshot => Boolean(layer))
}

function toMockupViews(payload: TailorKitProductEditorSavePayload) {
  return asArray(payload.mockupViews)
    .map<TailorKitMockupViewSnapshot | null>(view => {
      const id = idOf(view._id) || idOf(view.id)
      const mockupId = idOf(view.mockup) || idOf(view.mockupId)
      if (!id || !mockupId) return null
      return {
        id,
        mockupId,
        title: text(view.title) || 'View',
        layerIds: idsOf(view.layers),
        baseImage: view.baseImage,
        backgroundImage: view.backgroundImage,
        maskImage: view.maskImage,
        enableClippingMask: typeof view.enableClippingMask === 'boolean' ? view.enableClippingMask : undefined,
        overrides: asRecord(view.overrides),
      }
    })
    .filter((view): view is TailorKitMockupViewSnapshot => Boolean(view))
}

export function createTailorKitSavePayloadSlices(
  payload: TailorKitProductEditorSavePayload,
  current: TailorKitIntegrationRecord
): TailorKitSavePayloadSlices {
  return {
    variants: toVariants(payload, current),
    mockups: toMockups(payload, current),
    templates: toTemplates(asArray(payload.printAreas), asArray(payload.layers)),
    printAreas: toPrintAreas(payload, current),
    layerIntegrations: toLayers(payload),
    mockupViews: toMockupViews(payload),
  }
}
