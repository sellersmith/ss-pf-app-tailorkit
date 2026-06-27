/**
 * Shared global styling utilities for applying CSS variables
 * Used by both admin preview and storefront
 *
 * KEEP IN SYNC WITH: app/shared/extensions/tailorkit-src/src/shared/utils/global-styling-variables.ts
 * (TypeScript path alias maps `extensions/tailorkit-src/src/*` to `app/shared/extensions/tailorkit-src/src/*`
 *  so the admin app imports from that copy, not this one. Both files must be kept identical.)
 */

// ============ Types ============

export interface ButtonStyleInput {
  backgroundColor?: string
  textColor?: string
  borderColor?: string
}

export interface ButtonsStyleInput {
  primary?: ButtonStyleInput
  secondary?: ButtonStyleInput
  borderRadius?: number
}

export interface OptionSetOptionInput {
  borderActiveColor?: string
  borderRadius?: number
}

export interface OptionSetLabelInput {
  color?: string
  size?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface OptionSetInput {
  option?: OptionSetOptionInput
  label?: OptionSetLabelInput
}

export interface HeadingInput {
  fontSize?: number
  color?: string
  style?: string[] | string // Admin uses string[], storefront uses string
}

export interface DividerInput {
  enabled?: boolean
  width?: number
  style?: string
  color?: string
}

export interface PersonalizationAreaInput {
  enabled?: boolean
  color?: string
  fontSize?: number
  style?: string[] | string // Admin uses string[], storefront uses string
  backgroundColor?: string
  borderRadius?: number
}

export interface BoxInput {
  backgroundEnabled?: boolean
  backgroundColor?: string
  borderEnabled?: boolean
  borderColor?: string
  borderStyle?: string
  borderWidth?: number
  borderRadius?: number
}

export interface GlobalStylingInput {
  optionSet?: OptionSetInput
  heading?: HeadingInput
  divider?: DividerInput
  personalizationArea?: PersonalizationAreaInput
  box?: BoxInput
  buttons?: ButtonsStyleInput
}

// ============ Defaults ============

export const DEFAULTS = {
  optionSet: {
    option: {
      borderActiveColor: '#0d0324',
      borderRadius: 8,
    },
    label: {
      color: '#303030',
      size: 13,
      bold: true,
      italic: false,
      underline: false,
    },
  },
  heading: {
    fontSize: 18,
    color: '#303030',
  },
  divider: {
    enabled: true,
    width: 1,
    style: 'solid',
    color: '#000000',
  },
  personalizationArea: {
    enabled: true,
    color: '#303030',
    fontSize: 13,
    backgroundColor: '#E3E3E3',
    borderRadius: 4,
  },
  box: {
    backgroundEnabled: true,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderEnabled: true,
    borderColor: '#000000',
    borderStyle: 'solid',
    borderWidth: 2,
    borderRadius: 8,
  },
  buttons: {
    primary: {
      backgroundColor: '#202223',
      textColor: '#fff',
      borderColor: '#202223',
    },
    secondary: {
      backgroundColor: '#fff',
      textColor: '#303030',
      borderColor: '#e3e3e3',
    },
    borderRadius: 8,
  },
} as const

// ============ Helpers ============

type SetVarFn = (name: string, value: string) => void

const containsStyle = (style: string[] | string | undefined, keyword: string): boolean => {
  if (!style) return false
  if (Array.isArray(style)) return style.includes(keyword)
  return typeof style === 'string' && style.toLowerCase().includes(keyword)
}

// ============ Apply Functions ============

export function applyOptionSetVariables(optionSet: OptionSetInput | undefined, setVar: SetVarFn): void {
  const option = optionSet?.option ?? {}
  const label = optionSet?.label ?? {}

  // Option border
  setVar(
    '--emtlkit-option-border-active-color',
    option.borderActiveColor ?? DEFAULTS.optionSet.option.borderActiveColor
  )
  setVar('--emtlkit-option-border-radius', `${option.borderRadius ?? DEFAULTS.optionSet.option.borderRadius}px`)

  // Label
  setVar('--emtlkit-option-label-color', label.color ?? DEFAULTS.optionSet.label.color)
  setVar('--emtlkit-option-label-size', `${label.size ?? DEFAULTS.optionSet.label.size}px`)
  setVar('--emtlkit-option-label-weight', label.bold ? '700' : '550')
  setVar('--emtlkit-option-label-font-style', label.italic ? 'italic' : 'normal')
  setVar('--emtlkit-option-label-decoration', label.underline ? 'underline' : 'none')
}

export function applyHeadingVariables(heading: HeadingInput | undefined, setVar: SetVarFn): void {
  const style = heading?.style

  setVar('--emtlkit-heading-font-size', `${heading?.fontSize ?? DEFAULTS.heading.fontSize}px`)
  setVar('--emtlkit-heading-color', heading?.color ?? DEFAULTS.heading.color)
  setVar('--emtlkit-heading-font-weight', containsStyle(style, 'bold') ? '700' : '500')
  setVar('--emtlkit-heading-font-style', containsStyle(style, 'italic') ? 'italic' : 'normal')
  setVar('--emtlkit-heading-text-decoration', containsStyle(style, 'underline') ? 'underline' : 'none')
}

export function applyDividerVariables(divider: DividerInput | undefined, setVar: SetVarFn): void {
  const enabled = divider?.enabled !== false

  setVar('--emtlkit-divider-width', enabled ? `${divider?.width ?? DEFAULTS.divider.width}px` : '0px')
  setVar('--emtlkit-divider-style', divider?.style ?? DEFAULTS.divider.style)
  setVar('--emtlkit-divider-color', divider?.color ?? DEFAULTS.divider.color)
}

export function applyPersonalizationAreaVariables(
  personalizationArea: PersonalizationAreaInput | undefined,
  setVar: SetVarFn
): void {
  const enabled = personalizationArea?.enabled !== false
  const style = personalizationArea?.style

  setVar('--emtlkit-personalization-area-display', enabled ? 'flex' : 'none')
  setVar('--emtlkit-personalization-area-font-color', personalizationArea?.color ?? DEFAULTS.personalizationArea.color)
  setVar(
    '--emtlkit-personalization-area-font-size',
    `${personalizationArea?.fontSize ?? DEFAULTS.personalizationArea.fontSize}px`
  )
  setVar('--emtlkit-personalization-area-font-weight', containsStyle(style, 'bold') ? '700' : '500')
  setVar('--emtlkit-personalization-area-font-style', containsStyle(style, 'italic') ? 'italic' : 'normal')
  setVar('--emtlkit-personalization-area-font-decoration', containsStyle(style, 'underline') ? 'underline' : 'none')
  setVar(
    '--emtlkit-personalization-area-background-color',
    personalizationArea?.backgroundColor ?? DEFAULTS.personalizationArea.backgroundColor
  )
  setVar(
    '--emtlkit-personalization-area-border-radius',
    `${personalizationArea?.borderRadius ?? DEFAULTS.personalizationArea.borderRadius}px`
  )
}

export function applyBoxVariables(box: BoxInput | undefined, setVar: SetVarFn): void {
  // backgroundEnabled/borderEnabled default to true for backward compatibility (existing stores without the field)
  const backgroundEnabled = box?.backgroundEnabled !== false
  const borderEnabled = box?.borderEnabled !== false

  const bgColor = box?.backgroundColor ?? DEFAULTS.box.backgroundColor
  // Modal uses --emtlkit-box-background-color: shows configured color when enabled, default white when disabled
  setVar('--emtlkit-box-background-color', backgroundEnabled ? bgColor : DEFAULTS.box.backgroundColor)
  // Inline box uses --emtlkit-inline-box-background-color: transparent when disabled
  setVar('--emtlkit-inline-box-background-color', backgroundEnabled ? bgColor : 'transparent')
  setVar('--emtlkit-box-border-color', box?.borderColor ?? DEFAULTS.box.borderColor)
  setVar('--emtlkit-box-border-style', box?.borderStyle ?? DEFAULTS.box.borderStyle)
  setVar('--emtlkit-box-border-width', borderEnabled ? `${box?.borderWidth ?? DEFAULTS.box.borderWidth}px` : '0px')
  setVar('--emtlkit-box-border-radius', `${box?.borderRadius ?? DEFAULTS.box.borderRadius}px`)
}

export function applyButtonStylingVariables(buttons: ButtonsStyleInput | undefined, setVar: SetVarFn): void {
  const primary = buttons?.primary ?? {}
  const secondary = buttons?.secondary ?? {}

  // Primary button
  setVar('--emtlkit-button-primary-bg', primary.backgroundColor ?? DEFAULTS.buttons.primary.backgroundColor)
  setVar('--emtlkit-button-primary-text', primary.textColor ?? DEFAULTS.buttons.primary.textColor)
  setVar('--emtlkit-button-primary-border', primary.borderColor ?? DEFAULTS.buttons.primary.borderColor)

  // Secondary button
  setVar('--emtlkit-button-secondary-bg', secondary.backgroundColor ?? DEFAULTS.buttons.secondary.backgroundColor)
  setVar('--emtlkit-button-secondary-text', secondary.textColor ?? DEFAULTS.buttons.secondary.textColor)
  setVar('--emtlkit-button-secondary-border', secondary.borderColor ?? DEFAULTS.buttons.secondary.borderColor)

  // Unified border radius
  setVar('--emtlkit-button-border-radius', `${buttons?.borderRadius ?? DEFAULTS.buttons.borderRadius}px`)
}

/**
 * Apply all global styling CSS variables
 */
export function applyAllGlobalStylingVariables(styling: GlobalStylingInput | undefined, setVar: SetVarFn): void {
  if (!styling) return

  applyOptionSetVariables(styling.optionSet, setVar)
  applyHeadingVariables(styling.heading, setVar)
  applyDividerVariables(styling.divider, setVar)
  applyPersonalizationAreaVariables(styling.personalizationArea, setVar)
  applyBoxVariables(styling.box, setVar)
  applyButtonStylingVariables(styling.buttons, setVar)
}
