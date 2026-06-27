/* eslint-disable max-len */
/**
 * Extracts structured operation parameters from user requests for template/layer edits.
 * Uses LLM analysis to convert natural language into actionable edit parameters.
 */

import { type TemplateIntent } from './TemplateIntentAnalyzer'
import type { TemplateContext } from './context/TemplateContextProvider'
import type { ChatInvoker } from '../services/ProductIntentAnalyzer'
import { parseJsonFromLLM } from '../services/utils/json'
import type { SmartEditParameters } from './types'
import { SchemaFactory, type TemplateSchemaKeys } from './schemas/schema-registry'
import { TEMPLATE_INTENT_TYPES_MAP } from '../constants/templates'
import { optionSetDataKeys } from '~/types/psd'
import { buildMinimalPromptForSingleLayerSelection, buildContextualPrompt } from './utils/editTemplatePromptBuilders'

interface PositionOp {
  target: 'x' | 'y' | 'both'
  type: 'set' | 'add'
  value: number
  unit: 'px' | '%'
}

export interface TemplateIntentWithContext extends TemplateIntent {
  parameters: SmartEditParameters
  preview: any
  context: TemplateContext
}

/**
 * Transforms user edit requests into structured parameters for template operations.
 * Handles complex parameter extraction including position operations and context merging.
 */
