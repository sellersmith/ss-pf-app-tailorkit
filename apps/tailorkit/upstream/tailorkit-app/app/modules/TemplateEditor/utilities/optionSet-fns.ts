import type { TFunction } from 'i18next'
import { DISPLAY_STYLE_OPTIONS, DISPLAY_STYLE_OPTION_LIST } from '~/modules/TemplateEditor/elements/constants'
import type { DisplayStyleType } from '~/modules/TemplateEditor/elements/constants'
import type { EOptionSet, OptionSet } from '~/types/psd'

enum OptionSetErrorKeys {
  LABEL_STORE_FRONT,
  OPTION_SET_LABEL,
  OPTION_SET_DATA,
  OPTION_SET_DATA_OPTION,
  OPTION_SET_ITEM_NAME,
}

const getKeyError = (optionSet: OptionSet, key: OptionSetErrorKeys, itemId?: string) => {
  const { _id, type } = optionSet
  const str = `optionSet-${_id}`

  switch (key) {
    case OptionSetErrorKeys.LABEL_STORE_FRONT:
      return `${str}.storefrontLabel`
    case OptionSetErrorKeys.OPTION_SET_LABEL:
      return `${str}.optionSet.label`
    case OptionSetErrorKeys.OPTION_SET_DATA:
      return `${str}.optionSet_${type}.data`
    case OptionSetErrorKeys.OPTION_SET_DATA_OPTION:
      return `${str}.optionSet_${type}.data.option`
    case OptionSetErrorKeys.OPTION_SET_ITEM_NAME:
      return `${str}.optionSet_${type}.item-${itemId}.name`
    default:
      return ''
  }
}

const getErrorMessageByKey = (args: { keyOptionSetError: string; layerId: string }, context: any) => {
  const { validationErrors } = context
  const { keyOptionSetError, layerId } = args
  const keyError = `${layerId}-${keyOptionSetError}`
  return validationErrors[keyError]
}

/**
 * Display style utility functions
 */
const getDisplayStylesForOptionSet = (optionSetType: EOptionSet): readonly DisplayStyleType[] => {
  return DISPLAY_STYLE_OPTIONS[optionSetType as keyof typeof DISPLAY_STYLE_OPTIONS] || []
}

/**
 * OptionList utility functions for Shopify Polaris components
 */
const getDisplayStyleOptions = (optionSetType: EOptionSet, t: TFunction): { value: string; label: string }[] => {
  const options = DISPLAY_STYLE_OPTION_LIST[optionSetType as keyof typeof DISPLAY_STYLE_OPTION_LIST]

  return options.map(option => ({
    value: option.value,
    label: t(option.labelKey),
  }))
}

export { OptionSetErrorKeys, getKeyError, getErrorMessageByKey, getDisplayStylesForOptionSet, getDisplayStyleOptions }
