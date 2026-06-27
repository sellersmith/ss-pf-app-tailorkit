/**
 * Command Pipeline — executes tool call batches with undo and rollback.
 *
 * Pattern: Each tool call → Command → execute(context) → CommandResult
 * Batch: all-or-nothing. Partial failure → rollback already-executed commands.
 * Undo: reverts last batch by calling undo() on each command in reverse.
 */

import type { ToolCall, Command, CommandResult, BatchResult, EditorContext, ElementAdapter } from './types'
import { SetConditionalCommand } from './commands/set-conditional-command'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { deleteLayerStoreById } from '~/stores/modules/layer'
import { validateToolArgs } from './registry'
import { uuid } from '~/utils/uuid'
import { fontLoader } from '~/modules/TemplateEditor/elements/components/Text/instances'
import { fetchAllGoogleFonts } from '~/modules/TemplateEditor/elements/hooks/useQueryFonts'

/** Catalog entry shape used for font lookups */
type FontCatalogEntry = { family: string; variants?: string[]; files?: Record<string, string>; svgString?: string }

/**
 * Look up a font by family name in the Google Fonts catalog (case-insensitive).
 * Returns the matched entry or undefined. Shared by all font pre-resolution flows.
 */
function findFontInCatalog(catalog: FontCatalogEntry[], familyName: string): FontCatalogEntry | undefined {
  return catalog.find(f => f.family.toLowerCase() === familyName.toLowerCase())
}

/** Get the TTF URL for a font's first variant */
function getFontSrc(entry: FontCatalogEntry): string {
  const variant = entry.variants?.[0] || 'regular'
  return entry.files?.[variant] || ''
}

/**
 * Pre-resolve font_option tool call values from the Google Fonts catalog.
 * Enriches values with src (gstatic TTF URL), svgString, and exact family casing.
 * Pre-loads fonts via fontLoader — matching the manual FontSelector behavior.
 * Must be called BEFORE command execution so fonts are ready at dispatch time.
 */
async function preResolveFontCalls(calls: ToolCall[]): Promise<void> {
  const fontCalls = calls.filter(c => c.name === 'set_customization' && c.args?.type === 'font_option')
  if (!fontCalls.length) return

  const catalog = (await fetchAllGoogleFonts()) as FontCatalogEntry[] | undefined
  if (!catalog?.length) return

  type FontValue = { name?: string; family?: string; src?: string; svgString?: string; fontSource?: string }

  for (const call of fontCalls) {
    const values = call.args.values as FontValue[]
    if (!values?.length) continue
    for (const v of values) {
      if (v.src) continue
      const match = findFontInCatalog(catalog, v.family || v.name || '')
      if (match) {
        v.src = getFontSrc(match)
        v.svgString = v.svgString || match.svgString || ''
        v.family = match.family
        v.fontSource = 'google'
      }
    }
    await Promise.all(values.filter(v => v.src).map(v => fontLoader.loadFont(v.family as string, v.src as string)))
  }
}

/**
 * Pre-resolve font_family on create_element / set_settings calls for text elements.
 * Looks up the Google Fonts catalog to get the TTF URL and pre-loads the font.
 * Stores resolved src in args._resolved_font_src for the adapter/command to consume.
 */
async function preResolveTextFontCalls(calls: ToolCall[]): Promise<void> {
  const textCalls = calls.filter(
    c =>
      (c.name === 'create_element'
        && (c.args?.element_type === 'text' || c.args?.element_type === 'text_customer')
        && c.args?.font_family)
      || (c.name === 'set_settings' && c.args?.settings?.font_family)
  )
  if (!textCalls.length) return

  const catalog = (await fetchAllGoogleFonts()) as FontCatalogEntry[] | undefined
  if (!catalog?.length) return

  for (const call of textCalls) {
    // Font family lives in different places depending on the tool
    const isSettings = call.name === 'set_settings'
    const requestedFamily = isSettings ? call.args.settings.font_family : call.args.font_family
    const match = findFontInCatalog(catalog, requestedFamily as string)
    if (match) {
      const src = getFontSrc(match)
      if (isSettings) {
        call.args.settings.font_family = match.family
        call.args.settings._resolved_font_src = src
      } else {
        call.args.font_family = match.family
        call.args._resolved_font_src = src
      }
      if (src) await fontLoader.loadFont(match.family, src)
    }
  }
}

/** CustomizationItemType → EOptionSet type for slot lookup */
const CUSTOMIZATION_TO_OPTION_SET_TYPE: Record<string, string> = {
  imageless_option: 'imageless_option',
  text_option: 'text_option',
  font_option: 'font_option',
  color_option: 'color_option',
  image_buyer: 'image_option',
  image_seller: 'image_option',
  mask_option: 'mask_option',
}

