/**
 * Orchestrates template editing operations with context management and error handling.
 * Manages the flow from intent analysis through operation execution and response formatting.
 */

import type { SupervisorState } from '~/libs/langchain/supervisor'
import { EmitStatusService } from './EmitStatusService'
import { buildTemplatePreviewBlock } from '../templates/utils/buildTemplatePreviewBlock'
import type { ChatInvoker } from './ProductIntentAnalyzer'
import type { TemplateIntent } from '../templates/TemplateIntentAnalyzer'
import type { TemplateIntentWithContext } from '../templates/TemplateOperationParameterExtractor'
import ConversationMessage from '~/models/ConversationMessage.server'
import type { SmartEditParameters } from '../templates/types'
import type { LayerDocument } from '~/models/Layer.server'
import type { Template as TemplateDocument } from '~/types/psd'
import type { TemplateContext } from '../templates/context/TemplateContextProvider'
import { extractTemplateFromContent, normalizeTemplateId } from '~/utils/templateExtractor'
import { generateTemplatePreviewUrl } from '~/utils/generateTemplatePreview.server'
import { LANGUAGE_SUPPORT_MESSAGE } from '../../constant'

/** Dependencies for EditOrchestrator operations */
export interface EditOrchestratorDeps {
  templateOperationParameterExtractor: {
    analyzeWithMergedSources: (args: {
      query: string
      providedContext: TemplateContext
      intent: TemplateIntent
    }) => Promise<TemplateIntentWithContext>
  }
  contextProvider: {
    getContextFromProvidedTemplate: (args: {
      template: TemplateDocument
      layers?: LayerDocument[]
    }) => Promise<TemplateContext>
  }
  executeEditOperation: (
    smartIntent: TemplateIntentWithContext,
    opContext: SupervisorState['context'] & TemplateContext,
    onChunk?: (chunk: string) => void
  ) => Promise<unknown>
}

/** Core orchestrator for template editing operations */
export class EditOrchestrator {
  private emitStatusService: EmitStatusService
  private chatInvoker: ChatInvoker

  constructor(
    chatInvoker: ChatInvoker,
    private readonly deps: EditOrchestratorDeps
  ) {
    this.chatInvoker = chatInvoker
    this.emitStatusService = new EmitStatusService(chatInvoker)
  }

