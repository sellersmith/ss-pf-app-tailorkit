import { EOptionSet } from '~/types/psd'
import { DEFAULT_IMAGE_OPTION_SET_DATA } from './image'

const DEFAULT_LAYER_OPTION_SET_DATA = {
  [EOptionSet.IMAGE_OPTION]: DEFAULT_IMAGE_OPTION_SET_DATA,
  [EOptionSet.TEXT_OPTION]: null,
  [EOptionSet.COLOR_OPTION]: null,
  [EOptionSet.FONT_OPTION]: null,
  [EOptionSet.MULTI_LAYOUT_OPTION]: null,
  [EOptionSet.IMAGELESS_OPTION]: null,
  [EOptionSet.MASK_OPTION]: null,
}

/**
 * Display style types for different option sets
 */
enum EDisplayStyle {
  // Image option set display styles
  IMAGE_SWATCH = 'image_swatch',
  IMAGE_DROPDOWN_GRID = 'image_dropdown_grid',

  // Text option set display styles
  TEXT_VERTICAL_LIST = 'text_vertical_list',
  TEXT_DROPDOWN_LIST = 'text_dropdown_list',

  // Font option set display styles
  FONT_SWATCH = 'font_swatch',
  FONT_DROPDOWN_LIST = 'font_dropdown_list',

  // Color option set display styles
  COLOR_SWATCH = 'color_swatch',
  COLOR_DROPDOWN_LIST = 'color_dropdown_list',

  // Mask option set display styles (using same as image)
  MASK_SWATCH = 'mask_swatch',
  MASK_DROPDOWN_GRID = 'mask_dropdown_grid',

  // Imageless option set display styles
  IMAGELESS_SWATCH = 'imageless_swatch',
  IMAGELESS_DROPDOWN_LIST = 'imageless_dropdown_list',
  IMAGELESS_CHECKBOX = 'imageless_checkbox',

  // Multi-layout option set display styles
  MULTI_LAYOUT_SWATCH = 'multi_layout_swatch',
  MULTI_LAYOUT_DROPDOWN_LIST = 'multi_layout_dropdown_list',
}

/**
 * Display style options for each option set type
 */
const DISPLAY_STYLE_OPTIONS = {
  [EOptionSet.IMAGE_OPTION]: [EDisplayStyle.IMAGE_SWATCH, EDisplayStyle.IMAGE_DROPDOWN_GRID],
  [EOptionSet.TEXT_OPTION]: [EDisplayStyle.TEXT_VERTICAL_LIST, EDisplayStyle.TEXT_DROPDOWN_LIST],
  [EOptionSet.FONT_OPTION]: [EDisplayStyle.FONT_DROPDOWN_LIST, EDisplayStyle.FONT_SWATCH],
  [EOptionSet.COLOR_OPTION]: [EDisplayStyle.COLOR_SWATCH, EDisplayStyle.COLOR_DROPDOWN_LIST],
  [EOptionSet.MASK_OPTION]: [EDisplayStyle.MASK_SWATCH, EDisplayStyle.MASK_DROPDOWN_GRID],
  [EOptionSet.IMAGELESS_OPTION]: [
    EDisplayStyle.IMAGELESS_SWATCH,
    EDisplayStyle.IMAGELESS_DROPDOWN_LIST,
    EDisplayStyle.IMAGELESS_CHECKBOX,
  ],
  [EOptionSet.MULTI_LAYOUT_OPTION]: [EDisplayStyle.MULTI_LAYOUT_SWATCH, EDisplayStyle.MULTI_LAYOUT_DROPDOWN_LIST],
} as const

/**
 * Default display styles for each option set type
 * Visual types default to Swatch, text types default to Dropdown
 */
const DEFAULT_DISPLAY_STYLES = {
  [EOptionSet.IMAGE_OPTION]: EDisplayStyle.IMAGE_SWATCH,
  [EOptionSet.TEXT_OPTION]: EDisplayStyle.TEXT_VERTICAL_LIST,
  [EOptionSet.FONT_OPTION]: EDisplayStyle.FONT_DROPDOWN_LIST,
  [EOptionSet.COLOR_OPTION]: EDisplayStyle.COLOR_SWATCH,
  [EOptionSet.MASK_OPTION]: EDisplayStyle.MASK_SWATCH,
  [EOptionSet.IMAGELESS_OPTION]: EDisplayStyle.IMAGELESS_SWATCH,
  [EOptionSet.MULTI_LAYOUT_OPTION]: EDisplayStyle.MULTI_LAYOUT_SWATCH,
} as const

