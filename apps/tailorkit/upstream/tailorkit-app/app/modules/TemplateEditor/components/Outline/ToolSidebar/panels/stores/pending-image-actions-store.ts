import { createStore } from '~/libs/external-store'
import type { ImagePostAddAction } from '../../../../Editor/utils/element-presets/types'

interface PendingImageActionsState {
  actions: ImagePostAddAction[] | null
}

type ActionType = 'SET_ACTIONS' | 'CONSUME_ACTIONS'

interface StoreAction {
  type: ActionType
  payload?: { actions: ImagePostAddAction[] | null }
}

function reducer(state: PendingImageActionsState, action: StoreAction): PendingImageActionsState {
  switch (action.type) {
    case 'SET_ACTIONS':
      return { actions: action.payload?.actions ?? null }
    case 'CONSUME_ACTIONS':
      return { actions: null }
    default:
      return state
  }
}

export const PendingImageActionsStore = createStore(reducer, { actions: null })

/** Store pending image post-add actions (called by Elements panel) */
export function setPendingImagePostAddActions(actions: ImagePostAddAction[] | null): void {
  PendingImageActionsStore.dispatch({ type: 'SET_ACTIONS', payload: { actions } })
}

/** Consume pending image post-add actions (called by ImageToolPanel after adding image) */
export function consumePendingImagePostAddActions(): ImagePostAddAction[] | null {
  const { actions } = PendingImageActionsStore.getState()
  PendingImageActionsStore.dispatch({ type: 'CONSUME_ACTIONS' })
  return actions
}
