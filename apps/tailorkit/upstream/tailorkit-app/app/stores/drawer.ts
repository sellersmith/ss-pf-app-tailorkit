import { createStore } from '~/libs/external-store'

export type IDrawer = {
  active: boolean
  id: string | null
}

type DrawerActionTypes = 'OPEN_DRAWER' | 'CLOSE_DRAWER'

interface DrawerAction<T> {
  type: T
  payload?: any
}

export const DrawerStore = createStore(drawerStoreReducer, { active: false, id: null })

function drawerStoreReducer(state: IDrawer, action: DrawerAction<DrawerActionTypes>) {
  const payload = action.payload

  switch (action.type) {
    case 'OPEN_DRAWER':
      return {
        active: true,
        id: payload.id,
      }
    case 'CLOSE_DRAWER':
      return {
        active: false,
        id: null,
      }
    default:
      return state
  }
}

function openDrawer(id: string) {
  DrawerStore.dispatch({ type: 'OPEN_DRAWER', payload: { id } })
}

function closeDrawer() {
  DrawerStore.dispatch({ type: 'CLOSE_DRAWER' })
}

export const drawerStoreActions = {
  openDrawer,
  closeDrawer,
}
