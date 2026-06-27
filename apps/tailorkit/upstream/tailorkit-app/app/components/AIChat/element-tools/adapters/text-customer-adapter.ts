/**
 * Text customer adapter — creates TEXT layers for buyer text input (engraving).
 * Uses settings.textCreatedBy = 'customers'. No option set — storefront renders input field.
 * Delegates to createTextElement with proper geometry from canvas dimensions.
 */

import type { ElementAdapter, EditorContext } from '../types'
import type { TLayerStore } from '~/stores/modules/layer'
import { createTextElement } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import type { TextSettings } from '~/types/psd'
import { buildTextStylingFromArgs } from './text-styling-utils'

export class TextCustomerAdapter implements ElementAdapter {
  createElement(args: Record<string, any>, context: EditorContext): TLayerStore {
    const settings: Partial<TextSettings> = {
      textCreatedBy: 'customers',
      content: args.content || 'Enter text',
      storefrontLabel: args.label || 'Enter your text',
      placeholder: args.label || '',
      required: false,
      characterLimit: 50,
      allowMultiLineText: false,
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
