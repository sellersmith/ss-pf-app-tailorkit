import type { TemplateIntent } from '../TemplateIntentAnalyzer'
import type { TemplateContext } from '../context/TemplateContextProvider'
import { TEMPLATE_INTENT_TYPES_MAP } from '../../constants/templates'
import { ELayerType, EOptionSet, optionSetDataKeys } from '~/types/psd'

export function buildRulesForIntent(isLayerEdit: boolean): string {
  const base = [
    'Rules:',
    '- Return only the changed fields for the selected entity.',
    '- Entities: updatedTemplate / updatedLayer / updatedOptionSet (and targetLayer when applicable).',
    '- Do NOT introduce default zeros/empties; do not reset or include unrelated/unchanged values.',
    '- Do NOT change geometry (left/top/width/height) or decorative styles unless explicitly requested.',
    '- Output must include only fields defined by the selected schema for this operation.',
  ]

  if (isLayerEdit) base.push("- Must include the layer's _id and type.")
  return base.join('\n')
}

export function buildTargetLayerInfo(params: {
  isLayerOperation: boolean
  isDeleteOp: boolean
  selectedLayerIds?: string[]
}): string {
  const { isLayerOperation, isDeleteOp, selectedLayerIds = [] } = params
  if (!isLayerOperation) return ''
  // Only declare an explicit target when exactly ONE layer is selected by the UI.
  // Do NOT use active layer as implicit target to avoid biasing the model to the first layer.
  if (Array.isArray(selectedLayerIds) && selectedLayerIds.length === 1) {
    const id = String(selectedLayerIds[0])
    return isDeleteOp ? `- Target for deletion: ${id}` : `- Target layer: ${id}`
  }
  return ''
}

export function buildLayerLists(params: {
  isTemplateEdit: boolean
  isLayerOperation: boolean
  isTextContentOp: boolean
  isImageOp: boolean
  isCreateOp: boolean
  isDeleteOp: boolean
  isOptionSetOperation: boolean
  layers: any[]
  selectedLayerIds?: string[]
}): string {
  const {
    isTemplateEdit,
    isLayerOperation,
    isTextContentOp,
    isImageOp,
    isCreateOp,
    isDeleteOp,
    isOptionSetOperation,
    layers,
    selectedLayerIds = [],
  } = params

  if (isTemplateEdit || (!isLayerOperation && !isOptionSetOperation)) return ''

  const effectiveLayers = selectedLayerIds.length
    ? layers.filter(l => selectedLayerIds.includes(String((l as any)?._id || '')))
    : layers

  const sections: string[] = []

  if (isOptionSetOperation) {
    const withOptionSets = effectiveLayers.map(l => {
      const sets = Array.isArray(l?.optionSet) ? l.optionSet : []
      const os = sets
        .map((s: any) => {
          const setId = String(s?._id || '')
          const setType = String(s?.type || '')
          const dataKey = (optionSetDataKeys as any)?.[setType]
          const rawItems: any[] = (s?.data && dataKey ? (s.data as any)[dataKey] : []) || []
          const items = rawItems.map((it: any) => {
            const itemId = String(it?._id || '')
            const value = it?.value ?? it?.src ?? it?.name ?? it?.family ?? ''
            return `${itemId}|${String(value)}`
          })
          return `${setId}:${setType}{items:[${items.join(', ')}]}`
        })
        .join(', ')
      return `- ${l._id} | ${l.label} | ${l.type} | optionSets: [${os}]`
    })
    if (withOptionSets.length > 0) sections.push(`Layers and their option sets:\n${withOptionSets.join('\n')}`)
  }

  if (isTextContentOp) {
    const textLayers = effectiveLayers
      .filter(l => String(l?.type).trim() === ELayerType.TEXT)
      .map(l => `- ${l._id} | ${l.label} | content: ${l?.settings?.content ?? ''}`)
    if (textLayers.length > 0) sections.push(`Text layers (all ${textLayers.length}):\n${textLayers.join('\n')}`)
  }

  if (isImageOp && !isCreateOp) {
    const imageLayers = effectiveLayers
      .filter(l => String(l?.type) === 'image')
      .map(layer => {
        const imageType = String(layer?.settings?.imageType || '')
        const style = String(layer?.image?.generativeOptions?.imageStyle || '')
        const fullPrompt = String(layer?.image?.generativeOptions?.prompt || '')
        const row = [`- ${layer._id}`, layer.label, layer.type]
        if (imageType) row.push(`imageType:${imageType}`)
        if (fullPrompt) row.push(`prompt:${fullPrompt}`)
        if (style) row.push(`style:${style}`)
        return row.join(' | ')
      })
    if (imageLayers.length > 0) {
      sections.push(
        `Image layers (all ${imageLayers.length} - id | label | type | imageType | full prompt):\n${imageLayers.join('\n')}`
      )
    }
  }

  if (isDeleteOp) {
    const allLayers = effectiveLayers.map(l => `- ${l._id} | ${l.label} | ${l.type}`)
    if (allLayers.length > 0) {
      sections.push(`Available layers for deletion (all ${allLayers.length}):\n${allLayers.join('\n')}`)
    }
  }

  if (isCreateOp) {
    const existingIds = effectiveLayers.map(l => l._id).filter(Boolean)
    if (existingIds.length > 0) {
      sections.push(`Existing layer IDs (DO NOT reuse these):\n${existingIds.map(id => `- ${id}`).join('\n')}`)
    }
  }

  if (!sections.length) {
    const basicLayers = effectiveLayers.map(l => `- ${l._id} | ${l.label} | ${l.type}`)
    if (basicLayers.length > 0) {
      sections.push(`Available layers (all ${basicLayers.length}):\n${basicLayers.join('\n')}`)
    }
  }

  return sections.join('\n\n')
}

