import { optionSetDataKeys } from '~/types/psd'
import { OPTION_SET_TYPE_MAP, type CustomizationItem } from './types'

/**
 * Minimal layer shape required by the collector.
 *
 * Deliberately loose — works with both full `Layer` objects from the admin
 * stores AND slimmed-down server-side layer data used during preparation.
 *
 * @example
 * // Admin: from LayerStores
 * const layers = getAllLayerStore().map(s => s.getState())
 * collectCustomizationItems(layers)
 *
 * // Server: from template.layers
 * collectCustomizationItems(template.layers)
 */
export interface CollectorLayer {
  _id: string
  label?: string
  type?: string
  visible?: boolean
  settings?: Record<string, unknown>
  optionSet?: Array<{
    _id: string
    type?: string
    label?: string
    data?: Record<string, unknown> | null
  }>
}

/** Minimal print area shape for multi-print-area collection */
interface CollectorPrintArea {
  _id: string
}

/*──────────────────────────────────────────────────────────────────────
 * RULE: An option set is "configured" when its data-key array has ≥1 item.
 *
 * Every layer gets 8 pre-allocated option set slots (image, text, color,
 * font, multi_layout, imageless, shape, mask). Only the ones the merchant
 * actually configured have data. We SKIP empty slots.
 *
 * Text-customer layers are detected via `layer.settings.textCreatedBy`,
 * NOT via option sets (they have no dedicated option set type).
 *
 * Charm builder layers are detected via `layer.type === 'charm-node'`.
 *──────────────────────────────────────────────────────────────────────*/

/**
 * Determines whether an option set has been actively configured by the merchant.
 *
 * Each layer is pre-allocated with 8 option set slots. This function distinguishes
 * between empty default slots and slots that the merchant has populated with data.
 *
 * The check uses `optionSetDataKeys` to look up the correct data-key for the
 * option set type (e.g. `'texts'` for `text_option`, `'fonts'` for `font_option`),
 * then verifies that the array at that key has at least one entry.
 *
 * Special case: `multi_layout_option` stores its items inside `data.multi_layout.layouts[]`.
 *
 * @param os - The option set to check
 * @returns `true` if the option set has ≥1 configured item
 */
function hasConfiguredData(os: { type?: string; data?: Record<string, unknown> | null }): boolean {
  if (!os.type) return false
  const dataKey = optionSetDataKeys[os.type as keyof typeof optionSetDataKeys]
  if (!dataKey) return false
  const data = os.data || {}
  const items = data[dataKey]

  if (os.type === 'multi_layout_option') {
    const mlData = items as Record<string, unknown> | undefined
    return Array.isArray(mlData?.layouts) && mlData!.layouts.length > 0
  }

  return Array.isArray(items) && items.length > 0
}

/**
 * Extracts configured option sets from a layer as `CustomizationItem[]`.
 *
 * Iterates `layer.optionSet[]`, skipping entries that:
 * - Have no `type` or `_id`
 * - Fail the `hasConfiguredData` check (empty default slots)
 * - Have no mapping in `OPTION_SET_TYPE_MAP` (unknown types like `shape`)
 *
 * For `image_option`, the adapter inspects `layer.settings.enableBuyerImage` /
 * `enableSellerImage` to determine whether the item is `image_buyer` or `image_seller`.
 *
 * @param layer - A template layer with optional `optionSet[]`
 * @param printAreaId - The parent print area ID (for traceability)
 * @returns Normalized customization items for each configured option set
 */
function adaptFromOptionSets(layer: CollectorLayer, printAreaId: string): CustomizationItem[] {
  if (!layer.optionSet?.length) return []

  const settings = layer.settings || {}
  const items: CustomizationItem[] = []

  for (const os of layer.optionSet) {
    if (!os.type || !os._id) continue
    if (!hasConfiguredData(os)) continue

    // Skip text_option for customer-text layers — storefront Liquid also skips it,
    // so including it would cause an off-by-one index mismatch with storefront DOM order
    if (os.type === 'text_option' && settings.textCreatedBy === 'customers') continue

    let itemType = OPTION_SET_TYPE_MAP[os.type]
    if (!itemType) continue

    // Image option: determine buyer vs seller mode from layer settings
    if (os.type === 'image_option') {
      const enableSeller = settings.enableSellerImage as boolean | undefined
      const enableBuyer = settings.enableBuyerImage as boolean | undefined
      itemType = enableSeller && !enableBuyer ? 'image_seller' : 'image_buyer'
    }

    items.push({
      id: `${layer._id}::${os._id}`,
      type: itemType,
      label: os.label || layer.label || itemType,
      layerId: layer._id,
      layerLabel: layer.label || '',
      printAreaId,
      hasData: true,
      sourceRef: { optionSetId: os._id },
    })
  }

  return items
}

/**
 * Detects layer-level customization sources that don't live inside `layer.optionSet[]`:
 *
 * 1. **Text-customer**: `layer.settings.textCreatedBy === 'customers'` —
 *    requires at least one of `storefrontLabel`, `placeholder`, `required`
 *    to be considered configured.
 *
 * 2. **Image-buyer (no presets)**: `layer.type === 'image'` with
 *    `settings.enableBuyerImage === true` — surfaces upload-only image layers
 *    that have no preset images in the option set. Storefront still renders
 *    the upload UI in this case (see `tlk-render-layer.liquid` →
 *    `option_set.allowCustomerUploadImage`), so the wizard must include
 *    them. Skipped when the layer's image option set already has presets,
 *    since `adaptFromOptionSets` will emit an `image_buyer` item from there
 *    (avoids duplicate emission).
 *
 * @param layer - A template layer
 * @param printAreaId - The parent print area ID
 * @returns Customization items detected from layer settings
 */
