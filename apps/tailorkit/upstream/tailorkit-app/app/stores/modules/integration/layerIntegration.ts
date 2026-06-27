import { SAVE_BAR_ID } from '~/constants/save-bar'
import type { Store } from '~/libs/external-store'
import { createStore } from '~/libs/external-store'
import type { Step } from '~/libs/steps.client'
import { addSteps } from '~/libs/steps.client'
import type { LayerIntegration } from '~/types/integration'
import { stepCallback } from './fns'

type Trace = {
  skipTrace?: boolean
}

type Action =
  | { type: 'UPDATE_LAYER'; payload: { state: Partial<LayerIntegration> } }
  | { type: 'UPDATE_NAME'; payload: { name: string } }
  | {
      type: 'UPDATE_DIMENSION'
      payload: { width?: LayerIntegration['width']; height?: LayerIntegration['height'] }
    }
  | {
      type: 'UPDATE_TRANSFORMATION'
      payload: {
        width?: LayerIntegration['width']
        height?: LayerIntegration['height']
        x?: LayerIntegration['x']
        y?: LayerIntegration['y']
        rotation?: LayerIntegration['rotation']
      }
    }
  | {
      type: 'UPDATE_MASK'
      payload: {
        mask: {
          width: LayerIntegration['width']
          height: LayerIntegration['height']
          x: LayerIntegration['x']
          y: LayerIntegration['y']
          rotation: LayerIntegration['rotation']
        }
      }
    }
  | {
      type: 'UPDATE_DATA'
      payload: { data: LayerIntegration['data'] }
    }
  | { type: 'RESET_STATE' }

export const LayerIntegrationStores = new Map()

export type TLayerIntegrationStore = Store<LayerIntegration, Action & Trace>

export const DEFAULT_LAYER_INTEGRATION: LayerIntegration = {
  _id: '',
  layerId: '',
  name: '',
  x: 0,
  y: 0,
  width: 500,
  height: 500,
  rotation: 0,
  type: 'template',
  data: undefined,
  printAreaId: null,
  visible: true,
}

function layerIntegrationReducer(state: LayerIntegration, action: Action & Trace) {
  switch (action.type) {
    case 'UPDATE_DIMENSION': {
      const { width, height } = action.payload

      return {
        ...state,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      }
    }

    case 'UPDATE_NAME': {
      const { name } = action.payload

      return {
        ...state,
        name,
      }
    }

    case 'UPDATE_TRANSFORMATION': {
      const { width, height, rotation, x, y } = action.payload

      return {
        ...state,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
      }
    }

    case 'UPDATE_MASK': {
      const { mask } = action.payload

      return {
        ...state,
        mask,
      }
    }

    case 'UPDATE_DATA': {
      const { data } = action.payload

      return {
        ...state,
        data: {
          ...data,
        },
      }
    }

    case 'UPDATE_LAYER': {
      const { state: _updatedState } = action.payload

      // Only update properties in updated state that is changed and not overwritten other properties
      const updatedState = {
        ...state,
        ..._updatedState,
      }

      return updatedState
    }

    case 'RESET_STATE':
      return DEFAULT_LAYER_INTEGRATION

    default:
      return state
  }
}

function proxyLayerIntegrationReducer(state: LayerIntegration, action: Action & Trace) {
  const updatedState = layerIntegrationReducer(state, action)

  const skipTrace = action.skipTrace

  if (!skipTrace) {
    const step: Step = {
      type: 'UPDATE_LAYER_INTEGRATION',
      fromData: state,
      toData: updatedState,
      callback: (target: any, props: string | symbol, value: any) =>
        stepCallback(target, props, value, SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR),
    }

    addSteps(step)
  }

  return updatedState
}

export function createLayerIntegrationStore(layerIntegration: LayerIntegration): TLayerIntegrationStore {
  const layerIntegrationStore = createStore(proxyLayerIntegrationReducer, {
    ...DEFAULT_LAYER_INTEGRATION,
    ...layerIntegration,
  })

  LayerIntegrationStores.set(layerIntegration._id, layerIntegrationStore)

  return layerIntegrationStore
}

export function getLayerIntegrationStoreById(_id: string): TLayerIntegrationStore {
  return LayerIntegrationStores.get(_id)
}

export function deleteLayerIntegrationStoreById(_id: string) {
  return LayerIntegrationStores.delete(_id)
}

/**
 * Clear ALL layer integration stores from the Map.
 * This ensures no stale stores remain after discard/reset operations.
 */
export function clearAllLayerIntegrationStores(): void {
  LayerIntegrationStores.clear()
}
