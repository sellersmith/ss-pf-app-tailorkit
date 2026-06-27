/**
 * Template preview block builder for AI chat responses.
 * Constructs formatted template preview cards with layer data for frontend display.
 */
import { uuid } from '~/utils/uuid'
import type { SmartEditParameters } from '../types'
import { normalizeTemplateId } from '~/utils/templateExtractor'
import type { TemplateIntentWithContext } from '../TemplateOperationParameterExtractor'
import { TEMPLATE_INTENT_TYPES_MAP } from '../../constants/templates'

function getCtaButton(templateIntent: TemplateIntentWithContext): { text: string } {
  const intentType = templateIntent.intentType

  switch (intentType) {
    case TEMPLATE_INTENT_TYPES_MAP.template_create:
      return { text: 'create-template' }
    case TEMPLATE_INTENT_TYPES_MAP.template_edit:
    case TEMPLATE_INTENT_TYPES_MAP.layer_create:
    case TEMPLATE_INTENT_TYPES_MAP.layer_edit:
    case TEMPLATE_INTENT_TYPES_MAP.layer_delete:
      return { text: 'update-template' }
    case TEMPLATE_INTENT_TYPES_MAP.option_set_create:
      return { text: 'create-options' }
    case TEMPLATE_INTENT_TYPES_MAP.option_set_edit:
      return { text: 'update-options' }
    case TEMPLATE_INTENT_TYPES_MAP.option_set_delete:
      return { text: 'delete-options' }
    default:
      return { text: 'create-template' }
  }
}
/**
 * Builds a template preview block for AI chat display.
 * @param args - Object containing smartIntent and result data
 * @param args.smartIntent - Smart intent with context and parameters
 * @param args.result - Operation result with success status and layer data
 * @returns Formatted template preview block string or empty string on error
 */
