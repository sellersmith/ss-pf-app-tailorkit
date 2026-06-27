export const EDIT_ACTIONS = {
  UPDATE: 'update',
  DELETE: 'delete',
} as const

export type EditAction = (typeof EDIT_ACTIONS)[keyof typeof EDIT_ACTIONS]
