/**
 * SetConditionalCommand — wires conditional visibility between two elements.
 * Sets conditionalLogic.controls on source + conditionalLogic.isControlledBy on target.
 */

import type { ToolCall, Command, CommandResult, EditorContext } from '../types'
import type { TLayerStore } from '~/stores/modules/layer'

/** Option set data key mapping for looking up values */
const OPTION_SET_DATA_KEYS: Record<string, string> = {
  imageless_option: 'values',
  text_option: 'texts',
  color_option: 'colors',
  font_option: 'fonts',
  image_option: 'files',
  mask_option: 'masks',
}

type OptionValue = { name?: string; _id?: string; [key: string]: unknown }

/** Find an option value by name across all option sets of a layer store */
function findOptionValueByName(store: TLayerStore, valueName: string): { _id: string } | null {
  const state = store.getState() as Record<string, unknown>
  const optionSets = (state.optionSet as Array<Record<string, unknown>>) || []

  for (const os of optionSets) {
    const dataKey = OPTION_SET_DATA_KEYS[os.type as string] || 'values'
    const values = ((os.data as Record<string, unknown>)?.[dataKey] as OptionValue[]) || []

    // Exact match first
    const exact = values.find((v: OptionValue) => v.name === valueName)
    if (exact?._id) return { _id: exact._id }

    // Case-insensitive fallback
    const caseInsensitive = values.find((v: OptionValue) => v.name?.toLowerCase() === valueName.toLowerCase())
    if (caseInsensitive?._id) return { _id: caseInsensitive._id }

    // Starts-with fallback (safer than includes — avoids "Gold" matching "Rose Gold")
    const startsWith = values.find((v: OptionValue) => v.name?.toLowerCase().startsWith(valueName.toLowerCase()))
    if (startsWith?._id) return { _id: startsWith._id }
  }
  return null
}

export class SetConditionalCommand implements Command {
  toolCall: ToolCall
  private sourceStore?: TLayerStore
  private targetStore?: TLayerStore
  private previousSourceConditionalLogic?: Record<string, unknown>
  private previousTargetConditionalLogic?: Record<string, unknown>

  constructor(call: ToolCall) {
    this.toolCall = call
  }

  execute(_context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult {
    const { source_ref, target_ref, when_option, action } = this.toolCall.args

    const sourceStore = createdElements.get(source_ref)
    if (!sourceStore) return { success: false, error: `Source element not found: ${source_ref}` }

    const targetStore = createdElements.get(target_ref)
    if (!targetStore) return { success: false, error: `Target element not found: ${target_ref}` }

    this.sourceStore = sourceStore
    this.targetStore = targetStore

    // Find option value ID by name
    const optionValue = findOptionValueByName(sourceStore, when_option)
    if (!optionValue) {
      return { success: false, error: `Option value "${when_option}" not found on source element "${source_ref}"` }
    }

    const srcState = sourceStore.getState() as Record<string, unknown>
    const tgtState = targetStore.getState() as Record<string, unknown>
    const sourceId = srcState._id as string
    const targetId = tgtState._id as string
    this.previousSourceConditionalLogic = srcState.conditionalLogic
      ? (JSON.parse(JSON.stringify(srcState.conditionalLogic)) as Record<string, unknown>)
      : undefined
    this.previousTargetConditionalLogic = tgtState.conditionalLogic
      ? (JSON.parse(JSON.stringify(tgtState.conditionalLogic)) as Record<string, unknown>)
      : undefined

    type Condition = { ifOptionSelected: string; thenShowOrHideLayers: string[]; [key: string]: unknown }

    // Build condition entry
    const newCondition: Condition = { ifOptionSelected: optionValue._id, thenShowOrHideLayers: [targetId] }

    // Update SOURCE: set controls with action + conditions
    const srcLogic = (srcState.conditionalLogic as Record<string, unknown>) || {}
    const srcControls = srcLogic.controls as { conditions?: Condition[] } | undefined
    const existingConditions: Condition[] = srcControls?.conditions || []

    // Merge: if condition for same option exists, append target. Otherwise add new.
    const existingIdx = existingConditions.findIndex((c: Condition) => c.ifOptionSelected === optionValue._id)
    let nextConditions: Condition[]
    if (existingIdx >= 0) {
      nextConditions = existingConditions.map((c: Condition, i: number) =>
        i === existingIdx ? { ...c, thenShowOrHideLayers: [...new Set([...c.thenShowOrHideLayers, targetId])] } : c
      )
    } else {
      nextConditions = [...existingConditions, newCondition]
    }

    sourceStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: {
          conditionalLogic: {
            ...srcLogic,
            controls: { action, conditions: nextConditions },
            isControlledBy: (srcLogic.isControlledBy as string[]) || ([] as string[]),
          },
        } as any,
      },
    })

    // Update TARGET: add source to isControlledBy
    const tgtLogic = (tgtState.conditionalLogic as Record<string, unknown>) || {}
    const existingControlledBy: string[] = (tgtLogic.isControlledBy as string[]) || []

    targetStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: {
          conditionalLogic: {
            ...tgtLogic,
            controls: tgtLogic.controls || ({ conditions: [] } as any),
            isControlledBy: [...new Set([...existingControlledBy, sourceId])],
          },
        } as any,
      },
    })

    return { success: true }
  }

  undo(_context: EditorContext): void {
    if (this.sourceStore) {
      this.sourceStore.dispatch({
        type: 'UPDATE_LAYER',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: { state: { conditionalLogic: this.previousSourceConditionalLogic || {} } as any },
      })
    }
    if (this.targetStore) {
      this.targetStore.dispatch({
        type: 'UPDATE_LAYER',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: { state: { conditionalLogic: this.previousTargetConditionalLogic || {} } as any },
      })
    }
  }
}
