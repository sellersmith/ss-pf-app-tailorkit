import type { LayerDocument } from '~/models/Layer.server'
import { ELayerType } from '~/types/psd'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import { TemplateEditorStore, getExtractedCompositeLayerStores } from '~/stores/modules/template'

export interface AIChatTemplatesContext {
  templates?: { id: string }[]
}

export interface AIChatEditorContext {
  editorTemplate?: {
    _id: string
    name: string
    dimension: { width: number; height: number; measurementUnit: string; resolution: number }
    previewUrl?: string
    templateId: string
    layers: LayerDocument[]
    shopDomain: string
  }
}

export interface AIChatSelectedContext {
  selected?: {
    templateId?: string
    layerIds?: string[]
  }
}

export type AIChatContext = (AIChatTemplatesContext & AIChatEditorContext & AIChatSelectedContext) | undefined

export interface BuildChatRequestContextArgs {
  selectedTemplates: TemplateMentionData[]
  selectedLayer?: { templateId: string; layerId: string }
}

/**
 * Build a normalized context object for AI supervisor from UI selections via composable enrichers.
 * - Always prefer data derived from user selections
 * - Never throw; return minimal context when data is unavailable
 */
export function buildChatRequestContext(args: BuildChatRequestContextArgs): AIChatContext {
  const { selectedTemplates, selectedLayer } = args

  const primary = selectedTemplates?.[0]
  const context: AIChatContext = {}

  // Enricher 1: Selected Templates → templates: [{ id }]
  if (primary?.templateId) {
    context.templates = [{ id: String(primary.templateId) }]
  }

  // Enricher 1.1: Selected Layer → selected.layerIds (support cloned layers by lineage)
  if (selectedLayer?.layerId) {
    context.selected = {
      templateId: primary?.templateId ? String(primary.templateId) : selectedLayer.templateId,
      layerIds: [String(selectedLayer.layerId)],
    }
  }

  // Enricher 2: Editor state → editorTemplate (auto-inject when editor has state)
  try {
    const hasEditorContext = primary?.isEditor || TemplateEditorStore.getState()?._id
    if (hasEditorContext) {
      const editorState = TemplateEditorStore.getState() as {
        _id?: string
        name?: string
        dimension?: { width: number; height: number; measurementUnit: string; resolution: number }
        previewUrl?: string
        shopDomain?: string
      }

      if (editorState?._id) {
        const layerStores = getExtractedCompositeLayerStores()
        const layersState: LayerDocument[] = layerStores
          .map(store => store?.getState())
          .filter(layer => !!layer)
          .filter(layer => [ELayerType.TEXT, ELayerType.IMAGE].includes((layer as LayerDocument).type))
          .reverse() as LayerDocument[]

        // Build lineage map: cloned layer keeps original id in clonedBy
        const lineage: Record<string, string> = {}
        try {
          layersState.forEach(l => {
            const original = (l as any)?.clonedBy
            if (original) lineage[String(l._id)] = String(original)
          })
        } catch {}

        context.editorTemplate = {
          _id: String(editorState._id),
          name: String(editorState.name || 'Untitled Template'),
          dimension:
            editorState.dimension || ({ width: 0, height: 0, measurementUnit: 'px', resolution: 300 } as const),
          previewUrl: editorState.previewUrl,
          templateId: String(editorState._id),
          layers: layersState,
          shopDomain: String(editorState.shopDomain || ''),
        }

        // If selected.layerIds refers to an original id, translate to the current cloned id for this editor state
        try {
          if (context.selected?.layerIds && context.selected.layerIds.length === 1) {
            const incomingId = String(context.selected.layerIds[0])
            const exact = layersState.find(l => String((l as any)?._id || '') === incomingId)
            if (!exact) {
              const byOriginal = layersState.find(l => String((l as any)?.clonedBy || '') === incomingId)
              if (byOriginal) {
                context.selected.layerIds = [String((byOriginal as any)?._id)]
              }
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    // Non-blocking: do not include editorTemplate if store is unavailable
    // eslint-disable-next-line no-console
    console.warn('AIChat context builder: failed to include editorTemplate context:', e)
  }

  return Object.keys(context || {}).length ? context : undefined
}
