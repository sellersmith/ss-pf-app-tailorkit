/**
 * /generate-options skill handler — Planning-aware version.
 *
 * Uses structured output to produce an ExecutionPlan with steps + conditions.
 * Falls back to flat parsing if plan generation fails (graceful degradation).
 *
 * Architecture: Server produces WHAT (ExecutionPlan → ToolCallBatch) via LLM.
 *               Client executes HOW via CommandPipeline + ElementAdapters.
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { BASE_AGENT_MODEL } from '~/libs/langchain/constant'
import type { SkillHandler, OptionGroupPreview, ExecutionPlan } from '../types'
import type { ToolCall } from '~/components/AIChat/element-tools/types'
import { ParsedOptionGroupsSchema, type ParsedOptionGroup } from './schemas'
import {
  PLANNING_SYSTEM_PROMPT,
  PLANNING_FEW_SHOT_EXAMPLES,
  GENERATE_OPTIONS_SYSTEM_PROMPT,
  GENERATE_OPTIONS_FEW_SHOT_EXAMPLES,
} from './generate-options-prompt'
import { EXECUTION_PLAN_JSON_SCHEMA, ExecutionPlanSchema } from './plan-schemas'
import { convertPlanToToolCalls, buildPreviewFromPlan } from './plan-converter'
import { buildCapabilityContext } from './capability-context'

const MAX_SPEC_CHARS = 2000
const MAX_PLAN_STEPS = 15

// ── Planning-aware parsing ──────────────────────────────────────────

/** Parse spec into ExecutionPlan via structured output with capability context */
async function parsePlan(specText: string): Promise<ExecutionPlan> {
  const capabilityContext = buildCapabilityContext()
  const fullPrompt = `${PLANNING_SYSTEM_PROMPT}\n\n${capabilityContext}`

  const chat = new ChatOpenAI({
    modelName: BASE_AGENT_MODEL,
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    maxTokens: 4096,
    modelKwargs: {
      response_format: { type: 'json_schema', json_schema: EXECUTION_PLAN_JSON_SCHEMA },
    },
  })

  const messages = [
    new SystemMessage(fullPrompt),
    ...PLANNING_FEW_SHOT_EXAMPLES.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(specText),
  ]

  const response = await chat.invoke(messages)
  const content = typeof response.content === 'string' ? response.content : ''
  const parsed = JSON.parse(content)
  const validated = ExecutionPlanSchema.parse(parsed)
  return validated as ExecutionPlan
}

// ── Legacy flat parsing (fallback) ──────────────────────────────────

/** Parse spec into flat option groups (pre-planning format) */
async function parseSpecFlat(specText: string): Promise<ParsedOptionGroup[]> {
  const chat = new ChatOpenAI({
    modelName: BASE_AGENT_MODEL,
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    maxTokens: 4096,
    modelKwargs: {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'option_groups',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    layerType: { type: 'string', enum: ['text', 'text_customer', 'image', 'imageless'] },
                    optionSetType: {
                      type: 'string',
                      enum: ['image_option', 'text_option', 'color_option', 'font_option', 'imageless_option'],
                    },
                    displayStyle: { type: ['string', 'null'] },
                    values: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          value: { type: ['string', 'null'] },
                          pricing: { type: ['number', 'null'] },
                        },
                        required: ['name', 'value', 'pricing'],
                        additionalProperties: false,
                      },
                    },
                    isRequired: { type: 'boolean' },
                  },
                  required: ['name', 'layerType', 'optionSetType', 'displayStyle', 'values', 'isRequired'],
                  additionalProperties: false,
                },
              },
            },
            required: ['groups'],
            additionalProperties: false,
          },
        },
      },
    },
  })

  const messages = [
    new SystemMessage(GENERATE_OPTIONS_SYSTEM_PROMPT),
    ...GENERATE_OPTIONS_FEW_SHOT_EXAMPLES.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(specText),
  ]

  const response = await chat.invoke(messages)
  const content = typeof response.content === 'string' ? response.content : ''
  const parsed = JSON.parse(content)
  return ParsedOptionGroupsSchema.parse(parsed.groups || parsed)
}

/** Auto-detect display style for imageless options (flat mode) */
function resolveDisplayStyle(group: ParsedOptionGroup): string | undefined {
  if (group.optionSetType !== 'imageless_option') return undefined
  if (group.displayStyle) return group.displayStyle
  const count = group.values.length
  const isYesNo = count <= 2 && group.values.some(v => /^(yes|no|add|include)/i.test(v.name.split(' ')[0]))
  if (isYesNo || count === 1) return 'imageless_checkbox'
  if (count <= 5) return 'imageless_swatch'
  return 'imageless_dropdown_list'
}

