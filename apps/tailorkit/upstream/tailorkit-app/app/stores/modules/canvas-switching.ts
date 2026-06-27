import { createStore, useStore } from '~/libs/external-store'

type CanvasSwitchingState = {
  switchingToPrintAreaId: string | null
}

type CanvasSwitchingAction = { type: 'SET_SWITCHING_TO_PRINT_AREA_ID'; payload: { printAreaId: string | null } }

const initialState: CanvasSwitchingState = {
  switchingToPrintAreaId: null,
}

function canvasSwitchingReducer(state: CanvasSwitchingState, action: CanvasSwitchingAction): CanvasSwitchingState {
  switch (action.type) {
    case 'SET_SWITCHING_TO_PRINT_AREA_ID':
      return {
        ...state,
        switchingToPrintAreaId: action.payload.printAreaId,
      }
    default:
      return state
  }
}

export const CanvasSwitchingStore = createStore(canvasSwitchingReducer, initialState)

export function setSwitchingToPrintAreaId(printAreaId: string | null) {
  CanvasSwitchingStore.dispatch({
    type: 'SET_SWITCHING_TO_PRINT_AREA_ID',
    payload: { printAreaId },
  })
}

export function getSwitchingState(): CanvasSwitchingState {
  return CanvasSwitchingStore.getState()
}

export function useCanvasSwitching() {
  return useStore(CanvasSwitchingStore, state => state.switchingToPrintAreaId)
}