  /** Handles template edit operations from intent analysis to execution with error handling. */
  async handleEditOperation(args: {
    onChunk?: (chunk: string) => void
    query: string
    intent: TemplateIntentWithContext
    context: SupervisorState['context']
    conversationId?: string
  }): Promise<string> {
    const { onChunk, query, intent, context = {} as SupervisorState['context'], conversationId } = args

    try {
      const shopDomain = context?.shopDomain || context?.shopData?.shopDomain || ''
      type EditorContext = NonNullable<SupervisorState['context']> & {
        editorTemplate?: TemplateDocument
        templateId?: string
      }
      const providedTemplate = (context as EditorContext | undefined)?.editorTemplate

      const convKey = conversationId || ''
      const incomingTemplateId = (context as EditorContext | undefined)?.templateId
      const resolvedTemplateId = incomingTemplateId ? String(incomingTemplateId) : ''

      let templateOperationParameter: TemplateIntentWithContext | null = null

      let providedContext: TemplateContext | null = null
      // Always check with templateId first; only use editorTemplate when it matches the templateId
      const providedTemplateId
        = providedTemplate && (providedTemplate as any)._id ? String((providedTemplate as any)._id) : ''
      const normalizedProvidedId = providedTemplateId ? normalizeTemplateId(providedTemplateId) : ''
      const normalizedResolvedId = resolvedTemplateId ? normalizeTemplateId(resolvedTemplateId) : ''

      if (
        providedTemplate
        && normalizedResolvedId
        && normalizedProvidedId
        && normalizedResolvedId === normalizedProvidedId
      ) {
        providedContext = await this.deps.contextProvider.getContextFromProvidedTemplate({
          template: providedTemplate,
          layers: (providedTemplate as unknown as { layers?: LayerDocument[] })?.layers,
        })
      } else {
        // Rebuild minimal context from conversation; do not prioritize editorTemplate if id mismatched or missing
        providedContext = await buildContextFromConversation({
          conversationId: convKey,
          shopDomain,
          templateId: resolvedTemplateId,
        })
      }

      // Merge explicit selection coming from UI into providedContext (template/layers chosen via mention)
      try {
        const selectedFromRuntime = (context as any)?.selected
        if (providedContext && selectedFromRuntime) {
          ;(providedContext as any).selected = {
            templateId: String(selectedFromRuntime?.templateId || '') || undefined,
            layerIds: Array.isArray(selectedFromRuntime?.layerIds)
              ? (selectedFromRuntime.layerIds as string[]).map(id => String(id)).filter(Boolean)
              : undefined,
            allowCreate: Boolean(selectedFromRuntime?.allowCreate),
          }

          // If exactly one target layer is selected, set it as activeLayer for LLM context alignment
          try {
            const layerIds = (providedContext as any).selected?.layerIds as string[] | undefined
            if (Array.isArray(layerIds) && layerIds.length === 1 && Array.isArray((providedContext as any).layers)) {
              const nextActive = (providedContext as any).layers.find(
                (l: any) => String((l as any)?._id || '') === String(layerIds[0])
              )
              if (nextActive) {
                ;(providedContext as any).activeLayer = nextActive
              }
            }
          } catch {}
        }
      } catch {}

      // Ensure we have at least a minimal context before analysis
      if (!providedContext) {
        const msg = 'Can not find any template in latest conversation. Please redo this step to create a template.'
        await this.emitStatusService.emitFriendlyError({
          onChunk: onChunk || (() => {}),
          error: new Error(msg),
          userMessage: query,
          operationHint: intent.operation,
          options: { reassureContinuation: false },
        })
        return msg
      }

      // Build minimized LLM context: if exactly one layer selected, keep only that layer for LLM
      let llmContext: TemplateContext = providedContext as TemplateContext
      try {
        let layerIds = (providedContext as any)?.selected?.layerIds as string[] | undefined
        const allLayers: LayerDocument[] = Array.isArray((providedContext as any)?.layers)
          ? ((providedContext as any).layers as LayerDocument[])
          : []
        if (Array.isArray(layerIds) && layerIds.length === 1 && allLayers.length) {
          // Support lineage: if selected id is an original id, map to the current cloned id via clonedBy
          const targetId = String(layerIds[0])
          let only = allLayers.find(l => String((l as any)?._id || '') === targetId)
          if (!only) {
            const mapped = allLayers.find(l => String((l as any)?.clonedBy || '') === targetId)
            if (mapped) {
              only = mapped
              layerIds = [String((mapped as any)?._id)]
              ;(providedContext as any).selected.layerIds = layerIds
            }
          }
          if (only) {
            llmContext = {
              ...(providedContext as TemplateContext),
              layers: [only],
              activeLayer: only,
            } as TemplateContext
          }
        }
      } catch {}

      // Analyze ONCE with minimized context for LLM
      const analyzedRaw = await this.deps.templateOperationParameterExtractor.analyzeWithMergedSources({
        query,
        providedContext: llmContext as TemplateContext,
        intent,
      })

      // Restore full layers for downstream simulation/preview while keeping selected and activeLayer
      const analyzed = { ...analyzedRaw } as TemplateIntentWithContext
      try {
        const fullLayers = (providedContext as any)?.layers
        if (Array.isArray(fullLayers)) {
          analyzed.context = {
            ...(analyzedRaw.context as any),
            layers: fullLayers as any,
          } as any
        }
      } catch {}

      templateOperationParameter = analyzed
      if (!templateOperationParameter) {
        const msg = 'Not enough context to perform this operation.'
        await this.emitStatusService.emitFriendlyError({
          onChunk: onChunk || (() => {}),
          error: new Error(msg),
          userMessage: query,
          operationHint: intent.operation,
          options: { reassureContinuation: false },
        })
        return msg
      }

      const built = buildSimulatedContext({
        conversationId: convKey,
        analyzed: templateOperationParameter,
        context: context,
        shopDomain,
      })
      const finalContext = built.context
      templateOperationParameter = built.templateOperationParameter

      // Fan-out execution when multiple layers are explicitly selected
      let result: any
      const selectedLayerIds: string[] = Array.isArray((providedContext as any)?.selected?.layerIds)
        ? ((providedContext as any).selected.layerIds as string[]) || []
        : []

      const isLayerOrOptionOp = intent.intentType.startsWith('layer_') || intent.intentType.startsWith('option_set_')

      if (isLayerOrOptionOp && selectedLayerIds.length > 1 && intent.intentType !== 'layer_create') {
        const results: any[] = []
        for (const id of selectedLayerIds) {
          const cloned = JSON.parse(JSON.stringify(templateOperationParameter)) as TemplateIntentWithContext
          const params = (cloned.parameters || {}) as SmartEditParameters
          if (!params.updatedLayer) params.updatedLayer = {}
          ;(params as any).targetLayer = String(id)
          ;(params.updatedLayer as any)._id = String(id)

          // Keep activeLayer consistent per selected id for downstream services
          try {
            const layer = (finalContext?.layers || []).find((l: any) => String((l as any)?._id || '') === String(id))
            if (layer) {
              cloned.context = { ...(cloned.context || {}), activeLayer: layer } as any
            }
          } catch {}

          const r = await this.deps.executeEditOperation(cloned, finalContext, onChunk)
          results.push(r)
        }
        result = results
      } else {
        result = await this.deps.executeEditOperation(templateOperationParameter, finalContext, onChunk)
      }
      const editResponse = await formatEditResponse({
        result,
        smartIntent: templateOperationParameter,
        templateIntent: intent,
      })
      const editResponseString = `\n${editResponse.updatedDataString}`
      const editResponseCtaButton = editResponse.ctaButton.text

      if (typeof onChunk === 'function') {
        onChunk('[STATUS][COMPLETE][/STATUS]')
      }

      const contextMessage = this.buildTemplateContext({
        userMessage: query,
        templateIntent: intent,
        ctaButton: editResponseCtaButton,
      })

      const aiResponse = await this.emitStatusService.generateAIResponse({
        query,
        contextMessage,
        isStreaming: typeof onChunk === 'function',
        onChunk,
      })

      onChunk && onChunk(editResponseString)
      return aiResponse + editResponseString
    } catch (error) {
      console.error('handleEditOperation error = ', error)
      const errorMsg = await this.emitStatusService.emitFriendlyError({
        onChunk: onChunk || (() => {}),
        error,
        userMessage: query,
        operationHint: intent.operation,
        options: { reassureContinuation: false },
      })
      return errorMsg
    }
  }

