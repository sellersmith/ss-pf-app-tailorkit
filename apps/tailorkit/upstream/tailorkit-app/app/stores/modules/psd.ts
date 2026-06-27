import { createStore } from '~/libs/external-store'
import type { PSD } from '~/types/psd'

export type PSDs = {
  [key: string]: PSD | null
}

type Action = { type: 'ADD_PSD'; payload: { psdData: PSD | null; _id: string } } | { type: 'RESET_STATE' }

export const DEFAULT_PSDs_STORE: PSDs = {}

export const PSDsStore = createStore(psdsReducer, DEFAULT_PSDs_STORE)

function psdsReducer(state: PSDs, action: Action) {
  switch (action.type) {
    case 'ADD_PSD': {
      const payload = action.payload

      return {
        ...state,
        [payload._id]: payload.psdData,
      }
    }
    case 'RESET_STATE':
      return DEFAULT_PSDs_STORE
    default:
      return state
  }
}

function addPSD({ _id, psdData }: { _id: string; psdData: PSD | null }) {
  PSDsStore.dispatch({ type: 'ADD_PSD', payload: { _id, psdData } })
}

function resetPSDsStore() {
  PSDsStore.dispatch({ type: 'RESET_STATE' })
}

export const PSDsStoreActions = {
  addPSD,
  resetPSDsStore,
}
