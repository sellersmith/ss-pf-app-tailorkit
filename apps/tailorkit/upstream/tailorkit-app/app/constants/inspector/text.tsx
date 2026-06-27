import { Icon } from '@shopify/polaris'
import { TextBoldIcon, TextItalicIcon, TextUnderlineIcon } from '@shopify/polaris-icons'
import { AlignCenterIcon, AlignRightIcon, AlignLeftIcon } from '~/assets/icons'

export const TEXT_ALIGNMENT_OPTIONS = [
  { value: 'left', label: AlignLeftIcon },
  { value: 'center', label: AlignCenterIcon },
  { value: 'right', label: AlignRightIcon },
  // {
  //   value: 'justify',
  //   label: (<span className={'Polaris-Icon'}>{PolarisTextJustify}</span>) as OptionButtonToggle['label'],
  // },
]

export const TEXT_STYLE_OPTIONS = [
  { value: 'bold', label: <Icon source={TextBoldIcon} /> },
  { value: 'italic', label: <Icon source={TextItalicIcon} /> },
  { value: 'underline', label: <Icon source={TextUnderlineIcon} /> },
]

export const DEFAULT_TEXT_COLOR = 'rgb(0, 0, 0)'
export const DEFAULT_TEXT_STROKE_COLOR = DEFAULT_TEXT_COLOR
export const DEFAULT_TEXT_FAMILY = {
  family: 'Abril Fatface',
  src: 'https://fonts.gstatic.com/s/abrilfatface/v23/zOL64pLDlL1D99S8g8PtiKchm-BsjOLhZBY.ttf',
}
export const DEFAULT_TEXT_STYLE_CASE = 'none'
export const DEFAULT_TEXT_GENERATE_TEXT_WITH_AI = {
  allow: true,
  settings: {
    color: 'rgba(4, 123, 93, 1)',
  },
}
export const DEFAULT_TEXT_EMOJI_PICKER: {
  enabled: boolean
  emojis: string
  font?: { family: string; src: string }
  allowFontUpload?: boolean
} = {
  enabled: false,
  emojis: '',
}
export const DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER = false
export const DEFAULT_TEXT_CHARACTER_LIMIT = 50
export const DEFAULT_TEXT_REQUIRED = false
export const DEFAULT_TEXT_PLACEHOLDER = ''
export const DEFAULT_TEXT_ALLOW_MULTI_LINE = false
export const DEFAULT_TEXT_ALIGNMENT = 'center'
export const DEFAULT_TEXT_LINE_HEIGHT = 1.2
export const DEFAULT_TEXT_LETTER_SPACING = 0
export const DEFAULT_TEXT_VERTICAL_ALIGN = 'middle'
export const DEFAULT_TEXT_CREATED_BY = 'merchant'
export const DEFAULT_TEXT_STROKE_WEIGHT = 0
export const DEFAULT_TEXT_STORE_FRONT_LABEL = 'Enter message'
export const DEFAULT_TEXT_CONTENT = 'Enter text'
export const DEFAULT_TEXT_STYLE = ''
export const DEFAULT_TEXT_WRAP_TEXT = 'none'

// Text Shape Constants
export const DEFAULT_TEXT_SHAPE = 'none'
export const DEFAULT_CURVE_PEAKS = 1
export const DEFAULT_CURVE_BEND = 50 // Percentage: -100% to 100%
export const DEFAULT_CIRCLE_START_ANGLE = Math.PI
export const DEFAULT_CIRCLE_END_ANGLE = 0

// Advanced Settings Constants
export const DEFAULT_HIDE_WHEN_PRINTING = false
export const DEFAULT_HIDE_WHEN_EMPTY = false
export const DEFAULT_SKIP_EFFECTS_WHEN_PRINTING = false
export const DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT = false
