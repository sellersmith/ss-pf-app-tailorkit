import { createStore } from '~/libs/external-store'

export type ISubInspector = {
  key: string
  data?: any
}

type SubInspectorActionTypes = 'OPEN_SUB_INSPECTOR_BY_KEY' | 'CLOSE_SUB_INSPECTOR' | 'UPDATE_DATA'

interface SubInspectorAction<T> {
  type: T
  payload?: any
}

export const SubInspectorStore = createStore(subInspectorStoreReducer, { key: '', data: null })

function subInspectorStoreReducer(state: ISubInspector, action: SubInspectorAction<SubInspectorActionTypes>) {
  const payload = action.payload

  switch (action.type) {
    case 'OPEN_SUB_INSPECTOR_BY_KEY':
      return {
        key: payload.key,
        data: payload.data,
      }
    case 'CLOSE_SUB_INSPECTOR':
      return {
        key: '',
        data: null,
      }
    case 'UPDATE_DATA':
      return {
        ...state,
        data: { ...state.data, ...payload },
      }
    default:
      return state
  }
}

function openSubInspector(key: string, data: any = null) {
  SubInspectorStore.dispatch({ type: 'OPEN_SUB_INSPECTOR_BY_KEY', payload: { key, data } })
}

function closeSubInspector() {
  SubInspectorStore.dispatch({ type: 'CLOSE_SUB_INSPECTOR' })
}

function updateData(data: any) {
  SubInspectorStore.dispatch({ type: 'UPDATE_DATA', payload: data })
}

export const subInspectorStoreActions = {
  openSubInspector,
  closeSubInspector,
  updateData,
}
