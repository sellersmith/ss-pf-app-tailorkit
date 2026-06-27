import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import type { TLayerStore } from '~/stores/modules/layer'
import type { OptionSet, TextDataOptionSet } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'

/**
 * Evaluate the text option set style case
 * @param textOptionSet
 * @param value
 * @returns
 */
export function evaluateTextOptionSetStyleCase(textOptionSet: OptionSet, value: string) {
  const optionSetDataKey = optionSetDataKeys[textOptionSet.type as keyof typeof optionSetDataKeys]
  textOptionSet.data[optionSetDataKey] = (textOptionSet.data[optionSetDataKey] as TextDataOptionSet['texts']).map(
    text => ({
      ...text,
      name: applyStyleCase(text.name, value),
    })
  )

  return textOptionSet
}

/**
 * Mutate the text option set style case
 * @param textOptionSet
 * @param layerStore
 * @param value
 */
export function mutateTextOptionSetStyleCase(textOptionSet: OptionSet, layerStore: TLayerStore, value: string) {
  // Mutate the text option set if existing
  if (textOptionSet && textOptionSet.data) {
    const mutatedTextOptionSet = evaluateTextOptionSetStyleCase(textOptionSet, value)

    // Update the text option set
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: mutatedTextOptionSet,
      },
    })
  }
}
