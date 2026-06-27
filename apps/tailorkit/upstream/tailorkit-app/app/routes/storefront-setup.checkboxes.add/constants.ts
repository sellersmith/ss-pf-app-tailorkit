export const ADD_ACTIONS = {
  CREATE: 'create',
} as const

export type AddAction = (typeof ADD_ACTIONS)[keyof typeof ADD_ACTIONS]
