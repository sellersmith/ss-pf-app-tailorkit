import { createStore } from '~/libs/external-store'

type Progress = {
  index: number
  total: number
}

type ProgressStoreAction = 'SET_PROGRESS' | 'CLEAR_PROGRESS'

interface ProgressActions<T extends ProgressStoreAction> {
  type: T
  payload?: any
}

export const ProgressStore = createStore(progressStoreReducer, { index: 0, total: 0 })

function progressStoreReducer(state: Progress, action: ProgressActions<ProgressStoreAction>) {
  const payload = action.payload

  switch (action.type) {
    case 'SET_PROGRESS':
      return {
        index: payload.index,
        total: payload.total,
      }

    case 'CLEAR_PROGRESS':
      return {
        index: 0,
        total: 0,
      }
    default:
      return state
  }
}

export const ProgressStoreActions = {
  setProgress: ({ index, total }: { index: number; total: number }) =>
    ProgressStore.dispatch({ type: 'SET_PROGRESS', payload: { index, total } }),

  clearProgress: () => ProgressStore.dispatch({ type: 'CLEAR_PROGRESS' }),
}