export function buildTemplatePreviewBlock(args: {
  smartIntent: any
  result: any
  templateIntent: TemplateIntentWithContext
}): { updatedDataString: string; ctaButton: { text: string } } {
  const { smartIntent, result, templateIntent } = args
  try {
    const ctaButton = getCtaButton(templateIntent)
    const ctx = smartIntent?.context || {}
    const template = ctx?.template || {}
    const layers: any[] = Array.isArray(ctx?.layers) ? ctx.layers.slice() : []

    // Normalize result shape: accept both top-level and nested under data
    const nested = (result && typeof result === 'object' && 'data' in result ? (result as any).data : undefined) || {}
    const success
      = (typeof (result as any)?.success === 'boolean' ? (result as any).success : undefined)
      ?? (typeof nested?.success === 'boolean' ? nested.success : undefined)
    const layerPayload = (result as any)?.layer || nested?.layer
    const optionSetPayload = (result as any)?.optionSet || nested?.optionSet

    if (layerPayload && success) {
      const idx = layers.findIndex((l: any) => l?._id === layerPayload?._id)
      if (idx >= 0) layers[idx] = { ...layers[idx], ...layerPayload }
      else layers.push(layerPayload)
    }

    // Attach/merge option set changes into target layer before building payload
    if (optionSetPayload && success) {
      const params = (smartIntent?.parameters || {}) as SmartEditParameters
      const targetLayerId: string | undefined = (params as any)?.targetLayer
      const layerIdx = layers.findIndex((l: any) => String(l?._id || '') === String(targetLayerId))
      const currentLayer = layers[layerIdx]
      if (currentLayer) {
        const list: any[] = Array.isArray(currentLayer.optionSet) ? currentLayer.optionSet.slice() : []
        const incomingId = String((optionSetPayload as any)?._id || '')
        const existingIdx = list.findIndex(os => String(os?._id || '') === incomingId)
        const deleted = Boolean((optionSetPayload as any)?.deleted)

        if (existingIdx >= 0) {
          if (deleted) {
            list.splice(existingIdx, 1)
          } else {
            // Update
            list[existingIdx] = { ...list[existingIdx], ...optionSetPayload }
          }
        } else {
          // Insert
          list.push(optionSetPayload)
        }

        layers[layerIdx] = { ...currentLayer, optionSet: list }
      }
    }

    // Accept both parameter shapes: updatedTemplate (schema-driven)
    const params = (smartIntent?.parameters || {}) as SmartEditParameters
    const changes = params.updatedTemplate || {}

    const nameChange = changes.name
    const dimChange = changes.dimension

    if (typeof nameChange === 'string' && nameChange.trim()) {
      template.name = nameChange.trim()
    }

    if (dimChange && typeof dimChange === 'object') {
      const d = dimChange as any
      // Normalize incoming dimension into template.dimension
      template.dimension = {
        width: typeof d.width === 'number' ? d.width : template?.dimension?.width,
        height: typeof d.height === 'number' ? d.height : template?.dimension?.height,
        measurementUnit: d.measurementUnit || d.unit || template?.dimension?.measurementUnit || 'px',
        resolution: typeof d.resolution === 'number' ? d.resolution : template?.dimension?.resolution || 300,
      }
    }

    const name = template?.name || 'Edited Template'
    // Always expose cardId in the "template_${templateId}" form for consistent parsing on frontend
    const tplId = typeof template?._id === 'string' && template._id ? String(template._id) : uuid()
    // Normalize template ID - remove template_ prefix if it exists to avoid duplication
    const normalizedTplId = normalizeTemplateId(tplId)
    const cardId = `template_${normalizedTplId}`

    // Normalize dimension to schema-compliant format
    const normalizeDimension = (dim: any, fallback: any) => {
      const d = dim || {}
      const width = typeof d.width === 'number' && d.width > 0 ? d.width : fallback?.width || 0
      const height = typeof d.height === 'number' && d.height > 0 ? d.height : fallback?.height || 0
      const measurementUnit = d.measurementUnit || d.unit || fallback?.measurementUnit || 'px'
      const resolution = typeof d.resolution === 'number' ? d.resolution : fallback?.resolution || 300
      return { width, height, measurementUnit, resolution }
    }

    // Filter out layers that are marked deleted or invisible for preview
    const filteredLayers = Array.isArray(layers)
      ? (layers as any[]).filter(l => l && l.visible !== false && !l.isDeletedOnEditor)
      : []

    const payload = {
      cardId,
      templateId: normalizedTplId,
      name,
      ctaButton,
      dimension: normalizeDimension(template?.dimension, {
        width: 0,
        height: 0,
        measurementUnit: 'px',
        resolution: 300,
      }),
      ...(typeof template?.previewUrl === 'string' && template.previewUrl ? { previewUrl: template.previewUrl } : {}),
      layers: filteredLayers?.map((l: any) => {
        // Start with all existing fields
        const layer = { ...l }

        // Ensure required fields
        layer._id = layer._id || uuid()
        layer.settings = layer.settings || {}
        layer.visible = typeof layer.visible === 'boolean' ? layer.visible : true
        layer.isCreatedByAIAssistant = !!layer.isCreatedByAIAssistant

        // Handle position/dimension
        layer.width = layer.width ?? layer.position?.width ?? 100
        layer.height = layer.height ?? layer.position?.height ?? 100
        layer.left = layer.left ?? layer.position?.x ?? 0
        layer.top = layer.top ?? layer.position?.y ?? 0

        // Handle text content
        if (layer.type === 'text' && layer.content) {
          layer.settings.content = layer.content
        }

        // Handle image content
        if (layer.type === 'image') {
          layer.image = layer.image || {}
        }

        return layer
      }),
      metadata: { updatedByAIAssistantAt: new Date().toISOString() },
    }

    const cardLine = `[TEMPLATE_CARD:${cardId}] (${name})`
    const dataLine = `TEMPLATE_DATA:${JSON.stringify(payload)}`
    return { updatedDataString: `${cardLine}\n${dataLine}`, ctaButton }
  } catch (e) {
    console.warn('Failed to build template preview block:', e)
    return { updatedDataString: '', ctaButton: { text: '' } }
  }
}