/** Convert flat groups → ToolCall[] (legacy path) */
function convertFlatToToolCalls(groups: ParsedOptionGroup[]): ToolCall[] {
  const calls: ToolCall[] = []
  for (const group of groups) {
    const refId = group.name
    const isTextCustomer = group.layerType === 'text_customer'
    const elementType = isTextCustomer ? 'text_customer' : group.layerType
    calls.push({ name: 'create_element', args: { element_type: elementType, label: group.name, ref_id: refId } })
    if (!isTextCustomer) {
      const displayStyle = resolveDisplayStyle(group)
      calls.push({
        name: 'set_customization',
        args: {
          element_ref: refId,
          type: group.optionSetType,
          label: group.name,
          label_on_storefront: group.name,
          ...(displayStyle ? { display_style: displayStyle } : {}),
          values: group.values.map(v => ({
            name: v.name,
            ...(v.value ? { value: v.value } : {}),
            ...(v.pricing !== null && v.pricing > 0 ? { pricing: v.pricing } : {}),
          })),
        },
      })
    }
    if (isTextCustomer) {
      calls.push({
        name: 'set_settings',
        args: {
          element_ref: refId,
          settings: {
            text_created_by: 'customers',
            storefront_label: group.name,
            placeholder: group.values?.[0]?.name || 'Enter your text',
            required: group.isRequired,
          },
        },
      })
    }
  }
  return calls
}

/** Build preview from flat groups (legacy path) */
function buildFlatPreview(groups: ParsedOptionGroup[]): OptionGroupPreview[] {
  return groups.map(g => ({
    label: g.name,
    optionSetType: g.layerType === 'text_customer' ? 'text_customer' : g.optionSetType,
    displayStyle: g.layerType === 'text_customer' ? 'text_input' : resolveDisplayStyle(g) || '',
    layerType: g.layerType === 'text_customer' ? 'text' : g.layerType,
    values: g.values.map(v => ({ name: v.name, pricing: v.pricing, isDefault: false })),
  }))
}

// ── Handler ──────────────────────────────────────────────────────────

const handler: SkillHandler = async (input, _context, onStatus) => {
  if (!input.trim()) {
    return {
      success: false,
      error:
        'Please describe what customization options you want. Example: "/customize Add text engraving and color selection"',
    }
  }
  if (input.length > MAX_SPEC_CHARS) {
    return {
      success: false,
      error: `Specification text is too long (${input.length} chars). Please keep it under ${MAX_SPEC_CHARS} characters.`,
    }
  }

  // Try planning-aware path first, fall back to flat parsing
  try {
    onStatus?.('analyzing-your-specification')
    const plan = await parsePlan(input)

    if (plan.steps.length === 0) {
      return {
        success: false,
        error: 'Could not parse any option groups from the specification. Please try rephrasing.',
      }
    }
    if (plan.steps.length > MAX_PLAN_STEPS) {
      return {
        success: false,
        error:
          `Plan has ${plan.steps.length} steps (max ${MAX_PLAN_STEPS}). `
          + `Please split your specification into smaller groups.`,
      }
    }

    onStatus?.('building-element-preview')
    const toolCalls = convertPlanToToolCalls(plan)
    // Note: font resolution (name→URL) happens in openai-tool-defs.server.ts
    // to guarantee server-side execution with Node.js fs access.
    const preview = buildPreviewFromPlan(plan)

    return {
      success: true,
      plan,
      preview,
      data: { toolCallBatch: { calls: toolCalls, skill: 'customize' } },
    }
  } catch (planError: any) {
    console.warn('[generate-options] Plan parsing failed, falling back to flat mode:', planError.message)

    // Fallback to flat parsing (pre-planning behavior)
    try {
      onStatus?.('analyzing-your-specification')
      const groups = await parseSpecFlat(input)

      if (groups.length === 0) {
        return {
          success: false,
          error: 'Could not parse any option groups from the specification. Please try rephrasing.',
        }
      }

      onStatus?.('building-element-preview')
      const toolCalls = convertFlatToToolCalls(groups.slice(0, 20))
      const preview = buildFlatPreview(groups.slice(0, 20))

      return {
        success: true,
        preview,
        data: { toolCallBatch: { calls: toolCalls, skill: 'customize' } },
      }
    } catch (flatError: any) {
      console.error('[generate-options] Both plan and flat parsing failed:', flatError.message)
      if (flatError.name === 'ZodError') {
        return {
          success: false,
          error: 'The AI parsed the specification but the output format was invalid. Please try rephrasing.',
        }
      }
      return { success: false, error: `Failed to generate options: ${flatError.message || 'Unknown error'}` }
    }
  }
}

export default handler
