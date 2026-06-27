import { z } from 'zod'

/** Schema for a single option group parsed by the LLM */
export const ParsedOptionGroupSchema = z.object({
  name: z.string().describe('Display label for this option group'),
  layerType: z.enum(['text', 'text_customer', 'image', 'imageless']).describe('TailorKit layer type'),
  optionSetType: z
    .enum(['image_option', 'text_option', 'color_option', 'font_option', 'imageless_option'])
    .describe('TailorKit option set type'),
  displayStyle: z
    .string()
    .nullish()
    .describe('Display style: imageless_swatch, imageless_checkbox, imageless_dropdown_list'),
  values: z
    .array(
      z.object({
        name: z.string().describe('Display name for this value'),
        value: z.string().nullish().describe('Internal value (hex for colors, etc.)'),
        pricing: z.number().nullish().describe('Additional price in dollars (e.g. 5 for +$5)'),
      })
    )
    .describe('Option values'),
  isRequired: z.boolean().default(false).describe('Whether this option is required'),
})

export type ParsedOptionGroup = z.infer<typeof ParsedOptionGroupSchema>

/** Schema for the full LLM response */
export const ParsedOptionGroupsSchema = z.array(ParsedOptionGroupSchema)
