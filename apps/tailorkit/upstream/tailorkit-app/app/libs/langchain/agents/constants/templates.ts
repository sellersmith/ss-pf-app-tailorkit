import { TEMPLATE_INTENT_TYPES } from '../templates/constants/schema-enums'

const TEMPLATE_INTENT_TYPES_MAP = {
  template_create: 'template_create',
  template_edit: 'template_edit',
  layer_create: 'layer_create',
  layer_edit: 'layer_edit',
  layer_delete: 'layer_delete',
  option_set_create: 'option_set_create',
  option_set_edit: 'option_set_edit',
  option_set_delete: 'option_set_delete',
  general_template: 'general_template',
  unknown: 'unknown',
} as const

// Deprecated aliases removed; only canonical intent types are supported now.
export function normalizeTemplateIntentType(raw: string): (typeof TEMPLATE_INTENT_TYPES)[number] | 'unknown' {
  return (TEMPLATE_INTENT_TYPES as readonly string[]).includes(raw)
    ? (raw as (typeof TEMPLATE_INTENT_TYPES)[number])
    : 'unknown'
}

export { TEMPLATE_INTENT_TYPES, TEMPLATE_INTENT_TYPES_MAP }