  buildTemplateContext(args: {
    userMessage: string
    templateIntent: TemplateIntentWithContext
    ctaButton: string
  }): string {
    const { userMessage, templateIntent, ctaButton } = args

    return `
    EDIT COMPLETION DATA:
Query: "${userMessage}"
Intent: ${JSON.stringify(templateIntent)}
CTA Button: "${ctaButton.replace(/-/g, ' ')}"

Generate a brief completion message confirming the operation has been SUCCESSFULLY COMPLETED.
The user's request has already been processed - do not ask for more information or act like you're about to start.
Focus on what was accomplished based on their specific query.
Keep the tone conversational and confirmatory.
Do NOT include any TEMPLATE_DATA or JSON in your response. Just natural text + the template card marker.
Use the user's message to determine the language of the response: ${userMessage}.
${LANGUAGE_SUPPORT_MESSAGE}
`
  }
}

/** Builds simulated context for operation preview without persistence. */
function buildSimulatedContext(args: {
  conversationId: string
  analyzed: TemplateIntentWithContext
  context: SupervisorState['context']
  shopDomain: string
}): {
  context: SupervisorState['context'] & TemplateContext
  templateOperationParameter: TemplateIntentWithContext
} {
  const { analyzed, shopDomain } = args
  const opCtx = { ...args.context }

  opCtx.noPersist = true

  const finalTemplateId = analyzed?.context?.template?._id || (opCtx as any)?.templateId

  if (finalTemplateId) {
    const prev = (analyzed?.context?.template?._id === finalTemplateId ? analyzed?.context : {}) || {}
    const prevSelected = (analyzed?.context as any)?.selected
    const p = (analyzed?.parameters || {}) as SmartEditParameters

    const nextName = p?.updatedTemplate?.name || analyzed?.context?.template?.name || (prev as any).name
    const dimIn = p?.updatedTemplate?.dimension || analyzed?.context?.template?.dimension || (prev as any).dimension
    const normDim = dimIn
      ? {
          width: typeof (dimIn as any).width === 'number' ? (dimIn as any).width : (prev as any)?.dimension?.width,
          height: typeof (dimIn as any).height === 'number' ? (dimIn as any).height : (prev as any)?.dimension?.height,
          measurementUnit:
            (dimIn as any).measurementUnit || (dimIn as any).unit || (prev as any)?.dimension?.measurementUnit || 'px',
          resolution:
            typeof (dimIn as any).resolution === 'number'
              ? (dimIn as any).resolution
              : (prev as any)?.dimension?.resolution || 300,
        }
      : (prev as any).dimension

    const prevLayers: LayerDocument[] = Array.isArray((prev as any).layers)
      ? ((prev as any).layers as LayerDocument[])
      : []
    const ctxLayers: LayerDocument[] = Array.isArray(analyzed?.context?.layers)
      ? (analyzed.context.layers as LayerDocument[])
      : []
    const mergedLayers: LayerDocument[] = prevLayers.length ? prevLayers.slice() : ctxLayers.slice()
    const affected: string[] = Array.isArray(analyzed?.preview?.affectedElements)
      ? (analyzed.preview.affectedElements as string[])
      : []
    const targetId: string | undefined = analyzed?.parameters?.targetLayer
    const targets = new Set<string>([...affected, ...(targetId ? [targetId] : [])].filter(Boolean) as string[])

    if (Array.isArray(mergedLayers) && targets.size > 0) {
      mergedLayers.forEach((layer, i) => {
        if (targets.has(String(layer?._id))) {
          const existing = layer || ({} as LayerDocument)
          const delta = (p?.updatedLayer || {}) as Record<string, unknown>
          const { settings: deltaSettings, ...restDelta } = delta as { settings?: Record<string, unknown> }
          const mergedSettings
            = deltaSettings && existing?.settings
              ? { ...(existing as any).settings, ...deltaSettings }
              : (deltaSettings ?? (existing as any).settings)

          mergedLayers[i] = {
            ...(existing as unknown as LayerDocument),
            ...(restDelta as unknown as Partial<LayerDocument>),
            ...(mergedSettings !== undefined ? { settings: mergedSettings } : {}),
          } as LayerDocument
        }
      })
    }

    ;(analyzed as TemplateIntentWithContext).context = {
      template: {
        _id: finalTemplateId,
        name: nextName || (analyzed?.context?.template?.name as string),
        dimension: (normDim as any) || (analyzed?.context?.template?.dimension as any),
        shopDomain: shopDomain || '',
      },
      layers: mergedLayers as LayerDocument[],
      activeLayer: analyzed?.context?.activeLayer,
      selected: prevSelected,
      recentOperations: [],
    }
  }

  return {
    context: {
      ...opCtx,
      ...analyzed?.context,
    } as SupervisorState['context'] & TemplateContext,
    templateOperationParameter: analyzed,
  }
}

