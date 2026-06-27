export const FONT_SOURCE = {
  GOOGLE: 'google',
  CUSTOM: 'custom',
}

export const FONT_SOURCE_LABEL = {
  [FONT_SOURCE.GOOGLE]: 'google-fonts',
  [FONT_SOURCE.CUSTOM]: 'custom-fonts',
}

export const FONT_SOURCE_OPTIONS = [
  { labelKey: FONT_SOURCE_LABEL[FONT_SOURCE.GOOGLE], value: FONT_SOURCE.GOOGLE },
  { labelKey: FONT_SOURCE_LABEL[FONT_SOURCE.CUSTOM], value: FONT_SOURCE.CUSTOM },
]
