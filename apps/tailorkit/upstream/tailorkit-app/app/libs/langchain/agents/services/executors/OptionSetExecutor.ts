import type { SmartEditParameters } from '../../templates/types'
import type { ChatInvoker } from '../ProductIntentAnalyzer'
import type { SupervisorState } from '~/libs/langchain/supervisor'
import { EOptionSet, optionSetDataKeys, ELayerType } from '~/types/psd'
import type { Layer, OptionSet } from '~/types/psd'
import { ImageService } from '../../services/ImageService'
import { getShopData } from '~/models/Shop.server'
import { uuid, validateUUID } from '~/utils/uuid'
import { FontService } from '../../templates/services/FontService'
import type { TemplateContext } from '../../templates/context/TemplateContextProvider'
import type { LayerDocument } from '~/models/Layer.server'

/**
 * Handles option set operations for template layer customization variants.
 * Option sets define user-selectable variants (colors, text, images) for layers.
 */
export class OptionSetExecutor {
  private chatInvoker: ChatInvoker
  private imageService: ImageService
  private fontService: FontService

  constructor(chatInvoker: ChatInvoker) {
    this.chatInvoker = chatInvoker
    this.imageService = new ImageService(chatInvoker)
    this.fontService = FontService.getInstance()
  }

  /** Creates a new option set for a layer. */
  async createOptionSet(
    parameters: SmartEditParameters,
    _context: SupervisorState['context'] & TemplateContext
  ): Promise<any> {
    const { targetLayer, updatedOptionSet } = parameters as unknown as {
      targetLayer?: string
      updatedOptionSet?: any
    }

    if (!updatedOptionSet || typeof updatedOptionSet !== 'object') {
      return { success: false, error: 'updatedOptionSet is required' }
    }

    const optionSetType: EOptionSet = updatedOptionSet.type || ''
    if (!optionSetType) {
      return { success: false, error: 'updatedOptionSet.type is required' }
    }

    // Layer context is optional but recommended for geometry/defaults
    const layer = this.findLayerFromContext(_context, targetLayer)

    // Validate layer-type to option-set-type compatibility when context is available
    const validation = this.validateOptionSetForLayer(layer, optionSetType)
    if (!validation.ok) {
      return { success: false, error: validation.error }
    }

    const optionSetInput = await this.populateOptionSetSources(updatedOptionSet, layer, _context)
    const normalized = this.normalizeOptionSet(optionSetInput, layer)

    return { success: true, optionSet: normalized }
  }

  /** Edits an existing option set's properties or options. */
  async editOptionSet(
    parameters: SmartEditParameters,
    _context: SupervisorState['context'] & TemplateContext
  ): Promise<any> {
    const { updatedOptionSet } = parameters as unknown as { updatedOptionSet?: any }
    if (!updatedOptionSet || typeof updatedOptionSet !== 'object') {
      return { success: false, error: 'updatedOptionSet is required' }
    }

    const optionSetType: string = String(updatedOptionSet.type || '')
    if (!optionSetType) {
      return { success: false, error: 'updatedOptionSet.type is required' }
    }

    const layer = this.findLayerFromContext(_context, (parameters as any)?.targetLayer)

    // Validate layer-type to option-set-type compatibility when context is available
    const validation = this.validateOptionSetForLayer(layer, updatedOptionSet.type as EOptionSet)
    if (!validation.ok) {
      return { success: false, error: validation.error }
    }

    // If delta provided, apply merge on top of existing items; else treat as full array
    const dataObj = (updatedOptionSet as any)?.data || {}
    const hasDelta
      = Array.isArray((dataObj as any)?.edits)
      || Array.isArray((dataObj as any)?.creates)
      || Array.isArray((dataObj as any)?.deleteIds)

    if (hasDelta) {
      const merged = await this.applyOptionSetDelta({
        type: updatedOptionSet.type as EOptionSet,
        optionSetId: String((updatedOptionSet as any)?._id || ''),
        edits: Array.isArray((dataObj as any)?.edits) ? (dataObj as any).edits : [],
        creates: Array.isArray((dataObj as any)?.creates) ? (dataObj as any).creates : [],
        deleteIds: Array.isArray((dataObj as any)?.deleteIds) ? (dataObj as any).deleteIds : [],
        layer,
        context: _context,
      })

      return { success: true, optionSet: merged }
    }

    // Full payload
    const prepared = await this.populateOptionSetSources(updatedOptionSet, layer, _context)
    return {
      success: true,
      optionSet: this.normalizeOptionSetForEdit(prepared),
    }
  }

