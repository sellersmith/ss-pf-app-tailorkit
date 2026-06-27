import type { FORCE_UPDATE_ID } from '~/constants/force-update'
import { createStore } from '~/libs/external-store'

/**
 * This subscription stores force-update state
 * to serve some case that need update external component state
 */

export type IForceUpdate = {
  state: any
}

export type IForceUpdates = {
  [key in FORCE_UPDATE_ID]?: IForceUpdate
}

type ForceUpdateActionTypes = 'SET_FORCE_UPDATE' | 'RESET_FORCE_UPDATE'

interface ForceUpdateAction<T extends ForceUpdateActionTypes> {
  type: T
  payload?: any
}

export const forceUpdateStore = createStore(forceUpdateStoreReducer, {})

function forceUpdateStoreReducer(state: IForceUpdates, action: ForceUpdateAction<ForceUpdateActionTypes>) {
  const payload = action.payload

  switch (action.type) {
    case 'SET_FORCE_UPDATE':
      return {
        ...state,
        [payload.key]: {
          state: payload.value || {},
        },
      }

    case 'RESET_FORCE_UPDATE':
      return {
        ...state,
        [payload.key]: {
          state: undefined,
        },
      }

    default:
      return state
  }
}

export function setForceUpdate(key: FORCE_UPDATE_ID) {
  forceUpdateStore.dispatch({ type: 'SET_FORCE_UPDATE', payload: { key } })
}

export function resetForceUpdate(key: FORCE_UPDATE_ID) {
  forceUpdateStore.dispatch({ type: 'RESET_FORCE_UPDATE', payload: { key } })
}
