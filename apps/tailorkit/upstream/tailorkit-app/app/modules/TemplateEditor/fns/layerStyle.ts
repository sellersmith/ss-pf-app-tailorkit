import cloneDeep from 'lodash/cloneDeep'
import unset from 'lodash/unset'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '../constants'
import type { LayerDocument } from '~/models/Layer.server'
import type { TLayerStore } from '~/stores/modules/layer'

/**
 * Keys that should NOT be transferred when copying style between layers.
 * They are related to geometry, identity or hierarchy rather than visual style.
 */
const NON_STYLE_KEYS: (keyof LayerDocument | string)[] = [
  '_id',
  'left',
  'top',
  'type',
  'label',
  'image',
  'constrainProportions',
  'proportions',
  'parent',
  'children',
  'open',
  'locked',
  'visible',
  'optionSet',
  'optionSetEditingState',
  'mask',
  'isGroupLayer',
  'isStatic',
  'conditionalLogic',
  'settings.autoFitToContainer',
  'settings.characterLimit',
  'settings.content',
  'settings.generateTextWithAI',
  'settings.textCreatedBy',
  'settings.placeholder',
  'settings.required',
  'settings.storefrontLabel',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'shopDomain',
  'templateId',
]

export type TLayerStyle = Partial<LayerDocument>

/**
 * Extracts a visual–only style object from a full layer state.
 */
export function extractLayerStyle(layerState: LayerDocument): TLayerStyle {
  // Deep-clone the entire layer state first so we don’t mutate the original
  const style: TLayerStyle = cloneDeep(layerState)

  // Remove all keys (including nested paths) that are not part of the visual style
  NON_STYLE_KEYS.forEach(path => {
    unset(style as any, path)
  })

  return style
}

/**
 * Applies a previously extracted style object onto a layer store.
 */
export function applyStyleToLayer(layerStore: TLayerStore, style: TLayerStyle) {
  if (!style || Object.keys(style).length === 0) return

  layerStore.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: style,
    },
  })

  const { _id } = layerStore.getState()

  Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
    id: _id,
    elementData: layerStore.getState(),
  })
}

/**
 * Stores a style object in the clipboard. We add a custom guard key so we can
 * differentiate from normal element copy.
 */
export async function copyStyleToClipboard(style: TLayerStyle): Promise<boolean> {
  if (!style) return false

  try {
    const payload = JSON.stringify({ __tlkStyle__: true, data: style })
    await navigator.clipboard.writeText(payload)

    // Verify clipboard (may still fail if read permission denied)
    try {
      const verifyText = await navigator.clipboard.readText()
      if (verifyText === payload) {
        return true
      }
    } catch (_) {
      // Read permission denied – treat as failure for UX purposes
    }

    return false
  } catch (err) {
    // Clipboard might be unavailable (e.g. insecure context or permission denied)
    console.error('[TemplateEditor] Failed to write style to clipboard', err)
    return false
  }
}

/**
 * Reads clipboard and, if it contains a valid style object, returns it.
 */
export async function readStyleFromClipboard(): Promise<TLayerStyle | null> {
  try {
    const text = await navigator.clipboard.readText()
    const parsed = JSON.parse(text)

    if (parsed && parsed.__tlkStyle__ && parsed.data) {
      return parsed.data as TLayerStyle
    }
  } catch (err) {
    // Not a JSON payload or clipboard inaccessible – treat as miss.
  }

  return null
}