export function buildSnapshots(params: {
  isLayerOperation: boolean
  isTextContentOp: boolean
  active: any
  layers: any[]
  selectedLayerIds?: string[]
}): string {
  const { isLayerOperation, isTextContentOp, active, layers, selectedLayerIds = [] } = params
  if (!isLayerOperation) return ''

  const toCompact = (layer: any): string => {
    try {
      const base: any = {
        _id: String(layer?._id || ''),
        type: String(layer?.type || ''),
        label: String(layer?.label || ''),
      }
      if (String(layer?.type) === 'text') {
        base.settings = {
          content: String(layer?.settings?.content ?? ''),
          characterLimit: Number(layer?.settings?.characterLimit ?? 0) || undefined,
          fontFamily: layer?.settings?.fontFamily?.family || undefined,
          fontSize: layer?.settings?.fontSize || undefined,
          textColor: layer?.settings?.textColor || undefined,
        }
      } else if (String(layer?.type) === 'image') {
        base.settings = {
          imageType: String(layer?.settings?.imageType || ''),
          imageStyle: String(layer?.settings?.imageStyle || ''),
        }
      }
      return JSON.stringify(base)
    } catch {
      return ''
    }
  }

  const layerArray = Array.isArray(layers)
    ? selectedLayerIds.length
      ? layers.filter(l => selectedLayerIds.includes(String((l as any)?._id || '')))
      : layers
    : []

  const sections: string[] = []
  if (active) {
    const snapshot = toCompact(active)
    if (snapshot) sections.push(`\nLayer snapshot to copy unchanged fields from:\n${snapshot}`)
  }

  const pool = isTextContentOp ? layerArray.filter(l => String(l?.type) === 'text') : layerArray
  const snapshots = pool.map(toCompact).filter(Boolean)
  if (snapshots.length > 0) {
    sections.push(
      `\nLayer snapshot(s) to copy unchanged fields from (all ${snapshots.length} layers):\n${snapshots.join('\n')}`
    )
  }

  return sections.join('')
}

