import type { TextOptionItem } from '../components/TextOptionSet/types'
import type { FontOptionItem } from '../components/FontOptionSet/types'
import type { ImageOptionItem } from '../components/ImageOptionSet/types'
import type { ColorOptionItem } from '../components/ColorOptionSet/types'

enum EOptionSet {
  IMAGE_OPTION = 'image_option',
  TEXT_OPTION = 'text_option',
  COLOR_OPTION = 'color_option',
  FONT_OPTION = 'font_option',
  MULTI_LAYOUT_OPTION = 'multi_layout_option',
  IMAGELESS_OPTION = 'imageless_option',
  SHAPE = 'shape',
  MASK_OPTION = 'mask_option',
}

/**
 * Default display styles for each option set type
 * Visual types default to Swatch, text types default to Dropdown
 */
const DEFAULT_DISPLAY_STYLES = {
  [EOptionSet.IMAGE_OPTION]: 'image_swatch',
  [EOptionSet.TEXT_OPTION]: 'text_vertical_list',
  [EOptionSet.FONT_OPTION]: 'font_dropdown_list',
  [EOptionSet.COLOR_OPTION]: 'color_swatch',
  [EOptionSet.MASK_OPTION]: 'mask_swatch',
  [EOptionSet.IMAGELESS_OPTION]: 'imageless_swatch',
  [EOptionSet.MULTI_LAYOUT_OPTION]: 'multi_layout_swatch',
} as const

const FILE_OPTION_TYPE = 'files'
const TEXT_OPTION_TYPE = 'texts'
const COLOR_OPTION_TYPE = 'colors'
const FONT_OPTION_TYPE = 'fonts'
const MULTI_LAYOUT_OPTION_TYPE = 'multi_layout'
const IMAGELESS_OPTION_TYPE = 'values'
const MASK_OPTION_TYPE = 'masks'

const optionSetDataKeys = {
  [EOptionSet.IMAGE_OPTION]: FILE_OPTION_TYPE,
  [EOptionSet.TEXT_OPTION]: TEXT_OPTION_TYPE,
  [EOptionSet.COLOR_OPTION]: COLOR_OPTION_TYPE,
  [EOptionSet.FONT_OPTION]: FONT_OPTION_TYPE,
  [EOptionSet.MULTI_LAYOUT_OPTION]: MULTI_LAYOUT_OPTION_TYPE,
  [EOptionSet.IMAGELESS_OPTION]: IMAGELESS_OPTION_TYPE,
  [EOptionSet.MASK_OPTION]: MASK_OPTION_TYPE,
}

interface IOptionSetType {
  i: string
  t: EOptionSet
  l: string
  displayStyle: string
  ol: TextOptionItem[] | FontOptionItem[] | ColorOptionItem[] | ImageOptionItem[]
  /** Colour Guide image URL (color_option only). Per-template wins over global. */
  cg?: string
  /** Colour Guide modal intro description (color_option only). */
  cd?: string
}

const tlkOptionSetClickEvent = 'tlk-option-set-click'

export type { IOptionSetType }
export { EOptionSet, DEFAULT_DISPLAY_STYLES, optionSetDataKeys, tlkOptionSetClickEvent }
