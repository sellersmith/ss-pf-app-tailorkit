/**
 * Tool registry — maps tool names to JSON schemas + Zod validators.
 * Provides OpenAI function definitions for server-side function calling.
 */

import { z } from 'zod'
import type { ToolName } from './types'

/** Zod schema for create_element args */
export const CreateElementArgsSchema = z.object({
  element_type: z
    .enum(['text', 'text_customer', 'image', 'imageless'])
    .describe(
      'imageless=visual picker (swatch/radio/checkbox/dropdown), '
        + 'text_customer=buyer free text input, text=admin text presets, '
        + 'image=buyer photo upload'
    ),
  label: z.string().min(1).describe('Display label shown to customer on storefront'),
  ref_id: z
    .string()
    .optional()
    .describe('Reference ID for linking set_customization/set_settings/set_conditional calls to this element'),
  content: z.string().optional().describe('Default text content displayed on canvas (for text/text_customer elements)'),
  font_family: z.string().optional().describe('Google Font family name for text elements (e.g., "Pacifico", "Roboto")'),
  font_size: z.number().min(1).max(500).optional().describe('Font size in pixels for text elements (1-500)'),
  text_color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .optional()
    .describe('Text color as hex code (e.g., "#FF0000") for text elements'),
  text_align: z.enum(['left', 'center', 'right']).optional().describe('Horizontal text alignment for text elements'),
})

/** Zod schema for set_customization args */
export const SetCustomizationArgsSchema = z.object({
  element_ref: z.string().min(1).describe('ref_id of the element to configure'),
  type: z
    .string()
    .min(1)
    .describe('Customization type: imageless_option, text_option, font_option, color_option, image_buyer'),
  label: z.string().min(1).describe('Internal label for this customization'),
  label_on_storefront: z.string().optional().describe('Label shown on storefront (defaults to label if omitted)'),
  display_style: z
    .enum([
      'imageless_swatch',
      'imageless_checkbox',
      'imageless_dropdown_list',
      'font_swatch',
      'font_dropdown_list',
      'color_swatch',
      'color_dropdown_list',
    ])
    .optional()
    .describe('How options are displayed on storefront'),
  values: z
    .array(
      z.object({
        name: z.string().min(1).describe('Option value name shown to customer'),
        value: z.string().optional().describe('Internal value (defaults to name)'),
        pricing: z.number().optional().describe('Additional price in store currency (e.g. 5 for +$5)'),
      })
    )
    .describe('List of option values the customer can choose from'),
})

/** Zod schema for set_settings args */
export const SetSettingsArgsSchema = z.object({
  element_ref: z.string().min(1).describe('ref_id of the element to configure'),
  settings: z.object({
    text_created_by: z
      .enum(['customers', 'merchant'])
      .optional()
      .describe('Who provides the text: customers=buyer types on storefront, merchant=admin presets'),
    storefront_label: z.string().optional().describe('Label shown above the input on storefront'),
    placeholder: z.string().optional().describe('Placeholder text in the input field'),
    required: z.boolean().optional().describe('Whether this field must be filled before add-to-cart'),
    character_limit: z.number().optional().describe('Max characters allowed in text input'),
    allow_multi_line_text: z.boolean().optional().describe('Allow multi-line text input (textarea vs single-line)'),
    enable_buyer_image: z.boolean().optional().describe('Enable buyer image upload on this element'),
    content: z.string().optional().describe('Update default text content on canvas'),
    font_family: z.string().optional().describe('Google Font family name (e.g., "Pacifico", "Roboto")'),
    font_size: z.number().min(1).max(500).optional().describe('Font size in pixels (1-500)'),
    text_color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .optional()
      .describe('Text color as hex code (e.g., "#FF0000")'),
    text_align: z.enum(['left', 'center', 'right']).optional().describe('Horizontal text alignment'),
  }),
})

/** Zod schema for remove_element args */
export const RemoveElementArgsSchema = z.object({
  element_ref: z.string().min(1).describe('ref_id of the element to remove'),
})

/** Zod schema for set_conditional args */
export const SetConditionalArgsSchema = z.object({
  source_ref: z.string().min(1).describe('ref_id of the element whose option triggers the condition'),
  target_ref: z.string().min(1).describe('ref_id of the element to show/hide'),
  when_option: z
    .string()
    .min(1)
    .describe('Option value name that triggers the condition (e.g., "Yes", "Necklace Medium")'),
  action: z
    .enum(['show', 'hide'])
    .describe(
      'show = hidden by default, shown when condition met; hide = visible by default, hidden when condition met'
    ),
})

/** Schema map for validation */
const TOOL_SCHEMAS: Record<ToolName, z.ZodSchema> = {
  create_element: CreateElementArgsSchema,
  set_customization: SetCustomizationArgsSchema,
  set_settings: SetSettingsArgsSchema,
  remove_element: RemoveElementArgsSchema,
  set_conditional: SetConditionalArgsSchema,
}