  /** Deletes an option set from a layer. */
  async deleteOptionSet(
    parameters: SmartEditParameters,
    _context: SupervisorState['context'] & TemplateContext
  ): Promise<any> {
    const { optionSetId } = parameters as unknown as { optionSetId?: string }
    if (!optionSetId) {
      return { success: false, error: 'optionSetId is required' }
    }

    return { success: true, optionSet: { _id: optionSetId, deleted: true } }
  }

  private async applyOptionSetDelta(args: {
    type: EOptionSet
    optionSetId: string
    edits: any[]
    creates: any[]
    deleteIds: string[]
    layer?: Layer
    context?: SupervisorState['context']
  }): Promise<any> {
    const { type, optionSetId, edits, creates, deleteIds, layer, context } = args
    const dataKey = (optionSetDataKeys as any)[type]
    const existingOptionSet: OptionSet | undefined = (layer?.optionSet || []).find(
      (os: any) => String(os?._id || '') === String(optionSetId || '') && String(os?.type || '') === String(type || '')
    ) as any
    // Support both canonical key (e.g., "texts") and fallback key ("items") for robustness
    const existingItems: any[] = Array.isArray((existingOptionSet as any)?.data?.[dataKey])
      ? ((existingOptionSet as any).data[dataKey] as any[])
      : Array.isArray((existingOptionSet as any)?.data?.items)
        ? ((existingOptionSet as any).data.items as any[])
        : []

    const byId = new Map<string, any>(existingItems.map(it => [String(it?._id || ''), it]))

    // deletes
    for (const delId of deleteIds || []) byId.delete(String(delId))

    // edits
    for (const patch of edits || []) {
      const id = String(patch?._id || '')
      const prev = byId.get(id)
      if (!prev) continue
      byId.set(id, { ...prev, ...patch, _id: id })
    }

    // creates
    const createdList = (creates || []).map((c: any) => ({ ...c, _id: this.generateUuid(c?._id) }))
    for (const c of createdList) byId.set(String(c._id), c)

    let mergedItems = Array.from(byId.values())

    // For image/mask: ensure src generated
    if (type === EOptionSet.IMAGE_OPTION || type === EOptionSet.MASK_OPTION) {
      const tempOptionSet = { _id: optionSetId, type, data: { [dataKey]: mergedItems } }
      const withSrc = await this.populateOptionSetSources(tempOptionSet, layer, context)
      mergedItems = Array.isArray(withSrc?.data?.[dataKey]) ? (withSrc.data[dataKey] as any[]) : mergedItems
    }

    // If we have no context (no existing option set found) and no creates,
    // avoid returning an empty data array which would wipe frontend state.
    const hadExistingContext = Boolean(existingOptionSet)
    const hasCreates = (creates || []).length > 0
    const hasEdits = (edits || []).length > 0

    if (!hadExistingContext && !hasCreates && hasEdits) {
      // Cannot safely apply edits without base items; return minimal payload
      return { _id: optionSetId, type }
    }

    if (!hadExistingContext && !hasCreates && (deleteIds || []).length > 0) {
      // Cannot safely compute result of deletions without base items; return minimal payload
      return { _id: optionSetId, type }
    }

    // Otherwise, return merged items (from existing context and/or creates)
    return {
      _id: optionSetId,
      type,
      data: {
        [dataKey]: mergedItems,
      },
    }
  }
  /** Locate target layer from context, if available. */
  private findLayerFromContext(
    context: (SupervisorState['context'] & TemplateContext) | undefined,
    targetLayer?: string
  ): Layer | undefined {
    try {
      const layers = context?.layers
      if (!Array.isArray(layers)) return undefined
      const id = String(targetLayer || '')
      const found = (layers as Layer[]).find(l => String((l as any)?._id || '') === id)
      if (found) return found
      // Fallback: if minimized LLM context lost the target layer snapshot, try activeLayer
      const active = (context as any)?.activeLayer as Layer | undefined
      if (active && String((active as any)?._id || '') === id) return active
      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * Validate that the option set type is allowed for the given layer type.
   * For image layers: only image_option and mask_option are allowed.
   * For text layers: only text_option, color_option, and font_option are allowed.
   * If layer is not available (no context), validation is skipped to avoid blocking flows upstream.
   */
  private validateOptionSetForLayer(
    layer: Layer | undefined,
    optionSetType: EOptionSet
  ): { ok: boolean; error?: string } {
    if (!layer) return { ok: false, error: 'Can not find layer to add or edit option set' }

    const allowed = this.getAllowedOptionSetsForLayer(layer.type as ELayerType)
    const isAllowed = allowed.includes(optionSetType)
    if (isAllowed) return { ok: true }

    return {
      ok: false,
      error: `Option set type "${optionSetType}" is not allowed for layer type "${layer.type}". Allowed types: ${
        allowed.join(', ') || 'none'
      }`,
    }
  }

  /** Returns the list of allowed option set types for a given layer type */
  private getAllowedOptionSetsForLayer(layerType: ELayerType): EOptionSet[] {
    switch (layerType) {
      case ELayerType.IMAGE:
        return [EOptionSet.IMAGE_OPTION, EOptionSet.MASK_OPTION]
      case ELayerType.TEXT:
        return [EOptionSet.TEXT_OPTION, EOptionSet.COLOR_OPTION, EOptionSet.FONT_OPTION]
      default:
        return []
    }
  }

  /**
   * Normalize/complete option set payload per type: ids, defaults, dedup and geometry for images.
   */
  private normalizeOptionSet(optionSet: any, layer?: Layer): any {
    const optionKey = (optionSetDataKeys as any)[optionSet.type] as keyof OptionSet['data']
    const newOptionSet = {
      ...optionSet,
      data: {
        ...(optionSet?.data || {}),
        [optionKey]: (optionSet?.data?.[optionKey] || []).map((item: any) => ({
          ...item,
          _id: this.generateUuid(item?._id),
        })),
      },
      _id: this.generateUuid(optionSet?._id),
    }
    return newOptionSet
  }

  private generateUuid(existing?: string): string {
    const isValidUUID = validateUUID(existing)
    if (existing && isValidUUID) return existing
    return uuid()
  }

  /**
   * Normalization specifically for edit flow: do not merge with current option sets.
   * Ensures each item has a valid UUID while preserving provided structure.
   */
  private normalizeOptionSetForEdit(optionSet: any): any {
    try {
      const optionKey = (optionSetDataKeys as any)[optionSet.type] as keyof OptionSet['data']
      if (!optionKey) return optionSet

      // Trust LLM to return FULL array for edits (create/update/delete already applied in payload)
      const payloadItems: any[] = Array.isArray(optionSet?.data?.[optionKey])
        ? (optionSet.data[optionKey] as any[])
        : []
      const normalizedItems = payloadItems.map((item: any) => ({ ...item, _id: this.generateUuid(item?._id) }))

      return {
        ...optionSet,
        data: {
          ...(optionSet?.data || {}),
          [optionKey]: normalizedItems,
        },
      }
    } catch {
      return optionSet
    }
  }

  private async populateFontOptionSetSources(optionSet: any): Promise<any> {
    const dataKey = (optionSetDataKeys as any)[EOptionSet.FONT_OPTION]
    const fonts = Array.isArray(optionSet?.data?.[dataKey]) ? optionSet.data[dataKey] : []
    if (fonts.length === 0) return optionSet

    const validatedFonts = await Promise.all(
      fonts.map(async (font: any) => {
        if (String(font?.fontSource || '') !== 'google') return null
        const resolution = await this.fontService.resolveGoogleFont(String(font?.family || '').trim(), {
          variant: 'regular',
          requireLatinSubset: true,
        })
        if (!resolution) return null
        return {
          ...font,
          family: resolution.family,
          src: resolution.src,
          svgString: resolution.svgString,
          fontSource: 'google',
        }
      })
    )

    const filtered = validatedFonts.filter(Boolean)
    return {
      ...optionSet,
      data: {
        ...(optionSet?.data || {}),
        [dataKey]: filtered,
      },
    }
  }

  private async populateImageMaskOptionSetSources(
    optionSet: any,
    layer: Partial<LayerDocument> & any,
    context?: SupervisorState['context']
  ): Promise<any> {
    const isMask = optionSet.type === EOptionSet.MASK_OPTION
    const dataKey = (optionSetDataKeys as any)[optionSet.type]
    const items = Array.isArray(optionSet?.data?.[dataKey]) ? optionSet.data[dataKey] : []
    if (items.length === 0) return optionSet

    const width = Number(layer?.width || layer?.position?.width || 1024)
    const height = Number(layer?.height || layer?.position?.height || 1024)

    // Build prompt list from each item (required by schema) and enforce constraints
    // Prefer item prompt; if missing, inherit from layer snapshot for strict matching with layer context
    const baseLayerPrompt = String(layer?.image?.generativeOptions?.prompt || '')
    const baseImageStyle = String(layer?.image?.generativeOptions?.imageStyle || '')
    const prompts: string[] = items.map((it: any) => String(it?.imagePrompt || baseLayerPrompt || '').trim())

    const missingPrompt = prompts.some(p => !p)
    if (missingPrompt) return optionSet

    const shopDomain = String((context as any)?.shopDomain || (context as any)?.shopData?.shopDomain || '')
    const shopData = shopDomain ? await getShopData(shopDomain) : null

    const uploaded = await this.imageService.generateAndUploadFromPrompts({
      shopData: shopData as any,
      prompts,
      width,
      height,
      removeBackground: isMask ? 'none' : 'surrounding',
      admin: (context as any)?.shopifyAdmin,
      fileUploadType: isMask ? 'mask' : 'image',
    })

    const enriched = items.map((it: any, idx: number) => {
      const upload = uploaded[idx]
      const src = upload && (upload as any)?.image?.originalSrc ? (upload as any).image.originalSrc : it?.src || ''
      const imageStyle = String(it?.imageStyle || baseImageStyle || '')
      const base = { ...it, src, ...(imageStyle ? { imageStyle } : {}) }
      return base
    })

    return {
      ...optionSet,
      data: {
        ...(optionSet?.data || {}),
        [dataKey]: enriched,
      },
    }
  }

  /**
   * Ensure option set items (image/mask) have real src by generating and uploading images from prompts.
   * For mask option set: never remove background.
   */
  private async populateOptionSetSources(
    optionSet: any,
    layer: Layer | undefined,
    context?: SupervisorState['context']
  ): Promise<any> {
    try {
      const type: EOptionSet = optionSet?.type
      switch (type) {
        case EOptionSet.FONT_OPTION:
          return this.populateFontOptionSetSources(optionSet)
        case EOptionSet.IMAGE_OPTION:
        case EOptionSet.MASK_OPTION:
          return this.populateImageMaskOptionSetSources(optionSet, layer, context)
        default:
          return optionSet
      }
    } catch (e) {
      console.warn('populateOptionSetSources failed:', e)
      return optionSet
    }
  }
}
