/**
 * Imageless element adapter — creates IMAGELESS layers for choice options
 * (radio/checkbox/dropdown: Metal Color, Chain Length, Gift Box, Priority, etc.)
 * Delegates to existing createImagelessElement. No geometry needed.
 */

import type { ElementAdapter, EditorContext } from '../types'
import type { TLayerStore } from '~/stores/modules/layer'
import { createImagelessElement } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'

export class ImagelessAdapter implements ElementAdapter {
  createElement(args: Record<string, any>, context: EditorContext): TLayerStore {
    const store = createImagelessElement({
      widthByPixels: context.canvasWidth,
      heightByPixels: context.canvasHeight,
      shopDomain: context.shopDomain,
      t: context.t as any,
      imagelessLayerCount: context.imagelessLayerCount,
    })

    // Override auto-generated label with AI-provided label
    if (args.label) {
      store.dispatch({ type: 'UPDATE_LAYER', payload: { state: { label: args.label } } })
    }

    return store
  }

  removeElement(_layerStore: TLayerStore): void {
    // Handled by pipeline (deleteLayerStoreById)
  }
}