function adaptFromLayerSettings(layer: CollectorLayer, printAreaId: string): CustomizationItem[] {
  const settings = layer.settings || {}
  const items: CustomizationItem[] = []

  // Text-customer: free-text inputs typed by the buyer
  if (layer.type === 'text' && settings.textCreatedBy === 'customers') {
    if (settings.storefrontLabel || settings.placeholder || settings.required) {
      items.push({
        id: `${layer._id}::text_customer`,
        type: 'text_customer',
        label: (settings.storefrontLabel as string) || layer.label || 'Text input',
        layerId: layer._id,
        layerLabel: layer.label || '',
        printAreaId,
        hasData: true,
        sourceRef: { layerSettingsPath: 'settings.textCreatedBy' },
      })
    }
  }

  // Image-buyer (upload-only, no presets): emitted only when the layer has no
  // image option set with configured data. When presets exist, adaptFromOptionSets
  // handles emission with its own item id derived from the option set.
  // Use the image_option's _id in the item id so it matches the data-item-id
  // that admin preview renders on .emtlkit--option-set-container (see
  // OptionSet/index.tsx — uses ${layerId}::${optionSet._id}). Without this,
  // wizard ID-based matching fails and the step appears blank in admin preview.
  if (layer.type === 'image' && settings.enableBuyerImage === true) {
    const imageOptionSet = (layer.optionSet || []).find(os => os.type === 'image_option')
    const hasImagePresets = imageOptionSet ? hasConfiguredData(imageOptionSet) : false
    if (imageOptionSet && !hasImagePresets) {
      items.push({
        id: `${layer._id}::${imageOptionSet._id}`,
        type: 'image_buyer',
        label: imageOptionSet.label || layer.label || 'Image upload',
        layerId: layer._id,
        layerLabel: layer.label || '',
        printAreaId,
        hasData: true,
        sourceRef: { optionSetId: imageOptionSet._id },
      })
    }
  }

  return items
}

/**
 * Detects charm builder layers — interactive product charm configurators.
 *
 * Charm builders use a completely separate data model from option sets:
 * they are identified by `layer.type === 'charm-node'` and store their
 * product references in `layer.settings.linkedProducts[]`.
 *
 * `hasData` is `true` only when at least one product is linked.
 *
 * @param layer - A template layer
 * @param printAreaId - The parent print area ID
 * @returns A single `charm_builder` item, or empty array if not a charm-node
 */
function adaptFromCharmConfig(layer: CollectorLayer, printAreaId: string): CustomizationItem[] {
  if (layer.type !== 'charm-node') return []

  const settings = layer.settings || {}
  const linkedProducts = settings.linkedProducts as unknown[] | undefined

  return [
    {
      id: `${layer._id}::charm_builder`,
      type: 'charm_builder',
      label: (settings.storefrontLabel as string) || layer.label || 'Charm builder',
      layerId: layer._id,
      layerLabel: layer.label || '',
      printAreaId,
      hasData: Array.isArray(linkedProducts) && linkedProducts.length > 0,
      sourceRef: { charmConfigRef: true },
    },
  ]
}

/**
 * Collects ALL customization items from a set of layers into a flat,
 * normalized, deduplicated list.
 *
 * Scans 3 sources per layer (in order):
 * 1. **Layer settings** — text-customer (buyer-typed free text)
 * 2. **Option sets** — color, font, text presets, images, masks, layouts, imageless
 * 3. **Charm config** — charm-node layers with linked products
 *
 * Filters applied:
 * - Hidden layers (`visible === false`) are skipped
 * - Empty/default option set slots are skipped (see `hasConfiguredData`)
 * - Unconfigured text-customer layers are skipped
 * - Duplicate items (same `id`) are deduplicated
 *
 * Item order follows layer order (the order layers appear in the template).
 *
 * @param layers - Template layers (from LayerStores or template.layers)
 * @param printAreaId - Print area ID to attach to each item (defaults to '')
 * @returns Flat array of `CustomizationItem`, ready for UI rendering or wizard step assignment
 *
 * @example
 * // Admin: collect from all layers in the editor
 * const layers = getAllLayerStore().map(s => s.getState())
 * const items = collectCustomizationItems(layers)
 *
 * @example
 * // With print area context
 * const items = collectCustomizationItems(template.layers, printArea._id)
 */
export function collectCustomizationItems(layers: CollectorLayer[], printAreaId = ''): CustomizationItem[] {
  const seen = new Set<string>()
  const items: CustomizationItem[] = []

  for (const layer of layers) {
    if (layer.visible === false) continue

    const adapted = [
      ...adaptFromLayerSettings(layer, printAreaId),
      ...adaptFromOptionSets(layer, printAreaId),
      ...adaptFromCharmConfig(layer, printAreaId),
    ]

    for (const item of adapted) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }

  return items
}

/**
 * Collects customization items across multiple print areas.
 *
 * If `allLayers` is provided (flat list from LayerStores), uses them directly
 * with an empty `printAreaId`. Otherwise, iterates each print area and extracts
 * layers from `printArea.template.layers`.
 *
 * @param printAreas - Array of print areas, each optionally containing `template.layers`
 * @param allLayers - Optional flat layer array (takes precedence over print area iteration)
 * @returns Deduplicated flat array of `CustomizationItem`
 */
export function collectCustomizationItemsFromPrintAreas(
  printAreas: Array<CollectorPrintArea & { template?: { layers?: CollectorLayer[] } }>,
  allLayers?: CollectorLayer[]
): CustomizationItem[] {
  if (allLayers) {
    return collectCustomizationItems(allLayers, '')
  }

  const seen = new Set<string>()
  const items: CustomizationItem[] = []

  for (const pa of printAreas) {
    for (const item of collectCustomizationItems(pa.template?.layers || [], pa._id)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }

  return items
}
