import type { ActiveBottomSheet, BottomSheet } from './types'
import { createStore } from '~/libs/external-store'

export interface BottomSheetStore {
  root: string
  bottomSheets: Record<string, BottomSheet>
  active: Record<number, ActiveBottomSheet>
}

const DEFAULT_BOTTOM_SHEET_STORE: BottomSheetStore = {
  root: '',
  bottomSheets: {},
  active: {},
}

type Action =
  | {
      type: 'SET_BOTTOM_SHEET'
      payload: Partial<BottomSheetStore>
    }
  | {
      type: 'RESET_BOTTOM_SHEET'
    }

const reducer = (state: BottomSheetStore, action: Action) => {
  switch (action.type) {
    case 'SET_BOTTOM_SHEET': {
      return {
        ...state,
        ...action.payload,
      }
    }

    case 'RESET_BOTTOM_SHEET': {
      return DEFAULT_BOTTOM_SHEET_STORE
    }
  }
}

export const BottomSheetStore = createStore(reducer, DEFAULT_BOTTOM_SHEET_STORE)
