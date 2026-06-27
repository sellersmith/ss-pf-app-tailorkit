/**
 * Converts an ExecutionPlan into ToolCall[] for the client-side CommandPipeline.
 * set_conditional calls are appended AFTER all create/customize/settings calls
 * to ensure referenced elements exist when conditions are wired.
 */

import type { ExecutionPlan, PlanStep, OptionGroupPreview } from '../types'
import type { ToolCall } from '~/components/AIChat/element-tools/types'

/** Detect if values contain hex color codes (#RGB or #RRGGBB) */
function hasColorValues(values?: Array<{ value?: string | null }>): boolean {
  return !!values?.some(v => v.value && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v.value))
}

/** Map elementType → optionSetType for set_customization */
function resolveOptionSetType(elementType: string, step?: PlanStep): string {
  switch (elementType) {
    case 'imageless':
      // Auto-detect color swatches: if values contain hex codes, use color_option
      if (step && hasColorValues(step.values)) return 'color_option'
      return 'imageless_option'
    case 'text':
      return 'text_option'
    case 'image':
      return 'image_option'
    default:
      return 'imageless_option'
  }
}

/** Auto-detect display style when not specified by LLM */
function resolveDisplayStyle(step: PlanStep): string | undefined {
  if (step.elementType !== 'imageless') return undefined
  if (step.displayStyle) return step.displayStyle

  const count = step.values?.length || 0
  const isYesNo = count <= 2 && step.values?.some(v => /^(yes|no|add|include)/i.test(v.name.split(' ')[0]))
  if (isYesNo || count === 1) return 'imageless_checkbox'
  if (count <= 5) return 'imageless_swatch'
  return 'imageless_dropdown_list'
}

/** Sub-customization types that can be added to the SAME element (font/color on text) */
const SUB_CUSTOMIZATIONS = [
  { field: 'fontOptions' as const, type: 'font_option', defaultLabel: 'Font Style', displayStyle: 'font_swatch' },
  { field: 'colorOptions' as const, type: 'color_option', defaultLabel: 'Color', displayStyle: 'color_swatch' },
]

/** Convert an ExecutionPlan into ToolCall[] for CommandPipeline */
export function convertPlanToToolCalls(plan: ExecutionPlan): ToolCall[] {
  const calls: ToolCall[] = []

  for (const step of plan.steps) {
    const refId = step.id
    const isTextCustomer = step.elementType === 'text_customer'

    // 1. create_element
    calls.push({
      name: 'create_element',
      args: {
        element_type: step.elementType,
        label: step.label,
        ref_id: refId,
        ...(step.content !== null && step.content !== undefined ? { content: step.content } : {}),
        ...(step.fontFamily !== null && step.fontFamily !== undefined ? { font_family: step.fontFamily } : {}),
        ...(step.fontSize !== null && step.fontSize !== undefined ? { font_size: step.fontSize } : {}),
        ...(step.textColor !== null && step.textColor !== undefined ? { text_color: step.textColor } : {}),
        ...(step.textAlign !== null && step.textAlign !== undefined ? { text_align: step.textAlign } : {}),
      },
      stepId: refId,
    })

    // 2. set_customization (for non-text_customer elements with values)
    if (!isTextCustomer && step.values?.length) {
      const displayStyle = resolveDisplayStyle(step)
      calls.push({
        name: 'set_customization',
        stepId: refId,
        args: {
          element_ref: refId,
          type: resolveOptionSetType(step.elementType, step),
          label: step.label,
          label_on_storefront: step.label,
          ...(displayStyle ? { display_style: displayStyle } : {}),
          values: step.values.map(v => ({
            name: v.name,
            ...(v.value ? { value: v.value } : {}),
            ...(v.pricing !== null && v.pricing !== undefined && v.pricing > 0 ? { pricing: v.pricing } : {}),
          })),
        },
      })
    }

    // 3. set_settings (for text_customer elements)
    if (isTextCustomer) {
      calls.push({
        name: 'set_settings',
        stepId: refId,
        args: {
          element_ref: refId,
          settings: {
            text_created_by: 'customers',
            storefront_label: step.label,
            placeholder: step.settings?.placeholder || step.values?.[0]?.name || 'Enter your text',
            required: step.settings?.required ?? false,
            ...(step.settings?.characterLimit ? { character_limit: step.settings.characterLimit } : {}),
            ...(step.settings?.allowMultiLineText !== undefined
              ? { allow_multi_line_text: step.settings.allowMultiLineText }
              : {}),
          },
        },
      })
    }

    // 4. Sub-customizations (font/color option sets on the SAME element)
    for (const sub of SUB_CUSTOMIZATIONS) {
      const subValues = (step as any)[sub.field]
      if (subValues?.length) {
        calls.push({
          name: 'set_customization',
          stepId: refId,
          args: {
            element_ref: refId,
            type: sub.type,
            label: sub.defaultLabel,
            label_on_storefront: sub.defaultLabel,
            display_style: sub.displayStyle,
            values: subValues.map((v: any) => ({
              name: v.name,
              ...(v.value ? { value: v.value } : {}),
            })),
          },
        })
      }
    }
  }

  // 4. Wire conditional logic AFTER all elements are created
  for (const step of plan.steps) {
    if (step.condition) {
      calls.push({
        name: 'set_conditional',
        stepId: 'conditions',
        args: {
          source_ref: step.condition.dependsOnStep,
          target_ref: step.id,
          when_option: step.condition.whenValue,
          action: step.condition.action,
        },
      })
    }
  }

  return calls
}

/** Build OptionGroupPreview[] from an ExecutionPlan (for backward compat with existing preview card) */
export function buildPreviewFromPlan(plan: ExecutionPlan): OptionGroupPreview[] {
  return plan.steps.map(step => ({
    label: step.label,
    optionSetType:
      step.elementType === 'text_customer' ? 'text_customer' : resolveOptionSetType(step.elementType, step),
    displayStyle: step.elementType === 'text_customer' ? 'text_input' : resolveDisplayStyle(step) || '',
    layerType: step.elementType === 'text_customer' ? 'text' : step.elementType,
    values: (step.values || []).map(v => ({
      name: v.name,
      pricing: v.pricing,
      isDefault: false,
    })),
    ...((step as any).fontOptions?.length ? { fontOptions: (step as any).fontOptions.map((f: any) => f.name) } : {}),
    ...((step as any).colorOptions?.length ? { colorOptions: (step as any).colorOptions.map((c: any) => c.name) } : {}),
  }))
}
