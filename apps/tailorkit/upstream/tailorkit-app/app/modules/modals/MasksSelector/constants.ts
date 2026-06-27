import { PRE_MADE_MASK_OPTION_SET_RATIO } from '~/bootstrap/constants/mask-option-sets'

export const MASK_SOURCE = {
  PRE_MADE: 'pre-made',
  UPLOADED: 'uploaded',
}

export const MASK_SOURCE_LABEL = {
  [MASK_SOURCE.PRE_MADE]: 'pre-made-masks',
  [MASK_SOURCE.UPLOADED]: 'uploaded-masks',
}

export const MASK_SOURCE_OPTIONS = [
  { labelKey: MASK_SOURCE_LABEL[MASK_SOURCE.PRE_MADE], value: MASK_SOURCE.PRE_MADE },
  { labelKey: MASK_SOURCE_LABEL[MASK_SOURCE.UPLOADED], value: MASK_SOURCE.UPLOADED },
]

export const MASK_RATIO_OPTIONS = [
  ...Object.values(PRE_MADE_MASK_OPTION_SET_RATIO).map(ratio => ({
    labelKey: ratio.keyLabel,
    value: ratio.value,
  })),
  {
    labelKey: 'Custom masks',
    value: 'custom-masks',
  },
]
