import type { IOptionSetType } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import type { OptionSet } from '~/types/psd'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import { DEFAULT_DISPLAY_STYLES } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { getDefaultStorefrontLabel } from '~/modules/TemplateEditor/elements/fns'
import type { TFunction } from 'i18next'

export const getOptionSetFormatted = (optionSet: OptionSet, t: TFunction, defaultFont?: string): IOptionSetType => {
  const optionSetType = optionSet.type
  const optionSetDataKey = optionSetDataKeys[optionSetType as keyof typeof optionSetDataKeys]
  const optionSetData = optionSet.data as any
  const optionSetItems = optionSetData?.[optionSetDataKey] as any[]

  // Get the display style from the option set data or use the default
  const displayStyle
    = optionSetData?.displayStyle || DEFAULT_DISPLAY_STYLES[optionSetType as keyof typeof DEFAULT_DISPLAY_STYLES]
  const defaultStorefrontLabel = getDefaultStorefrontLabel({ t, type: optionSetType })

  return {
    i: optionSet._id,
    t: optionSet.type,
    l: optionSet.labelOnStoreFront || defaultStorefrontLabel,
    displayStyle,
    ol: optionSetItems.map((item: any) => ({
      i: item._id,
      // For image options, use compositedThumbnailSrc if available (pre-composited with SVG overlay)
      v: item.compositedThumbnailSrc || item.value || item.src || item.name,
      l: item.label || item.name,
      selecting: item.selecting || false,
      additionalPricing: item.additionalPricing,
      ...(optionSetType === EOptionSet.FONT_OPTION && { isDefault: false }), //{ item.family === defaultFont }),
    })),
  }
}