/**
 * Type definitions for display styles per option set
 */
type ImageDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.IMAGE_OPTION][number]
type TextDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.TEXT_OPTION][number]
type FontDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.FONT_OPTION][number]
type ColorDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.COLOR_OPTION][number]
type MaskDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.MASK_OPTION][number]
type ImagelessDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.IMAGELESS_OPTION][number]
type MultiLayoutDisplayStyle = (typeof DISPLAY_STYLE_OPTIONS)[EOptionSet.MULTI_LAYOUT_OPTION][number]

/**
 * Union type for all display styles
 */
type DisplayStyleType =
  | ImageDisplayStyle
  | TextDisplayStyle
  | FontDisplayStyle
  | ColorDisplayStyle
  | MaskDisplayStyle
  | ImagelessDisplayStyle
  | MultiLayoutDisplayStyle

/**
 * Display style configuration interface
 */
interface DisplayStyleConfig {
  displayStyle: DisplayStyleType
}

/**
 * Display style options formatted for Shopify Polaris OptionList component
 * Each option set type has its own array of {value, label} objects
 */
const DISPLAY_STYLE_OPTION_LIST = {
  [EOptionSet.IMAGE_OPTION]: [
    { value: EDisplayStyle.IMAGE_SWATCH, labelKey: 'swatch' },
    { value: EDisplayStyle.IMAGE_DROPDOWN_GRID, labelKey: 'dropdown' },
  ],
  [EOptionSet.TEXT_OPTION]: [
    { value: EDisplayStyle.TEXT_VERTICAL_LIST, labelKey: 'list' },
    { value: EDisplayStyle.TEXT_DROPDOWN_LIST, labelKey: 'dropdown' },
  ],
  [EOptionSet.FONT_OPTION]: [
    { value: EDisplayStyle.FONT_DROPDOWN_LIST, labelKey: 'dropdown' },
    { value: EDisplayStyle.FONT_SWATCH, labelKey: 'swatch' },
  ],
  [EOptionSet.COLOR_OPTION]: [
    { value: EDisplayStyle.COLOR_SWATCH, labelKey: 'swatch' },
    { value: EDisplayStyle.COLOR_DROPDOWN_LIST, labelKey: 'dropdown' },
  ],
  [EOptionSet.MASK_OPTION]: [
    { value: EDisplayStyle.MASK_SWATCH, labelKey: 'swatch' },
    { value: EDisplayStyle.MASK_DROPDOWN_GRID, labelKey: 'dropdown' },
  ],
  [EOptionSet.IMAGELESS_OPTION]: [
    { value: EDisplayStyle.IMAGELESS_SWATCH, labelKey: 'swatch' },
    { value: EDisplayStyle.IMAGELESS_DROPDOWN_LIST, labelKey: 'dropdown' },
    { value: EDisplayStyle.IMAGELESS_CHECKBOX, labelKey: 'checkbox' },
  ],
  [EOptionSet.MULTI_LAYOUT_OPTION]: [
    { value: EDisplayStyle.MULTI_LAYOUT_SWATCH, labelKey: 'swatch' },
    { value: EDisplayStyle.MULTI_LAYOUT_DROPDOWN_LIST, labelKey: 'dropdown' },
  ],
} as const

export type {
  ColorDisplayStyle,
  FontDisplayStyle,
  ImageDisplayStyle,
  ImagelessDisplayStyle,
  MaskDisplayStyle,
  MultiLayoutDisplayStyle,
  TextDisplayStyle,
  DisplayStyleConfig,
  DisplayStyleType,
}

export {
  EDisplayStyle,
  DEFAULT_LAYER_OPTION_SET_DATA,
  DISPLAY_STYLE_OPTIONS,
  DEFAULT_DISPLAY_STYLES,
  DISPLAY_STYLE_OPTION_LIST,
}
