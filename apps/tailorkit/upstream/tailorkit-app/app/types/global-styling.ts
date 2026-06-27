import type { TextStyleText } from './psd'

export type DisplayMode = 'inline' | 'modal_desktop' | 'modal_mobile'

export interface BoxStyle {
  backgroundEnabled: boolean // whether the background color is visible
  backgroundColor: string
  borderEnabled: boolean // whether the border is visible
  borderColor: string
  borderStyle: 'solid' | 'dashed'
  borderWidth: number // px, 1-10
  borderRadius: number // px, 0-30
}

export interface TextStyleConfig {
  text: string
  fontSize: number // px
  color: string
  style: TextStyleText[]
}

export interface DividerStyle {
  enabled: boolean
  color: string
  width: number // px, 1-10
  style: 'solid' | 'dashed'
}

export interface PersonalizationAreaStyle {
  enabled: boolean
  autoHideNameIfSingle: boolean
  color: string
  fontSize: number // px
  style: TextStyleText[]
  backgroundColor: string
  borderRadius: number // px, 0-30
}

export interface OptionSetLabelStyle {
  color: string
  size: number // px
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface OptionSetOptionStyle {
  borderActiveColor: string
  borderRadius: number // px
}

export interface OptionSetStyle {
  label: OptionSetLabelStyle
  option: OptionSetOptionStyle
}

export interface ButtonStyle {
  backgroundColor: string
  textColor: string
  borderColor: string
}

export interface ButtonsStyle {
  primary: ButtonStyle
  secondary: ButtonStyle
  borderRadius: number // px, 0-30 (unified for both buttons)
}

// OneTick checkbox styling
export interface CheckboxItemStyling {
  defaultBackground: string // Checkbox item container background (e.g., '#FFFFFF00')
  defaultBorder: string // Checkbox item container border (e.g., '#FFFFFF00')
}

// Personalize button styling for upsell checkbox addons
export interface PersonalizeButtonStyling {
  backgroundColor: string
  textColor: string
  borderColor: string
  borderRadius: number // px
  buttonText: string // default state text
  doneText: string // done state text
  doneBackgroundColor: string
  doneTextColor: string
  doneBorderColor: string
  doneBorderRadius: number // px
  paddingBlock: number // px — vertical padding
  paddingInline: number // px — horizontal padding
  donePaddingBlock: number // px
  donePaddingInline: number // px
}

export interface CheckboxGlobalStyling {
  checkboxType: string // Border radius: '0px' (square) or '50%' (circle)
  tickIcon: string // Checkmark color (e.g., '#FFFFFF')
  defaultBackground: string // Unchecked background color
  activeBackground: string // Checked background color
  defaultBorder: string // Unchecked border color
  activeBorder: string // Checked border color
  checkboxItem: CheckboxItemStyling
  imageSize: number // Product image size in pixels
  personalizeButton?: PersonalizeButtonStyling
}

export interface GlobalStyling {
  box: BoxStyle
  heading: TextStyleConfig
  divider: DividerStyle
  personalizationArea: PersonalizationAreaStyle
  optionSet: OptionSetStyle
  // Button styling (optional for backward compatibility)
  buttons?: ButtonsStyle
  // OneTick checkbox styling (optional for backward compatibility)
  checkbox?: CheckboxGlobalStyling
}

// Default button styling
export const defaultButtonsStyling: ButtonsStyle = {
  primary: {
    backgroundColor: 'rgb(32, 34, 35)',
    textColor: 'rgb(255, 255, 255)',
    borderColor: 'rgb(32, 34, 35)',
  },
  secondary: {
    backgroundColor: 'rgb(255, 255, 255)',
    textColor: 'rgb(48, 48, 48)',
    borderColor: 'rgb(227, 227, 227)',
  },
  borderRadius: 8,
}

// Default personalize button styling
export const defaultPersonalizeButtonStyling: PersonalizeButtonStyling = {
  backgroundColor: 'rgb(240, 245, 255)',
  textColor: 'rgb(0, 94, 194)',
  borderColor: 'rgb(0, 94, 194)',
  borderRadius: 4,
  buttonText: 'Personalize',
  doneText: 'Personalized',
  doneBackgroundColor: 'rgb(0, 94, 194)',
  doneTextColor: 'rgb(255, 255, 255)',
  doneBorderColor: 'rgb(0, 94, 194)',
  doneBorderRadius: 4,
  paddingBlock: 4,
  paddingInline: 8,
  donePaddingBlock: 4,
  donePaddingInline: 8,
}

// Default checkbox styling for OneTick
export const defaultCheckboxStyling: CheckboxGlobalStyling = {
  checkboxType: '0px',
  tickIcon: 'rgb(255, 255, 255)',
  defaultBackground: 'rgb(255, 255, 255)',
  activeBackground: 'rgb(0, 94, 194)',
  defaultBorder: 'rgb(138, 138, 138)',
  activeBorder: 'rgb(255, 255, 255)',
  checkboxItem: {
    defaultBackground: 'rgba(255, 255, 255, 0)',
    defaultBorder: 'rgb(0, 0, 0)',
  },
  imageSize: 40,
  personalizeButton: defaultPersonalizeButtonStyling,
}

export function createDefaultGlobalStyling(): GlobalStyling {
  return {
    box: {
      backgroundEnabled: true,
      backgroundColor: 'rgb(255, 255, 255)',
      borderEnabled: true,
      borderColor: 'rgb(0, 0, 0)',
      borderStyle: 'solid',
      borderWidth: 2,
      borderRadius: 8,
    },
    heading: {
      text: 'PERSONALIZED DESIGN',
      fontSize: 18,
      color: 'rgb(48, 48, 48)',
      style: ['bold'],
    },
    divider: {
      enabled: true,
      color: 'rgb(0, 0, 0)',
      width: 1,
      style: 'solid',
    },
    personalizationArea: {
      enabled: true,
      autoHideNameIfSingle: true,
      color: 'rgb(48, 48, 48)',
      fontSize: 13,
      style: [],
      backgroundColor: 'rgb(227, 227, 227)',
      borderRadius: 4,
    },
    optionSet: {
      label: {
        color: 'rgb(48, 48, 48)',
        size: 13,
        bold: true,
        italic: false,
        underline: false,
      },
      option: {
        borderRadius: 8,
        borderActiveColor: 'rgb(13, 3, 36)',
      },
    },
    buttons: defaultButtonsStyling,
    checkbox: defaultCheckboxStyling,
  }
}
