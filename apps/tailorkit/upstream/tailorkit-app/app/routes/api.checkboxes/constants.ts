export const CHECKBOX_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  DUPLICATE: 'duplicate',
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',
  GET_STYLING: 'get_styling',
  GET_ORDER_SETTING: 'get_order_setting',
  CHECK_VARIANT_INTEGRATION: 'check_variant_integration',
} as const

export type CheckboxAction = (typeof CHECKBOX_ACTIONS)[keyof typeof CHECKBOX_ACTIONS]