/** EOptionSet type → data key in option set data object */
const OPTION_SET_DATA_KEYS: Record<string, string> = {
  imageless_option: 'values',
  text_option: 'texts',
  color_option: 'colors',
  font_option: 'fonts',
  image_option: 'files',
  mask_option: 'masks',
}

/** Adapter registry — set by Phase 2, imported dynamically */
let adapterRegistry: Record<string, ElementAdapter> = {}

/** Register element adapters (called once during app init) */
export function registerAdapters(adapters: Record<string, ElementAdapter>): void {
  adapterRegistry = adapters
}

/** Create a Command from a tool call */
function createCommand(call: ToolCall): Command {
  switch (call.name) {
    case 'create_element':
      return new CreateElementCommand(call)
    case 'set_customization':
      return new SetCustomizationCommand(call)
    case 'set_settings':
      return new SetSettingsCommand(call)
    case 'remove_element':
      return new RemoveElementCommand(call)
    case 'set_conditional':
      return new SetConditionalCommand(call)
    default:
      throw new Error(`Unknown tool: ${call.name}`)
  }
}

/**
 * Command Pipeline — batch execution engine with undo/rollback.
 *
 * Usage:
 *   const pipeline = new CommandPipeline()
 *   const result = pipeline.executeBatch(toolCalls, editorContext)
 *   if (!result.success) // auto-rolled back
 *   pipeline.undoLastBatch() // user clicks Undo
 */
export class CommandPipeline {
  /** Stack of executed batches (for multi-level undo) */
  private history: Array<{ commands: Command[]; createdStoreIds: string[] }> = []

