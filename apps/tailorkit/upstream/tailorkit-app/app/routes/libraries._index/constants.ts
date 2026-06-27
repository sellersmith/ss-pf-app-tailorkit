import { ColorIcon, ImagesIcon, SkeletonIcon, TextFontListIcon, TextIcon } from '@shopify/polaris-icons'
import { EOptionSet } from '~/types/psd'
import { TEMPLATE_TYPE } from '../api.templates/constants'
import { CLIPART_SOURCE_LABEL } from '~/modules/modals/ClipartsSelector/constants'

type IOptionSetOption = {
  labelKey: string
  value: string
}

export const OPTION_SETS_OPTIONS: IOptionSetOption[] = [
  {
    labelKey: 'color-option-set',
    value: EOptionSet.COLOR_OPTION,
  },
  {
    labelKey: 'image-option-set',
    value: EOptionSet.IMAGE_OPTION,
  },
  {
    labelKey: 'text-option-set',
    value: EOptionSet.TEXT_OPTION,
  },
  {
    labelKey: 'font-option-set',
    value: EOptionSet.FONT_OPTION,
  },
  {
    labelKey: 'mask-option-set',
    value: EOptionSet.MASK_OPTION,
  },
]

// Type-safe dictionary object for
export const OPTION_SET_TYPE_FORMATTED: Record<EOptionSet & any, string> = {
  color_option: 'color',
  image_option: 'image',
  text_option: 'text',
  font_option: 'font',
  mask_option: 'mask',
  [TEMPLATE_TYPE.CLIPART]: CLIPART_SOURCE_LABEL[TEMPLATE_TYPE.CLIPART],
  [TEMPLATE_TYPE.PREMADE_TEMPLATE]: CLIPART_SOURCE_LABEL[TEMPLATE_TYPE.PREMADE_TEMPLATE],
}

export const THUMBNAILS_OPTION_SET: { [key: string]: any } = {
  color_option: ColorIcon,
  image_option: ImagesIcon,
  text_option: TextIcon,
  font_option: TextFontListIcon,
  mask_option: SkeletonIcon,
}