/** Validate tool args against schema. Returns parsed args or error string. */
export function validateToolArgs(
  name: ToolName,
  args: unknown
): { success: true; data: any } | { success: false; error: string } {
  const schema = TOOL_SCHEMAS[name]
  if (!schema) return { success: false, error: `Unknown tool: ${name}` }

  const result = schema.safeParse(args)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error.issues.map(i => i.message).join(', ') }
}

/** OpenAI function definitions for server-side function calling */
export function getOpenAIFunctionDefs() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'create_element',
        description:
          'Create a new element on the template canvas. Use imageless for choice options (radio/checkbox/dropdown),'
          + ' text_customer for buyer text input (engraving), text for admin text presets, image for buyer photo upload.',
        parameters: {
          type: 'object',
          properties: {
            element_type: { type: 'string', enum: ['text', 'text_customer', 'image', 'imageless'] },
            label: { type: 'string', description: 'Display name for this element' },
            ref_id: {
              type: 'string',
              description: 'Reference ID for linking set_customization/set_settings calls to this element',
            },
            content: {
              type: 'string',
              description: 'Default text content displayed on canvas (for text/text_customer elements)',
            },
            font_family: {
              type: 'string',
              description: 'Google Font family name for text elements (e.g., "Pacifico", "Roboto")',
            },
            font_size: { type: 'number', description: 'Font size in pixels for text elements' },
            text_color: { type: 'string', description: 'Text color hex code (e.g., "#FF0000")' },
            text_align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Horizontal text alignment' },
          },
          required: ['element_type', 'label', 'ref_id'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'set_customization',
        description:
          'Configure a customization (option set) on an element. Includes values, display style, and pricing.',
        parameters: {
          type: 'object',
          properties: {
            element_ref: { type: 'string', description: 'ref_id of the element to configure' },
            type: {
              type: 'string',
              enum: [
                'imageless_option',
                'text_option',
                'font_option',
                'color_option',
                'image_buyer',
                'image_seller',
                'mask_option',
              ],
              description: 'Customization type',
            },
            label: { type: 'string' },
            label_on_storefront: { type: 'string' },
            display_style: {
              type: 'string',
              enum: [
                'imageless_swatch',
                'imageless_checkbox',
                'imageless_dropdown_list',
                'font_swatch',
                'font_dropdown_list',
                'color_swatch',
                'color_dropdown_list',
              ],
            },
            values: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string' },
                  pricing: { type: 'number', description: 'Additional price (e.g. 5 for +$5)' },
                },
                required: ['name'],
                additionalProperties: false,
              },
            },
          },
          required: ['element_ref', 'type', 'label', 'values'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'set_settings',
        description:
          'Apply layer settings to an element. Use for text_customer config (storefrontLabel, placeholder, required) or image uploader config.',
        parameters: {
          type: 'object',
          properties: {
            element_ref: { type: 'string', description: 'ref_id of the element' },
            settings: {
              type: 'object',
              properties: {
                text_created_by: { type: 'string', enum: ['customers', 'merchant'] },
                storefront_label: { type: 'string' },
                placeholder: { type: 'string' },
                required: { type: 'boolean' },
                character_limit: { type: 'number' },
                allow_multi_line_text: { type: 'boolean' },
                enable_buyer_image: { type: 'boolean' },
                content: { type: 'string', description: 'Update default text content on canvas' },
                font_family: { type: 'string', description: 'Google Font family name (e.g., "Pacifico")' },
                font_size: { type: 'number', description: 'Font size in pixels' },
                text_color: { type: 'string', description: 'Text color hex code (e.g., "#FF0000")' },
                text_align: { type: 'string', enum: ['left', 'center', 'right'] },
              },
              required: [],
              additionalProperties: false,
            },
          },
          required: ['element_ref', 'settings'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'remove_element',
        description: 'Remove an element from the template.',
        parameters: {
          type: 'object',
          properties: {
            element_ref: { type: 'string', description: 'ref_id of the element to remove' },
          },
          required: ['element_ref'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'set_conditional',
        description:
          'Wire conditional visibility between two elements. Target is shown or hidden based on option selection in source.',
        parameters: {
          type: 'object',
          properties: {
            source_ref: { type: 'string', description: 'ref_id of the source element' },
            target_ref: { type: 'string', description: 'ref_id of the target element' },
            when_option: { type: 'string', description: 'Option value name that triggers the condition' },
            action: { type: 'string', enum: ['show', 'hide'], description: 'show or hide target when condition met' },
          },
          required: ['source_ref', 'target_ref', 'when_option', 'action'],
          additionalProperties: false,
        },
      },
    },
  ]
}