  /** Execute a batch of tool calls. Returns BatchResult. Auto-rollbacks on failure. */
  executeBatch(calls: ToolCall[], context: EditorContext): BatchResult {
    if (!calls.length) {
      return { success: true, createdStores: [], errors: [], executedCount: 0 }
    }

    const createdElements = new Map<string, TLayerStore>()
    const executedCommands: Command[] = []
    const errors: string[] = []

    for (const call of calls) {
      // Validate args
      const validation = validateToolArgs(call.name as any, call.args)
      if (!validation.success) {
        errors.push(`${call.name}: ${validation.error}`)
        this.rollbackCommands(executedCommands, context)
        return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
      }

      // Create and execute command
      try {
        const command = createCommand(call)
        const result = command.execute(context, createdElements)

        if (!result.success) {
          errors.push(`${call.name}: ${result.error || 'Unknown error'}`)
          this.rollbackCommands(executedCommands, context)
          return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
        }

        executedCommands.push(command)

        // Track created elements for cross-referencing
        if (result.layerStore && result.elementRef) {
          createdElements.set(result.elementRef, result.layerStore)
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        errors.push(`${call.name}: ${error.message}`)
        this.rollbackCommands(executedCommands, context)
        return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
      }
    }

    // All succeeded — add created stores to editor
    const createdStores = Array.from(createdElements.values())
    if (createdStores.length > 0) {
      const currentStores = (TemplateEditorStore.getState() as any).extractedLayerStores || []
      TemplateEditorStoreActions.setExtractedLayerStores([...createdStores, ...currentStores])
    }

    // Push to history for undo
    const createdStoreIds = createdStores.map(s => s.getState()._id)
    this.history.push({ commands: executedCommands, createdStoreIds })

    return { success: true, createdStores, errors: [], executedCount: executedCommands.length }
  }

  /** Execute with per-step progress callback. Groups calls by stepId for progress tracking. */
  async executeWithProgress(
    calls: ToolCall[],
    context: EditorContext,
    onStepProgress: (stepId: string, status: 'running' | 'done' | 'failed', error?: string) => void
  ): Promise<BatchResult> {
    if (!calls.length) {
      return { success: true, createdStores: [], errors: [], executedCount: 0 }
    }

    // Pre-resolve font src URLs from Google Fonts catalog BEFORE executing commands.
    // Must happen before dispatch so font data (src, svgString) is available at render time.
    await Promise.all([preResolveFontCalls(calls), preResolveTextFontCalls(calls)])

    // Group calls by stepId (preserving order)
    const groups = new Map<string, ToolCall[]>()
    for (const call of calls) {
      const key = call.stepId || '_ungrouped'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(call)
    }

    const createdElements = new Map<string, TLayerStore>()
    const executedCommands: Command[] = []
    const errors: string[] = []

    for (const [stepId, stepCalls] of groups) {
      onStepProgress(stepId, 'running')

      // Yield to UI between step groups
      await new Promise(resolve => setTimeout(resolve, 0))

      for (const call of stepCalls) {
        const validation = validateToolArgs(call.name as any, call.args)
        if (!validation.success) {
          errors.push(`${call.name}: ${validation.error}`)
          onStepProgress(stepId, 'failed', validation.error)
          this.rollbackCommands(executedCommands, context)
          return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
        }

        try {
          const command = createCommand(call)
          const result = command.execute(context, createdElements)
          if (!result.success) {
            errors.push(`${call.name}: ${result.error || 'Unknown error'}`)
            onStepProgress(stepId, 'failed', result.error)
            this.rollbackCommands(executedCommands, context)
            return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
          }
          executedCommands.push(command)
          if (result.layerStore && result.elementRef) {
            createdElements.set(result.elementRef, result.layerStore)
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          errors.push(`${call.name}: ${error.message}`)
          onStepProgress(stepId, 'failed', error.message)
          this.rollbackCommands(executedCommands, context)
          return { success: false, createdStores: [], errors, executedCount: executedCommands.length }
        }
      }

      onStepProgress(stepId, 'done')
    }

    // All succeeded — add to editor + history (same as executeBatch)
    const createdStores = Array.from(createdElements.values())
    if (createdStores.length > 0) {
      const currentStores = (TemplateEditorStore.getState() as any).extractedLayerStores || []
      TemplateEditorStoreActions.setExtractedLayerStores([...createdStores, ...currentStores])
    }

    const createdStoreIds = createdStores.map(s => s.getState()._id)
    this.history.push({ commands: executedCommands, createdStoreIds })

    return { success: true, createdStores, errors: [], executedCount: executedCommands.length }
  }

  /** Undo the last executed batch */
  undoLastBatch(): boolean {
    const batch = this.history.pop()
    if (!batch) return false

    // Remove created layers from editor
    const currentStores: TLayerStore[] = (TemplateEditorStore.getState() as any).extractedLayerStores || []
    const idsToRemove = new Set(batch.createdStoreIds)
    const filteredStores = currentStores.filter((s: TLayerStore) => !idsToRemove.has(s.getState()._id))
    TemplateEditorStoreActions.setExtractedLayerStores(filteredStores)

    // Clean up layer stores from global registry
    for (const id of batch.createdStoreIds) {
      deleteLayerStoreById(id)
    }

    return true
  }

  /** Rollback ALL batches */
  rollbackAll(): void {
    while (this.history.length > 0) {
      this.undoLastBatch()
    }
  }

  /** Check if there are batches to undo */
  canUndo(): boolean {
    return this.history.length > 0
  }

  /** Get count of batches in history */
  get batchCount(): number {
    return this.history.length
  }

  /** Rollback already-executed commands (internal, for partial failure) */
  private rollbackCommands(commands: Command[], context: EditorContext): void {
    for (let i = commands.length - 1; i >= 0; i--) {
      try {
        commands[i].undo(context)
      } catch {
        // Best effort — don't throw during rollback
      }
    }
  }
}

// ── Command implementations ──────────────────────────────────────────

class CreateElementCommand implements Command {
  toolCall: ToolCall
  private createdStore?: TLayerStore
  private createdId?: string

  constructor(call: ToolCall) {
    this.toolCall = call
  }

  execute(context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult {
    const { element_type, label, ref_id } = this.toolCall.args
    const adapter = adapterRegistry[element_type]
    if (!adapter) {
      return { success: false, error: `No adapter for element type: ${element_type}` }
    }

    const store = adapter.createElement({ label, ...this.toolCall.args }, context)
    this.createdStore = store
    this.createdId = store.getState()._id

    const refKey = ref_id || label
    return { success: true, layerStore: store, elementRef: refKey }
  }

  undo(_context: EditorContext): void {
    if (this.createdId) {
      deleteLayerStoreById(this.createdId)
    }
  }
}

class SetCustomizationCommand implements Command {
  toolCall: ToolCall

  constructor(call: ToolCall) {
    this.toolCall = call
  }

  execute(_context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult {
    const { element_ref, type, label, label_on_storefront, display_style, values } = this.toolCall.args
    const store = createdElements.get(element_ref)
    if (!store) {
      return { success: false, error: `Element not found: ${element_ref}. Must create_element first.` }
    }

    const state = store.getState() as any
    const optionSets = state.optionSet || []

    const osType = CUSTOMIZATION_TO_OPTION_SET_TYPE[type] || type
    const slot = optionSets.find((os: { type: string; [key: string]: unknown }) => os.type === osType)
    if (!slot) {
      return { success: false, error: `No option set slot for type: ${type}` }
    }

    const dataKey = OPTION_SET_DATA_KEYS[osType] || 'values'

    // Build option values with UUIDs.
    const isFontOption = osType === 'font_option'
    type OptionValue = {
      name?: string
      family?: string
      src?: string
      svgString?: string
      fontSource?: string
      value?: string
      pricing?: number
      [key: string]: unknown
    }
    const builtValues = ((values as OptionValue[]) || []).map((v, i: number) => ({
      ...v,
      _id: uuid(),
      name: v.name,
      value: v.value || v.name,
      selecting: i === 0,
      ...(isFontOption
        ? { family: v.family || v.name, fontSource: v.fontSource || 'google', svgString: v.svgString || '' }
        : {}),
      ...(v.pricing !== null && v.pricing !== undefined && v.pricing > 0
        ? { additionalPricing: { value: v.pricing, flatRate: v.pricing } }
        : {}),
    }))

    // Update the option set via UPDATE_OPTION_SET dispatch
    const updatedOptionSet = {
      ...slot,
      label: label || slot.label,
      labelOnStoreFront: label_on_storefront || label || slot.labelOnStoreFront,
      data: {
        ...(slot.data || {}),
        [dataKey]: builtValues,
        ...(display_style ? { displayStyle: display_style } : {}),
      },
    }

    store.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: { optionSet: updatedOptionSet, fromOption: slot },
    })

    // Mark option set as active so the editor recognizes it has data
    store.dispatch({
      type: 'UPDATE_OPTION_SET_EDITING_STATE',
      payload: {
        optionSetType: osType,
        editingState: { newOptionSetPressed: true, existOptionSetPressed: false, editMode: true },
      },
    })

    return { success: true }
  }

  undo(_context: EditorContext): void {
    // Undo handled by removing the parent element (CreateElementCommand.undo)
  }
}

class SetSettingsCommand implements Command {
  toolCall: ToolCall
  private previousSettings?: Record<string, unknown>

  constructor(call: ToolCall) {
    this.toolCall = call
  }

  execute(_context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult {
    const { element_ref, settings } = this.toolCall.args
    const store = createdElements.get(element_ref)
    if (!store) {
      return { success: false, error: `Element not found: ${element_ref}` }
    }

    // Save previous settings for undo
    this.previousSettings = { ...(store.getState() as any).settings }

    // Map snake_case AI args → camelCase TailorKit settings
    const mappedSettings: Record<string, unknown> = {}
    if (settings.text_created_by !== undefined) mappedSettings.textCreatedBy = settings.text_created_by
    if (settings.storefront_label !== undefined) mappedSettings.storefrontLabel = settings.storefront_label
    if (settings.placeholder !== undefined) mappedSettings.placeholder = settings.placeholder
    if (settings.required !== undefined) mappedSettings.required = settings.required
    if (settings.character_limit !== undefined) mappedSettings.characterLimit = settings.character_limit
    if (settings.allow_multi_line_text !== undefined) mappedSettings.allowMultiLineText = settings.allow_multi_line_text
    if (settings.enable_buyer_image !== undefined) mappedSettings.enableBuyerImage = settings.enable_buyer_image
    if (settings.content !== undefined) mappedSettings.content = settings.content
    if (settings.font_family !== undefined) {
      mappedSettings.fontFamily = { family: settings.font_family, src: settings._resolved_font_src || '' }
    }
    if (settings.font_size !== undefined) mappedSettings.fontSize = settings.font_size
    if (settings.text_color !== undefined) mappedSettings.textColor = settings.text_color
    if (settings.text_align !== undefined) mappedSettings.textAlign = settings.text_align

    // Use UPDATE_LAYER to merge settings into layer state
    store.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { settings: { ...this.previousSettings, ...mappedSettings } } },
    })

    return { success: true }
  }

  undo(_context: EditorContext): void {
    // Undo handled by removing the parent element
  }
}

class RemoveElementCommand implements Command {
  toolCall: ToolCall

  constructor(call: ToolCall) {
    this.toolCall = call
  }

  execute(_context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult {
    const { element_ref } = this.toolCall.args
    const store = createdElements.get(element_ref)
    if (!store) {
      return { success: false, error: `Element not found: ${element_ref}` }
    }

    const id = store.getState()._id
    deleteLayerStoreById(id)
    createdElements.delete(element_ref)

    return { success: true }
  }

  undo(_context: EditorContext): void {
    // Cannot undo remove without storing the full layer state
    // For now, remove is typically not used in generate flows
  }
}
