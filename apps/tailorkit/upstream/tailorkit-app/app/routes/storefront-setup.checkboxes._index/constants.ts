export const LIST_ACTIONS = {
  DELETE: 'delete',
  DUPLICATE: 'duplicate',
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',
} as const

export type ListAction = (typeof LIST_ACTIONS)[keyof typeof LIST_ACTIONS]

export const PAGE_SIZE = 20
