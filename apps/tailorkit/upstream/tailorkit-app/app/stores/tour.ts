import { createStore } from '~/libs/external-store'

export type ITour = {
  active?: boolean
}

export interface ITours {
  [key: string]: ITour
}

type TourActionTypes = 'SET_TOUR' | 'RESET_TOUR'

interface TourAction<TourActionTypes> {
  type: TourActionTypes
  payload: {
    key: string
    active: boolean
  }
}

export const tourStore = createStore(tourStoreReducer, {})

function tourStoreReducer(state: ITours, action: TourAction<TourActionTypes>) {
  const payload = action.payload

  switch (action.type) {
    case 'SET_TOUR':
      return {
        ...state,
        [payload.key]: {
          active: payload.active,
        },
      }
    case 'RESET_TOUR':
      return {}
    default:
      return state
  }
}