export function buildOperationRules(
  params: {
    isLayerOperation: boolean
    isTextContentOp: boolean
    isImageOp: boolean
    isCreateOp: boolean
    isDeleteOp: boolean
    isOptionSetOperation: boolean
  },
  activeLayerType?: string,
  selectedLayerIds: string[] = []
): string {
  const { isLayerOperation, isTextContentOp, isImageOp, isCreateOp, isDeleteOp, isOptionSetOperation } = params

  const baseRules = buildRulesForIntent(isLayerOperation)
  const rules: string[] = []

  if (isLayerOperation && selectedLayerIds.length === 1) {
    const lockId = String(selectedLayerIds[0])
    rules.push(
      `- IMPORTANT: Target layer is strictly locked to id ${lockId}.`,
      `- Always set targetLayer to ${lockId} and updatedLayer._id to ${lockId}.`,
      '- Do NOT reference or choose any other layer.'
    )
  }

  if (isCreateOp) {
    rules.push(
      '- For layer creation: MUST generate a unique _id (use uuid format like "text-layer-" + timestamp)',
      '- Do NOT reuse existing layer IDs from the layer list',
      '- Specify type, position, and all required settings',
      '- For new layers: ensure _id is completely unique and different from existing layers'
    )
    if (isTextContentOp) {
      rules.push('- Do NOT include image-related fields (imagePrompt, imageType, imageStyle, image object)')
    }
    if (isImageOp) {
      rules.push(
        '- For image layers: include imagePrompt, imageType, and imageStyle',
        '- Do NOT include text-specific fields (content, fontSize, fontFamily)',
        '- Set appropriate dimensions and positioning'
      )
    }
  }

  if (isDeleteOp) {
    rules.push(
      '- For layer deletion: must specify target layer _id or use targetLayer field',
      '- Identify correct layer from available options if not explicitly specified'
    )
  }

  if (isImageOp && !isCreateOp) {
    rules.push(
      ...(selectedLayerIds.length
        ? []
        : ['- For image edits: choose best-matching layer via layer.image.generativeOptions.prompt or layer label']),
      '- MUST set updatedLayer.image.generativeOptions.prompt (single source of truth for image generation)',
      '- Do NOT use settings.imagePrompt or root imagePrompt fields; use image.generativeOptions.prompt only',
      '- Include imageType, imageStyle, and opacity',
      '- Avoid decorative/background layers unless requested',
      '- Always include targetLayer and set updatedLayer._id to that same id',
      '- Do NOT change geometry or unrelated properties unless explicitly requested'
    )
  }

  if (isTextContentOp) {
    rules.push(
      '- For text edits: identify target layer by content match or label',
      '- Preserve existing styling unless changes are requested',
      '- Include fontSize, fontFamily, and textColor in updates'
    )
  }

  if (isOptionSetOperation) {
    rules.push(
      '- Always include targetLayer and updatedOptionSet',
      '- targetLayer must be an existing layer _id from the lists; NEVER return a label',
      '- For EDITS: Return a DELTA in updatedOptionSet.data.* (one or more of edits[], creates[], deleteIds[])',
      '- EDIT: include only {_id, fields to update}; NEVER generate a new _id for existing items.',
      '- CREATE: include only the new item data, NO DUPLICATES with existing items (system will assign _id if missing).',
      '- DELETE: include only ids in deleteIds[].',
      '- Do NOT return the full array for edits.',
      '- For image/mask edits/creates: include imagePrompt and imageStyle; src will be generated by system.',
      '- Do NOT alter unrelated layer geometry or styles',
      '- IMPORTANT (ID): NEVER set updatedOptionSet._id equal to targetLayer id.',
      '- IMPORTANT (CREATE): Do NOT include updatedOptionSet._id. The system will assign the id.',
      '- IMPORTANT (EDIT): If updatedOptionSet._id is present, it MUST be one of the option set ids listed for the target layer.'
    )

    const layerType = String(activeLayerType || '').trim()
    if (layerType === ELayerType.IMAGE) {
      const allowed = [EOptionSet.IMAGE_OPTION, EOptionSet.MASK_OPTION]
      rules.push(`- IMPORTANT: Target layer is image; updatedOptionSet.type MUST be one of [${allowed.join(', ')}].`)
      rules.push(
        `- NEVER produce ${EOptionSet.TEXT_OPTION}, ${EOptionSet.COLOR_OPTION}, or ${EOptionSet.FONT_OPTION} for image layers.`
      )
      rules.push('- For image_option and mask_option: derive imagePrompt from the layer.')
      rules.push('- Include imageStyle from the layer settings.imageStyle.')
      rules.push('- Both imagePrompt and imageStyle are REQUIRED per item in the option set.')
    }
    if (layerType === ELayerType.TEXT) {
      const allowed = [EOptionSet.TEXT_OPTION, EOptionSet.COLOR_OPTION, EOptionSet.FONT_OPTION]
      rules.push(`- IMPORTANT: Target layer is text; updatedOptionSet.type MUST be one of [${allowed.join(', ')}].`)
      rules.push(`- NEVER produce ${EOptionSet.IMAGE_OPTION} or ${EOptionSet.MASK_OPTION} for text layers.`)
    }
  }

  return rules.length ? `${baseRules}\n${rules.join('\n')}` : baseRules
}

