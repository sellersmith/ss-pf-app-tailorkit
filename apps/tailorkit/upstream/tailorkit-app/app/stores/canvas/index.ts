import { createStore } from '~/libs/external-store'

type SpriteContainer = {
  id: string | null
  dragging: boolean
}

type SpriteContainerStoreAction = 'MUTATE_SPRITE_CONTAINER' | 'CLEAR_SPRITE_CONTAINER'

interface SpriteContainerActions<T extends SpriteContainerStoreAction> {
  type: T
  payload?: any
}

export const SpriteContainerStore = createStore(spriteContainerStoreReducer, { id: null, dragging: false })

function spriteContainerStoreReducer(
  state: SpriteContainer,
  action: SpriteContainerActions<SpriteContainerStoreAction>
) {
  const payload = action.payload

  switch (action.type) {
    case 'MUTATE_SPRITE_CONTAINER':
      return {
        id: payload.id,
        dragging: payload.dragging,
      }

    case 'CLEAR_SPRITE_CONTAINER':
      return {
        id: null,
        dragging: false,
      }
    default:
      return state
  }
}

export const SpriteContainerActions = {
  mutateSpriteContainer: ({ id, dragging }: { id: string; dragging: boolean }) =>
    SpriteContainerStore.dispatch({ type: 'MUTATE_SPRITE_CONTAINER', payload: { id, dragging } }),

  clearSpriteContainer: () => SpriteContainerStore.dispatch({ type: 'CLEAR_SPRITE_CONTAINER' }),
}
