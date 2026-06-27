import type { TailorKitProductEditorSavePayload } from './product-editor-save-payload'
import { asArray, asRecord, idOf, idsOf, type JsonRecord } from './product-editor-save-payload-utils'

/**
 * Generic inverse of the editor's save-time normalize (`prepareIntegrationDataBeforeSaving`).
 *
 * The editor POSTs a NORMALIZED shape (variant.mockup = id, variant.printAreas = [ids],
 * mockup.layers = [ids]; full objects in sibling arrays) but on reopen reads a POPULATED shape
 * (variant.mockup._id, variant.mockup.layers[], variant.printAreas[].template). Upstream rebuilds
 * the populated shape via Mongoose `.populate()`; PageFly has no equivalent, so we join here.
 *
 * This is ONE join paired with the normalize — not a per-model reassembler. The result is stored
 * verbatim as `editorPayload` and returned to the editor on reopen with zero further processing.
 */
function indexById(records: JsonRecord[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>()
  records.forEach(record => {
    const id = idOf(record._id) || idOf(record.id)
    if (id) map.set(id, record)
  })
  return map
}

export function populateTailorKitEditorPayload(payload: TailorKitProductEditorSavePayload): JsonRecord {
  const integration = asRecord(payload.integration)
  const layerById = indexById(asArray(payload.layers))
  const printAreaById = indexById(asArray(payload.printAreas))
  const mockupById = indexById(asArray(payload.mockups))

  // Full Template objects live nested in printAreas[].template; index them so layers (which only
  // carry data.templateId after save) can resolve their template object from the same blob.
  const templateById = new Map<string, JsonRecord>()
  printAreaById.forEach(printArea => {
    const template = asRecord(printArea.template)
    const id = idOf(template._id) || idOf(template.id)
    if (id) templateById.set(id, template)
  })

  const resolveLayer = (layerId: string): JsonRecord | null => {
    const layer = layerById.get(layerId)
    if (!layer) return null
    const data = asRecord(layer.data)
    const templateId = typeof data.templateId === 'string' ? data.templateId : undefined
    const template = templateId ? templateById.get(templateId) : undefined
    return template ? { ...layer, data: { ...data, template } } : layer
  }

  const resolveLayers = (ids: unknown): JsonRecord[] =>
    idsOf(ids)
      .map(resolveLayer)
      .filter((layer): layer is JsonRecord => Boolean(layer))

  const viewsByMockup = new Map<string, JsonRecord[]>()
  asArray(payload.mockupViews).forEach(view => {
    const mockupId = idOf(view.mockup) || idOf(view.mockupId)
    if (!mockupId) return
    const populatedView = { ...view, layers: resolveLayers(view.layers) }
    viewsByMockup.set(mockupId, [...(viewsByMockup.get(mockupId) || []), populatedView])
  })

  const variants = asArray(payload.variants).map(variant => {
    const mockupId = idOf(variant.mockup)
    const mockup = mockupId ? mockupById.get(mockupId) : undefined
    // Always return a mockup OBJECT (never the bare id) so reopen's `variant.mockup.layers` is safe
    // even for a dangling ref — reintroducing the bare id would resurrect the `mockup._id` crash.
    const populatedMockup = mockup
      ? { ...mockup, layers: resolveLayers(mockup.layers), views: viewsByMockup.get(mockupId) || [] }
      : { _id: mockupId, layers: [], views: [] }
    const printAreas = idsOf(variant.printAreas)
      .map(id => printAreaById.get(id))
      .filter((printArea): printArea is JsonRecord => Boolean(printArea))
    return { ...variant, mockup: populatedMockup, printAreas }
  })

  return { ...integration, variants }
}