export function deriveOperationDescriptor(intent: TemplateIntent): {
  isTemplateEdit: boolean
  isLayerOperation: boolean
  isOptionSetOperation: boolean
  isTextContentOp: boolean
  isImageOp: boolean
  isCreateOp: boolean
  isDeleteOp: boolean
  operation: string
} {
  const operation = String((intent as any)?.operation || '')
  const isTemplateEdit = intent.intentType === TEMPLATE_INTENT_TYPES_MAP.template_edit
  const isLayerOperation = [
    TEMPLATE_INTENT_TYPES_MAP.layer_edit,
    TEMPLATE_INTENT_TYPES_MAP.layer_create,
    TEMPLATE_INTENT_TYPES_MAP.layer_delete,
  ].includes(intent.intentType as any)
  const isOptionSetOperation = [
    TEMPLATE_INTENT_TYPES_MAP.option_set_edit,
    TEMPLATE_INTENT_TYPES_MAP.option_set_create,
    TEMPLATE_INTENT_TYPES_MAP.option_set_delete,
  ].includes(intent.intentType as any)
  const isTextContentOp = operation.includes(ELayerType.TEXT)
  const isImageOp = operation.includes(ELayerType.IMAGE)
  const isCreateOp = intent.intentType === TEMPLATE_INTENT_TYPES_MAP.layer_create
  const isDeleteOp = intent.intentType === TEMPLATE_INTENT_TYPES_MAP.layer_delete

  return {
    isTemplateEdit,
    isLayerOperation,
    isOptionSetOperation,
    isTextContentOp,
    isImageOp,
    isCreateOp,
    isDeleteOp,
    operation,
  }
}

export function buildContextualPrompt(query: string, intent: TemplateIntent, context: TemplateContext): string {
  const tpl = (context as any)?.template || { name: '', dimension: { width: 0, height: 0 } }
  const selectedIds: string[] = Array.isArray((context as any)?.selected?.layerIds)
    ? ((context as any).selected!.layerIds as string[]) || []
    : []
  // Do NOT set an implicit active layer when there is no explicit selection.
  // This avoids misleading the model to pick the first layer by default.
  const active: any
    = selectedIds.length === 1
      ? (context as any)?.layers?.find((l: any) => String((l as any)?._id || '') === String(selectedIds[0]))
      : undefined

  const descriptor = deriveOperationDescriptor(intent)

  const targetInfo = buildTargetLayerInfo({
    isLayerOperation: descriptor.isLayerOperation,
    isDeleteOp: descriptor.isDeleteOp,
    selectedLayerIds: selectedIds,
  })

  const layerLists
    = descriptor.isLayerOperation && Array.isArray(selectedIds) && selectedIds.length === 1
      ? ''
      : buildLayerLists({
          isTemplateEdit: descriptor.isTemplateEdit,
          isLayerOperation: descriptor.isLayerOperation,
          isTextContentOp: descriptor.isTextContentOp,
          isImageOp: descriptor.isImageOp,
          isCreateOp: descriptor.isCreateOp,
          isDeleteOp: descriptor.isDeleteOp,
          isOptionSetOperation: descriptor.isOptionSetOperation,
          layers: (context as any)?.layers || [],
          selectedLayerIds: selectedIds,
        })

  const snapshots
    = descriptor.isLayerOperation && Array.isArray(selectedIds) && selectedIds.length === 1
      ? ''
      : buildSnapshots({
          isLayerOperation: descriptor.isLayerOperation,
          isTextContentOp: descriptor.isTextContentOp,
          active,
          layers: (context as any)?.layers || [],
          selectedLayerIds: selectedIds,
        })

  const rules = buildOperationRules(
    {
      isLayerOperation: descriptor.isLayerOperation,
      isTextContentOp: descriptor.isTextContentOp,
      isImageOp: descriptor.isImageOp,
      isCreateOp: descriptor.isCreateOp,
      isDeleteOp: descriptor.isDeleteOp,
      isOptionSetOperation: descriptor.isOptionSetOperation,
    },
    active?.type,
    selectedIds
  )

  return `
User request: "${query}"

Context:
- Template: ${tpl.name} (${tpl.dimension.width}x${tpl.dimension.height}px)
${targetInfo}
${layerLists}
${snapshots}

${rules}

Output:
- JSON only, matching the selected schema.
- Do not include storeActions.
- All entity references MUST use existing layer _id values from the lists; NEVER use layer labels.
- For option_set_create: Return a FULL updatedOptionSet with data.* as a complete array of NEW items
  (no reuse or copy of existing items). Do NOT include delta fields (edits/creates/deleteIds).
  Provide at least 3 items.
  `.trim()
}