/** Normalizes operation results to consistent format with success, data, message, and error fields. */
function normalizeResult(result: any): { success?: boolean; data?: any; message?: string; error?: string } {
  if (!result || typeof result !== 'object') return {}
  if ('data' in result || 'message' in result || 'error' in result) {
    const success = 'success' in result ? (result as any).success : (result as any)?.data?.success
    const error = 'error' in result ? (result as any).error : (result as any)?.data?.error
    const message = (result as any).message
    const data = (result as any).data
    return { success, data, message, error }
  }
  const data: any = {}
  if ((result as any).layer) data.layer = (result as any).layer
  if ((result as any).optionSet) data.optionSet = (result as any).optionSet
  if ((result as any).template) data.template = (result as any).template
  return { success: (result as any).success, data, message: (result as any).message, error: (result as any).error }
}

/** Generates human-readable description of edit result. */
function describeEditResult(result: any): string {
  const r = normalizeResult(result)
  const d = r.data || {}
  if (d.layer) return `Layer "${d.layer.label}" updated`
  if (d.optionSet) return `Option set "${d.optionSet.label}" updated`
  return 'Operation completed'
}

/** Formats edit operation response with preview blocks and error handling. */
async function formatEditResponse(args: {
  result: any
  smartIntent: any
  templateIntent: TemplateIntentWithContext
}): Promise<{ updatedDataString: string; ctaButton: { text: string } }> {
  const { result, smartIntent, templateIntent } = args
  const operationName = smartIntent?.operation || 'Edit operation'
  let { updatedDataString: previewBlock, ctaButton } = buildTemplatePreviewBlock({
    smartIntent,
    result,
    templateIntent,
  })

  if (Array.isArray(result)) {
    const successful = result.filter(r => r.success)
    const failed = result.filter(r => !r.success)

    if (successful.length > 0 && previewBlock) {
      return { updatedDataString: previewBlock, ctaButton }
    }

    let response = `✅ **${operationName} completed**\n\n`
    response += `Successfully updated ${successful.length} items:\n`
    successful.forEach(r => {
      response += `- ${describeEditResult(r)}\n`
    })
    if (failed.length > 0) {
      response += `\n⚠️ **${failed.length} operations failed:**\n`
      failed.forEach(r => {
        response += `- ${r.error}\n`
      })
    }
    return { updatedDataString: previewBlock ? `${response}\n${previewBlock}` : response, ctaButton }
  }

  const normalized = normalizeResult(result)
  if (normalized?.success) {
    // Regenerate preview and rebuild block so TEMPLATE_DATA schema is consistent and singular
    try {
      const ctxTemplate = smartIntent?.context?.template
      const ctxLayers = smartIntent?.context?.layers
      const shopDomain = ctxTemplate?.shopDomain || ''
      const dimension = ctxTemplate?.dimension
      const layers = Array.isArray(ctxLayers) ? (ctxLayers as any[]).slice() : []

      // Merge returned layer (may contain new image src) into layers used for preview
      const returnedLayer = (result as any)?.layer || (normalized?.data as any)?.layer
      if (returnedLayer && returnedLayer._id) {
        const idx = layers.findIndex(l => String((l as any)?._id || '') === String(returnedLayer._id))
        if (idx >= 0) layers[idx] = { ...layers[idx], ...returnedLayer }
        else layers.push(returnedLayer)
      }

      if (shopDomain && dimension && layers.length) {
        const previewUrl = await generateTemplatePreviewUrl({ shopDomain, dimension, layers })
        if (previewUrl) {
          smartIntent.context = smartIntent.context || {}
          smartIntent.context.template = { ...(smartIntent.context.template || {}), previewUrl }
          smartIntent.context.layers = layers as any
        }
      }
    } catch (e) {
      // Non-blocking
      console.warn('Edit preview regeneration failed:', e)
    }

    const { updatedDataString: _previewBlock, ctaButton: _ctaButton } = buildTemplatePreviewBlock({
      smartIntent,
      result,
      templateIntent,
    })
    previewBlock = _previewBlock
    ctaButton = _ctaButton
    if (previewBlock) {
      return { updatedDataString: previewBlock, ctaButton }
    }

    // Fallback: emit normalized data only if no block could be built
    const fallbackPayload = `TEMPLATE_DATA:${JSON.stringify(normalized.data ?? result ?? {})}`
    return { updatedDataString: fallbackPayload, ctaButton }
  }

  throw new Error(normalized?.error || 'Not supported edit operation. Please try again.')
}

