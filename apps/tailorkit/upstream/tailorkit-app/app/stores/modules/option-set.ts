import type { Reducer, Store } from '~/libs/external-store'
import { createStore } from '~/libs/external-store'
import type { OptionSet } from '~/types/psd'

type Action =
  | { type: 'CREATE_OPTION_SET'; payload: { optionSet: OptionSet; _id: string } }
  | { type: 'UPDATE_OPTION_SET'; payload: { state: OptionSet } }
  | { type: 'DELETE_OPTION_SET' }

export const OptionSetStores = new Map()

export const DEFAULT_OPTION_SET_STORE = {}

export type TOptionSetStore = Store<OptionSet, Action>

const optionSetReducer: Reducer<OptionSet, Action> = (state, action) => {
  switch (action.type) {
    case 'CREATE_OPTION_SET': {
      const payload = action.payload

      return {
        ...state,
        [payload._id]: payload.optionSet,
      }
    }
    case 'UPDATE_OPTION_SET': {
      const payload = action.payload

      return {
        ...state,
        ...payload.state,
      }
    }
    case 'DELETE_OPTION_SET': {
      return {
        ...state,
      }
    }

    default:
      return state
  }
}

export function createOptionSetStore(optionSet: OptionSet): TOptionSetStore {
  const optionSetStore = createStore(optionSetReducer, { ...optionSet })
  OptionSetStores.set(optionSet._id, optionSetStore)

  return optionSetStore
}

export function getOptionSetStoreById(_id: string): TOptionSetStore | null {
  return OptionSetStores.get(_id)
}

function removeAllOptionSetStore() {
  OptionSetStores.clear()
}

export const OptionSetActions = {
  createOptionSetStore,
  getOptionSetStoreById,
  removeAllOptionSetStore,
}