export function buildMinimalPromptForSingleLayerSelection(
  query: string,
  intent: TemplateIntent,
  context: TemplateContext,
  selectedLayerId: string
): string {
  if (intent.intentType === 'layer_create') {
    return `User request: "${query}"

Context:
- Template: ${String((context as any)?.template?.name || '')}
  (${(context as any)?.template?.dimension?.width || 0}x${(context as any)?.template?.dimension?.height || 0}px)
- Reference layer id (for relative positioning only): ${selectedLayerId}

Rules:
- CREATE a NEW layer. Generate a unique _id different from ALL existing layer ids.
- Do NOT modify the reference layer or any existing layer.
- Return JSON only, matching the selected schema.
- Provide complete fields for the new layer (type, label, geometry, settings, visibility, etc.).
- If positioning is mentioned, base it relative to the reference layer but keep the reference untouched.`.trim()
  }

  if (intent.intentType.startsWith('layer_')) {
    return `User request: "${query}"

Context:
- Template: ${String((context as any)?.template?.name || '')}
  (${(context as any)?.template?.dimension?.width || 0}x${(context as any)?.template?.dimension?.height || 0}px)
- Target layer id: ${selectedLayerId}

Rules:
- ONLY update the target layer id ${selectedLayerId}.
- Return JSON only, matching the selected schema.
- Always set targetLayer to ${selectedLayerId} and updatedLayer._id to ${selectedLayerId}.
- Do NOT reference any other layer.`.trim()
  }

  if (intent.intentType.startsWith('option_set_')) {
    const layers: any[] = Array.isArray((context as any)?.layers) ? ((context as any).layers as any[]) : []
    const target = layers.find(l => String((l as any)?._id || '') === String(selectedLayerId))
    const type = String(target?.type || '')
    const label = String(target?.label || '')
    const imageType = String(target?.image?.generativeOptions?.imageType || '')
    const imageStyle = String(target?.image?.generativeOptions?.imageStyle || '')
    const fullPrompt = String(target?.image?.generativeOptions?.prompt || '')

    const layerSnapshot = JSON.stringify(
      {
        _id: selectedLayerId,
        type,
        label,
        settings: { imageType, imageStyle, imagePrompt: fullPrompt },
      },
      null,
      0
    )

    const baseContext = `User request: "${query}"

Context:
- Template: ${String((context as any)?.template?.name || '')}
  (${(context as any)?.template?.dimension?.width || 0}x${(context as any)?.template?.dimension?.height || 0}px)
- Target layer id: ${selectedLayerId}
${target ? `- Target layer snapshot (authoritative): ${layerSnapshot}` : '- Target layer snapshot is not available in current context (id mismatch).'}

Rules:
- ONLY create/edit option set for the target layer id ${selectedLayerId}.
- If snapshot is available: derive items strictly from snapshot (imagePrompt/imageStyle/imageType).
- If snapshot is NOT available: do not guess other layers' content; keep labels generic. The server will reconcile prompts from the layer.
- If the user request conflicts, prefer the snapshot to keep alignment.
- For names: base label/labelOnStoreFront on the layer label (e.g., "${label} Options").
- Return JSON only, matching the selected schema.
- Always set targetLayer to ${selectedLayerId}.
- Do NOT reference any other layer.`.trim()

    return baseContext
  }

  return buildContextualPrompt(query, intent, context)
}