/** Builds minimal TemplateContext from conversation messages with optional templateId filtering. */
async function buildContextFromConversation(args: {
  conversationId: string
  shopDomain: string
  templateId?: string
}): Promise<TemplateContext | null> {
  const { conversationId, shopDomain, templateId } = args
  if (!conversationId || !shopDomain) return null
  try {
    const desiredId = templateId ? normalizeTemplateId(String(templateId)) : undefined

    const buildCtxFromParsed = (parsed: { data?: any; cardId?: string | undefined }) => {
      const d = parsed?.data || {}
      const templateRawId: string = String(d?.cardId || d?.templateId || parsed?.cardId || templateId || '')
      const dimension = d?.dimension || { width: 0, height: 0, measurementUnit: 'px', resolution: 300 }
      const layers = Array.isArray(d?.layers) ? (d.layers as LayerDocument[]) : []
      const ctx: TemplateContext = {
        template: {
          _id: templateRawId,
          name: String(d?.name || 'Untitled Template'),
          dimension,
          shopDomain: String(shopDomain || ''),
        },
        layers,
        activeLayer: layers.length ? layers[0] : undefined,
        recentOperations: [],
      }
      return ctx
    }

    const findNewestByContent = async (q: string) => {
      const res = await ConversationMessage.searchByContent({ shopDomain, conversationId, query: q, limit: 1 })
      const msg = Array.isArray(res?.messages) ? res.messages[0] : undefined
      return msg ? String((msg as any)?.content || '') : undefined
    }

    // 1) With templateId: match by exact content occurrence first
    if (desiredId) {
      const cardIdToSearch = desiredId.startsWith('template_') ? desiredId : `template_${desiredId}`
      const exact = await findNewestByContent(`TEMPLATE_CARD:${cardIdToSearch}`)
      const fallbackExact
        = exact || (await findNewestByContent(cardIdToSearch)) || (await findNewestByContent(desiredId))
      if (fallbackExact) {
        const parsed = extractTemplateFromContent(fallbackExact)
        const candidate = normalizeTemplateId(
          String(parsed?.data?.cardId || parsed?.data?.templateId || parsed?.cardId || '')
        )
        if (parsed && candidate && candidate === desiredId) {
          return buildCtxFromParsed(parsed)
        }
      }

      // Fallback: scan newest -> older
      const { messages: rawMessages } = await ConversationMessage.findByShopDomainAndConversationId(
        shopDomain,
        conversationId,
        1,
        50
      )
      for (const m of Array.isArray(rawMessages) ? rawMessages : []) {
        const content = String((m as any)?.content || '')
        const parsed = extractTemplateFromContent(content)
        const candidate = normalizeTemplateId(
          String(parsed?.data?.cardId || parsed?.data?.templateId || parsed?.cardId || '')
        )
        if (parsed && candidate && candidate === desiredId) {
          return buildCtxFromParsed(parsed)
        }
      }
      return null
    }

    // 2) Without templateId: take newest message that contains TEMPLATE_DATA
    const newestWithData = await findNewestByContent('TEMPLATE_DATA:')
    if (newestWithData) {
      const parsed = extractTemplateFromContent(newestWithData)
      if (parsed?.data) return buildCtxFromParsed(parsed)
    }

    // Fallback: scan newest -> older for first TEMPLATE_DATA
    const { messages: rawMessages } = await ConversationMessage.findByShopDomainAndConversationId(
      shopDomain,
      conversationId,
      1,
      50
    )
    for (const m of Array.isArray(rawMessages) ? rawMessages : []) {
      const content = String((m as any)?.content || '')
      const parsed = extractTemplateFromContent(content)
      if (parsed?.data) return buildCtxFromParsed(parsed)
    }
    return null
  } catch {
    return null
  }
}