export class TemplateOperationParameterExtractor {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly chatInvoker: ChatInvoker) {}

  /**
   * Analyzes user request and extracts structured parameters for template operations.
   * @param args.query User's edit request
   * @param args.providedContext Current template context
   * @param args.intent Classified template intent
   * @returns Complete intent with extracted parameters and preview
   */
  async analyzeWithMergedSources(args: {
    query: string
    providedContext: TemplateContext
    intent: TemplateIntent
  }): Promise<TemplateIntentWithContext> {
    const { query, providedContext, intent } = args

    if (!providedContext) {
      throw new Error('No template context available after merged sources')
    }

    const parameters = await this.extractWithStructuredPrompts(query, intent, providedContext)
    const preview = await this.generateOperationPreview(parameters)

    return {
      ...intent,
      operation: intent.operation,
      parameters,
      preview,
      context: providedContext,
    }
  }

  /** Maps template intent to appropriate schema key for parameter extraction */
  getSchemaKey(intent: TemplateIntent): string | undefined {
    switch (intent.intentType) {
      case TEMPLATE_INTENT_TYPES_MAP.template_edit:
        return 'templateEdit'
      case TEMPLATE_INTENT_TYPES_MAP.layer_edit:
      case TEMPLATE_INTENT_TYPES_MAP.layer_create:
      case TEMPLATE_INTENT_TYPES_MAP.layer_delete:
        return 'layerEdit'
      case TEMPLATE_INTENT_TYPES_MAP.option_set_create:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_delete:
        return 'optionSetCreate'
      case TEMPLATE_INTENT_TYPES_MAP.option_set_edit:
        return 'optionSetEdit'
    }
  }

  /** Extracts parameters using structured LLM prompts with schema validation */
  async extractWithStructuredPrompts(
    query: string,
    intent: TemplateIntent,
    context: TemplateContext
  ): Promise<SmartEditParameters> {
    // Fast-path: if UI provided exact target(s), short-circuit LLM disambiguation where possible
    const selectedLayerIds: string[] = Array.isArray((context as any)?.selected?.layerIds)
      ? ((context as any).selected.layerIds as string[]) || []
      : []
    // const selectedTemplateId: string | undefined = (context as any)?.selected?.templateId

    // If template edit and templateId provided, do not ask LLM to select ids; keep minimal schema
    const contextualPrompt = buildContextualPrompt(query, intent, context)
    // Choose minimal schema by intent type for better latency
    const applyKey: string | undefined = this.getSchemaKey(intent)

    // Build a minimal prompt for LLM when a specific layer is selected
    const minimalPrompt = (() => {
      const sIds = selectedLayerIds
      if (
        sIds.length === 1
        && (intent.intentType.startsWith('layer_') || intent.intentType.startsWith('option_set_'))
      ) {
        return buildMinimalPromptForSingleLayerSelection(query, intent, context, sIds[0])
      }
      return contextualPrompt
    })()

    const response = await this.chatInvoker.invokeChat(this.chatInvoker.buildMessages(minimalPrompt), {
      response_format: applyKey
        ? SchemaFactory.createResponseFormat(`operationApply_${applyKey}` as TemplateSchemaKeys)
        : undefined,
    })

    const rawParams = parseJsonFromLLM<any>(response)

    if ((rawParams as any)?.updatedTemplate && intent.intentType === 'template_edit') {
      const updated = (rawParams as any).updatedTemplate
      const current = (context as any)?.template || {}
      const merged = {
        ...current,
        ...updated,
        _id: updated.id || current._id,
      }
      return {
        template: { id: merged._id, ...merged },
        // Keep updatedTemplate for one-step merge downstream
        updatedTemplate: merged,
        contextualReasons: Array.isArray((rawParams as any)?.contextualReasons)
          ? (rawParams as any).contextualReasons
          : [],
      }
    }

    if ((rawParams as any)?.updatedLayer && intent.intentType.startsWith('layer_')) {
      const updated = (rawParams as any).updatedLayer
      // For layer creation, DO NOT bind to target layer. Return new layer only.
      if (intent.intentType === TEMPLATE_INTENT_TYPES_MAP.layer_create) {
        return {
          updatedLayer: updated,
          contextualReasons: Array.isArray((rawParams as any)?.contextualReasons)
            ? (rawParams as any).contextualReasons
            : [],
        } as any
      }

      const targetIdFromLLM: string = String((rawParams as any)?.targetLayer || updated._id || '')
      const targetId: string = String(selectedLayerIds.length === 1 ? selectedLayerIds[0] : targetIdFromLLM || '')

      // target id enforced above when exactly one layer is selected
      // Resolve original layer snapshot early for correct base position
      let original: any | undefined
      try {
        const layersArr: any[] = Array.isArray((context as any)?.layers) ? ((context as any).layers as any[]) : []
        original = layersArr.find(l => String((l as any)?._id || '') === targetId) || (context as any)?.activeLayer
      } catch {}

      // Optional movement ops: compute absolute position if provided, preserving LLM-provided delta sign
      try {
        const ops = Array.isArray((rawParams as any)?.positionOps) ? (rawParams as any).positionOps : []
        if (ops.length) {
          const baseX = Number((original as any)?.left ?? updated.left ?? 0)
          const baseY = Number((original as any)?.top ?? updated.top ?? 0)
          const current = { x: baseX, y: baseY }
          const canvas = {
            width: Number((context as any)?.template?.dimension?.width ?? 0),
            height: Number((context as any)?.template?.dimension?.height ?? 0),
          }
          const next = this.applyPositionOps(current, canvas, ops as PositionOp[])
          updated.left = next.x
          updated.top = next.y
        }
      } catch {}

      // Local preserve-merge: overlay updated fields onto original layer snapshot to keep unchanged fields
      // Skip merging for layer creation and deletion - these should be clean
      try {
        if (
          original
          && intent.intentType !== TEMPLATE_INTENT_TYPES_MAP.layer_create
          && intent.intentType !== TEMPLATE_INTENT_TYPES_MAP.layer_delete
        ) {
          const merged = this.deepMergePreserve(original, updated)
          ;(rawParams as any).updatedLayer = merged
        }
      } catch {}

      return {
        targetLayer: targetId,
        updatedLayer: (rawParams as any).updatedLayer,
        contextualReasons: Array.isArray((rawParams as any)?.contextualReasons)
          ? (rawParams as any).contextualReasons
          : [],
      } as any
    }
    if ((rawParams as any)?.updatedOptionSet && intent.intentType.startsWith('option_set_')) {
      const updated = (rawParams as any).updatedOptionSet
      const payload = {
        targetLayer: String(
          selectedLayerIds.length === 1
            ? selectedLayerIds[0]
            : (rawParams as any)?.targetLayer || (updated as any)?.targetLayer || ''
        ),
        optionSetId: String(updated._id || ''),
        optionSetType: String((updated as any)?.type || ''),
        contextualReasons: Array.isArray((rawParams as any)?.contextualReasons)
          ? (rawParams as any).contextualReasons
          : [],
      } as any

      // Detect delta payload vs full payload
      const dataObj = (updated as any)?.data
      const hasDelta
        = Array.isArray((dataObj as any)?.edits)
        || Array.isArray((dataObj as any)?.creates)
        || Array.isArray((dataObj as any)?.deleteIds)

      const isEdit = intent.intentType === TEMPLATE_INTENT_TYPES_MAP.option_set_edit

      if (hasDelta && isEdit) {
        payload.updatedOptionSet = {
          ...updated,
          type: String((updated as any)?.type || ''),
          edits: Array.isArray((dataObj as any)?.edits) ? (dataObj as any).edits : [],
          creates: Array.isArray((dataObj as any)?.creates) ? (dataObj as any).creates : [],
          deleteIds: Array.isArray((dataObj as any)?.deleteIds) ? (dataObj as any).deleteIds : [],
        }
      } else {
        const targetLayer = (context as any)?.layers?.find((l: any) => l._id === payload.targetLayer)
        const currentOptionSet = targetLayer?.optionSet?.find((os: any) => os._id === payload.optionSetId)
        if (currentOptionSet && currentOptionSet.data && updated.data) {
          const optionSetType = payload.optionSetType || currentOptionSet.type
          const dataKey = (optionSetDataKeys as any)[optionSetType]

          payload.updatedOptionSet = {
            ...currentOptionSet,
            ...updated,
            data: {
              ...currentOptionSet.data,
              [dataKey]: [...(currentOptionSet.data[dataKey] || []), ...(updated.data[dataKey] || [])],
            },
          }
        } else {
          payload.updatedOptionSet = updated
        }
      }

      return payload
    }

    // No updated entity returned – this is now required with operationApply schemas
    throw new Error('LLM did not return an updated entity (updatedTemplate/updatedLayer/updatedOptionSet)')
  }

  /** Computes absolute coordinates from position operations with canvas bounds clamping */
  protected applyPositionOps(
    current: { x: number; y: number },
    canvas: { width: number; height: number },
    ops: PositionOp[]
  ): { x: number; y: number } {
    let x = Number.isFinite(current.x) ? current.x : 0
    let y = Number.isFinite(current.y) ? current.y : 0
    const w = Math.max(0, Number(canvas.width || 0))
    const h = Math.max(0, Number(canvas.height || 0))

    const toPixels = (axis: 'x' | 'y', value: number, unit: 'px' | '%'): number => {
      if (unit === '%') {
        const basis = axis === 'x' ? w : h
        return (Number(value) * basis) / 100
      }
      return Number(value)
    }

    for (const op of ops) {
      const target = op?.target === 'both' ? (['x', 'y'] as const) : ([op?.target] as const)
      for (const axis of target) {
        const delta = toPixels(axis as any, Number(op?.value || 0), (op?.unit as any) || 'px')
        if (op?.type === 'set') {
          if (axis === 'x') x = delta
          else y = delta
        } else if (op?.type === 'add') {
          if (axis === 'x') x += delta
          else y += delta
        }
      }
    }

    x = Math.max(0, Math.min(w, Math.round(x)))
    y = Math.max(0, Math.min(h, Math.round(y)))
    return { x, y }
  }

  /** Deep merges updates into base object preserving existing fields */
  private deepMergePreserve<T extends Record<string, any>>(base: T, updates: Partial<T>): T {
    const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
    const result: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) }
    for (const key of Object.keys(updates || {})) {
      const uVal: any = (updates as any)[key]
      const bVal: any = (result as any)[key]
      if (Array.isArray(uVal)) {
        result[key] = uVal
      } else if (isObj(uVal) && isObj(bVal)) {
        result[key] = this.deepMergePreserve(bVal, uVal)
      } else {
        result[key] = uVal
      }
    }
    return result as T
  }

  // buildContextualInfo moved to utils/prompt-templates (via prompt-builders helpers)

  /** Generates preview of operation effects for client display */
  private async generateOperationPreview(parameters: SmartEditParameters): Promise<any> {
    return {
      updatedTemplate: parameters.updatedTemplate || {},
      updatedLayer: parameters.updatedLayer || {},
      updatedOptionSet: parameters.updatedOptionSet || {},
      affectedElements: parameters.targetLayer ? [parameters.targetLayer] : [],
    }
  }
}
