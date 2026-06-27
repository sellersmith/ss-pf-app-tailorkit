import { createStore } from '~/libs/external-store'
import type { Reducer, Store } from '~/libs/external-store'
import type { LayerIntegration } from '~/types/integration'
import { DEFAULT_LAYER_INTEGRATION, IntegrationStore } from './integration'
import { getLayerIntegrationStoreById } from './layerIntegration'

type ViewLayerKey = string

function buildKey(params: { mockupId: string; viewId: string; layerId: string }): ViewLayerKey {
  const { mockupId, viewId, layerId } = params
  return `${mockupId}::${viewId}::${layerId}`
}

type Action = { type: 'SYNC_FROM_SOURCES'; payload: { state: LayerIntegration } } | { type: 'RESET_STATE' }

export type TViewLayerIntegrationStore = Store<LayerIntegration, Action>

const ViewLayerIntegrationStores = new Map<ViewLayerKey, TViewLayerIntegrationStore>()

const reducer: Reducer<LayerIntegration, Action> = (state, action) => {
  switch (action.type) {
    case 'SYNC_FROM_SOURCES': {
      return { ...state, ...action.payload.state }
    }
    case 'RESET_STATE':
      return { ...DEFAULT_LAYER_INTEGRATION }
    default:
      return state
  }
}

function computeEffectiveState(mockupId: string, viewId: string, base: LayerIntegration): LayerIntegration {
  const integration = IntegrationStore.getState()
  const variant = integration.variants.find(v => v.mockup._id === mockupId)
  const view = (variant?.mockup.views || []).find(v => v._id === viewId) as any
  const ov = (view?.overrides && (view.overrides as any)[base._id]) || {}

  return {
    ...base,
    ...(ov.width !== undefined ? { width: ov.width } : {}),
    ...(ov.height !== undefined ? { height: ov.height } : {}),
    ...(ov.x !== undefined ? { x: ov.x } : {}),
    ...(ov.y !== undefined ? { y: ov.y } : {}),
    ...(ov.rotation !== undefined ? { rotation: ov.rotation } : {}),
    ...(ov.visible !== undefined ? { visible: ov.visible } : {}),
    ...(ov.mask !== undefined ? { mask: ov.mask } : {}),
  }
}

export function getViewLayerIntegrationStoreByIds(
  mockupId: string,
  viewId: string,
  layerId: string
): TViewLayerIntegrationStore {
  const key = buildKey({ mockupId, viewId, layerId })
  const existed = ViewLayerIntegrationStores.get(key)
  if (existed) return existed

  const baseStore = getLayerIntegrationStoreById(layerId)
  const base = baseStore.getState()

  const initial = computeEffectiveState(mockupId, viewId, base)
  const store = createStore(reducer, initial)

  // Subscribe sources: base layer and integration overrides
  const sync = () => {
    const nextBase = baseStore.getState()
    const eff = computeEffectiveState(mockupId, viewId, nextBase)
    store.dispatch({ type: 'SYNC_FROM_SOURCES', payload: { state: eff } }, true, true)
  }

  baseStore.subscribe(() => sync())
  IntegrationStore.subscribe(() => sync())

  // Keep simple lifecycle; no explicit unsubscribe registry for now
  // Consumers live within the modal lifetime

  ViewLayerIntegrationStores.set(key, store)
  return store
}

export function getEnableClippingMaskForView(mockupId: string, viewId: string): boolean {
  const integration = IntegrationStore.getState()
  const variant = integration.variants.find(v => v.mockup._id === mockupId)
  const view = (variant?.mockup.views || []).find(v => v._id === viewId) as any
  return Boolean(view?.enableClippingMask)
}

/**
 * Clear all cached ViewLayerIntegrationStores.
 * This should be called during discard/reset to ensure fresh stores are created
 * when the Mockup view is next accessed.
 */
export function clearViewLayerIntegrationStores(): void {
  ViewLayerIntegrationStores.clear()
}
