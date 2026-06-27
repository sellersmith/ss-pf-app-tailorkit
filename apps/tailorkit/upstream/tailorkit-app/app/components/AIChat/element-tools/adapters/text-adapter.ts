/**
 * Text adapter — creates TEXT layers for admin-defined text presets.
 * Uses text_option for predefined text choices (e.g., greeting messages).
 * Delegates to createTextElement with geometry from canvas.
 */

import type { ElementAdapter, EditorContext } from '../types'
import type { TLayerStore } from '~/stores/modules/layer'
import { createTextElement } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import type { TextSettings } from '~/types/psd'
import { buildTextStylingFromArgs } from './text-styling-utils'

export class TextAdapter implements ElementAdapter {
  createElement(args: Record<string, any>, context: EditorContext): TLayerStore {
    const settings: Partial<TextSettings> = {
      textCreatedBy: 'merchant',
      content: args.content || 'Enter text',
      ...buildTextStylingFromArgs(args),
    } as any

    const store = createTextElement(
      {
        widthByPixels: context.canvasWidth,
        heightByPixels: context.canvasHeight,
        shopDomain: context.shopDomain,
        t: context.t as any,
        textLayerCount: context.textLayerCount,
      },
      settings as TextSettings
    )

    if (args.label) {
      store.dispatch({ type: 'UPDATE_LAYER', payload: { state: { label: args.label } } })
    }

    return store
  }

  removeElement(_layerStore: TLayerStore): void {
    // Handled by pipeline
  }
}
